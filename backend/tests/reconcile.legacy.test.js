const { app, request, createUser, auth } = require('./helpers');
const mongoose = require('mongoose');
const Kos = require('../src/models/Kos');
const Pengajuan = require('../src/models/Pengajuan');
const { updateAvailability } = require('../src/services/submissionService');
const { reconcileLegacyData } = require('../src/scripts/reconcileLegacyData');

describe('Tahap 2: Legacy Version & Orphan Pending Reconciliation', () => {
  it('allows stock update on legacy kos missing version_ketersediaan without 409', async () => {
    const owner = await createUser('pemilik');

    // Buat dokumen kos langsung melalui collection MongoDB mentah agar field versi sengaja tidak ada di BSON
    const rawResult = await mongoose.connection.collection('kos').insertOne({
      pemilik_id: owner.user._id,
      nama: 'Kos Legacy BSON',
      alamat: 'Jl Kaliurang',
      area_kampus: 'UGM',
      jumlah_kamar_total: 10,
      jumlah_kamar_tersedia: 5,
      status_verifikasi: 'approved',
      status_publikasi: 'active',
      status_moderasi: 'normal',
      deleted_at: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const kosId = rawResult.insertedId;

    // Verifikasi bahwa dokumen mentah di DB memang tidak punya version_ketersediaan
    const rawDoc = await mongoose.connection.collection('kos').findOne({ _id: kosId });
    expect(rawDoc.version_ketersediaan).toBeUndefined();

    // 1. Pemilik memperbarui stok dengan expected_version: 1 -> harus BERHASIL tanpa 409
    const updated = await updateAvailability(owner.user._id, kosId, 7, 1);
    expect(updated).toBeDefined();
    expect(updated.ketersediaan.jumlah_kamar_tersedia).toBe(7);
    expect(updated.ketersediaan.version_ketersediaan).toBe(2);

    // Verifikasi di DB bahwa version_ketersediaan sekarang tersimpan fisik bernilai 2
    const updatedInDb = await mongoose.connection.collection('kos').findOne({ _id: kosId });
    expect(updatedInDb.version_ketersediaan).toBe(2);
    expect(updatedInDb.jumlah_kamar_tersedia).toBe(7);

    // 2. Konflik versi nyata (mengirim expected_version = 1 padahal sekarang versi 2) HARUS tetap 409
    await expect(updateAvailability(owner.user._id, kosId, 8, 1)).rejects.toMatchObject({
      statusCode: 409,
    });

    // 3. Update berikutnya dengan expected_version = 2 berhasil dan naik ke versi 3
    const updatedAgain = await updateAvailability(owner.user._id, kosId, 4, 2);
    expect(updatedAgain.ketersediaan.version_ketersediaan).toBe(3);
  });

  it('reconciles orphan pending kos into admin queue idempotently', async () => {
    const admin = await createUser('admin');
    const owner = await createUser('pemilik');

    // Buat listing pending TANPA Pengajuan kanonikal (simulasi data seeder/legacy lama)
    const orphanKos = await Kos.create({
      pemilik_id: owner.user._id,
      nama: 'Kos Pending Yatim',
      alamat: 'Jl Pogung Raya',
      area_kampus: 'UGM',
      status_verifikasi: 'pending',
      status_publikasi: 'active',
      status_moderasi: 'normal',
    });

    // Sebelum rekonsiliasi: Admin antrean pengajuan kosong
    const queueBefore = await request(app).get('/api/admin/pengajuan').set(auth(admin.token));
    expect(queueBefore.status).toBe(200);
    expect(queueBefore.body.data.some((p) => p.kos_id === String(orphanKos._id))).toBe(false);

    // Jalankan dry-run rekonsiliasi -> mendeteksi tapi tidak mengubah DB
    const dryRunRes = await reconcileLegacyData({ execute: false });
    expect(dryRunRes.isExecute).toBe(false);
    expect(dryRunRes.orphanPendingCount).toBeGreaterThanOrEqual(1);

    const queueAfterDryRun = await request(app).get('/api/admin/pengajuan').set(auth(admin.token));
    expect(queueAfterDryRun.body.data.some((p) => p.kos_id === String(orphanKos._id))).toBe(false);

    // Jalankan eksekusi nyata rekonsiliasi
    const execRes = await reconcileLegacyData({ execute: true });
    expect(execRes.isExecute).toBe(true);
    expect(execRes.createdSubmissionsCount).toBeGreaterThanOrEqual(1);

    // Sekarang listing pending harus muncul di antrean admin
    const queueAfterExec = await request(app).get('/api/admin/pengajuan').set(auth(admin.token));
    expect(queueAfterExec.status).toBe(200);
    const submissionItem = queueAfterExec.body.data.find((p) => p.kos_id === String(orphanKos._id));
    expect(submissionItem).toBeDefined();
    expect(submissionItem.status).toBe('pending');
    expect(submissionItem.nama_kos).toBe('Kos Pending Yatim');
    expect(submissionItem.pemilik._id).toBe(String(owner.user._id));

    // Jalankan eksekusi KEDUA KALI untuk membuktikan IDEMPOTENSI (tidak boleh membuat duplikat)
    const execRes2 = await reconcileLegacyData({ execute: true });
    expect(execRes2.createdSubmissionsCount).toBe(0);

    const queueAfterExec2 = await request(app).get('/api/admin/pengajuan').set(auth(admin.token));
    const duplicateMatches = queueAfterExec2.body.data.filter((p) => p.kos_id === String(orphanKos._id));
    expect(duplicateMatches).toHaveLength(1);
  });
});

