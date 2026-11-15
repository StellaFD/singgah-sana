const mongoose = require('mongoose');
const Kos = require('../models/Kos');
const Favorit = require('../models/Favorit');
const Inquiry = require('../models/Inquiry');
const {
  safeSearchTerm,
  escapeRegex,
  parsePagination,
  parseStrictNumber,
  parseStrictCoordinate,
  toNumberOrUndefined,
} = require('../utils/helpers');

// Field yang bila diubah pemilik pada kos yang sudah disetujui/ditolak
// mengharuskan verifikasi ulang oleh admin. Perubahan kuota kamar tidak termasuk,
// agar pemilik tetap bisa memperbarui ketersediaan kamar secara real-time.
const FIELD_BUTUH_VERIFIKASI_ULANG = [
  'nama', 'deskripsi', 'alamat', 'area_kampus', 'koordinat', 'harga_per_bulan',
  'tipe', 'fasilitas', 'luas_kamar', 'peraturan', 'jumlah_kamar_total',
];

const ALLOWED_SORT_OPTIONS = {
  terbaru: { createdAt: -1 },
  harga_asc: { harga_per_bulan: 1 },
  harga_desc: { harga_per_bulan: -1 },
  kamar_banyak: { jumlah_kamar_tersedia: -1 },
};

/**
 * Membangun query filter publik bersama untuk endpoint list dan map.
 * Memastikan aturan verifikasi, batas rentang harga, dan sanitasi input konsisten.
 */
const buildPublicKosFilter = (query) => {
  const {
    q,
    tipe,
    harga_min,
    harga_max,
    fasilitas,
    aturan,
    kamar_tersedia,
    area_kampus,
  } = query;

  const filter = { status_verifikasi: 'approved' };

  if (q) {
    const term = safeSearchTerm(q);
    filter.$or = [
      { nama: { $regex: term, $options: 'i' } },
      { alamat: { $regex: term, $options: 'i' } },
      { area_kampus: { $regex: term, $options: 'i' } },
      { deskripsi: { $regex: term, $options: 'i' } },
    ];
  }

  if (tipe && tipe !== 'all' && tipe !== 'Semua') {
    const lowerTipe = String(tipe).toLowerCase().trim();
    if (!['putra', 'putri', 'campur'].includes(lowerTipe)) {
      const err = new Error('Tipe kos harus salah satu dari: putra, putri, campur, atau all');
      err.statusCode = 400;
      throw err;
    }
    filter.tipe = lowerTipe;
  }

  if (area_kampus && area_kampus !== 'Semua Area') {
    filter.area_kampus = { $regex: safeSearchTerm(area_kampus), $options: 'i' };
  }

  let hargaMin;
  if (harga_min !== undefined) {
    const parsed = parseStrictNumber(harga_min);
    if (parsed === null) {
      const err = new Error('harga_min harus berupa angka skalar yang valid');
      err.statusCode = 400;
      throw err;
    }
    if (parsed < 0) {
      const err = new Error('harga_min tidak boleh bernilai negatif');
      err.statusCode = 400;
      throw err;
    }
    hargaMin = parsed;
  }

  let hargaMax;
  if (harga_max !== undefined) {
    const parsed = parseStrictNumber(harga_max);
    if (parsed === null) {
      const err = new Error('harga_max harus berupa angka skalar yang valid');
      err.statusCode = 400;
      throw err;
    }
    if (parsed < 0) {
      const err = new Error('harga_max tidak boleh bernilai negatif');
      err.statusCode = 400;
      throw err;
    }
    hargaMax = parsed;
  }

  if (hargaMin !== undefined && hargaMax !== undefined && hargaMin > hargaMax) {
    const err = new Error('harga_min tidak boleh lebih besar dari harga_max');
    err.statusCode = 400;
    throw err;
  }

  if (hargaMin !== undefined || hargaMax !== undefined) {
    filter.harga_per_bulan = {};
    if (hargaMin !== undefined) filter.harga_per_bulan.$gte = hargaMin;
    if (hargaMax !== undefined) filter.harga_per_bulan.$lte = hargaMax;
  }

  if (kamar_tersedia === 'true') {
    filter.jumlah_kamar_tersedia = { $gt: 0 };
  }

  if (fasilitas) {
    const fasList = String(fasilitas)
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((f) => new RegExp(escapeRegex(f.slice(0, 50)), 'i'));
    if (fasList.length > 0) filter.fasilitas = { $all: fasList };
  }

  if (aturan) {
    const aturanList = String(aturan)
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((a) => new RegExp(escapeRegex(a.slice(0, 50)), 'i'));
    if (aturanList.length > 0) filter.peraturan = { $all: aturanList };
  }

  return filter;
};

