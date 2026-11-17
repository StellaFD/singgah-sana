/** Read-only by default. Execute only after backing up the intended database. */
const mongoose = require('mongoose');
const Kos = require('../models/Kos');
const Pengajuan = require('../models/Pengajuan');
const User = require('../models/User');
const { toKosContent } = require('../dto/submissionDto');

function hasCompleteContent(kos) {
  const { latitude, longitude } = kos.koordinat || {};
  return Boolean(kos.nama && kos.alamat && kos.deskripsi && kos.pemilik_id &&
    Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    Number.isFinite(longitude) && Math.abs(longitude) <= 180 &&
    kos.harga_per_bulan > 0 && Number.isInteger(kos.jumlah_kamar_total) &&
    kos.jumlah_kamar_total > 0 && ['putra', 'putri', 'campur'].includes(kos.tipe) &&
    kos.foto?.length);
}

async function reconcileLegacyData({ execute = false } = {}) {
  const result = { isExecute: execute, versionUpdatesCount: 0, orphanPendingCount: 0,
    createdSubmissionsCount: 0, skipped: [] };
  const missingVersions = await Kos.find({ deleted_at: null, $or: [
    { version: null }, { version_ketersediaan: null },
  ] }).lean();
  for (const kos of missingVersions) {
    result.versionUpdatesCount++;
    if (!execute) continue;
    for (const field of ['version', 'version_ketersediaan']) {
      if (kos[field] == null) {
        // Compare-and-set avoids overwriting a concurrent owner update.
        await Kos.collection.updateOne({ _id: kos._id, deleted_at: null, [field]: null },
          { $set: { [field]: 1 } });
      }
    }
  }
  const candidates = await Kos.find({ deleted_at: null, status_verifikasi: 'pending' }).lean();
  for (const kos of candidates) {
    if (await Pengajuan.exists({ kos_id: kos._id, is_active: true })) continue;
    result.orphanPendingCount++;
    if (!hasCompleteContent(kos) || !(await User.exists({ _id: kos.pemilik_id, status: 'active', deleted_at: null }))) {
      result.skipped.push({ kos_id: String(kos._id), reason: 'Konten belum lengkap atau pemilik tidak aktif.' });
      continue;
    }
    if (!execute) { result.createdSubmissionsCount++; continue; }
    await Kos.db.transaction(async (session) => {
      const current = await Kos.findOne({ _id: kos._id, deleted_at: null, status_verifikasi: 'pending' }).session(session).lean();
      if (!current || !hasCompleteContent(current) || await Pengajuan.exists({ kos_id: kos._id, is_active: true }).session(session)) return;
      // Write-lock listing so a concurrent withdrawal cannot leave an orphan submission.
      const locked = await Kos.updateOne({ _id: kos._id, status_verifikasi: 'pending', version: current.version },
        { $inc: { version: 1 } }, { session });
      if (!locked.modifiedCount) return;
      await Pengajuan.create([{
        kos_id: current._id, pemilik_id: current.pemilik_id, jenis: 'baru', status: 'pending',
        is_active: true, version: 1, base_version: current.version + 1,
        submitted_at: current.updatedAt || current.createdAt || new Date(),
        nama_kos: current.nama, before: null, after: toKosContent(current),
        catatan_verifikasi: null,
      }], { session });
      result.createdSubmissionsCount++;
    });
  }
  console.log(JSON.stringify(result));
  return result;
}

if (require.main === module) {
  require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
  const execute = process.argv.includes('--execute');
  if (!process.env.MONGO_URI || (execute && !process.env.MIGRATION_DATABASE)) {
    console.error('MONGO_URI diperlukan; eksekusi juga memerlukan MIGRATION_DATABASE sesuai nama database tujuan.');
    process.exitCode = 1;
  } else {
    (async () => {
      try {
        await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false });
        if (execute && mongoose.connection.name !== process.env.MIGRATION_DATABASE) throw new Error('Nama database tujuan tidak sesuai.');
        await reconcileLegacyData({ execute });
      } catch {
        console.error('Rekonsiliasi gagal; periksa database tujuan dan kelengkapan data.');
        process.exitCode = 1;
      } finally { await mongoose.disconnect(); }
    })();
  }
}
module.exports = { reconcileLegacyData };
