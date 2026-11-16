const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

const kosSchema = new mongoose.Schema(
  {
    nama: {
      type: String,
      default: null,
      trim: true,
      maxlength: [120, 'Nama kos maksimal 120 karakter'],
    },
    deskripsi: {
      type: String,
      default: null,
      trim: true,
    },
    alamat: {
      type: String,
      default: null,
      trim: true,
    },
    area_kampus: {
      type: String,
      default: null,
      trim: true,
    },
    koordinat: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude minimal -90'],
        max: [90, 'Latitude maksimal 90'],
        default: null,
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude minimal -180'],
        max: [180, 'Longitude maksimal 180'],
        default: null,
      },
    },
    foto: {
      type: [String],
      default: [],
    },
    foto_id_list: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'MediaAsset',
      default: [],
    },
    harga_per_bulan: {
      type: Number,
      default: null,
    },
    tipe: {
      type: String,
      enum: {
        values: ['putra', 'putri', 'campur', null, ''],
        message: 'Tipe kos harus salah satu dari: putra, putri, atau campur',
      },
      default: null,
    },
    fasilitas: {
      type: [String],
      default: [],
    },
    luas_kamar: {
      type: String,
      default: null,
      trim: true,
    },
    peraturan: {
      type: [String],
      default: [],
    },
    jumlah_kamar_total: {
      type: Number,
      default: null,
    },
    jumlah_kamar_tersedia: {
      type: Number,
      default: null,
    },
    status_verifikasi: {
      type: String,
      enum: {
        values: ['draft', 'pending', 'revision', 'approved', 'rejected'],
        message: 'Status verifikasi harus draft, pending, revision, approved, atau rejected',
      },
      default: 'draft',
      index: true,
    },
    status_publikasi: {
      type: String,
      enum: {
        values: ['active', 'archived'],
        message: 'Status publikasi harus active atau archived',
      },
      default: 'active',
      index: true,
    },
    status_moderasi: {
      type: String,
      enum: {
        values: ['normal', 'suspended'],
        message: 'Status moderasi harus normal atau suspended',
      },
      default: 'normal',
      index: true,
    },
    deleted_at: {
      type: Date,
      default: null,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    version_ketersediaan: {
      type: Number,
      default: 1,
    },
    ketersediaan_diperbarui_pada: {
      type: Date,
      default: null,
    },
    draft_konten: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    catatan_verifikasi: {
      type: String,
      default: '',
      trim: true,
    },
    diverifikasi_oleh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    diverifikasi_pada: {
      type: Date,
      default: null,
    },
    pemilik_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ID pemilik kos wajib diisi'],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

kosSchema.index({ nama: 'text', deskripsi: 'text', alamat: 'text', area_kampus: 'text' });

// Hook deleteOne untuk kompatibilitas penghapusan berkas lokal
// Berkas fisik TIDAK dihapus jika masih dirujuk MediaAsset, Pengajuan (submission/history), atau Kos lain
kosSchema.post('deleteOne', { document: true, query: false }, async function () {
  const fotoLokal = (this.foto || []).filter(
    (foto) => typeof foto === 'string' && foto.startsWith('/uploads/')
  );

  if (!fotoLokal.length) return;

  const MediaAsset = mongoose.model('MediaAsset');
  const Pengajuan = mongoose.model('Pengajuan');
  const KosModel = this.constructor;

  await Promise.all(
    fotoLokal.map(async (foto) => {
      const filename = path.basename(foto);
      const filePath = path.join(UPLOAD_DIR, filename);

      try {
        // Cek 1: Apakah masih dirujuk MediaAsset yang belum dihapus permanen?
        const isReferencedInMedia = await MediaAsset.exists({
          $or: [
            { file_path: filePath },
            { url: { $regex: filename } },
          ],
        });
        if (isReferencedInMedia) {
          return;
        }

        // Cek 2: Apakah masih dirujuk dalam submission / history Pengajuan?
        const isReferencedInPengajuan = await Pengajuan.exists({
          $or: [
            { 'before.foto.url': { $regex: filename } },
            { 'after.foto.url': { $regex: filename } },
          ],
        });
        if (isReferencedInPengajuan) {
          return;
        }

        // Cek 3: Apakah masih dirujuk oleh Kos lain?
        const isReferencedInOtherKos = await KosModel.exists({
          _id: { $ne: this._id },
          foto: foto,
        });
        if (isReferencedInOtherKos) {
          return;
        }

        // Hanya hapus berkas fisik jika benar-benar tidak ada rujukan tersisa
        await fs.promises.unlink(filePath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error(`[Kos] Gagal membersihkan berkas foto ${filePath}: ${error.message}`);
        }
      }
    })
  );
});

module.exports = mongoose.model('Kos', kosSchema);
