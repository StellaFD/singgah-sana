const { app, request, createUser, createKos, auth } = require('./helpers');
const User = require('../src/models/User');
const Kos = require('../src/models/Kos');
const Session = require('../src/models/Session');
const Favorit = require('../src/models/Favorit');

describe('Tahap 5: Safe Account Deletion & Referential Integrity', () => {
  it('prevents deletion of sole administrator account', async () => {
    // Pastikan hanya ada 1 admin
    await User.deleteMany({ role: 'admin' });
    const admin = await createUser('admin');

    const res = await request(app)
      .delete('/api/auth/me')
      .set(auth(admin.token))
      .send({ password: 'Password123!' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
    expect(res.body.message).toContain('administrator tunggal');
  });

  it('safely archives owner kos and anonymizes owner user account', async () => {
    const owner = await createUser('pemilik');
    const ownerPassword = 'PasswordOwner123!';
    owner.user.password = ownerPassword;
    await owner.user.save();

    // Buat kos milik owner
    const kos1 = await createKos(owner.user, {
      nama: 'Kos Mawar Owner Deletion',
      status_publikasi: 'active',
      status_verifikasi: 'approved',
    });

    // Buat sesi
    await Session.create({
      token_hash: 'sess-owner-del-hash',
      csrf_hash: 'csrf-owner-del-hash',
      user_id: owner.user._id,
      expires_at: new Date(Date.now() + 86400000),
    });

    // 1. Password salah ditolak 422
    const wrongRes = await request(app)
      .delete('/api/auth/me')
      .set(auth(owner.token))
      .send({ password: 'SalahPassword!' });
    expect(wrongRes.status).toBe(422);

    // 2. Password benar -> berhasil dihapus
    const successRes = await request(app)
      .delete('/api/auth/me')
      .set(auth(owner.token))
      .send({ password: ownerPassword });
    expect(successRes.status).toBe(200);

    // 3. Kos milik owner sekarang terarsip dengan enum resmi yang valid
    const updatedKos = await Kos.findById(kos1._id);
    expect(updatedKos.status_publikasi).toBe('archived');
    expect(updatedKos.deleted_at).toBeDefined();

    // 4. Sesi owner dicabut
    const remainingSessions = await Session.find({ user_id: owner.user._id });
    expect(remainingSessions).toHaveLength(0);

    // 5. Data user dianonimkan (tidak dangling)
    const anonymizedUser = await User.findById(owner.user._id);
    expect(anonymizedUser).toBeDefined();
    expect(anonymizedUser.status).toBe('suspended');
    expect(anonymizedUser.deleted_at).toBeDefined();
    expect(anonymizedUser.nama).toBe('Pengguna Dihapus');
    expect(anonymizedUser.email).toContain('@deleted.invalid');
  });

  it('requires reauthentication for Google-only account deletion', async () => {
    const googleUser = await createUser('pencari');
    googleUser.user.password = undefined;
    googleUser.user.google_id = 'sub-google-only-user-777';
    await googleUser.user.save();

    // 1. Tanpa konfirmasi ditolak 422
    const noConfRes = await request(app)
      .delete('/api/auth/me')
      .set(auth(googleUser.token))
      .send({});
    expect(noConfRes.status).toBe(403);

    // 2. Dengan konfirmasi HAPUS berhasil
    const confRes = await request(app)
      .delete('/api/auth/me')
      .set(auth(googleUser.token))
      .send({ konfirmasi: 'HAPUS' });
    expect(confRes.status).toBe(403);
    expect(confRes.body.code).toBe('REAUTH_REQUIRED');

    const userInDb = await User.findById(googleUser.user._id);
    expect(userInDb.status).toBe('active');
    expect(userInDb.deleted_at).toBeNull();
  });
});

