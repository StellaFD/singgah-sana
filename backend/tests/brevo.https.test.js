const { app, request, createUser, auth } = require('./helpers');
const crypto = require('crypto');
const User = require('../src/models/User');
const Session = require('../src/models/Session');
const { sendTransactionalMail, sendPasswordResetEmail } = require('../src/services/emailService');

describe('Tahap 3: Brevo HTTPS Email & Password Reset Lifecycle', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.BREVO_API_KEY;
  });

  it('rejects sending when email service is unconfigured', async () => {
    const origKey = process.env.BREVO_API_KEY;
    const origUser = process.env.BREVO_SMTP_USER;
    const origPass = process.env.BREVO_SMTP_KEY;
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_SMTP_USER;
    delete process.env.BREVO_SMTP_KEY;

    await expect(
      sendTransactionalMail({
        toEmail: 'test@example.com',
        toName: 'Test',
        subject: 'Subjek',
        text: 'Teks',
        html: '<p>Teks</p>',
      })
    ).rejects.toMatchObject({ code: 'SMTP_NOT_CONFIGURED' });

    process.env.BREVO_API_KEY = origKey;
    process.env.BREVO_SMTP_USER = origUser;
    process.env.BREVO_SMTP_KEY = origPass;
  });

  it('sends via Brevo HTTPS REST API when BREVO_API_KEY is configured', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-mock-valid-api-key-1234567890';
    process.env.MAIL_FROM = 'Singgah-sana <singgahsana.paw@gmail.com>';
    process.env.APP_ORIGIN = 'http://localhost:3120';

    let capturedUrl = '';
    let capturedHeaders = {};
    let capturedBody = {};

    global.fetch = jest.fn(async (url, options) => {
      capturedUrl = url;
      capturedHeaders = options.headers;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 201,
        json: async () => ({ messageId: '<20261117-test-msg-id@brevo>' }),
      };
    });

    const result = await sendTransactionalMail({
      toEmail: 'recipient@example.com',
      toName: 'Penerima Test',
      subject: 'Test Subjek',
      text: 'Test Isi',
      html: '<p>Test Isi</p>',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('<20261117-test-msg-id@brevo>');
    expect(capturedUrl).toBe('https://api.brevo.com/v3/smtp/email');
    expect(capturedHeaders['api-key']).toBe('xkeysib-mock-valid-api-key-1234567890');
    expect(capturedBody.to[0].email).toBe('recipient@example.com');
    expect(capturedBody.sender.email).toBe('singgahsana.paw@gmail.com');
  });

  it('handles Brevo HTTPS API rejection cleanly without leaking keys', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-invalid-key';
    process.env.MAIL_FROM = 'Singgah-sana <singgahsana.paw@gmail.com>';
    process.env.APP_ORIGIN = 'http://localhost:3120';

    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ code: 'unauthorized', message: 'Key not found' }),
    }));

    await expect(
      sendTransactionalMail({
        toEmail: 'recipient@example.com',
        toName: 'Penerima',
        subject: 'Subjek',
        text: 'Teks',
        html: '<p>Teks</p>',
      })
    ).rejects.toMatchObject({
      code: 'unauthorized',
      statusCode: 401,
    });
  });

  it('handles network timeout (10s) gracefully without hanging', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-mock-timeout-key';
    process.env.MAIL_FROM = 'Singgah-sana <singgahsana.paw@gmail.com>';
    process.env.APP_ORIGIN = 'http://localhost:3120';

    global.fetch = jest.fn(async () => {
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'TimeoutError';
      throw err;
    });

    await expect(
      sendTransactionalMail({
        toEmail: 'recipient@example.com',
        toName: 'Penerima',
        subject: 'Subjek',
        text: 'Teks',
        html: '<p>Teks</p>',
      })
    ).rejects.toMatchObject({
      code: 'ETIMEDOUT',
    });
  });

  it('enforces atomic single-use reset token and revokes previous sessions', async () => {
    const user = await createUser('pencari');
    const oldPassword = 'PasswordLama123!';
    user.user.password = oldPassword;
    await user.user.save();

    // Buat token reset acak
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.user.reset_password_token_hash = tokenHash;
    user.user.reset_password_expires_at = new Date(Date.now() + 30 * 60 * 1000);
    await user.user.save();

    // Buat sesi aktif lama
    await Session.create({
      token_hash: 'mock-session-token-hash-12345',
      csrf_hash: 'mock-csrf-hash-12345',
      user_id: user.user._id,
      token_version: 0,
      expires_at: new Date(Date.now() + 86400000),
    });

    // 1. Password sama dengan password lama ditolak (PASSWORD_SAME)
    const sameRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: oldPassword });
    expect(sameRes.status).toBe(422);
    expect(sameRes.body.code).toBe('PASSWORD_SAME');

    // Token harus masih utuh karena validasi input gagal sebelum konsumsi
    const userStillHasToken = await User.findById(user.user._id).select('+reset_password_token_hash');
    expect(userStillHasToken.reset_password_token_hash).toBe(tokenHash);

    // 2. Reset dengan password baru
    const newPassword = 'PasswordBaru12345!';
    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: newPassword });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // 3. Token langsung terhapus (single-use)
    const userAfter = await User.findById(user.user._id).select('+reset_password_token_hash');
    expect(userAfter.reset_password_token_hash).toBeNull();

    // Sesi lama dicabut
    const remainingSessions = await Session.find({ user_id: user.user._id });
    expect(remainingSessions).toHaveLength(0);

    // Email tidak otomatis terverifikasi
    expect(userAfter.email_verified_at).toBeFalsy();

    // 4. Token bekas ditolak
    const reuseRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'AnotherPassword999!' });
    expect(reuseRes.status).toBe(400);
    expect(reuseRes.body.code).toBe('TOKEN_EXPIRED');

    // 5. Password lama tidak bisa dipakai login lagi
    const loginOld = await request(app)
      .post('/api/auth/login')
      .send({ email: user.user.email, password: oldPassword });
    expect(loginOld.status).toBe(401);

    // Password baru berhasil dipakai login
    const loginNew = await request(app)
      .post('/api/auth/login')
      .send({ email: user.user.email, password: newPassword });
    expect(loginNew.status).toBe(200);
  });
});

