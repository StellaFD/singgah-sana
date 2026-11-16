const mongoose = require('mongoose');
const {
  app,
  request,
  createUser,
  createKos,
  createMediaAsset,
  samplePngBuffer,
  auth,
} = require('./helpers');
const Kos = require('../src/models/Kos');
const Pengajuan = require('../src/models/Pengajuan');
const MediaAsset = require('../src/models/MediaAsset');
const AuditLog = require('../src/models/AuditLog');

describe('Siklus Hidup Pengajuan Listing Kos (Listing Submissions)', () => {
  let pemilikA;
  let tokenPemilikA;
  let pemilikB;
  let tokenPemilikB;
  let admin;
  let tokenAdmin;
  let pencari;
  let tokenPencari;
  let assetA;

  beforeEach(async () => {
    ({ user: pemilikA, token: tokenPemilikA } = await createUser('pemilik'));
    ({ user: pemilikB, token: tokenPemilikB } = await createUser('pemilik'));
    ({ user: admin, token: tokenAdmin } = await createUser('admin'));
    ({ user: pencari, token: tokenPencari } = await createUser('pencari'));

    assetA = await createMediaAsset(pemilikA);
  });

  // 1. draft tak publik dan POST {} parsial murni
  it('1. POST {} membuat draft parsial murni tanpa fabrikasi nilai (koordinat, tipe, harga, total absent) dan tidak tampil publik', async () => {
    const resDraft = await request(app)
      .post('/api/pemilik/kos')
      .set(auth(tokenPemilikA))
      .send({});

    expect(resDraft.statusCode).toBe(201);
    expect(resDraft.body.success).toBe(true);
    expect(resDraft.body.data.status_verifikasi).toBe('draft');

    const draft = resDraft.body.data.draft;
    expect(draft).toBeDefined();
    // Tidak memfabrikasi fakta
    expect(draft.nama).toBeUndefined();
    expect(draft.deskripsi).toBeUndefined();
    expect(draft.alamat).toBeUndefined();
    expect(draft.area_kampus).toBeUndefined();
    expect(draft.koordinat).toBeUndefined();
    expect(draft.harga_per_bulan).toBeUndefined();
    expect(draft.tipe).toBeUndefined();
    expect(draft.jumlah_kamar_total).toBeUndefined();
    expect(draft.foto).toEqual([]);

    const kosId = resDraft.body.data._id;

    // Cek GET /api/kos (Publik)
    const resList = await request(app).get('/api/kos');
    expect(resList.statusCode).toBe(200);
    const foundInList = resList.body.data.find((k) => k._id === kosId);
    expect(foundInList).toBeUndefined();

    // Cek GET /api/kos/map (Publik)
    const resMap = await request(app).get('/api/kos/map');
    expect(resMap.statusCode).toBe(200);
    const foundInMap = resMap.body.data.find((k) => k._id === kosId);
    expect(foundInMap).toBeUndefined();

    // Cek GET /api/kos/:id (Publik anonim)
    const resDetail = await request(app).get(`/api/kos/${kosId}`);
    expect(resDetail.statusCode).toBe(403);
  });

  // 2. submit lengkap
  it('2. Submit menolak data tak lengkap / tanpa foto dengan 422, dan berhasil saat lengkap', async () => {
    // Buat draft parsial (hanya nama)
    const resCreate = await request(app)
      .post('/api/pemilik/kos')
      .set(auth(tokenPemilikA))
      .send({
        nama: 'Kos Belum Lengkap',
      });
    const kosId = resCreate.body.data._id;

    // Coba submit langsung -> harus 422 VALIDATION_ERROR
    const resSubmitIncomplete = await request(app)
      .post(`/api/pemilik/kos/${kosId}/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });

    expect(resSubmitIncomplete.statusCode).toBe(422);
    expect(resSubmitIncomplete.body.code).toBe('VALIDATION_ERROR');
    expect(resSubmitIncomplete.body.errors).toBeDefined();

    // Lengkapi draft dengan foto valid
    const resPatch = await request(app)
      .patch(`/api/pemilik/kos/${kosId}`)
      .set(auth(tokenPemilikA))
      .send({
        expected_version: 1,
        deskripsi: 'Kos lengkap dan nyaman dekat kampus UGM',
        alamat: 'Jl. Kaliurang KM 5, Sleman',
        area_kampus: 'Pogung',
        koordinat: { latitude: -7.76, longitude: 110.37 },
        harga_per_bulan: 1500000,
        tipe: 'campur',
        fasilitas: ['WiFi', 'AC'],
        peraturan: ['Akses 24 Jam'],
        jumlah_kamar_total: 10,
        foto_ids: [String(assetA._id)],
      });
    expect(resPatch.statusCode).toBe(200);

    // Submit draft lengkap -> 200 & status jadi pending
    const resSubmit = await request(app)
      .post(`/api/pemilik/kos/${kosId}/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 2 });

    expect(resSubmit.statusCode).toBe(200);
    expect(resSubmit.body.success).toBe(true);
    expect(resSubmit.body.data.status).toBe('pending');
    expect(resSubmit.body.data.jenis).toBe('baru');
    expect(resSubmit.body.data.after.foto.length).toBe(1);
    expect(resSubmit.body.data.after.foto[0].asset_id).toBe(String(assetA._id));

    const checkKos = await Kos.findById(kosId);
    expect(checkKos.status_verifikasi).toBe('pending');
  });

  // 3. IDOR / role
  it('3. IDOR: Pengguna lain ditolak 404/403 saat mengakses/memodifikasi kos pemilik lain', async () => {
    const kosA = await createKos(pemilikA, { status_verifikasi: 'draft' });

    // Pemilik B mencoba detail kos A
    const resGet = await request(app)
      .get(`/api/pemilik/kos/${kosA._id}`)
      .set(auth(tokenPemilikB));
    expect(resGet.statusCode).toBe(404);

    // Pemilik B mencoba patch draft kos A
    const resPatch = await request(app)
      .patch(`/api/pemilik/kos/${kosA._id}`)
      .set(auth(tokenPemilikB))
      .send({ expected_version: 1, nama: 'Nama Dibajak' });
    expect(resPatch.statusCode).toBe(404);

    // Pencari mencoba akses endpoint pemilik
    const resPencari = await request(app)
      .get(`/api/pemilik/kos/${kosA._id}`)
      .set(auth(tokenPencari));
    expect(resPencari.statusCode).toBe(403);

    // Pemilik mencoba akses endpoint admin
    const resAdminQueue = await request(app)
      .get('/api/admin/pengajuan')
      .set(auth(tokenPemilikA));
    expect(resAdminQueue.statusCode).toBe(403);
  });

  // 4. pending immutable
  it('4. Listing dalam status pending tidak dapat disunting sebelum ditarik (409 Conflict)', async () => {
    const kos = await createKos(pemilikA, {
      status_verifikasi: 'draft',
      version: 1,
      draft_konten: {
        nama: 'Kos Uji Pending',
        deskripsi: 'Deskripsi',
        alamat: 'Alamat',
        area_kampus: 'Pogung',
        koordinat: { latitude: -7.76, longitude: 110.37 },
        harga_per_bulan: 1000000,
        tipe: 'putra',
        fasilitas: ['WiFi'],
        peraturan: ['No Smoking'],
        jumlah_kamar_total: 5,
        jumlah_kamar_tersedia: 5,
        foto_ids: [String(assetA._id)],
      },
    });

    await request(app)
      .post(`/api/pemilik/kos/${kos._id}/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });

    // Saat status pending, coba edit -> harus 409
    const resEdit = await request(app)
      .patch(`/api/pemilik/kos/${kos._id}`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 2, nama: 'Edit Saat Pending' });

    expect(resEdit.statusCode).toBe(409);
    expect(resEdit.body.message).toMatch(/tarik pengajuan terlebih dahulu/i);
  });

  // 5. revision + resubmit
  it('5. Alur revision: Admin meminta revisi, pemilik menyunting draft, lalu mengajukan ulang', async () => {
    const kos = await createKos(pemilikA, {
      status_verifikasi: 'draft',
      version: 1,
      draft_konten: {
        nama: 'Kos Awal',
        deskripsi: 'Deskripsi singkat',
        alamat: 'Alamat',
        area_kampus: 'Pogung',
        koordinat: { latitude: -7.76, longitude: 110.37 },
        harga_per_bulan: 1000000,
        tipe: 'putri',
        fasilitas: ['WiFi'],
        peraturan: [],
        jumlah_kamar_total: 4,
        jumlah_kamar_tersedia: 4,
        foto_ids: [String(assetA._id)],
      },
    });

    const resSubmit = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    const pengajuanId = resSubmit.body.data._id;

    // Admin memutuskan revision
    const resDecision = await request(app)
      .patch(`/api/admin/pengajuan/${pengajuanId}/keputusan`)
      .set(auth(tokenAdmin))
      .send({
        keputusan: 'revision',
        catatan_verifikasi: 'Deskripsi mohon diperjelas fasilitas kamar mandinya.',
        expected_version: 1,
      });

    expect(resDecision.statusCode).toBe(200);
    expect(resDecision.body.data.status).toBe('revision');

    const kosRevisi = await Kos.findById(kos._id);
    expect(kosRevisi.status_verifikasi).toBe('revision');

    // Pemilik mengedit draft -> otomatis kembali ke 'draft'
    const resEdit = await request(app)
      .patch(`/api/pemilik/kos/${kos._id}`)
      .set(auth(tokenPemilikA))
      .send({
        expected_version: 3,
        deskripsi: 'Deskripsi sudah diperjelas: kamar mandi dalam dengan pemanas air.',
      });

    expect(resEdit.statusCode).toBe(200);
    expect(resEdit.body.data.status_verifikasi).toBe('draft');

    // Pemilik mengajukan ulang
    const resResubmit = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 4 });

    expect(resResubmit.statusCode).toBe(200);
    expect(resResubmit.body.data.status).toBe('pending');
  });

  // 6. withdraw + stale admin 409
  it('6. Penarikan oleh pemilik menandai withdrawn; admin yang memutuskan setelahnya ditolak 409', async () => {
    const kos = await createKos(pemilikA, {
      status_verifikasi: 'draft',
      version: 1,
      draft_konten: {
        nama: 'Kos Tarik',
        deskripsi: 'Deskripsi',
        alamat: 'Alamat',
        area_kampus: 'Pogung',
        koordinat: { latitude: -7.76, longitude: 110.37 },
        harga_per_bulan: 1000000,
        tipe: 'campur',
        fasilitas: [],
        peraturan: [],
        jumlah_kamar_total: 2,
        jumlah_kamar_tersedia: 2,
        foto_ids: [String(assetA._id)],
      },
    });

    const resSubmit = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    const pengajuanId = resSubmit.body.data._id;

    // Pemilik menarik pengajuan
    const resWithdraw = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/tarik`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });

    expect(resWithdraw.statusCode).toBe(200);
    expect(resWithdraw.body.data.status_verifikasi).toBe('draft');

    // Admin mencoba memutuskan pengajuan yang sudah ditarik
    const resStaleAdmin = await request(app)
      .patch(`/api/admin/pengajuan/${pengajuanId}/keputusan`)
      .set(auth(tokenAdmin))
      .send({
        keputusan: 'approved',
        expected_version: 1,
      });

    expect(resStaleAdmin.statusCode).toBe(409);
    expect(resStaleAdmin.body.message).toMatch(/tidak dalam status pending/i);
  });

  // 7. approved edit publik lama sampai approve
  it('7. Listing approved yang diajukan perubahan tetap menampilkan versi publik lama sampai admin menyetujui', async () => {
    const kos = await createKos(pemilikA, {
      nama: 'Kos Melati Versi Lama',
      status_verifikasi: 'approved',
      version: 1,
      foto: [assetA.url],
      foto_id_list: [assetA._id],
    });

    // Buat draft perubahan
    const resChangeDraft = await request(app)
      .put(`/api/pemilik/kos/${kos._id}/perubahan`)
      .set(auth(tokenPemilikA))
      .send({
        expected_version: 1,
        nama: 'Kos Melati Super Mewah',
      });
    expect(resChangeDraft.statusCode).toBe(200);
    const submissionId = resChangeDraft.body.data._id;

    // Ajukan perubahan
    const resSubmitChange = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/perubahan/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    expect(resSubmitChange.statusCode).toBe(200);

    // Publik membaca detail kos saat perubahan masih pending -> nama MASIH versi lama!
    const resPublicBefore = await request(app).get(`/api/kos/${kos._id}`);
    expect(resPublicBefore.statusCode).toBe(200);
    expect(resPublicBefore.body.data.nama).toBe('Kos Melati Versi Lama');

    // Admin menyetujui perubahan
    const resApprove = await request(app)
      .patch(`/api/admin/pengajuan/${submissionId}/keputusan`)
      .set(auth(tokenAdmin))
      .send({
        keputusan: 'approved',
        expected_version: resSubmitChange.body.data.version,
      });
    expect(resApprove.statusCode).toBe(200);

    // Publik membaca detail kos setelah disetujui -> nama SUDAH versi baru!
    const resPublicAfter = await request(app).get(`/api/kos/${kos._id}`);
    expect(resPublicAfter.statusCode).toBe(200);
    expect(resPublicAfter.body.data.nama).toBe('Kos Melati Super Mewah');
  });

  // 8. reject / revision tidak mengganti publik
  it('8. Penolakan / permintaan revisi pengajuan perubahan tidak merusak versi publik yang sedang tayang', async () => {
    const kos = await createKos(pemilikA, {
      nama: 'Kos Tetap Publik',
      status_verifikasi: 'approved',
      version: 1,
      foto: [assetA.url],
      foto_id_list: [assetA._id],
    });

    const resChange = await request(app)
      .put(`/api/pemilik/kos/${kos._id}/perubahan`)
      .set(auth(tokenPemilikA))
      .send({
        expected_version: 1,
        nama: 'Kos Perubahan Yang Ditolak',
      });
    expect(resChange.statusCode).toBe(200);
    const subId = resChange.body.data._id;

    const resSubmitChange = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/perubahan/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    expect(resSubmitChange.statusCode).toBe(200);

    // Admin menolak perubahan
    const resReject = await request(app)
      .patch(`/api/admin/pengajuan/${subId}/keputusan`)
      .set(auth(tokenAdmin))
      .send({
        keputusan: 'rejected',
        catatan_verifikasi: 'Perubahan harga tidak wajar tanpa peningkatan fasilitas.',
        expected_version: resSubmitChange.body.data.version,
      });
    expect(resReject.statusCode).toBe(200);

    // Kos tetap approved di publik dengan nama lama
    const resPublic = await request(app).get(`/api/kos/${kos._id}`);
    expect(resPublic.statusCode).toBe(200);
    expect(resPublic.body.data.nama).toBe('Kos Tetap Publik');

    const checkKos = await Kos.findById(kos._id);
    expect(checkKos.status_verifikasi).toBe('approved');
  });

  // 9. stok selama review tak tertimpa
  it('9. Stok ketersediaan kamar yang diperbarui selama review tidak tertimpa saat approval', async () => {
    const kos = await createKos(pemilikA, {
      nama: 'Kos Uji Stok',
      status_verifikasi: 'approved',
      jumlah_kamar_total: 10,
      jumlah_kamar_tersedia: 5,
      version: 1,
      version_ketersediaan: 1,
      foto: [assetA.url],
      foto_id_list: [assetA._id],
    });

    // Pemilik mengajukan perubahan konten (misal deskripsi baru dan total kamar jadi 12)
    const resChange = await request(app)
      .put(`/api/pemilik/kos/${kos._id}/perubahan`)
      .set(auth(tokenPemilikA))
      .send({
        expected_version: 1,
        jumlah_kamar_total: 12,
        deskripsi: 'Deskripsi diperbarui',
      });
    expect(resChange.statusCode).toBe(200);
    const subId = resChange.body.data._id;

    const resSubmitChange = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/perubahan/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    expect(resSubmitChange.statusCode).toBe(200);

    // Di tengah review, kamar terisi sehingga pemilik memperbarui stok ketersediaan jadi 2
    const resStok = await request(app)
      .patch(`/api/pemilik/kos/${kos._id}/ketersediaan`)
      .set(auth(tokenPemilikA))
      .send({
        jumlah_kamar_tersedia: 2,
        expected_version: 1,
      });
    expect(resStok.statusCode).toBe(200);
    expect(resStok.body.data.ketersediaan.jumlah_kamar_tersedia).toBe(2);

    // Admin menyetujui pengajuan perubahan
    const resApprove = await request(app)
      .patch(`/api/admin/pengajuan/${subId}/keputusan`)
      .set(auth(tokenAdmin))
      .send({
        keputusan: 'approved',
        expected_version: resSubmitChange.body.data.version,
      });
    expect(resApprove.statusCode).toBe(200);

    // Setelah approval, jumlah kamar total jadi 12, tapi ketersediaan kamar TETAP 2 (tidak tertimpa ke 5)
    const updatedKos = await Kos.findById(kos._id);
    expect(updatedKos.jumlah_kamar_total).toBe(12);
    expect(updatedKos.jumlah_kamar_tersedia).toBe(2);
  });

  // 10. total baru < stok 409
  it('10. Approval / submit perubahan ditolak 409 jika total kamar baru lebih kecil dari kamar tersedia saat ini', async () => {
    const kos = await createKos(pemilikA, {
      nama: 'Kos Stok Lebih Besar',
      status_verifikasi: 'approved',
      jumlah_kamar_total: 10,
      jumlah_kamar_tersedia: 7, // 7 kamar sedang tersedia
      version: 1,
      foto: [assetA.url],
      foto_id_list: [assetA._id],
    });

    // Pemilik mencoba mengajukan total kamar hanya 4 (padahal 7 kamar sedang kosong)
    const resChange = await request(app)
      .put(`/api/pemilik/kos/${kos._id}/perubahan`)
      .set(auth(tokenPemilikA))
      .send({
        expected_version: 1,
        jumlah_kamar_total: 4,
      });
    expect(resChange.statusCode).toBe(200);

    const resSubmit = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/perubahan/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });

    expect(resSubmit.statusCode).toBe(409);
    expect(resSubmit.body.message).toMatch(/lebih kecil dari kamar tersedia/i);
  });

  // 11. archive tak dibatalkan approve
  it('11. Status publikasi archived tidak dibatalkan / dipaksa active saat admin menyetujui perubahan', async () => {
    const kos = await createKos(pemilikA, {
      nama: 'Kos Archived',
      status_verifikasi: 'approved',
      status_publikasi: 'archived',
      version: 1,
      foto: [assetA.url],
      foto_id_list: [assetA._id],
    });

    const resChange = await request(app)
      .put(`/api/pemilik/kos/${kos._id}/perubahan`)
      .set(auth(tokenPemilikA))
      .send({
        expected_version: 1,
        deskripsi: 'Deskripsi baru saat diarsipkan',
      });
    expect(resChange.statusCode).toBe(200);
    const subId = resChange.body.data._id;

    const resSubmitChange = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/perubahan/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    expect(resSubmitChange.statusCode).toBe(200);

    const resApprove = await request(app)
      .patch(`/api/admin/pengajuan/${subId}/keputusan`)
      .set(auth(tokenAdmin))
      .send({
        keputusan: 'approved',
        expected_version: resSubmitChange.body.data.version,
      });
    expect(resApprove.statusCode).toBe(200);

    const recheckKos = await Kos.findById(kos._id);
    expect(recheckKos.status_publikasi).toBe('archived');
  });

  // 12. race dua admin tepat 1 sukses
  it('12. Race condition dua admin: Tepat satu admin yang sukses memutuskan pengajuan yang sama (409 untuk yang kedua)', async () => {
    const { token: tokenAdmin2 } = await createUser('admin');

    const kos = await createKos(pemilikA, {
      status_verifikasi: 'draft',
      version: 1,
      draft_konten: {
        nama: 'Kos Balapan Admin',
        deskripsi: 'Deskripsi',
        alamat: 'Alamat',
        area_kampus: 'Pogung',
        koordinat: { latitude: -7.76, longitude: 110.37 },
        harga_per_bulan: 1000000,
        tipe: 'campur',
        fasilitas: [],
        peraturan: [],
        jumlah_kamar_total: 2,
        jumlah_kamar_tersedia: 2,
        foto_ids: [String(assetA._id)],
      },
    });

    const resSubmit = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    const subId = resSubmit.body.data._id;

    // Dua admin memutuskan secara bersamaan dengan expected_version: 1
    const [resAdmin1, resAdmin2] = await Promise.all([
      request(app)
        .patch(`/api/admin/pengajuan/${subId}/keputusan`)
        .set(auth(tokenAdmin))
        .send({ keputusan: 'approved', expected_version: 1 }),
      request(app)
        .patch(`/api/admin/pengajuan/${subId}/keputusan`)
        .set(auth(tokenAdmin2))
        .send({ keputusan: 'rejected', catatan_verifikasi: 'Ditolak admin 2', expected_version: 1 }),
    ]);

    const statuses = [resAdmin1.statusCode, resAdmin2.statusCode].sort();
    expect(statuses).toEqual([200, 409]);
  });

  // 13. rollback tidak meninggalkan separuh keputusan / audit
  it('13. Transaksi rollback tidak meninggalkan separuh data keputusan atau jejak audit palsu', async () => {
    const kos = await createKos(pemilikA, {
      status_verifikasi: 'draft',
      version: 1,
      draft_konten: {
        nama: 'Kos Rollback Test',
        deskripsi: 'Deskripsi',
        alamat: 'Alamat',
        area_kampus: 'Pogung',
        koordinat: { latitude: -7.76, longitude: 110.37 },
        harga_per_bulan: 1000000,
        tipe: 'campur',
        fasilitas: [],
        peraturan: [],
        jumlah_kamar_total: 2,
        jumlah_kamar_tersedia: 2,
        foto_ids: [String(assetA._id)],
      },
    });

    const resSubmit = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    const subId = resSubmit.body.data._id;

    const initialAuditCount = await AuditLog.countDocuments();

    // Kirim keputusan dengan expected_version yang salah -> transaksi batal / tidak dieksekusi
    const resFail = await request(app)
      .patch(`/api/admin/pengajuan/${subId}/keputusan`)
      .set(auth(tokenAdmin))
      .send({
        keputusan: 'approved',
        expected_version: 999, // versi salah
      });

    expect(resFail.statusCode).toBe(409);

    // Pastikan tidak ada audit log yang tercipta
    const finalAuditCount = await AuditLog.countDocuments();
    expect(finalAuditCount).toBe(initialAuditCount);

    // Pengajuan tetap pending
    const pengajuan = await Pengajuan.findById(subId);
    expect(pengajuan.status).toBe('pending');
  });

  // 14. aset owner lain ditolak
  it('14. Penggunaan aset media milik pemilik lain ditolak (403 Forbidden)', async () => {
    // Pemilik B mengunggah fotonya sendiri
    const assetB = await createMediaAsset(pemilikB);

    // Pemilik A mencoba membuat draft dengan merujuk assetB milik Pemilik B
    const resDraft = await request(app)
      .post('/api/pemilik/kos')
      .set(auth(tokenPemilikA))
      .send({
        nama: 'Kos Mencuri Foto',
        foto_ids: [String(assetB._id)],
      });

    expect(resDraft.statusCode).toBe(403);
    expect(resDraft.body.message).toMatch(/milik pengguna lain/i);
  });

  // 15. DTO publik tak bocorkan draft / admin / private
  it('15. DTO publik tidak membocorkan draf perubahan, catatan admin internal, atau kontak privat', async () => {
    const kos = await createKos(pemilikA, {
      nama: 'Kos Publik Steril',
      status_verifikasi: 'approved',
      version: 1,
    });

    // Buat perubahan yang masih draft
    await request(app)
      .put(`/api/pemilik/kos/${kos._id}/perubahan`)
      .set(auth(tokenPemilikA))
      .send({
        expected_version: 1,
        nama: 'Nama Rahasia Belum Disetujui',
      });

    const resPublic = await request(app).get(`/api/kos/${kos._id}`);
    expect(resPublic.statusCode).toBe(200);

    const body = resPublic.body.data;
    expect(body.nama).toBe('Kos Publik Steril');
    expect(body.draft_konten).toBeUndefined();
    expect(body.perubahan_tertunda).toBeUndefined();
    expect(body.catatan_verifikasi).toBeUndefined();
    expect(body.diverifikasi_oleh).toBeUndefined();
    expect(body.pemilik_id.email).toBeUndefined();
    expect(body.pemilik_id.nomor_telepon).toBeUndefined();
  });

  // Pengujian Media API (/api/media)
  it('Media API: Upload berkas JPEG/PNG valid menghasilkan 201 dan PhotoResult serta dapat di-GET via /uploads/filename', async () => {
    const resUpload = await request(app)
      .post('/api/media')
      .set(auth(tokenPemilikA))
      .attach('file', samplePngBuffer, { filename: 'test-kamar.png', contentType: 'image/png' })
      .field('alt', 'Foto kamar mandi');

    expect(resUpload.statusCode).toBe(201);
    expect(resUpload.body.success).toBe(true);
    expect(resUpload.body.data.asset_id).toBeDefined();
    expect(resUpload.body.data.url).toMatch(/^https?:\/\//);
    expect(resUpload.body.data.alt).toBe('Foto kamar mandi');

    // Verifikasi bahwa Express static route /uploads/:filename mengembalikan berkas biner PNG yang persis sama
    const photoUrl = resUpload.body.data.url;
    const pathname = new URL(photoUrl).pathname;
    const resGetFile = await request(app).get(pathname);
    expect(resGetFile.statusCode).toBe(200);
    expect(resGetFile.headers['content-type']).toMatch(/image\/png/);
    expect(resGetFile.body).toEqual(samplePngBuffer);
  });

  it('Media API: Menolak berkas yang bukan gambar atau magic bytes rusak dengan 422', async () => {
    const fakeBuffer = Buffer.from('Bukan berkas gambar yang sah');

    const resFake = await request(app)
      .post('/api/media')
      .set(auth(tokenPemilikA))
      .attach('file', fakeBuffer, { filename: 'fake.png', contentType: 'image/png' });

    expect(resFake.statusCode).toBe(422);
    expect(resFake.body.code).toBe('VALIDATION_ERROR');
  });

  // 16. Archive di tengah review lalu APPROVE HARUS SUKSES dan status tetap archived
  it('16. Archive di tengah review lalu APPROVE HARUS SUKSES dan status tetap archived (base_version tidak konflik)', async () => {
    // 1. Setup listing approved awal
    const kos = await createKos(pemilikA, {
      nama: 'Kos Mawar Asli',
      harga_per_bulan: 1500000,
      jumlah_kamar_total: 10,
      jumlah_kamar_tersedia: 5,
      status_verifikasi: 'approved',
      status_publikasi: 'active',
      version: 1,
      foto: [assetA.url],
      foto_id_list: [assetA._id],
    });

    // 2. Pemilik membuat draft perubahan
    const resChangeDraft = await request(app)
      .put(`/api/pemilik/kos/${kos._id}/perubahan`)
      .set(auth(tokenPemilikA))
      .send({
        expected_version: 1,
        nama: 'Kos Mawar Renovasi Baru',
      });
    expect(resChangeDraft.statusCode).toBe(200);

    // 3. Pemilik mengajukan perubahan ke admin (pengajuan menjadi pending)
    const resSubmitChange = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/perubahan/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    expect(resSubmitChange.statusCode).toBe(200);
    const submissionId = resSubmitChange.body.data._id;
    expect(resSubmitChange.body.data.base_version).toBe(1);

    // 4. Di tengah review, pemilik mengarsipkan listing publiknya
    const resArchive = await request(app)
      .patch(`/api/pemilik/kos/${kos._id}/publikasi`)
      .set(auth(tokenPemilikA))
      .send({
        status_publikasi: 'archived',
        expected_version: 1,
      });
    expect(resArchive.statusCode).toBe(200);
    expect(resArchive.body.data.status_publikasi).toBe('archived');

    // Pastikan kos berstatus archived di DB
    const kosAfterArchive = await Kos.findById(kos._id);
    expect(kosAfterArchive.status_publikasi).toBe('archived');

    // 5. Admin menyetujui pengajuan perubahan
    const resApprove = await request(app)
      .patch(`/api/admin/pengajuan/${submissionId}/keputusan`)
      .set(auth(tokenAdmin))
      .send({
        keputusan: 'approved',
        expected_version: resSubmitChange.body.data.version,
        catatan_verifikasi: 'Disetujui perubahannya',
      });

    // Approval HARUS SUKSES tanpa konflik base_version
    expect(resApprove.statusCode).toBe(200);
    expect(resApprove.body.success).toBe(true);
    expect(resApprove.body.data.status).toBe('approved');

    // Verifikasi pada dokumen Kos: konten terupdate, tetapi status publikasi TETAP archived!
    const kosFinal = await Kos.findById(kos._id);
    expect(kosFinal.nama).toBe('Kos Mawar Renovasi Baru');
    expect(kosFinal.status_verifikasi).toBe('approved');
    expect(kosFinal.status_publikasi).toBe('archived');
  });

  // 17. Uji koordinat [0, 0] valid yang memang dipilih vs koordinat tidak disuplai
  it('17. Uji koordinat [0, 0] valid yang memang dipilih vs koordinat tidak disuplai (bukan sentinel 0)', async () => {
    // A. Koordinat tidak disuplai -> draft tidak memuat koordinat
    const resDraftNoCoord = await request(app)
      .post('/api/pemilik/kos')
      .set(auth(tokenPemilikA))
      .send({
        nama: 'Kos Tanpa Koordinat',
      });
    expect(resDraftNoCoord.statusCode).toBe(201);
    expect(resDraftNoCoord.body.data.draft.koordinat).toBeUndefined();

    // Submit tanpa koordinat ditolak 422
    const resSubmitNoCoord = await request(app)
      .post(`/api/pemilik/kos/${resDraftNoCoord.body.data._id}/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    expect(resSubmitNoCoord.statusCode).toBe(422);
    expect(resSubmitNoCoord.body.errors.koordinat).toBeDefined();

    // B. Koordinat [0, 0] valid yang memang dipilih
    const resDraftZero = await request(app)
      .post('/api/pemilik/kos')
      .set(auth(tokenPemilikA))
      .send({
        nama: 'Kos Di Garis Khatulistiwa',
        deskripsi: 'Kos tepat di koordinat 0,0',
        alamat: 'Pulau Null',
        koordinat: { latitude: 0, longitude: 0 },
        harga_per_bulan: 500000,
        tipe: 'campur',
        jumlah_kamar_total: 4,
        jumlah_kamar_tersedia: 2,
        foto_ids: [String(assetA._id)],
      });
    expect(resDraftZero.statusCode).toBe(201);
    expect(resDraftZero.body.data.draft.koordinat).toEqual({ latitude: 0, longitude: 0 });

    // Submit dengan koordinat [0, 0] HARUS SUKSES
    const resSubmitZero = await request(app)
      .post(`/api/pemilik/kos/${resDraftZero.body.data._id}/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    expect(resSubmitZero.statusCode).toBe(200);
    expect(resSubmitZero.body.data.status).toBe('pending');
    expect(resSubmitZero.body.data.after.koordinat).toEqual({ latitude: 0, longitude: 0 });
  });

  // 18. Harga sewa minimal 1 (bukan batas 100rb lama) dan area_kampus opsional
  it('18. Harga sewa minimal 1 (bukan batas 100rb lama) dan area_kampus opsional saat submit', async () => {
    // Harga 0 ditolak
    const resZeroPrice = await request(app)
      .post('/api/pemilik/kos')
      .set(auth(tokenPemilikA))
      .send({
        harga_per_bulan: 0,
      });
    expect(resZeroPrice.statusCode).toBe(422);

    // Harga 50000 (< 100000 lama) diterima karena batas kontrak baru >= 1
    // dan tanpa area_kampus submit tetap berhasil (area_kampus opsional)
    const resCreate = await request(app)
      .post('/api/pemilik/kos')
      .set(auth(tokenPemilikA))
      .send({
        nama: 'Kos Murah Nasional',
        deskripsi: 'Deskripsi kos murah meriah',
        alamat: 'Jl. Merdeka No 1',
        // area_kampus sengaja dikosongkan (opsional)
        koordinat: { latitude: -6.2, longitude: 106.8 },
        harga_per_bulan: 50000,
        tipe: 'campur',
        jumlah_kamar_total: 5,
        jumlah_kamar_tersedia: 5,
        foto_ids: [String(assetA._id)],
      });
    expect(resCreate.statusCode).toBe(201);

    const resSubmit = await request(app)
      .post(`/api/pemilik/kos/${resCreate.body.data._id}/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    expect(resSubmit.statusCode).toBe(200);
    expect(resSubmit.body.data.status).toBe('pending');
    expect(resSubmit.body.data.after.harga_per_bulan).toBe(50000);
    expect(resSubmit.body.data.after.area_kampus).toBe('');
  });

  // 19. Hook cleanup foto Kos.deleteOne tidak menghapus berkas yang masih dirujuk
  it('19. Hook cleanup foto pada deleteOne Kos tidak menghapus berkas yang masih dirujuk MediaAsset atau Pengajuan', async () => {
    const fs = require('fs');
    const path = require('path');
    const { UPLOAD_DIR } = require('../src/services/mediaService');

    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });

    // Buat file dummy fisik di UPLOAD_DIR
    const testFileName = `test-protected-${Date.now()}.png`;
    const testFilePath = path.join(UPLOAD_DIR, testFileName);
    await fs.promises.writeFile(testFilePath, samplePngBuffer);

    // Buat MediaAsset yang merujuk berkas ini
    const mediaAsset = await MediaAsset.create({
      user_id: pemilikA._id,
      file_path: testFilePath,
      url: `/uploads/${testFileName}`,
      original_filename: testFileName,
      mime_type: 'image/png',
      file_size: samplePngBuffer.length,
    });

    // Buat Kos yang menggunakan foto tersebut
    const kos = await Kos.create({
      nama: 'Kos Uji Cleanup',
      pemilik_id: pemilikA._id,
      foto: [`/uploads/${testFileName}`],
      foto_id_list: [mediaAsset._id],
      status_verifikasi: 'draft',
      status_publikasi: 'active',
      status_moderasi: 'normal',
      version: 1,
      version_ketersediaan: 1,
    });

    // Hapus kos secara fisik dengan deleteOne
    await kos.deleteOne();

    // Verifikasi: file fisik di UPLOAD_DIR TIDAK boleh terhapus karena masih dirujuk MediaAsset
    const fileExistsAfterKosDelete = fs.existsSync(testFilePath);
    expect(fileExistsAfterKosDelete).toBe(true);

    // Cleanup tes: hapus berkas fisik
    await fs.promises.unlink(testFilePath).catch(() => {});
  });

  // 20. Serangan route legacy terhadap canonical pending
  it('20. Serangan route legacy PATCH /api/admin/kos/:id/verifikasi tanpa expected_version ditolak 409 tanpa efek samping', async () => {
    const AuditLog = mongoose.model('AuditLog');
    const initialAuditCount = await AuditLog.countDocuments();

    // Buat kos dan ajukan secara kanonikal
    const kos = await createKos(pemilikA, {
      status_verifikasi: 'draft',
      version: 1,
      draft_konten: {
        nama: 'Kos Kanonikal Pending',
        deskripsi: 'Deskripsi lengkap',
        alamat: 'Jl. Kaliurang KM 5',
        area_kampus: 'UGM',
        koordinat: { latitude: -7.76, longitude: 110.37 },
        harga_per_bulan: 1500000,
        tipe: 'putri',
        fasilitas: ['AC', 'WiFi'],
        peraturan: ['No Smoking'],
        jumlah_kamar_total: 6,
        jumlah_kamar_tersedia: 6,
        foto_ids: [String(assetA._id)],
      },
    });

    const resSubmit = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    expect(resSubmit.statusCode).toBe(200);

    const pengajuanSebelum = await Pengajuan.findOne({ kos_id: kos._id, is_active: true, status: 'pending' });
    expect(pengajuanSebelum).not.toBeNull();
    const versiPengajuanAwal = pengajuanSebelum.version;

    // Serangan 1: Admin menyerang lewat route legacy TANPA expected_version
    const resLegacyNoVersion = await request(app)
      .patch(`/api/admin/kos/${kos._id}/verifikasi`)
      .set(auth(tokenAdmin))
      .send({
        status_verifikasi: 'approved',
      });
    expect(resLegacyNoVersion.statusCode).toBe(409);
    expect(resLegacyNoVersion.body.code).toBe('CONFLICT');

    // Serangan 2: Admin menyerang lewat route legacy dengan expected_version basi (stale)
    const resLegacyStaleVersion = await request(app)
      .patch(`/api/admin/kos/${kos._id}/verifikasi`)
      .set(auth(tokenAdmin))
      .send({
        status_verifikasi: 'approved',
        expected_version: 999,
      });
    expect(resLegacyStaleVersion.statusCode).toBe(409);
    expect(resLegacyStaleVersion.body.code).toBe('CONFLICT');

    // Pastikan status publik, snapshot pengajuan, dan audit log TIDAK berubah sama sekali
    const kosRecheck = await Kos.findById(kos._id);
    expect(kosRecheck.status_verifikasi).toBe('pending');
    expect(kosRecheck.diverifikasi_oleh).toBeNull();

    const pengajuanRecheck = await Pengajuan.findById(pengajuanSebelum._id);
    expect(pengajuanRecheck.status).toBe('pending');
    expect(pengajuanRecheck.version).toBe(versiPengajuanAwal);
    expect(pengajuanRecheck.is_active).toBe(true);

    const auditCountAfterAttack = await AuditLog.countDocuments();
    expect(auditCountAfterAttack).toBe(initialAuditCount);

    // Sekarang panggil route legacy DENGAN expected_version yang benar -> didelegasikan kanonikal
    const resLegacyValid = await request(app)
      .patch(`/api/admin/kos/${kos._id}/verifikasi`)
      .set(auth(tokenAdmin))
      .send({
        status_verifikasi: 'approved',
        expected_version: versiPengajuanAwal,
      });
    expect(resLegacyValid.statusCode).toBe(200);

    const kosApproved = await Kos.findById(kos._id);
    expect(kosApproved.status_verifikasi).toBe('approved');
    expect(kosApproved.nama).toBe('Kos Kanonikal Pending'); // snapshot diterapkan!

    const pengajuanSelesai = await Pengajuan.findById(pengajuanSebelum._id);
    expect(pengajuanSelesai.status).toBe('approved');
    expect(pengajuanSelesai.is_active).toBe(false); // menjadi non-aktif / historis
  });

  // 21. Jalur pemulihan listing pending legacy tanpa Pengajuan
  it('21. Jalur pemulihan: Listing pending legacy tanpa Pengajuan dapat ditarik ke draft tanpa 409 dead-end', async () => {
    // Buat listing berstatus pending langsung di DB tanpa dokumen Pengajuan (kondisi legacy)
    const legacyKos = await Kos.create({
      nama: 'Kos Pending Zaman Kuno',
      deskripsi: 'Deskripsi kos kuno',
      alamat: 'Jl. Kuno No. 1',
      pemilik_id: pemilikA._id,
      status_verifikasi: 'pending',
      status_publikasi: 'active',
      status_moderasi: 'normal',
      version: 1,
      version_ketersediaan: 1,
      jumlah_kamar_total: 5,
      jumlah_kamar_tersedia: 5,
      draft_konten: null,
    });

    // Pastikan tidak ada Pengajuan untuk kos ini
    const countPengajuan = await Pengajuan.countDocuments({ kos_id: legacyKos._id });
    expect(countPengajuan).toBe(0);

    // Pemilik menarik listing via endpoint tarik kanonikal
    const resWithdraw = await request(app)
      .post(`/api/pemilik/kos/${legacyKos._id}/tarik`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });

    expect(resWithdraw.statusCode).toBe(200);
    expect(resWithdraw.body.data.status_verifikasi).toBe('draft');
    expect(resWithdraw.body.data.version).toBe(2);

    // Periksa bahwa kos sekarang draft dan draft_konten telah diinisialisasi
    const updated = await Kos.findById(legacyKos._id);
    expect(updated.status_verifikasi).toBe('draft');
    expect(updated.draft_konten).not.toBeNull();
    expect(updated.draft_konten.nama).toBe('Kos Pending Zaman Kuno');
  });

  // 22. MediaAsset storage_kind legacy_remote tidak membuat path fiktif dan aman dari unlink
  it('22. MediaAsset storage_kind legacy_remote memiliki file_path null dan tidak memicu filesystem unlink', async () => {
    const remoteUrl = 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format';

    const remoteAsset = await MediaAsset.create({
      user_id: pemilikA._id,
      storage_kind: 'legacy_remote',
      file_path: null,
      url: remoteUrl,
      original_filename: 'remote-photo.jpg',
      mime_type: 'image/jpeg',
      file_size: 2048,
    });

    expect(remoteAsset.storage_kind).toBe('legacy_remote');
    expect(remoteAsset.file_path).toBeNull();

    // Hapus mediaAsset (tidak sedang dipakai) -> harus berhasil tanpa error filesystem
    const { deleteMediaAsset } = require('../src/services/mediaService');
    const resultDelete = await deleteMediaAsset(pemilikA._id, remoteAsset._id);
    expect(resultDelete).toBe(true);

    const recheckAsset = await MediaAsset.findById(remoteAsset._id);
    expect(recheckAsset.is_deleted).toBe(true);
  });

  // 23. Histori pengajuan review immutable dan tidak memicu duplicate key pada resubmit
  it('23. Histori pengajuan yang diputuskan (revision/rejected) tersimpan immutable dan resubmit sukses', async () => {
    const kos = await createKos(pemilikA, {
      status_verifikasi: 'draft',
      version: 1,
      draft_konten: {
        nama: 'Kos Siklus Ganda',
        deskripsi: 'Deskripsi awal',
        alamat: 'Jl. Babarsari',
        area_kampus: 'Atma Jaya',
        koordinat: { latitude: -7.78, longitude: 110.41 },
        harga_per_bulan: 1200000,
        tipe: 'campur',
        fasilitas: ['WiFi'],
        peraturan: [],
        jumlah_kamar_total: 3,
        jumlah_kamar_tersedia: 3,
        foto_ids: [String(assetA._id)],
      },
    });

    // 1. Submit pengajuan awal (pending)
    const resSub1 = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    expect(resSub1.statusCode).toBe(200);
    const subId1 = resSub1.body.data._id;

    // 2. Admin menolak (rejected)
    const resDecision1 = await request(app)
      .patch(`/api/admin/pengajuan/${subId1}/keputusan`)
      .set(auth(tokenAdmin))
      .send({
        keputusan: 'rejected',
        catatan_verifikasi: 'Foto kurang jelas, harap unggah foto tampak depan.',
        expected_version: 1,
      });
    expect(resDecision1.statusCode).toBe(200);

    const p1 = await Pengajuan.findById(subId1);
    expect(p1.status).toBe('rejected');
    expect(p1.is_active).toBe(false);

    // 3. Pemilik mengedit draft dan mengajukan ulang (resubmit)
    const resEdit = await request(app)
      .patch(`/api/pemilik/kos/${kos._id}`)
      .set(auth(tokenPemilikA))
      .send({
        expected_version: 3,
        deskripsi: 'Deskripsi baru setelah foto diperjelas',
      });
    expect(resEdit.statusCode).toBe(200);

    // 4. Submit kembali -> HARUS BERHASIL tanpa Duplicate Key Error uniq_active_pengajuan_per_kos!
    const resSub2 = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 4 });
    expect(resSub2.statusCode).toBe(200);
    const subId2 = resSub2.body.data._id;

    expect(subId2).not.toEqual(subId1); // Pengajuan baru dengan ID baru!

    const p2 = await Pengajuan.findById(subId2);
    expect(p2.status).toBe('pending');
    expect(p2.is_active).toBe(true);

    // Pengajuan pertama tetap ada di histori dan tidak termodifikasi
    const p1Recheck = await Pengajuan.findById(subId1);
    expect(p1Recheck.status).toBe('rejected');
    expect(p1Recheck.catatan_verifikasi).toBe('Foto kurang jelas, harap unggah foto tampak depan.');
    expect(p1Recheck.is_active).toBe(false);
  });

  // 24. softDeleteKos menolak 409 bila ada pengajuan perubahan pending; setelah ditarik, soft delete sukses mempertahankan histori
  it('24. softDeleteKos menolak 409 bila ada pengajuan perubahan pending; setelah ditarik, soft delete sukses mempertahankan histori', async () => {
    const kos = await createKos(pemilikA, {
      nama: 'Kos Uji Soft Delete Guard',
      status_verifikasi: 'approved',
      status_publikasi: 'active',
      version: 1,
      foto: [assetA.url],
      foto_id_list: [assetA._id],
    });

    // 1. Buat draft perubahan dan ajukan sehingga status perubahan menjadi pending
    const resDraftChange = await request(app)
      .put(`/api/pemilik/kos/${kos._id}/perubahan`)
      .set(auth(tokenPemilikA))
      .send({
        expected_version: 1,
        nama: 'Kos Uji Soft Delete Perubahan Pending',
      });
    expect(resDraftChange.statusCode).toBe(200);

    const resSubmit = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/perubahan/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    expect(resSubmit.statusCode).toBe(200);

    // 2. Arsipkan kos terlebih dahulu (syarat soft delete adalah status_publikasi: archived)
    const resArchive = await request(app)
      .patch(`/api/pemilik/kos/${kos._id}/publikasi`)
      .set(auth(tokenPemilikA))
      .send({
        status_publikasi: 'archived',
        expected_version: 1,
      });
    expect(resArchive.statusCode).toBe(200);

    // 3. Coba hapus (soft delete) saat pengajuan perubahan masih pending -> HARUS DITOLAK 409
    const resDeletePending = await request(app)
      .delete(`/api/pemilik/kos/${kos._id}`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    expect(resDeletePending.statusCode).toBe(409);
    expect(resDeletePending.body.message).toMatch(/pengajuan perubahan sedang dalam peninjauan admin/i);

    // 4. Tarik pengajuan perubahan (withdraw)
    const resWithdraw = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/perubahan/tarik`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: resSubmit.body.data.version });
    expect(resWithdraw.statusCode).toBe(200);

    // 5. Setelah ditarik, soft delete berhasil!
    const resDeleteSuccess = await request(app)
      .delete(`/api/pemilik/kos/${kos._id}`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    expect(resDeleteSuccess.statusCode).toBe(200);
    expect(resDeleteSuccess.body.success).toBe(true);

    // Pastikan kos soft deleted (deleted_at terisi) dan histori pengajuan tetap ada
    const deletedKos = await Kos.findById(kos._id);
    expect(deletedKos.deleted_at).not.toBeNull();

    const pengajuanHistori = await Pengajuan.find({ kos_id: kos._id });
    expect(pengajuanHistori.length).toBeGreaterThanOrEqual(1);
  });

  // 25. Keputusan admin terhadap kos yang telah di-soft-delete ditolak 409 Conflict
  it('25. Keputusan admin terhadap kos yang telah di-soft-delete ditolak 409 Conflict', async () => {
    const kos = await createKos(pemilikA, {
      status_verifikasi: 'approved',
      status_publikasi: 'archived',
      version: 1,
      foto: [assetA.url],
      foto_id_list: [assetA._id],
    });

    const resChange = await request(app)
      .put(`/api/pemilik/kos/${kos._id}/perubahan`)
      .set(auth(tokenPemilikA))
      .send({
        expected_version: 1,
        nama: 'Kos Diuji Stale Admin',
      });
    expect(resChange.statusCode).toBe(200);

    const resSubmit = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/perubahan/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    expect(resSubmit.statusCode).toBe(200);
    const subId = resSubmit.body.data._id;
    const subVersion = resSubmit.body.data.version;

    // Simulasikan kos dihapus (misal lewat soft-delete langsung di model / background cleanup)
    await Kos.updateOne({ _id: kos._id }, { deleted_at: new Date() });

    // Admin mencoba menyetujui pengajuan tersebut
    const resDecision = await request(app)
      .patch(`/api/admin/pengajuan/${subId}/keputusan`)
      .set(auth(tokenAdmin))
      .send({
        keputusan: 'approved',
        expected_version: subVersion,
      });

    expect(resDecision.statusCode).toBe(409);
    expect(resDecision.body.code).toBe('CONFLICT');
    expect(resDecision.body.message).toMatch(/telah dihapus/i);
  });

  // 26. Revise -> resubmit -> approve -> buka editor perubahan baru tidak kembali ke revisi usang
  it('26. Alur revisi -> pengajuan ulang -> disetujui -> buka draft perubahan berikutnya memulai dari konten publik terkini (bukan revisi usang)', async () => {
    // 1. Setup listing approved awal
    const kos = await createKos(pemilikA, {
      nama: 'Kos Awal Asli',
      harga_per_bulan: 1000000,
      jumlah_kamar_total: 5,
      jumlah_kamar_tersedia: 5,
      status_verifikasi: 'approved',
      status_publikasi: 'active',
      version: 1,
      foto: [assetA.url],
      foto_id_list: [assetA._id],
    });

    // 2. Pemilik membuat perubahan dan submit
    const resChange1 = await request(app)
      .put(`/api/pemilik/kos/${kos._id}/perubahan`)
      .set(auth(tokenPemilikA))
      .send({
        expected_version: 1,
        nama: 'Kos Nama Pengajuan Pertama',
      });
    expect(resChange1.statusCode).toBe(200);
    const subId1 = resChange1.body.data._id;

    const resSubmit1 = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/perubahan/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: 1 });
    expect(resSubmit1.statusCode).toBe(200);

    // 3. Admin meminta revisi
    const resRev1 = await request(app)
      .patch(`/api/admin/pengajuan/${subId1}/keputusan`)
      .set(auth(tokenAdmin))
      .send({
        keputusan: 'revision',
        catatan_verifikasi: 'Harap perjelas nama kos dengan branding resmi.',
        expected_version: resSubmit1.body.data.version,
      });
    expect(resRev1.statusCode).toBe(200);

    // 4. Pemilik memperbaiki sesuai permintaan revisi dan submit ulang
    const resChange2 = await request(app)
      .put(`/api/pemilik/kos/${kos._id}/perubahan`)
      .set(auth(tokenPemilikA))
      .send({
        expected_version: resRev1.body.data.version,
        nama: 'Kos Eksklusif Melati Resmi',
      });
    expect(resChange2.statusCode).toBe(200);
    const subId2 = resChange2.body.data._id;

    const resSubmit2 = await request(app)
      .post(`/api/pemilik/kos/${kos._id}/perubahan/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: resChange2.body.data.version });
    expect(resSubmit2.statusCode).toBe(200);

    // 5. Admin menyetujui pengajuan kedua
    const resApprove = await request(app)
      .patch(`/api/admin/pengajuan/${subId2}/keputusan`)
      .set(auth(tokenAdmin))
      .send({
        keputusan: 'approved',
        expected_version: resSubmit2.body.data.version,
      });
    expect(resApprove.statusCode).toBe(200);

    // Verifikasi konten publik sekarang adalah 'Kos Eksklusif Melati Resmi'
    const publicKos = await Kos.findById(kos._id);
    expect(publicKos.nama).toBe('Kos Eksklusif Melati Resmi');

    // 6. Pemilik membuka editor perubahan baru (GET /api/pemilik/kos/:id/perubahan)
    // Sesuai kontrak: jika tidak ada draf perubahan aktif, GET mengembalikan 404
    const resNewEditor404 = await request(app)
      .get(`/api/pemilik/kos/${kos._id}/perubahan`)
      .set(auth(tokenPemilikA));
    expect(resNewEditor404.statusCode).toBe(404);

    // 7. Pemilik membuat draft perubahan baru melalui PUT dengan expected_version dari listing approved terkini
    const resNewChange = await request(app)
      .put(`/api/pemilik/kos/${kos._id}/perubahan`)
      .set(auth(tokenPemilikA))
      .send({
        expected_version: publicKos.version,
        nama: 'Kos Perubahan Lanjutan',
      });
    expect(resNewChange.statusCode).toBe(200);
    expect(resNewChange.body.data.status).toBe('draft');
    // Snapshot 'before' harus berasal dari publik terkini
    expect(resNewChange.body.data.before.nama).toBe('Kos Eksklusif Melati Resmi');
    expect(resNewChange.body.data.after.nama).toBe('Kos Perubahan Lanjutan');

    // Sejarah pengajuan sebelumnya (subId1 dan subId2) tidak termutasi
    const p1Recheck = await Pengajuan.findById(subId1);
    expect(p1Recheck.status).toBe('revision');
    const p2Recheck = await Pengajuan.findById(subId2);
    expect(p2Recheck.status).toBe('approved');
  });

  // 27. Race condition dua PUT konkuren pada draft perubahan existing dengan expected_version sama
  it('27. Race condition dua PUT konkuren pada draft perubahan existing menghasilkan tepat satu 200 dan satu 409 CAS, versi naik tepat 1', async () => {
    const kos = await createKos(pemilikA, {
      nama: 'Kos Uji CAS Draft Perubahan',
      status_verifikasi: 'approved',
      version: 1,
      foto: [assetA.url],
      foto_id_list: [assetA._id],
    });

    // Buat draft perubahan awal (version: 1)
    const resDraftAwal = await request(app)
      .put(`/api/pemilik/kos/${kos._id}/perubahan`)
      .set(auth(tokenPemilikA))
      .send({
        expected_version: 1,
        nama: 'Draft Perubahan Versi 1',
      });
    expect(resDraftAwal.statusCode).toBe(200);
    expect(resDraftAwal.body.data.version).toBe(1);

    // Dua request konkuren mengedit draft yang sama dengan expected_version 1
    const [res1, res2] = await Promise.all([
      request(app)
        .put(`/api/pemilik/kos/${kos._id}/perubahan`)
        .set(auth(tokenPemilikA))
        .send({
          expected_version: 1,
          nama: 'Edit Bersamaan Tab 1',
        }),
      request(app)
        .put(`/api/pemilik/kos/${kos._id}/perubahan`)
        .set(auth(tokenPemilikA))
        .send({
          expected_version: 1,
          nama: 'Edit Bersamaan Tab 2',
        }),
    ]);

    const statusCodes = [res1.statusCode, res2.statusCode].sort();
    expect(statusCodes).toEqual([200, 409]);

    const winner = res1.statusCode === 200 ? res1 : res2;
    const loser = res1.statusCode === 409 ? res1 : res2;

    expect(loser.body.code).toBe('CONFLICT');

    // Versi naik tepat 1 (dari 1 menjadi 2)
    expect(winner.body.data.version).toBe(2);

    // Periksa di DB: pengajuan memiliki versi 2 dan nama sesuai pemenang
    const activePengajuan = await Pengajuan.findOne({ kos_id: kos._id, is_active: true });
    expect(activePengajuan.version).toBe(2);
    expect(activePengajuan.after.nama).toBe(winner.body.data.after.nama);
  });

  // 28. Multipart ke POST legacy /api/kos ditolak 409 tanpa efek samping: tidak menulis file fisik dan tidak membuat dokumen Kos baru
  it('28. Multipart ke POST legacy /api/kos ditolak 409 tanpa menulis file dan tanpa membuat dokumen Kos baru', async () => {
    const fs = require('fs');
    const path = require('path');
    const UPLOAD_DIR = path.join(__dirname, '../uploads');
    const initialFiles = fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : [];
    const initialKosCount = await Kos.countDocuments();

    const res = await request(app)
      .post('/api/kos')
      .set(auth(tokenPemilikA))
      .field('nama', 'Kos Mencoba Upload File Lewat Legacy')
      .field('alamat', 'Jl. Percobaan No. 99')
      .field('harga_per_bulan', '1500000')
      .attach('foto', samplePngBuffer, 'test-should-not-be-saved.png');

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('DEPRECATED_ENDPOINT');

    // Dokumen Kos tidak bertambah
    const finalKosCount = await Kos.countDocuments();
    expect(finalKosCount).toBe(initialKosCount);

    // File tidak ditulis ke UPLOAD_DIR
    const finalFiles = fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : [];
    expect(finalFiles.length).toBe(initialFiles.length);
  });

  // 29. Table-driven integration tests untuk visibilitas publik lintas list/detail/map/favorit/inquiry
  it('29. Table-driven integration tests: status non-aktif/unknown tersembunyi konsisten dan legacy missing fields tetap tampil', async () => {
    const Favorit = mongoose.model('Favorit');
    const Inquiry = mongoose.model('Inquiry');
    const User = mongoose.model('User');

    // Skenario pengujian visibilitas publik
    const testCases = [
      {
        deskripsi: 'Kos berstatus publikasi archived',
        kosOverrides: { status_verifikasi: 'approved', status_publikasi: 'archived', status_moderasi: 'normal' },
        shouldBePublic: false,
      },
      {
        deskripsi: 'Kos berstatus moderasi suspended',
        kosOverrides: { status_verifikasi: 'approved', status_publikasi: 'active', status_moderasi: 'suspended' },
        shouldBePublic: false,
      },
      {
        deskripsi: 'Kos berstatus soft-deleted',
        kosOverrides: { status_verifikasi: 'approved', status_publikasi: 'active', status_moderasi: 'normal', deleted_at: new Date() },
        shouldBePublic: false,
        isDeleted: true,
      },
      {
        deskripsi: 'Kos dengan status_verifikasi bukan approved (misal pending)',
        kosOverrides: { status_verifikasi: 'pending', status_publikasi: 'active', status_moderasi: 'normal' },
        shouldBePublic: false,
      },
      {
        deskripsi: 'Kos dengan status_publikasi unknown / invalid string',
        rawUpdate: { status_publikasi: 'unknown_publikasi' },
        shouldBePublic: false,
      },
      {
        deskripsi: 'Kos dengan status_moderasi unknown / invalid string',
        rawUpdate: { status_moderasi: 'unknown_moderasi' },
        shouldBePublic: false,
      },
      {
        deskripsi: 'Kos dengan status_publikasi explicit null',
        rawUpdate: { status_publikasi: null },
        shouldBePublic: false,
      },
      {
        deskripsi: 'Kos dengan status_moderasi explicit null',
        rawUpdate: { status_moderasi: null },
        shouldBePublic: false,
      },
      {
        deskripsi: 'Kos dengan akun pemilik suspended',
        ownerStatus: 'suspended',
        shouldBePublic: false,
      },
      {
        deskripsi: 'Kos dengan akun pemilik unknown status',
        ownerStatus: 'unknown_owner_status',
        shouldBePublic: false,
      },
      {
        deskripsi: 'Kos data legacy: field status_publikasi dan status_moderasi absent (tanpa field)',
        isLegacyAbsent: true,
        shouldBePublic: true,
      },
    ];

    for (const tc of testCases) {
      let ownerUser = pemilikA;

      if (tc.ownerStatus) {
        const { user: customOwner } = await createUser('pemilik');
        await User.collection.updateOne({ _id: customOwner._id }, { $set: { status: tc.ownerStatus } });
        ownerUser = await User.findById(customOwner._id);
      }

      let kos;
      if (tc.isLegacyAbsent) {
        // Buat langsung lewat collection Mongo agar field status_publikasi dan status_moderasi benar-benar absent
        const insertRes = await Kos.collection.insertOne({
          nama: `Kos Legacy Absent ${Date.now()}`,
          deskripsi: 'Deskripsi legacy',
          alamat: 'Jl. Legacy No. 1',
          area_kampus: 'UGM',
          koordinat: { latitude: -7.76, longitude: 110.37 },
          harga_per_bulan: 1200000,
          tipe: 'campur',
          jumlah_kamar_total: 5,
          jumlah_kamar_tersedia: 5,
          status_verifikasi: 'approved',
          pemilik_id: ownerUser._id,
          foto: [assetA.url],
          foto_id_list: [assetA._id],
          deleted_at: null,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        kos = await Kos.findById(insertRes.insertedId);
      } else {
        // Buat Kos valid terlebih dahulu
        kos = await createKos(ownerUser, {
          nama: `Kos Uji ${tc.deskripsi}`,
          version: 1,
          foto: [assetA.url],
          foto_id_list: [assetA._id],
          ...(tc.kosOverrides || {}),
        });

        // Gunakan collection update jika ada modifikasi raw (nilai unknown / explicit null) untuk melewati validasi Mongoose enum
        if (tc.rawUpdate) {
          await Kos.collection.updateOne({ _id: kos._id }, { $set: tc.rawUpdate });
          kos = await Kos.findById(kos._id);
        }
      }

      // Buat favorit existing untuk pencari
      await Favorit.create({ user_id: pencari._id, kos_id: kos._id });

      // 1. Uji List Publik (GET /api/kos)
      const resList = await request(app).get(`/api/kos?q=${encodeURIComponent(kos.nama)}`);
      expect(resList.statusCode).toBe(200);
      const inList = resList.body.data.some((item) => String(item._id) === String(kos._id));
      expect(inList).toBe(tc.shouldBePublic);

      // 2. Uji Map Publik (GET /api/kos/map)
      const resMap = await request(app).get(`/api/kos/map?q=${encodeURIComponent(kos.nama)}`);
      expect(resMap.statusCode).toBe(200);
      const inMap = resMap.body.data.some((item) => String(item._id) === String(kos._id));
      expect(inMap).toBe(tc.shouldBePublic);

      // 3. Uji Detail Publik (GET /api/kos/:id oleh pencari / non-owner)
      const resDetail = await request(app).get(`/api/kos/${kos._id}`);
      if (tc.shouldBePublic) {
        expect(resDetail.statusCode).toBe(200);
        expect(resDetail.body.data.nama).toBe(kos.nama);
      } else if (tc.isDeleted) {
        expect(resDetail.statusCode).toBe(404);
      } else {
        expect(resDetail.statusCode).toBe(403);
      }

      // 4. Uji Tambah Favorit Baru (PUT /api/favorit/:id oleh pencari)
      const resAddFav = await request(app)
        .put(`/api/favorit/${kos._id}`)
        .set(auth(tokenPencari));
      if (tc.shouldBePublic) {
        expect([200, 201]).toContain(resAddFav.statusCode);
      } else {
        expect(resAddFav.statusCode).toBe(400);
      }

      // 5. Uji Kirim Inquiry Baru (POST /api/inquiry oleh pencari)
      const resNewInquiry = await request(app)
        .post('/api/inquiry')
        .set(auth(tokenPencari))
        .send({
          kos_id: kos._id,
          pesan: 'Pertanyaan tes visibilitas',
        });
      if (tc.shouldBePublic) {
        expect([201, 409]).toContain(resNewInquiry.statusCode);
      } else {
        expect(resNewInquiry.statusCode).toBe(400);
      }

      // 6. Uji Daftar Favorit Existing (GET /api/favorit oleh pencari)
      const resFavList = await request(app)
        .get('/api/favorit')
        .set(auth(tokenPencari));
      expect(resFavList.statusCode).toBe(200);
      const favEntry = resFavList.body.data.find((f) => String(f.kos_id?._id) === String(kos._id));
      expect(favEntry).toBeDefined();
      if (tc.shouldBePublic) {
        expect(favEntry.kos_id.unavailable).toBeUndefined();
        expect(favEntry.kos_id.nama).toBe(kos.nama);
      } else {
        expect(favEntry.kos_id.unavailable).toBe(true);
      }

      // Cleanup favorit dan inquiry uji untuk iterasi berikutnya
      await Favorit.deleteMany({ kos_id: kos._id });
      await Inquiry.deleteMany({ kos_id: kos._id });
    }
  });

  // 30. Keputusan admin menyimpan notifikasi sesuai enum (kos_disetujui, kos_revisi, kos_ditolak) dan kegagalan notifikasi tidak membatalkan keputusan
  it('30. Admin decision menyimpan Notifikasi dengan tipe sesuai enum (approved, revision, rejected) untuk pemilik, dan kegagalan notifikasi tidak membatalkan keputusan/audit', async () => {
    const Notifikasi = mongoose.model('Notifikasi');

    const createAndSubmitTestDraft = async (namaSuffix) => {
      const kos = await createKos(pemilikA, {
        status_verifikasi: 'draft',
        version: 1,
        draft_konten: {
          nama: `Kos Notif ${namaSuffix} ${Date.now()}`,
          deskripsi: 'Deskripsi lengkap kos untuk pengujian keputusan dan notifikasi admin.',
          alamat: 'Jl. Notifikasi No. 10',
          area_kampus: 'UGM',
          koordinat: { latitude: -7.761, longitude: 110.375 },
          harga_per_bulan: 1500000,
          tipe: 'campur',
          fasilitas: ['WiFi', 'Parkir'],
          peraturan: ['Tidak merokok'],
          luas_kamar: '3 x 4 m',
          jumlah_kamar_total: 5,
          jumlah_kamar_tersedia: 5,
          foto_ids: [String(assetA._id)],
        },
      });

      const resSubmit = await request(app)
        .post(`/api/pemilik/kos/${kos._id}/ajukan`)
        .set(auth(tokenPemilikA))
        .send({ expected_version: 1 });
      expect(resSubmit.statusCode).toBe(200);

      return {
        kos,
        subId: resSubmit.body.data._id,
        subVersion: resSubmit.body.data.version,
      };
    };

    try {
      // 1. Keputusan APPROVED -> Notifikasi kos_disetujui & AuditLog KOS_APPROVE
      const setupApprove = await createAndSubmitTestDraft('Approve');
      const resApprove = await request(app)
        .patch(`/api/admin/pengajuan/${setupApprove.subId}/keputusan`)
        .set(auth(tokenAdmin))
        .send({
          keputusan: 'approved',
          expected_version: setupApprove.subVersion,
        });
      expect(resApprove.statusCode).toBe(200);

      const notifApprove = await Notifikasi.findOne({
        user_id: pemilikA._id,
        tipe: 'kos_disetujui',
      }).sort({ createdAt: -1 });
      expect(notifApprove).not.toBeNull();
      expect(notifApprove.tipe).toBe('kos_disetujui');
      expect(notifApprove.judul).toMatch(/disetujui/i);

      const auditApprove = await AuditLog.findOne({
        pengajuan_id: setupApprove.subId,
        aksi: 'KOS_APPROVE',
      });
      expect(auditApprove).not.toBeNull();

      // 2. Keputusan REVISION -> Notifikasi kos_revisi & AuditLog KOS_REVISION
      const setupRevision = await createAndSubmitTestDraft('Revision');
      const catatanRevisi = 'Harap lengkapi foto bagian dapur dan perjelas deskripsi';
      const resRevision = await request(app)
        .patch(`/api/admin/pengajuan/${setupRevision.subId}/keputusan`)
        .set(auth(tokenAdmin))
        .send({
          keputusan: 'revision',
          catatan_verifikasi: catatanRevisi,
          expected_version: setupRevision.subVersion,
        });
      expect(resRevision.statusCode).toBe(200);

      const notifRevision = await Notifikasi.findOne({
        user_id: pemilikA._id,
        tipe: 'kos_revisi',
      }).sort({ createdAt: -1 });
      expect(notifRevision).not.toBeNull();
      expect(notifRevision.tipe).toBe('kos_revisi');
      expect(notifRevision.judul).toMatch(/revisi/i);
      expect(notifRevision.isi).toContain(catatanRevisi);

      const auditRevision = await AuditLog.findOne({
        pengajuan_id: setupRevision.subId,
        aksi: 'KOS_REVISION',
      });
      expect(auditRevision).not.toBeNull();

      // 3. Keputusan REJECTED -> Notifikasi kos_ditolak & AuditLog KOS_REJECT
      const setupReject = await createAndSubmitTestDraft('Reject');
      const catatanTolak = 'Listing ditolak karena tidak memenuhi ketentuan lingkungan';
      const resReject = await request(app)
        .patch(`/api/admin/pengajuan/${setupReject.subId}/keputusan`)
        .set(auth(tokenAdmin))
        .send({
          keputusan: 'rejected',
          catatan_verifikasi: catatanTolak,
          expected_version: setupReject.subVersion,
        });
      expect(resReject.statusCode).toBe(200);

      const notifReject = await Notifikasi.findOne({
        user_id: pemilikA._id,
        tipe: 'kos_ditolak',
      }).sort({ createdAt: -1 });
      expect(notifReject).not.toBeNull();
      expect(notifReject.tipe).toBe('kos_ditolak');
      expect(notifReject.judul).toMatch(/ditolak/i);
      expect(notifReject.isi).toContain(catatanTolak);

      const auditReject = await AuditLog.findOne({
        pengajuan_id: setupReject.subId,
        aksi: 'KOS_REJECT',
      });
      expect(auditReject).not.toBeNull();

      // 4. Mock kegagalan Notifikasi.create -> Keputusan dan AuditLog TETAP commit di DB
      jest.spyOn(Notifikasi, 'create').mockRejectedValueOnce(new Error('Simulasi kegagalan notifikasi database'));

      const setupFailNotif = await createAndSubmitTestDraft('FailNotif');
      const resDecisionWhenNotifFails = await request(app)
        .patch(`/api/admin/pengajuan/${setupFailNotif.subId}/keputusan`)
        .set(auth(tokenAdmin))
        .send({
          keputusan: 'approved',
          expected_version: setupFailNotif.subVersion,
        });

      // Keputusan tetap sukses 200 meskipun notifikasi gagal
      expect(resDecisionWhenNotifFails.statusCode).toBe(200);

      // Verifikasi pengajuan dan kos tetap terupdate (commit transaksi berhasil)
      const subUpdated = await Pengajuan.findById(setupFailNotif.subId);
      expect(subUpdated.status).toBe('approved');

      const kosUpdated = await Kos.findById(setupFailNotif.kos._id);
      expect(kosUpdated.status_verifikasi).toBe('approved');

      // Verifikasi audit log tetap tersimpan di DB
      const auditLogCommited = await AuditLog.findOne({
        pengajuan_id: setupFailNotif.subId,
        aksi: 'KOS_APPROVE',
      });
      expect(auditLogCommited).not.toBeNull();
      expect(String(auditLogCommited.admin)).toBe(String(admin._id));
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('31. Read DTO owner menyertakan summary pengajuan (semua jenis & revisi terkini) dan pagination clamp skip ke halaman terakhir valid', async () => {
    // 1. Buat listing dan submit pengajuan baru (pending)
    const resDraft = await request(app)
      .post('/api/pemilik/kos')
      .set(auth(tokenPemilikA))
      .send({
        nama: 'Kos Mawar Read DTO Test',
        deskripsi: 'Deskripsi lengkap kos mawar untuk pengujian DTO owner',
        alamat: 'Jl. Melati No. 5 Yogyakarta',
        koordinat: { latitude: -7.76, longitude: 110.37 },
        harga_per_bulan: 750000,
        tipe: 'campur',
        jumlah_kamar_total: 5,
        jumlah_kamar_tersedia: 5,
        foto_ids: [String(assetA._id)],
        fasilitas: ['WiFi', 'Kasur'],
        peraturan: ['Bebas Jam Malam'],
      });
    expect(resDraft.statusCode).toBe(201);
    const kosId = resDraft.body.data._id;

    // Submit initial draft -> status Kos menjadi pending
    const resSubmit = await request(app)
      .post(`/api/pemilik/kos/${kosId}/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: resDraft.body.data.version });
    expect(resSubmit.statusCode).toBe(200);

    // Ambil detail Kos: perubahan_tertunda harus terisi dengan summary pengajuan jenis 'baru' status 'pending'
    const resDetailPending = await request(app)
      .get(`/api/pemilik/kos/${kosId}`)
      .set(auth(tokenPemilikA));
    expect(resDetailPending.statusCode).toBe(200);
    expect(resDetailPending.body.data.status_verifikasi).toBe('pending');
    expect(resDetailPending.body.data.draft.nama).toBe('Kos Mawar Read DTO Test');
    expect(resDetailPending.body.data.draft.harga_per_bulan).toBe(750000);
    expect(resDetailPending.body.data.data_publik).toBeNull();
    expect(resDetailPending.body.data.perubahan_tertunda).not.toBeNull();
    expect(resDetailPending.body.data.perubahan_tertunda.jenis).toBe('baru');
    expect(resDetailPending.body.data.perubahan_tertunda.status).toBe('pending');
    const summaryVersion = resDetailPending.body.data.perubahan_tertunda.version;
    expect(typeof summaryVersion).toBe('number');

    // Uji penarikan pengajuan awal menggunakan summaryVersion dari DTO
    const resWithdraw = await request(app)
      .post(`/api/pemilik/kos/${kosId}/tarik`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: summaryVersion });
    expect(resWithdraw.statusCode).toBe(200);
    expect(resWithdraw.body.data.status_verifikasi).toBe('draft');

    // Ajukan kembali untuk melanjutkan skenario revisi admin
    const resResubmitAwal = await request(app)
      .post(`/api/pemilik/kos/${kosId}/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: resWithdraw.body.data.version });
    expect(resResubmitAwal.statusCode).toBe(200);

    // 2. Admin meminta revisi terhadap pengajuan awal
    const pengajuanAwal = await Pengajuan.findOne({ kos_id: kosId, is_active: true });
    expect(pengajuanAwal).not.toBeNull();
    const catatanAdmin = 'Perbaiki foto tampak depan dan perjelas fasilitas';
    const resDecisionRev = await request(app)
      .patch(`/api/admin/pengajuan/${pengajuanAwal._id}/keputusan`)
      .set(auth(tokenAdmin))
      .send({
        keputusan: 'revision',
        catatan_verifikasi: catatanAdmin,
        expected_version: pengajuanAwal.version,
      });
    expect(resDecisionRev.statusCode).toBe(200);

    // Ambil detail Kos setelah revisi: perubahan_tertunda harus memuat catatan_verifikasi
    const resDetailRevision = await request(app)
      .get(`/api/pemilik/kos/${kosId}`)
      .set(auth(tokenPemilikA));
    expect(resDetailRevision.statusCode).toBe(200);
    expect(resDetailRevision.body.data.status_verifikasi).toBe('revision');
    expect(resDetailRevision.body.data.perubahan_tertunda).not.toBeNull();
    expect(resDetailRevision.body.data.perubahan_tertunda.status).toBe('revision');
    expect(resDetailRevision.body.data.perubahan_tertunda.catatan_verifikasi).toBe(catatanAdmin);

    // 3. Resubmit draft setelah revisi lalu admin setujui -> listing approved tidak boleh menampilkan revisi usang
    const resResubmit = await request(app)
      .post(`/api/pemilik/kos/${kosId}/ajukan`)
      .set(auth(tokenPemilikA))
      .send({ expected_version: resDetailRevision.body.data.version });
    expect(resResubmit.statusCode).toBe(200);

    const pengajuanResubmit = await Pengajuan.findOne({ kos_id: kosId, is_active: true });
    const resApprove = await request(app)
      .patch(`/api/admin/pengajuan/${pengajuanResubmit._id}/keputusan`)
      .set(auth(tokenAdmin))
      .send({
        keputusan: 'approved',
        expected_version: pengajuanResubmit.version,
      });
    expect(resApprove.statusCode).toBe(200);

    const resDetailApproved = await request(app)
      .get(`/api/pemilik/kos/${kosId}`)
      .set(auth(tokenPemilikA));
    expect(resDetailApproved.statusCode).toBe(200);
    expect(resDetailApproved.body.data.status_verifikasi).toBe('approved');
    expect(resDetailApproved.body.data.data_publik.foto[0].asset_id).toBe(String(assetA._id));
    // Listing approved tanpa pengajuan perubahan aktif tidak boleh memiliki perubahan_tertunda usang
    expect(resDetailApproved.body.data.perubahan_tertunda).toBeNull();

    // 4. Uji Pagination Clamping: skip dihitung berdasarkan currentPage yang ter-clamp
    const resPagingClampOwner = await request(app)
      .get('/api/pemilik/kos?page=999&limit=10')
      .set(auth(tokenPemilikA));
    expect(resPagingClampOwner.statusCode).toBe(200);
    expect(resPagingClampOwner.body.pagination.currentPage).toBe(resPagingClampOwner.body.pagination.totalPages);
    expect(resPagingClampOwner.body.data.length).toBeGreaterThan(0);

    const resPagingClampAdmin = await request(app)
      .get('/api/admin/pengajuan?status=approved&page=999&limit=10')
      .set(auth(tokenAdmin));
    expect(resPagingClampAdmin.statusCode).toBe(200);
    expect(resPagingClampAdmin.body.pagination.currentPage).toBe(resPagingClampAdmin.body.pagination.totalPages);
    expect(resPagingClampAdmin.body.data.length).toBeGreaterThan(0);

    const resPagingClampAudit = await request(app)
      .get('/api/admin/audit-logs?page=999&limit=10')
      .set(auth(tokenAdmin));
    expect(resPagingClampAudit.statusCode).toBe(200);
    expect(resPagingClampAudit.body.pagination.currentPage).toBe(resPagingClampAudit.body.pagination.totalPages);
    expect(resPagingClampAudit.body.data.length).toBeGreaterThan(0);
  });
});
