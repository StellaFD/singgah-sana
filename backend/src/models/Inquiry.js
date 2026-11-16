const mongoose = require('mongoose');

const pesanSubSchema = new mongoose.Schema(
  {
    pengirim_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pengirim_role: {
      type: String,
      enum: ['pencari', 'pemilik'],
      required: true,
    },
    teks: {
      type: String,
      required: [true, 'Teks pesan wajib diisi'],
      trim: true,
      maxlength: [1000, 'Teks pesan maksimal 1000 karakter'],
    },
  },
  {
    timestamps: true,
  }
);

const inquirySchema = new mongoose.Schema(
  {
    pencari_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    pemilik_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    kos_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Kos',
      required: true,
      index: true,
    },
    pesan: {
      type: String,
      required: [true, 'Pesan pertanyaan wajib diisi'],
      trim: true,
      maxlength: [1000, 'Pesan pertanyaan maksimal 1000 karakter'],
    },
    balasan: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Balasan maksimal 1000 karakter'],
    },
    balasan_at: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['menunggu', 'dibalas'],
      default: 'menunggu',
    },
    // Array pesan percakapan multi-turn berkelanjutan (kompatibel penuh dengan data lama)
    pesan_list: {
      type: [pesanSubSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual getter untuk mendapatkan daftar percakapan lengkap secara berurutan
inquirySchema.virtual('riwayat_pesan').get(function () {
  const hasil = [];
  // 1. Pesan awal dari pencari (selalu ada)
  if (this.pesan) {
    hasil.push({
      _id: `${this._id}-0`,
      pengirim_id: this.pencari_id?._id || this.pencari_id,
      pengirim_role: 'pencari',
      teks: this.pesan,
      createdAt: this.createdAt || new Date(),
    });
  }
  // 2. Balasan awal dari pemilik (jika ada pada format legacy, gunakan balasan_at yang stabil)
  if (this.balasan) {
    hasil.push({
      _id: `${this._id}-1`,
      pengirim_id: this.pemilik_id?._id || this.pemilik_id,
      pengirim_role: 'pemilik',
      teks: this.balasan,
      createdAt: this.balasan_at || this.updatedAt || this.createdAt || new Date(),
    });
  }
  // 3. Pesan-pesan berikutnya dari array pesan_list
  if (Array.isArray(this.pesan_list) && this.pesan_list.length > 0) {
    this.pesan_list.forEach((p) => {
      hasil.push({
        _id: p._id,
        pengirim_id: p.pengirim_id?._id || p.pengirim_id,
        pengirim_role: p.pengirim_role,
        teks: p.teks,
        createdAt: p.createdAt,
      });
    });
  }
  return hasil;
});

// Satu pencari hanya boleh punya satu inquiry 'menunggu' per kos.
// Pengecekan utama ada di controller (409); index ini menjaga dari request yang masuk bersamaan.
inquirySchema.index(
  { pencari_id: 1, kos_id: 1 },
  { unique: true, partialFilterExpression: { status: 'menunggu' } }
);

module.exports = mongoose.model('Inquiry', inquirySchema);