/**
 * Memformat dokumen kos ke DTO whitelist publik.
 * Memastikan data sensitif akun pemilik (email, nomor_telepon, password, foto_profil)
 * serta metadata admin (catatan_verifikasi, diverifikasi_oleh, diverifikasi_pada, riwayat_status)
 * TIDAK dibocorkan ke respons publik untuk pengunjung anonim atau pencari kos.
 */
const formatPublicKos = (kosDoc) => {
  if (!kosDoc) return null;
  const doc = typeof kosDoc.toObject === 'function' ? kosDoc.toObject() : kosDoc;

  // Pemilik ringkas: hanya nama dan _id untuk relasi kompatibilitas frontend
  let pemilikPublic = undefined;
  if (doc.pemilik_id && typeof doc.pemilik_id === 'object') {
    pemilikPublic = {
      ...(doc.pemilik_id._id ? { _id: doc.pemilik_id._id } : {}),
      nama:
        typeof doc.pemilik_id.nama === 'string' && doc.pemilik_id.nama.trim()
          ? doc.pemilik_id.nama.trim()
          : 'Pengelola kos',
    };
  } else if (doc.pemilik && typeof doc.pemilik === 'object') {
    pemilikPublic = {
      ...(doc.pemilik._id ? { _id: doc.pemilik._id } : {}),
      nama:
        typeof doc.pemilik.nama === 'string' && doc.pemilik.nama.trim()
          ? doc.pemilik.nama.trim()
          : 'Pengelola kos',
    };
  }

  const publicDto = {
    _id: doc._id,
    ...(doc.id ? { id: doc.id } : {}),
    nama: doc.nama,
    deskripsi: doc.deskripsi,
    alamat: doc.alamat,
    area_kampus: doc.area_kampus,
    koordinat: doc.koordinat,
    foto: doc.foto,
    harga_per_bulan: doc.harga_per_bulan,
    tipe: doc.tipe,
    fasilitas: doc.fasilitas,
    luas_kamar: doc.luas_kamar,
    peraturan: doc.peraturan,
    jumlah_kamar_total: doc.jumlah_kamar_total,
    jumlah_kamar_tersedia: doc.jumlah_kamar_tersedia,
    status_verifikasi: doc.status_verifikasi,
    ...(doc.ketersediaan_diperbarui_pada
      ? { ketersediaan_diperbarui_pada: doc.ketersediaan_diperbarui_pada }
      : {}),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };

  if (pemilikPublic) {
    publicDto.pemilik_id = pemilikPublic;
    publicDto.pemilik = pemilikPublic;
  } else if (doc.pemilik_id) {
    publicDto.pemilik_id = doc.pemilik_id;
  }

  return publicDto;
};

