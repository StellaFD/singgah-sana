/**
 * Skrip Rekonsiliasi & Inspeksi Data Legacy Singgah Sana
 *
 * PERILAKU DEFAULT: DRY-RUN (Hanya inspeksi dan simulasi, tidak mengubah database).
 * Untuk eksekusi nyata, jalankan dengan flag: --execute
 *
 * Contoh penggunaan:
 * 1. Inspeksi (Dry-run aman):
 *    node src/scripts/reconcileLegacyData.js
 * 2. Eksekusi pada database pengujian terisolasi:
 *    node src/scripts/reconcileLegacyData.js --execute
 *
 * Fitur:
 * 1. Idempoten: Menjalankan skrip berkali-kali tidak akan menimbulkan duplikasi data atau perubahan ganda.
 * 2. Melaporkan rincian ID dan jumlah record yang diperbaiki.
 * 3. Menghubungkan Kos pending tanpa pengajuan ke Pengajuan baru berstatus pending (tidak memberi auto-approval).
 * 4. Memastikan field version dan version_ketersediaan terisi dengan nilai awal (1).
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Kos = require('../models/Kos');
const Pengajuan = require('../models/Pengajuan');

async function reconcileLegacyData(options = {}) {
  const isExecute = Boolean(options.execute || process.argv.includes('--execute'));
  console.log(`\n======================================================`);
  console.log(`[REKONSILIASI DATA LEGACY] Mode: ${isExecute ? 'EKSEKUSI NYATA' : 'DRY-RUN (SIMULASI / READ-ONLY)'}`);
  console.log(`======================================================\n`);

  // 1. Audit Versi Kos (version dan version_ketersediaan yang belum tersimpan / null / undefined)
  const kosMissingVersions = await Kos.find({
    deleted_at: null,
    $or: [
      { version: { $exists: false } },
      { version: null },
      { version_ketersediaan: { $exists: false } },
      { version_ketersediaan: null },
    ],
  }).lean();

  console.log(`[1. AUDIT VERSI] Ditemukan ${kosMissingVersions.length} listing dengan field version/version_ketersediaan belum terinisialisasi.`);
  const versionUpdates = [];
  for (const k of kosMissingVersions) {
    const updateFields = {};
    if (k.version === undefined || k.version === null) updateFields.version = 1;
    if (k.version_ketersediaan === undefined || k.version_ketersediaan === null) updateFields.version_ketersediaan = 1;

    versionUpdates.push({
      _id: k._id,
      nama: k.nama || '(tanpa nama)',
      updates: updateFields,
    });
  }

  if (isExecute && versionUpdates.length > 0) {
    for (const item of versionUpdates) {
      await Kos.updateOne({ _id: item._id }, { $set: item.updates });
    }
    console.log(`   -> Berhasil memperbarui field versi pada ${versionUpdates.length} listing.`);
  } else if (!isExecute && versionUpdates.length > 0) {
    console.log(`   -> [DRY-RUN] Simulasi pembaruan versi untuk ${versionUpdates.length} dokumen:`);
    versionUpdates.slice(0, 5).forEach((u) => console.log(`      * [${u._id}] ${u.nama} -> ${JSON.stringify(u.updates)}`));
    if (versionUpdates.length > 5) console.log(`      * ...dan ${versionUpdates.length - 5} dokumen lainnya.`);
  }

  // 2. Audit Listing Pending Tanpa Pengajuan Kanonikal
  const pendingKosList = await Kos.find({
    deleted_at: null,
    status_verifikasi: 'pending',
  }).lean();

  console.log(`\n[2. AUDIT ANTREAN PENDING] Ditemukan ${pendingKosList.length} listing dengan status_verifikasi = 'pending'.`);

  const orphanPendingKos = [];
  for (const k of pendingKosList) {
    const existingSubmission = await Pengajuan.findOne({
      kos_id: k._id,
      is_active: true,
      status: 'pending',
    }).lean();

    if (!existingSubmission) {
      orphanPendingKos.push(k);
    }
  }

  console.log(`   -> Dari ${pendingKosList.length} listing pending, ditemukan ${orphanPendingKos.length} listing TANPA Pengajuan aktif di antrean.`);

  const createdSubmissions = [];
  if (orphanPendingKos.length > 0) {
    for (const k of orphanPendingKos) {
      const submissionDoc = {
        kos_id: k._id,
        pemilik_id: k.pemilik_id,
        jenis: (k.version && k.version > 1) ? 'perubahan' : 'baru',
        status: 'pending',
        is_active: true,
        version: 1,
        base_version: k.version || 1,
        submitted_at: k.updatedAt || k.createdAt || new Date(),
        nama_kos: k.nama || 'Kos Tanpa Nama',
        before: null,
        after: {
          nama: k.nama || '',
          deskripsi: k.deskripsi || '',
          alamat: k.alamat || '',
          area_kampus: k.area_kampus || '',
          koordinat: k.koordinat || { latitude: 0, longitude: 0 },
          harga_per_bulan: k.harga_per_bulan || 0,
          tipe: ['putra', 'putri', 'campur'].includes(k.tipe) ? k.tipe : 'campur',
          fasilitas: Array.isArray(k.fasilitas) ? k.fasilitas : [],
          peraturan: Array.isArray(k.peraturan) ? k.peraturan : [],
          luas_kamar: k.luas_kamar || null,
          jumlah_kamar_total: Number(k.jumlah_kamar_total || 0),
          foto: Array.isArray(k.foto) ? k.foto : [],
        },
        catatan_verifikasi: 'Rekonsiliasi otomatis listing pending legacy untuk dimasukkan ke antrean verifikasi admin.',
      };

      if (isExecute) {
        const created = await Pengajuan.create(submissionDoc);
        createdSubmissions.push({
          submission_id: created._id,
          kos_id: k._id,
          nama: k.nama,
        });
      } else {
        createdSubmissions.push({
          submission_id: '(simulated-new-id)',
          kos_id: k._id,
          nama: k.nama,
        });
      }
    }

    if (isExecute) {
      console.log(`   -> [EKSEKUSI] Berhasil membuat ${createdSubmissions.length} Pengajuan baru.`);
      createdSubmissions.forEach((s) => console.log(`      * Pengajuan ID: ${s.submission_id} untuk Kos: [${s.kos_id}] ${s.nama}`));
    } else {
      console.log(`   -> [DRY-RUN] Simulasi pembuatan ${createdSubmissions.length} Pengajuan baru:`);
      createdSubmissions.slice(0, 5).forEach((s) => console.log(`      * Rencana Pengajuan untuk Kos: [${s.kos_id}] ${s.nama}`));
      if (createdSubmissions.length > 5) console.log(`      * ...dan ${createdSubmissions.length - 5} lainnya.`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`[RINGKASAN REKONSILIASI]`);
  console.log(`- Listing diperbaiki versinya   : ${versionUpdates.length}`);
  console.log(`- Listing pending direkonsiliasi: ${orphanPendingKos.length}`);
  console.log(`- Status eksekusi               : ${isExecute ? 'SUDAH DITERAPKAN' : 'DRY-RUN SELESAI (TIDAK ADA PERUBAHAN DB)'}`);
  console.log(`======================================================\n`);

  return {
    isExecute,
    versionUpdatesCount: versionUpdates.length,
    orphanPendingCount: orphanPendingKos.length,
    createdSubmissionsCount: createdSubmissions.length,
  };
}

if (require.main === module) {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI tidak ditemukan di environment.');
    process.exit(1);
  }

  mongoose
    .connect(mongoUri)
    .then(async () => {
      await reconcileLegacyData();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Koneksi database gagal:', err);
      process.exit(1);
    });
}

module.exports = { reconcileLegacyData };

