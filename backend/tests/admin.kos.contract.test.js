const { app, request, createUser, createKos, auth } = require('./helpers');
const Pengajuan = require('../src/models/Pengajuan');
const Kos = require('../src/models/Kos');

describe('Tahap 1: Admin Kos Contract & Filtering', () => {
  it('returns canonical serialized items conforming to frontend expectations', async () => {
    const admin = await createUser('admin');
    const owner = await createUser('pemilik');
    const seeker = await createUser('pencari');

    const approvedKos = await createKos(owner.user, {
      nama: 'Kos Mawar Indah',
      alamat: 'Jl Kaliurang KM 5',
      area_kampus: 'UGM',
      status_verifikasi: 'approved',
      status_publikasi: 'active',
      status_moderasi: 'normal',
    });

    const pendingKos = await createKos(owner.user, {
      nama: 'Kos Melati Asri',
      alamat: 'Jl Gejayan',
      area_kampus: 'UNY',
      status_verifikasi: 'pending',
      status_publikasi: 'active',
      status_moderasi: 'normal',
    });
    await Pengajuan.create({
      kos_id: pendingKos._id,
      pemilik_id: owner.user._id,
      jenis: 'baru',
      status: 'pending',
      is_active: true,
      after: { nama: pendingKos.nama, alamat: pendingKos.alamat, area_kampus: pendingKos.area_kampus },
    });

    // 1. Non-admin access rejected
    const unauthRes = await request(app).get('/api/admin/kos');
    expect(unauthRes.status).toBe(401);

    const seekerRes = await request(app).get('/api/admin/kos').set(auth(seeker.token));
    expect(seekerRes.status).toBe(403);

    const ownerRes = await request(app).get('/api/admin/kos').set(auth(owner.token));
    expect(ownerRes.status).toBe(403);

    // 2. Admin access returns canonical contract
    const res = await request(app).get('/api/admin/kos').set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.totalData).toBeGreaterThanOrEqual(2);

    const approvedItem = res.body.data.find((k) => k._id === String(approvedKos._id));
    expect(approvedItem).toBeDefined();
    expect(approvedItem.nama).toBe('Kos Mawar Indah');
    expect(approvedItem.status_verifikasi).toBe('approved');
    expect(approvedItem.status_publikasi).toBe('active');
    expect(approvedItem.status_moderasi).toBe('normal');
    expect(approvedItem.pemilik).toBeDefined();
    expect(approvedItem.pemilik.nama).toBe(owner.user.nama);
    expect(approvedItem.pemilik_detail).toBeDefined();
    expect(approvedItem.pemilik_detail.email).toBe(owner.user.email);
    expect(approvedItem.data_publik).toBeDefined();
    expect(approvedItem.data_publik.nama).toBe('Kos Mawar Indah');

    const pendingItem = res.body.data.find((k) => k._id === String(pendingKos._id));
    expect(pendingItem).toBeDefined();
    expect(pendingItem.nama).toBe('Kos Melati Asri');
    expect(pendingItem.status_verifikasi).toBe('pending');
    expect(pendingItem.draft).toBeDefined();
    expect(pendingItem.draft.nama).toBe('Kos Melati Asri');

    // 3. Filtering by status_verifikasi
    const filterPending = await request(app)
      .get('/api/admin/kos?status_verifikasi=pending')
      .set(auth(admin.token));
    expect(filterPending.status).toBe(200);
    expect(filterPending.body.data.every((k) => k.status_verifikasi === 'pending')).toBe(true);
    expect(filterPending.body.data.some((k) => k._id === String(pendingKos._id))).toBe(true);
    expect(filterPending.body.data.some((k) => k._id === String(approvedKos._id))).toBe(false);

    // 4. Filtering with legacy 'status' param
    const filterLegacy = await request(app)
      .get('/api/admin/kos?status=approved')
      .set(auth(admin.token));
    expect(filterLegacy.status).toBe(200);
    expect(filterLegacy.body.data.every((k) => k.status_verifikasi === 'approved')).toBe(true);

    // 5. Search query matching
    const searchRes = await request(app)
      .get('/api/admin/kos?q=Mawar')
      .set(auth(admin.token));
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.some((k) => k._id === String(approvedKos._id))).toBe(true);
    expect(searchRes.body.data.some((k) => k._id === String(pendingKos._id))).toBe(false);
  });

  it('handles dangling/missing owner reference gracefully without crashing', async () => {
    const admin = await createUser('admin');
    const fakeOwnerId = new (require('mongoose').Types.ObjectId)();
    const orphanKos = await Kos.create({
      pemilik_id: fakeOwnerId,
      nama: 'Kos Yatim Tanpa Pemilik',
      alamat: 'Jl Damai',
      status_verifikasi: 'approved',
      status_publikasi: 'active',
      status_moderasi: 'normal',
    });

    const res = await request(app).get('/api/admin/kos').set(auth(admin.token));
    expect(res.status).toBe(200);
    const item = res.body.data.find((k) => k._id === String(orphanKos._id));
    expect(item).toBeDefined();
    expect(item.nama).toBe('Kos Yatim Tanpa Pemilik');
    // pemilik is null or placeholder, must not crash
    expect(item.pemilik === null || typeof item.pemilik.nama === 'string').toBe(true);
  });
});

