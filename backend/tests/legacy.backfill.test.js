const mongoose = require('mongoose');
const { app, request, createUser, createKos, auth } = require('./helpers');
const Kos = require('../src/models/Kos');
const Pengajuan = require('../src/models/Pengajuan');
const { runLegacyBackfill } = require('../src/utils/legacyBackfill');

/**
 * Menyisipkan kos langsung ke koleksi MongoDB TANPA field versioning/status baru,
 * meniru data hasil seeder lama yang ada di database produksi.
 */
async function insertLegacyKos(ownerId, overrides = {}) {
  const _id = new mongoose.Types.ObjectId();
  const now = new Date();
  await Kos.collection.insertOne({
    _id,
    nama: 'Kos Legacy Blimbing',
    deskripsi: 'Data seed lama',
    alamat: 'Jl. Blimbing No. 1, Sleman',
    area_kampus: 'UGM',
    koordinat: { latitude: -7.77, longitude: 110.38 },
    foto: ['https://example.com/legacy.jpg'],
    harga_per_bulan: 1300000,
    tipe: 'campur',
    fasilitas: ['WiFi'],
    peraturan: [],
    jumlah_kamar_total: 8,
    jumlah_kamar_tersedia: 3,
    status_verifikasi: 'approved',
    pemilik_id: ownerId,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
  return _id;
}

describe('Backfill data kos legacy', () => {
  it('reproduksi bug: tanpa backfill, ubah stok kos legacy gagal 409', async () => {
    const owner = await createUser('pemilik');
    const kosId = await insertLegacyKos(owner.user._id);

    const res = await request(app)
      .patch(`/api/pemilik/kos/${kosId}/ketersediaan`)
      .set(auth(owner.token))
      .send({ jumlah_kamar_tersedia: 2, expected_version: 1 });

    expect(res.statusCode).toBe(409);
  });

  it('melengkapi field yang hilang sehingga ubah stok berhasil', async () => {
    const owner = await createUser('pemilik');
    const kosId = await insertLegacyKos(owner.user._id);

    const summary = await runLegacyBackfill({ log: false });
    expect(summary.fields.version_ketersediaan).toBeGreaterThanOrEqual(1);

    const raw = await Kos.collection.findOne({ _id: kosId });
    expect(raw.version).toBe(1);
    expect(raw.version_ketersediaan).toBe(1);
    expect(raw.status_publikasi).toBe('active');
    expect(raw.status_moderasi).toBe('normal');
    expect(raw.deleted_at).toBeNull();

    const res = await request(app)
      .patch(`/api/pemilik/kos/${kosId}/ketersediaan`)
      .set(auth(owner.token))
      .send({ jumlah_kamar_tersedia: 2, expected_version: 1 });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.ketersediaan.jumlah_kamar_tersedia).toBe(2);
  });

  it('tidak mengubah kos yang field-nya sudah lengkap', async () => {
    const owner = await createUser('pemilik');
    const kos = await createKos(owner.user, { version: 4, version_ketersediaan: 7 });

    await runLegacyBackfill({ log: false });

    const raw = await Kos.collection.findOne({ _id: kos._id });
    expect(raw.version).toBe(4);
    expect(raw.version_ketersediaan).toBe(7);
  });

  it('membuat pengajuan untuk kos legacy pending sehingga masuk antrean admin dan bisa disetujui', async () => {
    const admin = await createUser('admin');
    const owner = await createUser('pemilik');
    const kosId = await insertLegacyKos(owner.user._id, {
      nama: 'Kos Pogung Raya Indah',
      status_verifikasi: 'pending',
    });

    const before = await request(app).get('/api/admin/pengajuan').set(auth(admin.token));
    expect(before.body.data.some((s) => s.kos_id === String(kosId))).toBe(false);

    const first = await runLegacyBackfill({ log: false });
    const second = await runLegacyBackfill({ log: false });
    expect(first.pengajuanDibuat).toBe(1);
    expect(second.pengajuanDibuat).toBe(0);
    expect(await Pengajuan.countDocuments({ kos_id: kosId })).toBe(1);

    const queue = await request(app).get('/api/admin/pengajuan').set(auth(admin.token));
    const item = queue.body.data.find((s) => s.kos_id === String(kosId));
    expect(item).toBeDefined();
    expect(item.nama_kos).toBe('Kos Pogung Raya Indah');
    expect(item.after.foto[0].url).toBe('https://example.com/legacy.jpg');

    const stats = await request(app).get('/api/admin/stats').set(auth(admin.token));
    expect(stats.body.data.kos.pending).toBe(1);

    const decision = await request(app)
      .patch(`/api/admin/pengajuan/${item._id}/keputusan`)
      .set(auth(admin.token))
      .send({ keputusan: 'approved', expected_version: item.version });
    expect(decision.statusCode).toBe(200);

    const kos = await Kos.findById(kosId);
    expect(kos.status_verifikasi).toBe('approved');
    expect(kos.foto).toEqual(['https://example.com/legacy.jpg']);
  });
});

describe('GET /api/admin/kos mengikuti kontrak admin', () => {
  it('mengirim objek pemilik dan status, bukan dokumen mentah', async () => {
    const admin = await createUser('admin');
    const owner = await createUser('pemilik');
    await createKos(owner.user, { nama: 'Kos Kontrak Admin' });

    const res = await request(app).get('/api/admin/kos').set(auth(admin.token));
    expect(res.statusCode).toBe(200);
    const item = res.body.data[0];
    expect(item.pemilik.nama).toBe(owner.user.nama);
    expect(item.pemilik_detail.email).toBe(owner.user.email);
    expect(item.status_verifikasi).toBe('approved');
    expect(item.status_publikasi).toBe('active');
    expect(item.status_moderasi).toBe('normal');
    expect(item.data_publik.nama).toBe('Kos Kontrak Admin');
    expect(item).not.toHaveProperty('pemilik_id');
    expect(item).not.toHaveProperty('draft_konten');
    expect(item).not.toHaveProperty('__v');
  });

  it('menyertakan ID pengajuan pending aktif dan mendukung filter status V1', async () => {
    const admin = await createUser('admin');
    const owner = await createUser('pemilik');
    await createKos(owner.user, { nama: 'Kos Sudah Tayang' });
    const pending = await createKos(owner.user, { nama: 'Kos Menunggu', status_verifikasi: 'pending' });
    const pengajuan = await Pengajuan.create({
      kos_id: pending._id,
      pemilik_id: owner.user._id,
      jenis: 'baru',
      status: 'pending',
      is_active: true,
      after: { nama: 'Kos Menunggu' },
    });

    const res = await request(app)
      .get('/api/admin/kos?status_verifikasi=pending')
      .set(auth(admin.token));
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].perubahan_tertunda._id).toBe(String(pengajuan._id));
    expect(res.body.data[0].perubahan_tertunda.status).toBe('pending');

    const invalid = await request(app)
      .get('/api/admin/kos?status_moderasi=hilang')
      .set(auth(admin.token));
    expect(invalid.statusCode).toBe(422);
  });
});
