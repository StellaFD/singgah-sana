const { app, request, createUser, auth } = require('./helpers');
const User = require('../src/models/User');
const { OAuth2Client } = require('google-auth-library');

// Mock verifyIdToken
jest.mock('google-auth-library');

describe('Tahap 4: Google Auth & Account Security', () => {
  const origClientId = process.env.GOOGLE_CLIENT_ID;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'mock-google-client-id-12345';
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.GOOGLE_CLIENT_ID = origClientId;
  });

  it('rejects request when Google Client ID is unconfigured on server', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const res = await request(app).post('/api/auth/google').send({ credential: 'any-token' });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SERVICE_UNAVAILABLE');
    process.env.GOOGLE_CLIENT_ID = 'mock-google-client-id-12345';
  });

  it('rejects invalid or expired Google tokens with 401', async () => {
    OAuth2Client.prototype.verifyIdToken = jest.fn().mockRejectedValue(new Error('Token expired'));

    const res = await request(app).post('/api/auth/google').send({ credential: 'expired-token' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_GOOGLE_TOKEN');
  });

  it('rejects suspended accounts attempting Google login with 403', async () => {
    const existing = await createUser('pencari');
    existing.user.status = 'suspended';
    existing.user.google_id = 'sub-suspended-user-123';
    await existing.user.save();

    OAuth2Client.prototype.verifyIdToken = jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'sub-suspended-user-123',
        email: existing.user.email,
        email_verified: true,
        iss: 'https://accounts.google.com',
      }),
    });

    const res = await request(app).post('/api/auth/google').send({ credential: 'valid-token' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('prevents account takeover: requires password verification to link existing password account', async () => {
    const existing = await createUser('pemilik');
    const userPassword = 'PasswordExisting123!';
    existing.user.password = userPassword;
    await existing.user.save();

    OAuth2Client.prototype.verifyIdToken = jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-hacker-or-owner-999',
        email: existing.user.email,
        email_verified: true,
        iss: 'https://accounts.google.com',
      }),
    });

    // 1. Tanpa password -> minta konfirmasi password kepemilikan akun (NEED_PASSWORD_LINK)
    const noPassRes = await request(app).post('/api/auth/google').send({ credential: 'valid-token' });
    expect(noPassRes.status).toBe(200);
    expect(noPassRes.body.code).toBe('NEED_PASSWORD_LINK');

    // Akun belum terhubung
    const checkDb1 = await User.findById(existing.user._id);
    expect(checkDb1.google_id).toBeFalsy();

    // 2. Password salah -> ditolak 401
    const wrongPassRes = await request(app).post('/api/auth/google').send({
      credential: 'valid-token',
      password: 'SalahPassword!',
    });
    expect(wrongPassRes.status).toBe(401);
    expect(wrongPassRes.body.code).toBe('INVALID_CREDENTIALS');

    // 3. Password benar -> berhasil dihubungkan dan google_id tersimpan
    const correctPassRes = await request(app).post('/api/auth/google').send({
      credential: 'valid-token',
      password: userPassword,
    });
    expect(correctPassRes.status).toBe(200);
    expect(correctPassRes.body.success).toBe(true);

    const checkDb2 = await User.findById(existing.user._id);
    expect(checkDb2.google_id).toBe('google-sub-hacker-or-owner-999');
  });

  it('rejects conflict when email is already linked to a different google_id', async () => {
    const existing = await createUser('pencari');
    existing.user.google_id = 'original-google-sub-111';
    await existing.user.save();

    OAuth2Client.prototype.verifyIdToken = jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'different-google-sub-222',
        email: existing.user.email,
        email_verified: true,
        iss: 'https://accounts.google.com',
      }),
    });

    const res = await request(app).post('/api/auth/google').send({ credential: 'valid-token' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ACCOUNT_CONFLICT');
  });

  it('forbids role escalation to admin for new Google users', async () => {
    OAuth2Client.prototype.verifyIdToken = jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'brand-new-sub-333',
        email: 'newuser.brandnew@gmail.com',
        email_verified: true,
        name: 'Brand New User',
        iss: 'https://accounts.google.com',
      }),
    });

    // 1. Tanpa role -> NEED_ROLE
    const noRoleRes = await request(app).post('/api/auth/google').send({ credential: 'valid-token' });
    expect(noRoleRes.status).toBe(200);
    expect(noRoleRes.body.code).toBe('NEED_ROLE');

    // 2. Mencoba eskalasi ke admin -> ditolak dan tetap diarahkan NEED_ROLE (hanya pencari/pemilik)
    const adminEscalationRes = await request(app).post('/api/auth/google').send({
      credential: 'valid-token',
      role: 'admin',
    });
    expect(adminEscalationRes.status).toBe(200);
    expect(adminEscalationRes.body.code).toBe('NEED_ROLE');

    // 3. Memilih pencari -> berhasil terdaftar sebagai pencari
    const validRegisterRes = await request(app).post('/api/auth/google').send({
      credential: 'valid-token',
      role: 'pencari',
    });
    expect(validRegisterRes.status).toBe(201);
    expect(validRegisterRes.body.data.role).toBe('pencari');

    const createdUser = await User.findOne({ email: 'newuser.brandnew@gmail.com' });
    expect(createdUser).toBeDefined();
    expect(createdUser.role).toBe('pencari');
  });
});