const getAllKosPublic = async (req, res, next) => {
  try {
    const filter = buildPublicKosFilter(req.query);
    const { sort, page, limit } = req.query;

    let sortOptions = ALLOWED_SORT_OPTIONS.terbaru;
    if (sort !== undefined && sort !== '') {
      const normalizedSort = String(sort).trim().toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(ALLOWED_SORT_OPTIONS, normalizedSort)) {
        const err = new Error(
          'Parameter sort tidak valid. Opsi yang tersedia: terbaru, harga_asc, harga_desc, kamar_banyak'
        );
        err.statusCode = 400;
        throw err;
      }
      sortOptions = ALLOWED_SORT_OPTIONS[normalizedSort];
    }

    const { pageNum, limitNum } = parsePagination(page, limit, 10);

    const totalData = await Kos.countDocuments(filter);
    const totalPages = totalData > 0 ? Math.ceil(totalData / limitNum) : 1;
    const currentPage = totalData > 0 ? Math.min(Math.max(1, pageNum), totalPages) : 1;
    const actualSkip = (currentPage - 1) * limitNum;

    const dataKos = await Kos.find(filter)
      .populate('pemilik_id', 'nama')
      .sort(sortOptions)
      .skip(actualSkip)
      .limit(limitNum);

    const sanitizedData = dataKos.map((item) => formatPublicKos(item));

    res.status(200).json({
      success: true,
      count: sanitizedData.length,
      pagination: {
        totalData,
        totalPages,
        currentPage,
        limit: limitNum,
      },
      data: sanitizedData,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

const getKosMapPublic = async (req, res, next) => {
  try {
    const filter = buildPublicKosFilter(req.query);
    const MAX_MAP_MARKERS = 500;

    const totalCount = await Kos.countDocuments(filter);
    const markers = await Kos.find(filter)
      .select('nama harga_per_bulan tipe foto area_kampus alamat koordinat jumlah_kamar_tersedia status_verifikasi createdAt')
      .sort({ createdAt: -1 })
      .limit(MAX_MAP_MARKERS);

    res.status(200).json({
      success: true,
      count: markers.length,
      totalCount,
      isTruncated: totalCount > MAX_MAP_MARKERS,
      data: markers,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

const getKosById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Kos tidak ditemukan',
      });
    }

    const kos = await Kos.findById(req.params.id).populate(
      'pemilik_id',
      'nama nomor_telepon email foto_profil role'
    );

    if (!kos) {
      return res.status(404).json({
        success: false,
        message: 'Kos tidak ditemukan',
      });
    }

    const user = req.user;
    const ownerIdStr =
      kos.pemilik_id && kos.pemilik_id._id
        ? kos.pemilik_id._id.toString()
        : kos.pemilik_id
        ? kos.pemilik_id.toString()
        : null;
    const isOwner = Boolean(user && ownerIdStr && ownerIdStr === user._id.toString());
    const isAdmin = Boolean(user && user.role === 'admin');

    if (kos.status_verifikasi !== 'approved') {
      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Kos ini masih dalam proses peninjauan verifikasi admin dan belum dipublikasikan.',
        });
      }
    }

    // Pemilik kos sendiri atau admin berhak mengakses data privat lengkap
    if (isOwner || isAdmin) {
      return res.status(200).json({
        success: true,
        data: kos,
      });
    }

    // Respons untuk publik (anonim / pencari / non-owner): DTO whitelist tanpa data privat
    res.status(200).json({
      success: true,
      data: formatPublicKos(kos),
    });
  } catch (error) {
    next(error);
  }
};

const createKos = async (req, res, next) => {
  try {
    const {
      nama,
      deskripsi,
      alamat,
      area_kampus,
      latitude,
      longitude,
      harga_per_bulan,
      tipe,
      fasilitas,
      luas_kamar,
      peraturan,
      jumlah_kamar_total,
      jumlah_kamar_tersedia,
      foto_urls,
    } = req.body;

    if (!nama || !deskripsi || !alamat || !harga_per_bulan || !tipe || !jumlah_kamar_total) {
      return res.status(400).json({
        success: false,
        message: 'Mohon lengkapi field wajib: nama, deskripsi, alamat, harga_per_bulan, tipe, jumlah_kamar_total',
      });
    }

    const parsedLat = parseStrictCoordinate(latitude, -90, 90);
    const parsedLng = parseStrictCoordinate(longitude, -180, 180);

    if (parsedLat === null || parsedLng === null) {
      return res.status(400).json({
        success: false,
        message: 'Koordinat lokasi (latitude [-90, 90] dan longitude [-180, 180]) wajib diisi dengan angka yang valid',
      });
    }

    let daftarFoto = [];
    if (req.files && req.files.length > 0) {
      daftarFoto = req.files.map((file) => `/uploads/${file.filename}`);
    } else if (foto_urls) {
      daftarFoto = Array.isArray(foto_urls) ? foto_urls : [foto_urls];
    } else {
      daftarFoto = [
        'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80',
      ];
    }

    let parsedFasilitas = [];
    if (fasilitas) {
      parsedFasilitas = Array.isArray(fasilitas) ? fasilitas : fasilitas.split(',').map((f) => f.trim());
    }

    let parsedPeraturan = ['Akses 24 Jam', 'Dilarang Merokok di Kamar'];
    if (peraturan) {
      parsedPeraturan = Array.isArray(peraturan) ? peraturan : peraturan.split(',').map((p) => p.trim());
    }

    const kosBaru = await Kos.create({
      nama,
      deskripsi,
      alamat,
      area_kampus: area_kampus || 'Sekitar UGM',
      koordinat: {
        latitude: parsedLat,
        longitude: parsedLng,
      },
      foto: daftarFoto,
      harga_per_bulan: Number(harga_per_bulan),
      tipe: tipe.toLowerCase(),
      fasilitas: parsedFasilitas,
      luas_kamar: luas_kamar || '3x4 meter',
      peraturan: parsedPeraturan,
      jumlah_kamar_total: Number(jumlah_kamar_total),
      jumlah_kamar_tersedia:
        jumlah_kamar_tersedia !== undefined
          ? Number(jumlah_kamar_tersedia)
          : Number(jumlah_kamar_total),
      status_verifikasi: 'pending',
      pemilik_id: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Kos berhasil didaftarkan dan sedang menunggu verifikasi oleh Administrator',
      data: kosBaru,
    });
  } catch (error) {
    next(error);
  }
};

