/**
 * Backfill data legacy (idempotent, aman dijalankan berkali-kali).
 *
 * Kos hasil seed lama dibuat sebelum field versioning/status ditambahkan.
 * Mongoose mengisi nilai default saat MEMBACA dokumen, sehingga API menampilkan
 * version = 1, tetapi field tersebut sebenarnya tidak ada di MongoDB. Akibatnya
 * update bersyarat seperti { version_ketersediaan: 1 } atau { version: 1 }
 * tidak menemukan dokumen dan selalu menghasilkan 409.
 *
 * Fungsi ini:
 * 1. Menulis field default yang hilang langsung ke database.
 * 2. Membuat dokumen Pengajuan kanonikal untuk kos legacy berstatus "pending"
 *    yang belum punya pengajuan aktif, supaya muncul di antrean admin.
 */
const Kos = require('../models/Kos');
const Pengajuan = require('../models/Pengajuan');
const { toKosContent } = require('../dto/submissionDto');

const MISSING_FIELD_DEFAULTS = {
  version: 1,
  version_ketersediaan: 1,
  status_publikasi: 'active',
  status_moderasi: 'normal',
  deleted_at: null,
};

async function backfillMissingKosFields() {
  const result = {};
  for (const [field, value] of Object.entries(MISSING_FIELD_DEFAULTS)) {
    const { modifiedCount } = await Kos.collection.updateMany(
      { [field]: { $exists: false } },
      { $set: { [field]: value } }
    );
    result[field] = modifiedCount;
  }
  return result;
}

async function backfillPendingSubmissions() {
  const pendingKos = await Kos.find({ status_verifikasi: 'pending', deleted_at: null });
  let created = 0;

  for (const kos of pendingKos) {
    const hasActive = await Pengajuan.exists({ kos_id: kos._id, is_active: true });
    if (hasActive) continue;

    const after = toKosContent(kos);
    try {
      await Pengajuan.create({
        kos_id: kos._id,
        pemilik_id: kos.pemilik_id,
        jenis: 'baru',
        status: 'pending',
        is_active: true,
        version: 1,
        base_version: Number(kos.version || 1),
        before: null,
        after,
        foto_ids: [],
        nama_kos: after.nama,
        submitted_at: kos.updatedAt || kos.createdAt || new Date(),
      });
      created += 1;
    } catch (error) {
      // 11000 = index unik pengajuan aktif; berarti proses lain sudah membuatnya
      if (error.code !== 11000) throw error;
    }
  }

  return created;
}

async function runLegacyBackfill({ log = true } = {}) {
  const fields = await backfillMissingKosFields();
  const pengajuanDibuat = await backfillPendingSubmissions();
  const totalFields = Object.values(fields).reduce((sum, n) => sum + n, 0);

  if (log && (totalFields > 0 || pengajuanDibuat > 0)) {
    console.log(
      `[Backfill] Field kos legacy dilengkapi: ${JSON.stringify(fields)}; pengajuan legacy dibuat: ${pengajuanDibuat}`
    );
  }

  return { fields, pengajuanDibuat };
}

module.exports = { runLegacyBackfill, backfillMissingKosFields, backfillPendingSubmissions };

// Bisa dijalankan manual: `npm run backfill`
if (require.main === module) {
  require('dotenv').config();
  const mongoose = require('mongoose');
  const connectDB = require('../config/db');

  connectDB()
    .then(() => runLegacyBackfill())
    .then((summary) => {
      console.log('[Backfill] Selesai:', JSON.stringify(summary));
    })
    .catch((error) => {
      console.error('[Backfill] Gagal:', error.message);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}
