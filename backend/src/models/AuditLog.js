const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ID admin pelaku tindakan wajib diisi'],
      index: true,
    },
    aksi: {
      type: String,
      required: [true, 'Jenis aksi audit wajib diisi'],
      enum: {
        values: [
          'KOS_APPROVE',
          'KOS_REVISION',
          'KOS_REJECT',
          'CHANGE_APPROVE',
          'CHANGE_REVISION',
          'CHANGE_REJECT',
          'KOS_SUSPEND',
          'KOS_UNSUSPEND',
          'USER_SUSPEND',
          'USER_UNSUSPEND',
          'REPORT_RESOLVE',
        ],
        message: 'Aksi audit tidak valid',
      },
      index: true,
    },
    target_type: {
      type: String,
      required: [true, 'Tipe target audit wajib diisi'],
      enum: {
        values: ['kos', 'user', 'laporan', 'pengajuan'],
        message: 'Tipe target audit harus salah satu dari: kos, user, laporan, atau pengajuan',
      },
      index: true,
    },
    target_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'ID target audit wajib diisi'],
      index: true,
    },
    pengajuan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pengajuan',
      default: null,
    },
    laporan_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    catatan: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