const getMyKos = async (req, res, next) => {
  try {
    const listKos = await Kos.find({ pemilik_id: req.user._id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: listKos.length,
      data: listKos,
    });
  } catch (error) {
    next(error);
  }
};

const updateKos = async (req, res, next) => {
  try {
    let kos = await Kos.findById(req.params.id);

    if (!kos) {
      return res.status(404).json({ success: false, message: 'Kos tidak ditemukan' });
    }

    if (kos.pemilik_id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Anda hanya dapat memperbarui kos milik Anda sendiri',
      });
    }

    const {
      nama,
      deskripsi,
      alamat,
      area_kampus,
      latitude,
      longitude,
      harga_per_bulan,
      tipe,
      fasilitas,
      luas_kamar,
      peraturan,
      jumlah_kamar_total,
      jumlah_kamar_tersedia,
    } = req.body;

    if (nama) kos.nama = nama;
    if (deskripsi) kos.deskripsi = deskripsi;
    if (alamat) kos.alamat = alamat;
    if (area_kampus) kos.area_kampus = area_kampus;

    if (latitude !== undefined || longitude !== undefined) {
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Pembaruan koordinat harus menyertakan pasangan latitude dan longitude lengkap',
        });
      }
      const parsedLat = parseStrictCoordinate(latitude, -90, 90);
      const parsedLng = parseStrictCoordinate(longitude, -180, 180);

      if (parsedLat === null || parsedLng === null) {
        return res.status(400).json({
          success: false,
          message: 'Nilai koordinat latitude [-90, 90] atau longitude [-180, 180] tidak valid',
        });
      }
      kos.koordinat = { latitude: parsedLat, longitude: parsedLng };
    }

    if (harga_per_bulan) kos.harga_per_bulan = Number(harga_per_bulan);
    if (tipe) kos.tipe = tipe.toLowerCase();
    if (luas_kamar) kos.luas_kamar = luas_kamar;
    if (fasilitas) {
      kos.fasilitas = Array.isArray(fasilitas) ? fasilitas : fasilitas.split(',').map((f) => f.trim());
    }
    if (peraturan) {
      kos.peraturan = Array.isArray(peraturan) ? peraturan : peraturan.split(',').map((p) => p.trim());
    }
    if (jumlah_kamar_total !== undefined) kos.jumlah_kamar_total = Number(jumlah_kamar_total);
    if (jumlah_kamar_tersedia !== undefined) {
      kos.jumlah_kamar_tersedia = Number(jumlah_kamar_tersedia);
    }

    // Pemilik mengubah data penting pada kos yang sudah diverifikasi -> kembali ke antrean verifikasi
    let butuhVerifikasiUlang = false;
    if (req.user.role !== 'admin' && kos.status_verifikasi !== 'pending') {
      butuhVerifikasiUlang = FIELD_BUTUH_VERIFIKASI_ULANG.some((f) => kos.isModified(f));
      if (butuhVerifikasiUlang) {
        kos.status_verifikasi = 'pending';
        kos.catatan_verifikasi = 'Data kos diperbarui oleh pemilik dan menunggu verifikasi ulang admin.';
        kos.diverifikasi_oleh = null;
        kos.diverifikasi_pada = null;
      }
    }

    const updatedKos = await kos.save();

    res.status(200).json({
      success: true,
      message: butuhVerifikasiUlang
        ? 'Data kos berhasil diperbarui dan akan ditinjau ulang oleh Administrator sebelum tayang kembali'
        : 'Data kos berhasil diperbarui',
      data: updatedKos,
    });
  } catch (error) {
    next(error);
  }
};

const deleteKos = async (req, res, next) => {
  try {
    const kos = await Kos.findById(req.params.id);

    if (!kos) {
      return res.status(404).json({ success: false, message: 'Kos tidak ditemukan' });
    }

    if (kos.pemilik_id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Anda tidak memiliki izin untuk menghapus kos ini',
      });
    }

    await Promise.all([
      Favorit.deleteMany({ kos_id: kos._id }),
      Inquiry.deleteMany({ kos_id: kos._id }),
    ]);
    await kos.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Kos berhasil dihapus dari sistem',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  formatPublicKos,
  getAllKosPublic,
  getKosMapPublic,
  getKosById,
  createKos,
  getMyKos,
  updateKos,
  deleteKos,
};
