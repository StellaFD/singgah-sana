const mongoose = require('mongoose');

const pengajuanSchema = new mongoose.Schema(
  {
    kos_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Kos',
      required: [true, 'ID kos wajib diisi'],
    },
    pemilik_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ID pemilik kos wajib diisi'],
      index: true,
    },
    jenis: {
      type: String,
      enum: {
        values: ['baru', 'perubahan'],
        message: 'Jenis pengajuan harus baru atau perubahan',
      },
      required: [true, 'Jenis pengajuan wajib diisi'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'pending', 'approved', 'revision', 'rejected', 'withdrawn'],
        message: 'Status pengajuan harus draft, pending, approved, revision, rejected, atau withdrawn',
      },
      default: 'draft',
      index: true,
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    base_version: {
      type: Number,
      default: 1,
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Snapshot konten pengajuan (after) wajib diisi'],
    },
    foto_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MediaAsset',
      },
    ],
    nama_kos: {
      type: String,
      default: '',
      trim: true,
    },
    catatan_verifikasi: {
      type: String,
      default: null,
      trim: true,
    },
    submitted_at: {
      type: Date,
      default: null,
    },
    reviewed_at: {
      type: Date,
      default: null,
    },
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

pengajuanSchema.index({ kos_id: 1, status: 1 }, { name: 'idx_pengajuan_kos_status' });
pengajuanSchema.index({ submitted_at: 1, _id: 1 }, { name: 'idx_pengajuan_submitted_id' });
pengajuanSchema.index(
  { kos_id: 1 },
  {
    unique: true,
    name: 'uniq_active_pengajuan_per_kos',
    partialFilterExpression: {
      is_active: true,
    },
  }
);

module.exports = mongoose.model('Pengajuan', pengajuanSchema);
