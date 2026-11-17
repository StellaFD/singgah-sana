const { app, request, createUser, createKos, auth } = require('./helpers');
const User = require('../src/models/User');
const Kos = require('../src/models/Kos');
const Favorit = require('../src/models/Favorit');
const { getMailConfig, getAppOrigin } = require('../src/config/mail');
const { reconcileLegacyData } = require('../src/scripts/reconcileLegacyData');

describe('Release regressions', () => {
  it('returns accurate authentication metadata without exposing the password hash', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/auth/me').set(auth(user.token));
    expect(res.body.data.has_password).toBe(true);
    expect(res.body.data.is_google).toBe(false);
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.token_version).toBeUndefined();
    user.user.password = undefined;
    user.user.google_id = 'google-release-test';
    await user.user.save();
    const google = await request(app).get('/api/auth/me').set(auth(user.token));
    expect(google.body.data.has_password).toBe(false);
    expect(google.body.data.is_google).toBe(true);
  });

  it('rolls back listing archival if account cleanup fails', async () => {
    const owner = await createUser('pemilik');
    const kos = await createKos(owner.user);
    const spy = jest.spyOn(Favorit, 'deleteMany').mockReturnValue({ session: () => Promise.reject(new Error('cleanup unavailable')) });
    try {
      const res = await request(app).delete('/api/auth/me').set(auth(owner.token)).send({ password: 'Password123!' });
      expect(res.status).toBe(500);
      expect((await Kos.findById(kos._id)).deleted_at).toBeNull();
      expect((await User.findById(owner.user._id)).status).toBe('active');
    } finally { spy.mockRestore(); }
  });

  it('can delete two password accounts without a unique null-phone collision', async () => {
    for (let i = 0; i < 2; i++) {
      const user = await createUser();
      const res = await request(app).delete('/api/auth/me').set(auth(user.token)).send({ password: 'Password123!' });
      expect(res.status).toBe(200);
      expect((await User.findById(user.user._id)).nomor_telepon).toBeUndefined();
    }
  });

  it('does not fabricate missing content while reconciling incomplete legacy listings', async () => {
    const owner = await createUser('pemilik');
    await Kos.create({ pemilik_id: owner.user._id, nama: 'Incomplete', status_verifikasi: 'pending' });
    const result = await reconcileLegacyData({ execute: true });
    expect(result.createdSubmissionsCount).toBe(0);
    expect(result.skipped).toHaveLength(1);
  });

  it('requires HTTPS email credentials in production and preserves the configured local origin', () => {
    const before = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.APP_ORIGIN = 'https://singgah-sana.vercel.app';
      process.env.MAIL_FROM = 'Project <project@example.com>';
      process.env.BREVO_SMTP_USER = 'local';
      process.env.BREVO_SMTP_KEY = 'local-only';
      delete process.env.BREVO_API_KEY;
      expect(getMailConfig().isConfigured).toBe(false);
      process.env.BREVO_API_KEY = 'xkeysib-test-only-not-real';
      expect(getMailConfig().transportMode).toBe('https_api');
      expect(getMailConfig().isConfigured).toBe(true);
      process.env.NODE_ENV = 'test';
      process.env.APP_ORIGIN = 'http://localhost:3000';
      expect(getAppOrigin()).toBe('http://localhost:3000');
    } finally { process.env = before; }
  });
});
