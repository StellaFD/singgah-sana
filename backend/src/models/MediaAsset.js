const mongoose = require('mongoose');

const mediaAssetSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ID pengguna pemilik aset wajib diisi'],
      index: true,
    },
    storage_kind: {
      type: String,
      enum: {
        values: ['local', 'legacy_remote', 'cloudinary'],
        message: 'storage_kind harus local, legacy_remote, atau cloudinary',
      },
      default: 'local',
      index: true,
    },
    file_path: {
      type: String,
      default: null,
      validate: {
        validator: function (val) {
          if (this.storage_kind === 'local') {
            return typeof val === 'string' && val.trim().length > 0;
          }
          return true;
        },
        message: 'Lokasi penyimpanan berkas lokal wajib diisi untuk media berjenis local',
      },
    },
    cloudinary_public_id: {
      type: String,
      default: null,
      required: function () { return this.storage_kind === 'cloudinary'; },
    },
    cloudinary_asset_id: {
      type: String,
      default: null,
      required: function () { return this.storage_kind === 'cloudinary'; },
    },
    cloudinary_cloud_name: {
      type: String,
      default: null,
      required: function () { return this.storage_kind === 'cloudinary'; },
    },
    url: {
      type: String,
      required: [true, 'URL aset media wajib diisi'],
    },
    alt: {
      type: String,
      default: '',
      trim: true,
      maxlength: [160, 'Teks alternatif maksimal 160 karakter'],
    },
    original_filename: {
      type: String,
      default: '',
      trim: true,
    },
    mime_type: {
      type: String,
      required: [true, 'Tipe MIME berkas wajib diisi'],
      enum: {
        values: ['image/jpeg', 'image/png', 'image/webp'],
        message: 'Format media yang didukung hanya JPEG, PNG, dan WebP',
      },
    },
    file_size: {
      type: Number,
      default: null,
    },
    is_deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('MediaAsset', mediaAssetSchema);
