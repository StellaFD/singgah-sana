const mongoose = require('mongoose');
const Kos = require('../models/Kos');
const Pengajuan = require('../models/Pengajuan');
const User = require('../models/User');
const {
  toKosOwnerDto,
  toKosAdminDto,
  toSubmissionDto,
  toKosContent,
} = require('../dto/submissionDto');
const { validateAndResolveFotoIds } = require('./mediaService');
const { logAdminAction } = require('./auditService');
const { parsePagination, safeSearchTerm } = require('../utils/helpers');
const { kirimNotifikasi } = require('../utils/notifikasi');

function validateFullDraftContent(data) {
  const errors = {};

  if (!data.nama || typeof data.nama !== 'string' || !data.nama.trim()) {
    errors.nama = ['Nama kos wajib diisi'];
  } else if (data.nama.trim().length > 120) {
    errors.nama = ['Nama kos maksimal 120 karakter'];
  }

  if (!data.deskripsi || typeof data.deskripsi !== 'string' || !data.deskripsi.trim()) {
    errors.deskripsi = ['Deskripsi kos wajib diisi'];
  } else if (data.deskripsi.trim().length > 5000) {
    errors.deskripsi = ['Deskripsi kos maksimal 5000 karakter'];
  }

  if (!data.alamat || typeof data.alamat !== 'string' || !data.alamat.trim()) {
    errors.alamat = ['Alamat kos wajib diisi'];
  } else if (data.alamat.trim().length > 500) {
    errors.alamat = ['Alamat kos maksimal 500 karakter'];
  }

  // area_kampus bersifat opsional (perluasan nasional, tidak memaksakan nama kampus)
  if (data.area_kampus && typeof data.area_kampus === 'string' && data.area_kampus.trim().length > 120) {
    errors.area_kampus = ['Area kampus maksimal 120 karakter'];
  }

  const lat = data.koordinat?.latitude;
  const lng = data.koordinat?.longitude;
  if (typeof lat !== 'number' || Number.isNaN(lat) || lat < -90 || lat > 90) {
    errors.koordinat = ['Latitude harus berupa angka antara -90 dan 90'];
  }
  if (typeof lng !== 'number' || Number.isNaN(lng) || lng < -180 || lng > 180) {
    errors.koordinat = ['Longitude harus berupa angka antara -180 dan 180'];
  }

  const harga = Number(data.harga_per_bulan);
  if (!Number.isInteger(harga) || harga < 1) {
    errors.harga_per_bulan = ['Harga per bulan harus berupa bilangan bulat positif minimal 1'];
  }

  if (!['putra', 'putri', 'campur'].includes(data.tipe)) {
    errors.tipe = ['Tipe kos harus salah satu dari: putra, putri, atau campur'];
  }

  if (!Array.isArray(data.fasilitas)) {
    errors.fasilitas = ['Fasilitas harus berupa daftar teks'];
  }

  if (!Array.isArray(data.peraturan)) {
    errors.peraturan = ['Peraturan harus berupa daftar teks'];
  }

  const total = Number(data.jumlah_kamar_total);
  if (!Number.isInteger(total) || total < 1) {
    errors.jumlah_kamar_total = ['Jumlah kamar total minimal 1 kamar'];
  }

  const tersedia = Number(data.jumlah_kamar_tersedia);
  if (!Number.isInteger(tersedia) || tersedia < 0) {
    errors.jumlah_kamar_tersedia = ['Jumlah kamar tersedia tidak boleh negatif'];
  } else if (total && tersedia > total) {
    errors.jumlah_kamar_tersedia = ['Jumlah kamar tersedia tidak boleh melebihi jumlah kamar total'];
  }

  const fotoIds = Array.isArray(data.foto_ids) ? data.foto_ids : [];
  if (fotoIds.length < 1) {
    errors.foto_ids = ['Wajib menyertakan minimal 1 foto listing yang valid'];
  } else if (fotoIds.length > 5) {
    errors.foto_ids = ['Maksimal 5 foto per listing'];
  }

  if (Object.keys(errors).length > 0) {
    const err = new Error('Periksa kembali kelengkapan formulir listing');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    err.errors = errors;
    throw err;
  }
}

function validatePartialDraftInput(input) {
  if (!input || typeof input !== 'object') return;
  const errors = {};

  if (input.nama !== undefined && input.nama !== null) {
    if (typeof input.nama !== 'string') {
      errors.nama = ['Nama kos harus berupa teks'];
    } else if (input.nama.trim().length > 120) {
      errors.nama = ['Nama kos maksimal 120 karakter'];
    }
  }

  if (input.deskripsi !== undefined && input.deskripsi !== null) {
    if (typeof input.deskripsi !== 'string') {
      errors.deskripsi = ['Deskripsi kos harus berupa teks'];
    } else if (input.deskripsi.trim().length > 5000) {
      errors.deskripsi = ['Deskripsi kos maksimal 5000 karakter'];
    }
  }

  if (input.alamat !== undefined && input.alamat !== null) {
    if (typeof input.alamat !== 'string') {
      errors.alamat = ['Alamat kos harus berupa teks'];
    } else if (input.alamat.trim().length > 500) {
      errors.alamat = ['Alamat kos maksimal 500 karakter'];
    }
  }

  if (input.area_kampus !== undefined && input.area_kampus !== null) {
    if (typeof input.area_kampus !== 'string') {
      errors.area_kampus = ['Area kampus harus berupa teks'];
    } else if (input.area_kampus.trim().length > 120) {
      errors.area_kampus = ['Area kampus maksimal 120 karakter'];
    }
  }

  if (input.koordinat !== undefined && input.koordinat !== null) {
    if (typeof input.koordinat !== 'object' || Array.isArray(input.koordinat)) {
      errors.koordinat = ['Koordinat harus berupa objek { latitude, longitude }'];
    } else {
      const lat = input.koordinat.latitude;
      const lng = input.koordinat.longitude;
      if (lat === undefined || lng === undefined) {
        errors.koordinat = ['Pembaruan koordinat harus menyertakan pasangan latitude dan longitude'];
      } else {
        if (typeof lat !== 'number' || Number.isNaN(lat) || lat < -90 || lat > 90) {
          errors.koordinat = ['Latitude harus berupa angka antara -90 dan 90'];
        }
        if (typeof lng !== 'number' || Number.isNaN(lng) || lng < -180 || lng > 180) {
          errors.koordinat = ['Longitude harus berupa angka antara -180 dan 180'];
        }
      }
    }
  }

  if (input.harga_per_bulan !== undefined && input.harga_per_bulan !== null && input.harga_per_bulan !== '') {
    const harga = Number(input.harga_per_bulan);
    if (!Number.isInteger(harga) || harga < 1) {
      errors.harga_per_bulan = ['Harga per bulan harus berupa bilangan bulat positif minimal 1'];
    }
  }

  if (input.tipe !== undefined && input.tipe !== null && input.tipe !== '') {
    if (!['putra', 'putri', 'campur'].includes(input.tipe)) {
      errors.tipe = ['Tipe kos harus salah satu dari: putra, putri, atau campur'];
    }
  }

  if (input.fasilitas !== undefined && input.fasilitas !== null) {
    if (!Array.isArray(input.fasilitas)) {
      errors.fasilitas = ['Fasilitas harus berupa daftar teks'];
    }
  }

  if (input.peraturan !== undefined && input.peraturan !== null) {
    if (!Array.isArray(input.peraturan)) {
      errors.peraturan = ['Peraturan harus berupa daftar teks'];
    }
  }

  let totalNum = undefined;
  if (input.jumlah_kamar_total !== undefined && input.jumlah_kamar_total !== null && input.jumlah_kamar_total !== '') {
    const total = Number(input.jumlah_kamar_total);
    if (!Number.isInteger(total) || total < 1) {
      errors.jumlah_kamar_total = ['Jumlah kamar total minimal 1 kamar'];
    } else {
      totalNum = total;
    }
  }

  let tersediaNum = undefined;
  if (input.jumlah_kamar_tersedia !== undefined && input.jumlah_kamar_tersedia !== null && input.jumlah_kamar_tersedia !== '') {
    const tersedia = Number(input.jumlah_kamar_tersedia);
    if (!Number.isInteger(tersedia) || tersedia < 0) {
      errors.jumlah_kamar_tersedia = ['Jumlah kamar tersedia tidak boleh negatif'];
    } else {
      tersediaNum = tersedia;
    }
  }

  if (totalNum !== undefined && tersediaNum !== undefined && tersediaNum > totalNum) {
    errors.jumlah_kamar_tersedia = ['Jumlah kamar tersedia tidak boleh melebihi jumlah kamar total'];
  }

  if (Object.keys(errors).length > 0) {
    const err = new Error('Data draf listing tidak valid');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    err.errors = errors;
    throw err;
  }
}

async function createDraft(ownerId, input = {}) {
  validatePartialDraftInput(input);

  let resolvedPhotos = [];
  if (Array.isArray(input.foto_ids) && input.foto_ids.length > 0) {
    resolvedPhotos = await validateAndResolveFotoIds(ownerId, input.foto_ids);
  }

  let koordinat = null;
  if (
    input.koordinat &&
    typeof input.koordinat.latitude === 'number' &&
    !Number.isNaN(input.koordinat.latitude) &&
    typeof input.koordinat.longitude === 'number' &&
    !Number.isNaN(input.koordinat.longitude)
  ) {
    koordinat = {
      latitude: input.koordinat.latitude,
      longitude: input.koordinat.longitude,
    };
  }

  let hargaPerBulan = null;
  if (input.harga_per_bulan !== undefined && input.harga_per_bulan !== null && input.harga_per_bulan !== '') {
    hargaPerBulan = Number(input.harga_per_bulan);
  }

  let tipe = null;
  if (input.tipe && ['putra', 'putri', 'campur'].includes(input.tipe)) {
    tipe = input.tipe;
  }

  let totalKamar = null;
  if (input.jumlah_kamar_total !== undefined && input.jumlah_kamar_total !== null && input.jumlah_kamar_total !== '') {
    totalKamar = Number(input.jumlah_kamar_total);
  }

  let kamarTersedia = null;
  if (input.jumlah_kamar_tersedia !== undefined && input.jumlah_kamar_tersedia !== null && input.jumlah_kamar_tersedia !== '') {
    kamarTersedia = Number(input.jumlah_kamar_tersedia);
  }

  const draftKonten = {
    nama: typeof input.nama === 'string' && input.nama.trim() ? input.nama.trim() : null,
    deskripsi: typeof input.deskripsi === 'string' && input.deskripsi.trim() ? input.deskripsi.trim() : null,
    alamat: typeof input.alamat === 'string' && input.alamat.trim() ? input.alamat.trim() : null,
    area_kampus: typeof input.area_kampus === 'string' && input.area_kampus.trim() ? input.area_kampus.trim() : null,
    koordinat,
    harga_per_bulan: hargaPerBulan,
    tipe,
    fasilitas: Array.isArray(input.fasilitas) ? input.fasilitas : [],
    peraturan: Array.isArray(input.peraturan) ? input.peraturan : [],
    luas_kamar: input.luas_kamar ? String(input.luas_kamar) : null,
    jumlah_kamar_total: totalKamar,
    jumlah_kamar_tersedia: kamarTersedia,
    foto_ids: input.foto_ids || [],
    foto: resolvedPhotos,
  };

  const kos = await Kos.create({
    nama: draftKonten.nama,
    pemilik_id: ownerId,
    status_verifikasi: 'draft',
    status_publikasi: 'active',
    status_moderasi: 'normal',
    version: 1,
    version_ketersediaan: 1,
    ketersediaan_diperbarui_pada: null,
    jumlah_kamar_total: totalKamar,
    jumlah_kamar_tersedia: kamarTersedia,
    draft_konten: draftKonten,
  });

  await kos.populate('pemilik_id', 'nama email role');
  return toKosOwnerDto(kos);
}

async function getOwnerKosList(ownerId, query = {}) {
  const { page, limit, status_verifikasi, q } = query;
  const filter = { pemilik_id: ownerId, deleted_at: null };

  if (status_verifikasi) {
    filter.status_verifikasi = status_verifikasi;
  }
  if (q) {
    const term = safeSearchTerm(q);
    filter.$or = [
      { nama: { $regex: term, $options: 'i' } },
      { 'draft_konten.nama': { $regex: term, $options: 'i' } },
    ];
  }

  const { pageNum, limitNum } = parsePagination(page, limit, 12);
  const totalData = await Kos.countDocuments(filter);
  const totalPages = totalData > 0 ? Math.ceil(totalData / limitNum) : 1;
  const currentPage = totalData > 0 ? Math.min(Math.max(1, pageNum), totalPages) : 1;
  const clampedSkip = (currentPage - 1) * limitNum;

  const list = await Kos.find(filter)
    .populate('pemilik_id', 'nama email role')
    .sort({ createdAt: -1 })
    .skip(clampedSkip)
    .limit(limitNum);

  const kosIds = list.map((k) => k._id);
  const activeSubmissions = await Pengajuan.find({
    kos_id: { $in: kosIds },
    is_active: true,
  });
  const submissionMap = new Map(activeSubmissions.map((s) => [String(s.kos_id), s]));

  const missingKos = list.filter((k) => !submissionMap.has(String(k._id)));
  if (missingKos.length > 0) {
    const missingIds = missingKos.map((k) => k._id);
    const candidateSubmissions = await Pengajuan.find({
      kos_id: { $in: missingIds },
      status: { $in: ['revision', 'rejected'] },
    }).sort({ createdAt: -1, updatedAt: -1 });

    for (const kos of missingKos) {
      const latest = candidateSubmissions.find((s) => String(s.kos_id) === String(kos._id));
      if (latest) {
        let isObsolete = false;
        if (kos.status_verifikasi === 'approved') {
          if (latest.jenis === 'baru') {
            isObsolete = true;
          } else {
            const hasSubsequentApproval = await Pengajuan.findOne({
              kos_id: kos._id,
              status: 'approved',
              createdAt: { $gte: latest.createdAt },
              _id: { $ne: latest._id },
            });
            if (hasSubsequentApproval) {
              isObsolete = true;
            }
          }
        }
        if (!isObsolete) {
          submissionMap.set(String(kos._id), latest);
        }
      }
    }
  }

  return {
    data: list.map((k) => toKosOwnerDto(k, submissionMap.get(String(k._id)))),
    pagination: {
      totalData,
      totalPages,
      currentPage,
      limit: limitNum,
    },
  };
}

async function getOwnerKosDetail(ownerId, kosId) {
  if (!mongoose.Types.ObjectId.isValid(kosId)) {
    const err = new Error('ID kos tidak valid');
    err.statusCode = 404;
    throw err;
  }

  const kos = await Kos.findOne({ _id: kosId, pemilik_id: ownerId, deleted_at: null }).populate(
    'pemilik_id',
    'nama email role'
  );
  if (!kos) {
    const err = new Error('Kos tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  let activePengajuan = await Pengajuan.findOne({
    kos_id: kos._id,
    is_active: true,
  });

  if (!activePengajuan) {
    const latestSubmission = await Pengajuan.findOne({
      kos_id: kos._id,
    }).sort({ createdAt: -1, updatedAt: -1 });

    if (latestSubmission && ['revision', 'rejected'].includes(latestSubmission.status)) {
      let isObsolete = false;
      if (kos.status_verifikasi === 'approved') {
        if (latestSubmission.jenis === 'baru') {
          isObsolete = true;
        } else {
          const hasSubsequentApproval = await Pengajuan.findOne({
            kos_id: kos._id,
            status: 'approved',
            createdAt: { $gte: latestSubmission.createdAt },
            _id: { $ne: latestSubmission._id },
          });
          if (hasSubsequentApproval) {
            isObsolete = true;
          }
        }
      }
      if (!isObsolete) {
        activePengajuan = latestSubmission;
      }
    }
  }

  return toKosOwnerDto(kos, activePengajuan);
}

async function updateDraft(ownerId, kosId, input) {
  const kos = await Kos.findOne({ _id: kosId, pemilik_id: ownerId, deleted_at: null }).populate(
    'pemilik_id',
    'nama email role'
  );
  if (!kos) {
    const err = new Error('Kos tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  if (kos.status_verifikasi === 'pending') {
    const err = new Error('Pengajuan awal sedang ditinjau. Tarik pengajuan terlebih dahulu untuk menyunting.');
    err.statusCode = 409;
    throw err;
  }
  if (kos.status_verifikasi === 'approved') {
    const err = new Error('Listing yang sudah disetujui tidak dapat disunting melalui endpoint draft awal. Gunakan resource perubahan.');
    err.statusCode = 409;
    throw err;
  }

  if (typeof input.expected_version !== 'number' || input.expected_version !== kos.version) {
    const err = new Error('Versi listing tidak sesuai (konflik pembaharuan konkuren). Muat ulang lalu coba lagi.');
    err.statusCode = 409;
    throw err;
  }

  validatePartialDraftInput(input);

  let resolvedPhotos = undefined;
  if (input.foto_ids !== undefined) {
    resolvedPhotos = await validateAndResolveFotoIds(ownerId, input.foto_ids);
  }

  const current = kos.draft_konten || {
    nama: kos.nama,
    deskripsi: kos.deskripsi,
    alamat: kos.alamat,
    area_kampus: kos.area_kampus,
    koordinat: kos.koordinat,
    harga_per_bulan: kos.harga_per_bulan,
    tipe: kos.tipe,
    fasilitas: kos.fasilitas,
    peraturan: kos.peraturan,
    luas_kamar: kos.luas_kamar,
    jumlah_kamar_total: kos.jumlah_kamar_total,
    jumlah_kamar_tersedia: kos.jumlah_kamar_tersedia,
    foto_ids: [],
    foto: [],
  };

  let newKoordinat = current.koordinat;
  if (input.koordinat !== undefined) {
    if (input.koordinat === null) {
      newKoordinat = null;
    } else if (
      typeof input.koordinat?.latitude === 'number' &&
      typeof input.koordinat?.longitude === 'number'
    ) {
      newKoordinat = {
        latitude: input.koordinat.latitude,
        longitude: input.koordinat.longitude,
      };
    }
  }

  const updatedDraft = {
    ...current,
    ...(input.nama !== undefined ? { nama: input.nama ? String(input.nama).trim() : null } : {}),
    ...(input.deskripsi !== undefined ? { deskripsi: input.deskripsi ? String(input.deskripsi).trim() : null } : {}),
    ...(input.alamat !== undefined ? { alamat: input.alamat ? String(input.alamat).trim() : null } : {}),
    ...(input.area_kampus !== undefined ? { area_kampus: input.area_kampus ? String(input.area_kampus).trim() : null } : {}),
    ...(input.koordinat !== undefined ? { koordinat: newKoordinat } : {}),
    ...(input.harga_per_bulan !== undefined
      ? { harga_per_bulan: input.harga_per_bulan !== null && input.harga_per_bulan !== '' ? Number(input.harga_per_bulan) : null }
      : {}),
    ...(input.tipe !== undefined ? { tipe: input.tipe || null } : {}),
    ...(input.fasilitas !== undefined ? { fasilitas: Array.isArray(input.fasilitas) ? input.fasilitas : [] } : {}),
    ...(input.peraturan !== undefined ? { peraturan: Array.isArray(input.peraturan) ? input.peraturan : [] } : {}),
    ...(input.luas_kamar !== undefined ? { luas_kamar: input.luas_kamar ? String(input.luas_kamar) : null } : {}),
    ...(input.jumlah_kamar_total !== undefined
      ? { jumlah_kamar_total: input.jumlah_kamar_total !== null && input.jumlah_kamar_total !== '' ? Number(input.jumlah_kamar_total) : null }
      : {}),
    ...(input.jumlah_kamar_tersedia !== undefined
      ? { jumlah_kamar_tersedia: input.jumlah_kamar_tersedia !== null && input.jumlah_kamar_tersedia !== '' ? Number(input.jumlah_kamar_tersedia) : null }
      : {}),
    ...(input.foto_ids !== undefined ? { foto_ids: input.foto_ids, foto: resolvedPhotos } : {}),
  };

  if (updatedDraft.jumlah_kamar_total != null && updatedDraft.jumlah_kamar_tersedia != null) {
    if (updatedDraft.jumlah_kamar_tersedia > updatedDraft.jumlah_kamar_total) {
      const err = new Error('Jumlah kamar tersedia tidak boleh melebihi jumlah kamar total');
      err.statusCode = 422;
      err.code = 'VALIDATION_ERROR';
      err.errors = { jumlah_kamar_tersedia: ['Jumlah kamar tersedia tidak boleh melebihi jumlah kamar total'] };
      throw err;
    }
  }

  if (updatedDraft.nama !== undefined) {
    kos.nama = updatedDraft.nama;
  }
  if (updatedDraft.jumlah_kamar_total !== undefined) {
    kos.jumlah_kamar_total = updatedDraft.jumlah_kamar_total;
  }
  if (updatedDraft.jumlah_kamar_tersedia !== undefined) {
    kos.jumlah_kamar_tersedia = updatedDraft.jumlah_kamar_tersedia;
  }
  kos.draft_konten = updatedDraft;
  if (['revision', 'rejected'].includes(kos.status_verifikasi)) {
    kos.status_verifikasi = 'draft';
  }
  kos.version = kos.version + 1;

  await kos.save();
  return toKosOwnerDto(kos);
}

async function submitInitialKos(ownerId, kosId, expectedVersion) {
  if (!mongoose.Types.ObjectId.isValid(kosId)) {
    const err = new Error('ID kos tidak valid');
    err.statusCode = 400;
    err.code = 'MALFORMED_ID';
    throw err;
  }

  const kos = await Kos.findOne({ _id: kosId, pemilik_id: ownerId, deleted_at: null }).populate(
    'pemilik_id',
    'nama email role'
  );
  if (!kos) {
    const err = new Error('Kos tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  if (['pending', 'approved'].includes(kos.status_verifikasi)) {
    const err = new Error(`Listing dalam status ${kos.status_verifikasi} tidak dapat diajukan kembali`);
    err.statusCode = 409;
    throw err;
  }

  if (typeof expectedVersion !== 'number' || expectedVersion !== kos.version) {
    const err = new Error('Versi listing tidak sesuai. Muat ulang lalu coba lagi.');
    err.statusCode = 409;
    throw err;
  }

  const draftData = kos.draft_konten || {
    nama: kos.nama,
    deskripsi: kos.deskripsi,
    alamat: kos.alamat,
    area_kampus: kos.area_kampus,
    koordinat: kos.koordinat,
    harga_per_bulan: kos.harga_per_bulan,
    tipe: kos.tipe,
    fasilitas: kos.fasilitas,
    peraturan: kos.peraturan,
    luas_kamar: kos.luas_kamar,
    jumlah_kamar_total: kos.jumlah_kamar_total,
    jumlah_kamar_tersedia: kos.jumlah_kamar_tersedia,
    foto_ids: [],
  };

  validateFullDraftContent(draftData);

  const resolvedPhotos = await validateAndResolveFotoIds(ownerId, draftData.foto_ids);
  const afterContent = toKosContent({
    ...draftData,
    foto: resolvedPhotos,
  });

  const session = await mongoose.startSession();
  let createdSubmission = null;

  try {
    await session.withTransaction(async () => {
      const currentKos = await Kos.findOne({ _id: kosId, pemilik_id: ownerId, deleted_at: null }).session(session);
      if (!currentKos) {
        const err = new Error('Kos tidak ditemukan');
        err.statusCode = 404;
        throw err;
      }

      if (['pending', 'approved'].includes(currentKos.status_verifikasi)) {
        const err = new Error(`Listing dalam status ${currentKos.status_verifikasi} tidak dapat diajukan kembali`);
        err.statusCode = 409;
        throw err;
      }

      if (currentKos.version !== expectedVersion) {
        const err = new Error('Versi listing tidak sesuai. Muat ulang lalu coba lagi.');
        err.statusCode = 409;
        throw err;
      }

      const updatedKos = await Kos.findOneAndUpdate(
        { _id: kosId, pemilik_id: ownerId, status_verifikasi: { $in: ['draft', 'revision', 'rejected'] }, version: expectedVersion },
        {
          $set: {
            status_verifikasi: 'pending',
            jumlah_kamar_total: afterContent.jumlah_kamar_total,
            jumlah_kamar_tersedia: afterContent.jumlah_kamar_tersedia,
            ketersediaan_diperbarui_pada: new Date(),
          },
          $inc: { version: 1 },
        },
        { session, new: true }
      );

      if (!updatedKos) {
        const err = new Error('Konflik versi listing saat pengajuan.');
        err.statusCode = 409;
        throw err;
      }

      const [pengajuan] = await Pengajuan.create(
        [
          {
            kos_id: kos._id,
            pemilik_id: ownerId,
            jenis: 'baru',
            status: 'pending',
            version: 1,
            base_version: currentKos.version,
            before: null,
            after: afterContent,
            foto_ids: draftData.foto_ids,
            nama_kos: afterContent.nama,
            submitted_at: new Date(),
          },
        ],
        { session }
      );

      createdSubmission = pengajuan;
    });
  } finally {
    await session.endSession();
  }

  await createdSubmission.populate('pemilik_id', 'nama email role');
  return toSubmissionDto(createdSubmission);
}

async function withdrawInitialKos(ownerId, kosId, expectedVersion) {
  if (!mongoose.Types.ObjectId.isValid(kosId)) {
    const err = new Error('ID kos tidak valid');
    err.statusCode = 400;
    err.code = 'MALFORMED_ID';
    throw err;
  }

  const session = await mongoose.startSession();
  let resultKos = null;

  try {
    await session.withTransaction(async () => {
      const pengajuan = await Pengajuan.findOne({
        kos_id: kosId,
        pemilik_id: ownerId,
        is_active: true,
        jenis: 'baru',
        status: 'pending',
      }).session(session);

      if (!pengajuan) {
        // Jalur pemulihan eksplisit untuk data legacy berstatus pending tanpa Pengajuan kanonikal
        const legacyKos = await Kos.findOne({
          _id: kosId,
          pemilik_id: ownerId,
          status_verifikasi: 'pending',
          deleted_at: null,
        }).session(session);

        if (!legacyKos) {
          const err = new Error('Tidak ada pengajuan awal pending yang dapat ditarik');
          err.statusCode = 409;
          throw err;
        }

        if (typeof expectedVersion === 'number' && expectedVersion !== legacyKos.version) {
          const err = new Error('Versi listing tidak sesuai. Muat ulang lalu coba lagi.');
          err.statusCode = 409;
          throw err;
        }

        const draftData = legacyKos.draft_konten || {
          nama: legacyKos.nama,
          deskripsi: legacyKos.deskripsi,
          alamat: legacyKos.alamat,
          area_kampus: legacyKos.area_kampus,
          koordinat: legacyKos.koordinat,
          harga_per_bulan: legacyKos.harga_per_bulan,
          tipe: legacyKos.tipe,
          fasilitas: legacyKos.fasilitas || [],
          peraturan: legacyKos.peraturan || [],
          luas_kamar: legacyKos.luas_kamar,
          jumlah_kamar_total: legacyKos.jumlah_kamar_total,
          jumlah_kamar_tersedia: legacyKos.jumlah_kamar_tersedia,
          foto_ids: [],
          foto: legacyKos.foto || [],
        };

        const updatedLegacy = await Kos.findOneAndUpdate(
          {
            _id: kosId,
            pemilik_id: ownerId,
            status_verifikasi: 'pending',
            version: legacyKos.version,
          },
          {
            $set: {
              status_verifikasi: 'draft',
              draft_konten: draftData,
            },
            $inc: { version: 1 },
          },
          { session, new: true }
        );

        if (!updatedLegacy) {
          const err = new Error('Konflik saat menarik listing pending legacy.');
          err.statusCode = 409;
          throw err;
        }

        resultKos = updatedLegacy;
        return;
      }

      if (typeof expectedVersion !== 'number' || expectedVersion !== pengajuan.version) {
        const err = new Error('Versi pengajuan tidak sesuai. Muat ulang lalu coba lagi.');
        err.statusCode = 409;
        throw err;
      }

      const updatedPengajuan = await Pengajuan.findOneAndUpdate(
        { _id: pengajuan._id, status: 'pending', version: expectedVersion },
        {
          $set: { status: 'withdrawn', is_active: false },
          $inc: { version: 1 },
        },
        { session, new: true }
      );

      if (!updatedPengajuan) {
        const err = new Error('Pengajuan telah berubah status atau ditarik.');
        err.statusCode = 409;
        throw err;
      }

      const updatedKos = await Kos.findOneAndUpdate(
        { _id: kosId, pemilik_id: ownerId, status_verifikasi: 'pending' },
        {
          $set: { status_verifikasi: 'draft' },
          $inc: { version: 1 },
        },
        { session, new: true }
      );

      if (!updatedKos) {
        const err = new Error('Listing tidak dalam status pending.');
        err.statusCode = 409;
        throw err;
      }

      resultKos = updatedKos;
    });
  } finally {
    await session.endSession();
  }

  await resultKos.populate('pemilik_id', 'nama email role');
  return toKosOwnerDto(resultKos);
}

async function updateAvailability(ownerId, kosId, stok, expectedVersion) {
  if (!mongoose.Types.ObjectId.isValid(kosId)) {
    const err = new Error('ID kos tidak valid');
    err.statusCode = 400;
    err.code = 'MALFORMED_ID';
    throw err;
  }

  const kos = await Kos.findOne({ _id: kosId, pemilik_id: ownerId, deleted_at: null }).populate(
    'pemilik_id',
    'nama email role'
  );
  if (!kos) {
    const err = new Error('Kos tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  if (typeof expectedVersion !== 'number' || expectedVersion !== kos.version_ketersediaan) {
    const err = new Error('Versi ketersediaan tidak sesuai. Muat ulang lalu coba lagi.');
    err.statusCode = 409;
    throw err;
  }

  const stokNum = Number(stok);
  if (!Number.isInteger(stokNum) || stokNum < 0) {
    const err = new Error('Jumlah kamar tersedia harus berupa bilangan bulat positif atau nol');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const maxTotal = kos.status_verifikasi === 'approved'
    ? kos.jumlah_kamar_total
    : (kos.draft_konten?.jumlah_kamar_total || kos.jumlah_kamar_total);

  if (maxTotal && stokNum > maxTotal) {
    const err = new Error('Kamar tersedia tidak boleh melebihi jumlah kamar total');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const updatedKos = await Kos.findOneAndUpdate(
    { _id: kosId, pemilik_id: ownerId, deleted_at: null, version_ketersediaan: expectedVersion },
    {
      $set: {
        jumlah_kamar_tersedia: stokNum,
        ketersediaan_diperbarui_pada: new Date(),
      },
      $inc: { version_ketersediaan: 1 },
    },
    { new: true }
  ).populate('pemilik_id', 'nama email role');

  if (!updatedKos) {
    const err = new Error('Versi ketersediaan tidak sesuai. Muat ulang lalu coba lagi.');
    err.statusCode = 409;
    throw err;
  }

  return toKosOwnerDto(updatedKos);
}

async function updatePublication(ownerId, kosId, statusPublikasi, expectedVersion) {
  if (!mongoose.Types.ObjectId.isValid(kosId)) {
    const err = new Error('ID kos tidak valid');
    err.statusCode = 400;
    err.code = 'MALFORMED_ID';
    throw err;
  }

  if (!['active', 'archived'].includes(statusPublikasi)) {
    const err = new Error('Status publikasi harus bernilai "active" atau "archived"');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (typeof expectedVersion !== 'number') {
    const err = new Error('expected_version wajib disertakan');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const updatedKos = await Kos.findOneAndUpdate(
    { _id: kosId, pemilik_id: ownerId, deleted_at: null, version: expectedVersion },
    {
      $set: { status_publikasi: statusPublikasi },
    },
    { new: true }
  ).populate('pemilik_id', 'nama email role');

  if (!updatedKos) {
    const kosExists = await Kos.findOne({ _id: kosId, pemilik_id: ownerId, deleted_at: null });
    if (!kosExists) {
      const err = new Error('Kos tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }
    const err = new Error('Versi listing tidak sesuai. Muat ulang lalu coba lagi.');
    err.statusCode = 409;
    throw err;
  }

  return toKosOwnerDto(updatedKos);
}

async function softDeleteKos(ownerId, kosId, expectedVersion) {
  if (!mongoose.Types.ObjectId.isValid(kosId)) {
    const err = new Error('ID kos tidak valid');
    err.statusCode = 400;
    err.code = 'MALFORMED_ID';
    throw err;
  }

  const kos = await Kos.findOne({ _id: kosId, pemilik_id: ownerId });
  if (!kos) {
    const err = new Error('Kos tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  if (kos.deleted_at !== null) {
    return true;
  }

  if (kos.status_verifikasi === 'pending') {
    const err = new Error('Pengajuan awal sedang pending. Tarik pengajuan terlebih dahulu sebelum menghapus listing.');
    err.statusCode = 409;
    throw err;
  }

  const pendingChange = await Pengajuan.findOne({
    kos_id: kosId,
    jenis: 'perubahan',
    status: 'pending',
    is_active: true,
  });
  if (pendingChange) {
    const err = new Error('Pengajuan perubahan sedang dalam peninjauan admin. Tarik pengajuan perubahan terlebih dahulu sebelum menghapus listing.');
    err.statusCode = 409;
    throw err;
  }

  if (kos.status_verifikasi === 'approved' && kos.status_publikasi !== 'archived') {
    const err = new Error('Listing yang sudah disetujui harus diarsipkan terlebih dahulu sebelum dihapus.');
    err.statusCode = 409;
    throw err;
  }

  if (typeof expectedVersion !== 'number' || expectedVersion !== kos.version) {
    const err = new Error('Versi listing tidak sesuai. Muat ulang lalu coba lagi.');
    err.statusCode = 409;
    throw err;
  }

  const updatedKos = await Kos.findOneAndUpdate(
    { _id: kosId, pemilik_id: ownerId, deleted_at: null, version: expectedVersion },
    {
      $set: { deleted_at: new Date() },
    },
    { new: true }
  );

  if (!updatedKos) {
    const err = new Error('Versi listing tidak sesuai atau listing telah dihapus.');
    err.statusCode = 409;
    throw err;
  }

  return true;
}

async function getChangeSubmission(ownerId, kosId) {
  const kos = await Kos.findOne({ _id: kosId, pemilik_id: ownerId, deleted_at: null }).populate(
    'pemilik_id',
    'nama email role'
  );
  if (!kos) {
    const err = new Error('Kos tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  let pengajuan = await Pengajuan.findOne({
    kos_id: kos._id,
    pemilik_id: ownerId,
    jenis: 'perubahan',
    is_active: true,
  });

  if (!pengajuan) {
    const latestSubmission = await Pengajuan.findOne({
      kos_id: kos._id,
      pemilik_id: ownerId,
      jenis: 'perubahan',
    }).sort({ createdAt: -1, updatedAt: -1 });

    if (latestSubmission && ['revision', 'rejected'].includes(latestSubmission.status)) {
      pengajuan = latestSubmission;
    }
  }

  if (!pengajuan) {
    const err = new Error('Tidak ada pengajuan perubahan aktif untuk listing ini');
    err.statusCode = 404;
    throw err;
  }

  return toSubmissionDto(pengajuan, { [String(ownerId)]: kos.pemilik_id });
}

async function upsertChangeDraft(ownerId, kosId, input) {
  if (!mongoose.Types.ObjectId.isValid(kosId)) {
    const err = new Error('ID kos tidak valid');
    err.statusCode = 400;
    err.code = 'MALFORMED_ID';
    throw err;
  }

  const kos = await Kos.findOne({ _id: kosId, pemilik_id: ownerId, deleted_at: null }).populate(
    'pemilik_id',
    'nama email role'
  );
  if (!kos) {
    const err = new Error('Kos tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  if (kos.status_verifikasi !== 'approved') {
    const err = new Error('Pengajuan perubahan hanya dapat dibuat untuk listing yang sudah berstatus approved');
    err.statusCode = 409;
    throw err;
  }

  validatePartialDraftInput(input);

  const existing = await Pengajuan.findOne({
    kos_id: kos._id,
    pemilik_id: ownerId,
    jenis: 'perubahan',
    is_active: true,
  });

  const MediaAsset = mongoose.model('MediaAsset');
  const path = require('path');
  const fs = require('fs');
  const { UPLOAD_DIR } = require('./mediaService');

  // Helper untuk mengonversi foto legacy ke MediaAsset nyata secara terkontrol
  async function ensureMediaAssetsForLegacyPhotos(fotoList) {
    const resolvedIds = [];
    const resolvedObjs = [];
    for (const item of fotoList || []) {
      const urlStr = typeof item === 'string' ? item : item.url;
      if (!urlStr) continue;

      let asset = await MediaAsset.findOne({ user_id: ownerId, url: urlStr, is_deleted: false });
      if (!asset) {
        const isRemote = /^https?:\/\//i.test(urlStr);
        const filename = path.basename(urlStr);
        const ext = path.extname(filename).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        let fileSize = null;
        let filePath = null;

        if (!isRemote) {
          const localPath = path.join(UPLOAD_DIR, filename);
          if (fs.existsSync(localPath)) {
            try {
              fileSize = fs.statSync(localPath).size;
            } catch (e) {
              fileSize = null;
            }
          }
          filePath = localPath;
        }

        asset = await MediaAsset.create({
          user_id: ownerId,
          storage_kind: isRemote ? 'legacy_remote' : 'local',
          file_path: filePath,
          url: urlStr,
          original_filename: filename,
          mime_type: mime,
          file_size: fileSize,
        });
      }
      resolvedIds.push(String(asset._id));
      resolvedObjs.push({
        asset_id: String(asset._id),
        url: ensureAbsoluteUrl(asset.url),
        alt: asset.alt || '',
      });
    }
    return { resolvedIds, resolvedObjs };
  }

  if (existing) {
    if (existing.status === 'pending') {
      const err = new Error('Pengajuan perubahan sedang dalam peninjauan admin. Tarik pengajuan terlebih dahulu untuk menyunting.');
      err.statusCode = 409;
      throw err;
    }

    if (typeof input.expected_version !== 'number' || input.expected_version !== existing.version) {
      const err = new Error('Versi pengajuan perubahan tidak sesuai. Muat ulang lalu coba lagi.');
      err.statusCode = 409;
      throw err;
    }

    let resolvedPhotos = existing.after.foto;
    let fotoIds = existing.foto_ids;
    if (input.foto_ids !== undefined) {
      resolvedPhotos = await validateAndResolveFotoIds(ownerId, input.foto_ids);
      fotoIds = input.foto_ids;
    } else if ((!fotoIds || fotoIds.length === 0) && Array.isArray(kos.foto) && kos.foto.length > 0) {
      const legacyResult = await ensureMediaAssetsForLegacyPhotos(kos.foto);
      if (legacyResult.resolvedIds.length > 0) {
        fotoIds = legacyResult.resolvedIds;
        resolvedPhotos = legacyResult.resolvedObjs;
      }
    }

    let newKoordinat = existing.after.koordinat;
    if (input.koordinat !== undefined) {
      if (
        typeof input.koordinat?.latitude === 'number' &&
        typeof input.koordinat?.longitude === 'number'
      ) {
        newKoordinat = {
          latitude: input.koordinat.latitude,
          longitude: input.koordinat.longitude,
        };
      }
    }

    const updatedAfter = {
      ...existing.after,
      ...(input.nama !== undefined ? { nama: input.nama == null ? '' : String(input.nama).trim() } : {}),
      ...(input.deskripsi !== undefined ? { deskripsi: input.deskripsi == null ? '' : String(input.deskripsi).trim() } : {}),
      ...(input.alamat !== undefined ? { alamat: input.alamat == null ? '' : String(input.alamat).trim() } : {}),
      ...(input.area_kampus !== undefined ? { area_kampus: input.area_kampus == null ? '' : String(input.area_kampus).trim() } : {}),
      ...(input.koordinat !== undefined ? { koordinat: newKoordinat } : {}),
      ...(input.harga_per_bulan !== undefined ? { harga_per_bulan: Number(input.harga_per_bulan) } : {}),
      ...(input.tipe !== undefined ? { tipe: input.tipe } : {}),
      ...(input.fasilitas !== undefined ? { fasilitas: Array.isArray(input.fasilitas) ? input.fasilitas : [] } : {}),
      ...(input.peraturan !== undefined ? { peraturan: Array.isArray(input.peraturan) ? input.peraturan : [] } : {}),
      ...(input.luas_kamar !== undefined ? { luas_kamar: input.luas_kamar ? String(input.luas_kamar) : null } : {}),
      ...(input.jumlah_kamar_total !== undefined ? { jumlah_kamar_total: Number(input.jumlah_kamar_total) } : {}),
      ...(input.foto_ids !== undefined || (fotoIds && fotoIds.length > 0) ? { foto: resolvedPhotos } : {}),
    };

    const updatedSubmission = await Pengajuan.findOneAndUpdate(
      {
        _id: existing._id,
        pemilik_id: ownerId,
        is_active: true,
        status: 'draft',
        version: input.expected_version,
      },
      {
        $set: {
          after: updatedAfter,
          foto_ids: fotoIds,
          nama_kos: updatedAfter.nama,
          base_version: kos.version,
        },
        $inc: { version: 1 },
      },
      { new: true }
    );

    if (!updatedSubmission) {
      const err = new Error('Versi pengajuan perubahan tidak sesuai atau telah diubah (konflik versi). Muat ulang lalu coba lagi.');
      err.statusCode = 409;
      throw err;
    }

    return toSubmissionDto(updatedSubmission, { [String(ownerId)]: kos.pemilik_id });
  }

  // Membuat pengajuan perubahan baru dari snapshot publik atau dari revisi sebelumnya
  const latestSubmission = await Pengajuan.findOne({
    kos_id: kos._id,
    pemilik_id: ownerId,
    jenis: 'perubahan',
  }).sort({ createdAt: -1, updatedAt: -1 });

  const latestHistorical = (latestSubmission && ['revision', 'rejected'].includes(latestSubmission.status))
    ? latestSubmission
    : null;

  const beforeContent = toKosContent(kos);
  let baseContent = beforeContent;
  let fotoIds = (kos.foto_id_list || []).map(String);
  let resolvedPhotos = beforeContent.foto;

  if (latestHistorical && input.expected_version === latestHistorical.version) {
    baseContent = latestHistorical.after;
    fotoIds = latestHistorical.foto_ids || [];
    resolvedPhotos = latestHistorical.after?.foto || beforeContent.foto;
  } else if (typeof input.expected_version === 'number' && input.expected_version === kos.version) {
    baseContent = beforeContent;
  } else {
    const err = new Error('expected_version harus sesuai dengan versi konten listing publik saat ini atau versi revisi.');
    err.statusCode = 409;
    throw err;
  }

  if (input.foto_ids !== undefined) {
    resolvedPhotos = await validateAndResolveFotoIds(ownerId, input.foto_ids);
    fotoIds = input.foto_ids;
  } else if (fotoIds.length === 0 && Array.isArray(kos.foto) && kos.foto.length > 0) {
    const legacyResult = await ensureMediaAssetsForLegacyPhotos(kos.foto);
    if (legacyResult.resolvedIds.length > 0) {
      fotoIds = legacyResult.resolvedIds;
      resolvedPhotos = legacyResult.resolvedObjs;
      kos.foto_id_list = legacyResult.resolvedIds;
      await kos.save();
    }
  }

  let newKoordinat = baseContent.koordinat;
  if (input.koordinat !== undefined) {
    if (
      typeof input.koordinat?.latitude === 'number' &&
      typeof input.koordinat?.longitude === 'number'
    ) {
      newKoordinat = {
        latitude: input.koordinat.latitude,
        longitude: input.koordinat.longitude,
      };
    }
  }

  const afterContent = {
    ...baseContent,
    ...(input.nama !== undefined ? { nama: input.nama == null ? '' : String(input.nama).trim() } : {}),
    ...(input.deskripsi !== undefined ? { deskripsi: input.deskripsi == null ? '' : String(input.deskripsi).trim() } : {}),
    ...(input.alamat !== undefined ? { alamat: input.alamat == null ? '' : String(input.alamat).trim() } : {}),
    ...(input.area_kampus !== undefined ? { area_kampus: input.area_kampus == null ? '' : String(input.area_kampus).trim() } : {}),
    ...(input.koordinat !== undefined ? { koordinat: newKoordinat } : {}),
    ...(input.harga_per_bulan !== undefined ? { harga_per_bulan: Number(input.harga_per_bulan) } : {}),
    ...(input.tipe !== undefined ? { tipe: input.tipe } : {}),
    ...(input.fasilitas !== undefined ? { fasilitas: Array.isArray(input.fasilitas) ? input.fasilitas : [] } : {}),
    ...(input.peraturan !== undefined ? { peraturan: Array.isArray(input.peraturan) ? input.peraturan : [] } : {}),
    ...(input.luas_kamar !== undefined ? { luas_kamar: input.luas_kamar ? String(input.luas_kamar) : null } : {}),
    ...(input.jumlah_kamar_total !== undefined ? { jumlah_kamar_total: Number(input.jumlah_kamar_total) } : {}),
    foto: resolvedPhotos,
  };

  const pengajuanBaru = await Pengajuan.create({
    kos_id: kos._id,
    pemilik_id: ownerId,
    jenis: 'perubahan',
    status: 'draft',
    is_active: true,
    version: 1,
    base_version: kos.version,
    before: beforeContent,
    after: afterContent,
    foto_ids: fotoIds,
    nama_kos: afterContent.nama,
  });

  return toSubmissionDto(pengajuanBaru, { [String(ownerId)]: kos.pemilik_id });
}

async function submitChangeDraft(ownerId, kosId, expectedVersion) {
  if (!mongoose.Types.ObjectId.isValid(kosId)) {
    const err = new Error('ID kos tidak valid');
    err.statusCode = 400;
    err.code = 'MALFORMED_ID';
    throw err;
  }

  const kos = await Kos.findOne({ _id: kosId, pemilik_id: ownerId, deleted_at: null }).populate(
    'pemilik_id',
    'nama email role'
  );
  if (!kos) {
    const err = new Error('Kos tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  const submission = await Pengajuan.findOne({
    kos_id: kos._id,
    pemilik_id: ownerId,
    jenis: 'perubahan',
    is_active: true,
    status: 'draft',
  });

  if (!submission) {
    const err = new Error('Tidak ada draf pengajuan perubahan yang dapat diajukan');
    err.statusCode = 404;
    throw err;
  }

  if (typeof expectedVersion !== 'number' || expectedVersion !== submission.version) {
    const err = new Error('Versi pengajuan tidak sesuai. Muat ulang lalu coba lagi.');
    err.statusCode = 409;
    throw err;
  }

  if (submission.base_version !== kos.version) {
    const err = new Error('Versi konten listing publik telah berubah. Silakan perbarui draf perubahan Anda.');
    err.statusCode = 409;
    throw err;
  }

  // Pengecekan konflik state terhadap ketersediaan kamar saat ini (harus 409 STATE_CONFLICT)
  if (submission.after.jumlah_kamar_total < kos.jumlah_kamar_tersedia) {
    const err = new Error('Jumlah kamar total yang diajukan tidak boleh lebih kecil dari kamar tersedia saat ini');
    err.statusCode = 409;
    err.code = 'STATE_CONFLICT';
    throw err;
  }

  validateFullDraftContent({
    ...submission.after,
    jumlah_kamar_tersedia: kos.jumlah_kamar_tersedia,
    foto_ids: submission.foto_ids,
  });

  const updatedSubmission = await Pengajuan.findOneAndUpdate(
    { _id: submission._id, status: 'draft', is_active: true, version: expectedVersion },
    {
      $set: {
        status: 'pending',
        submitted_at: new Date(),
      },
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!updatedSubmission) {
    const err = new Error('Versi pengajuan tidak sesuai atau status pengajuan telah berubah.');
    err.statusCode = 409;
    throw err;
  }

  return toSubmissionDto(updatedSubmission, { [String(ownerId)]: kos.pemilik_id });
}

async function withdrawChangeDraft(ownerId, kosId, expectedVersion) {
  if (!mongoose.Types.ObjectId.isValid(kosId)) {
    const err = new Error('ID kos tidak valid');
    err.statusCode = 400;
    err.code = 'MALFORMED_ID';
    throw err;
  }

  const session = await mongoose.startSession();
  let resultDraft = null;

  try {
    await session.withTransaction(async () => {
      const kos = await Kos.findOne({ _id: kosId, pemilik_id: ownerId, deleted_at: null }).session(session);
      if (!kos) {
        const err = new Error('Kos tidak ditemukan');
        err.statusCode = 404;
        throw err;
      }

      const submission = await Pengajuan.findOne({
        kos_id: kos._id,
        pemilik_id: ownerId,
        jenis: 'perubahan',
        is_active: true,
        status: 'pending',
      }).session(session);

      if (!submission) {
        const err = new Error('Tidak ada pengajuan perubahan pending yang dapat ditarik');
        err.statusCode = 409;
        throw err;
      }

      if (typeof expectedVersion !== 'number' || expectedVersion !== submission.version) {
        const err = new Error('Versi pengajuan tidak sesuai. Muat ulang lalu coba lagi.');
        err.statusCode = 409;
        throw err;
      }

      const withdrawn = await Pengajuan.findOneAndUpdate(
        { _id: submission._id, status: 'pending', is_active: true, version: expectedVersion },
        {
          $set: { status: 'withdrawn', is_active: false },
          $inc: { version: 1 },
        },
        { session, new: true }
      );

      if (!withdrawn) {
        const err = new Error('Pengajuan perubahan telah ditarik atau diproses.');
        err.statusCode = 409;
        throw err;
      }

      const [newDraft] = await Pengajuan.create(
        [
          {
            kos_id: kos._id,
            pemilik_id: ownerId,
            jenis: 'perubahan',
            status: 'draft',
            is_active: true,
            version: 1,
            base_version: submission.base_version,
            before: submission.before,
            after: submission.after,
            foto_ids: submission.foto_ids,
            nama_kos: submission.nama_kos,
            submitted_at: null,
            catatan_verifikasi: null,
          },
        ],
        { session }
      );

      resultDraft = newDraft;
    });
  } finally {
    await session.endSession();
  }

  await resultDraft.populate('pemilik_id', 'nama email role');
  return toSubmissionDto(resultDraft);
}

async function discardChangeDraft(ownerId, kosId, expectedVersion) {
  if (!mongoose.Types.ObjectId.isValid(kosId)) {
    const err = new Error('ID kos tidak valid');
    err.statusCode = 400;
    err.code = 'MALFORMED_ID';
    throw err;
  }

  const kos = await Kos.findOne({ _id: kosId, pemilik_id: ownerId, deleted_at: null });
  if (!kos) {
    const err = new Error('Kos tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  const submission = await Pengajuan.findOne({
    kos_id: kos._id,
    pemilik_id: ownerId,
    jenis: 'perubahan',
    is_active: true,
    status: 'draft',
  });

  if (!submission) {
    const pending = await Pengajuan.findOne({
      kos_id: kos._id,
      pemilik_id: ownerId,
      jenis: 'perubahan',
      is_active: true,
      status: 'pending',
    });
    if (pending) {
      const err = new Error('Pengajuan perubahan pending harus ditarik terlebih dahulu sebelum dibuang.');
      err.statusCode = 409;
      throw err;
    }
    const err = new Error('Tidak ada draf perubahan aktif untuk dibuang');
    err.statusCode = 404;
    throw err;
  }

  if (typeof expectedVersion !== 'number' || expectedVersion !== submission.version) {
    const err = new Error('Versi pengajuan tidak sesuai. Muat ulang lalu coba lagi.');
    err.statusCode = 409;
    throw err;
  }

  const discarded = await Pengajuan.findOneAndUpdate(
    { _id: submission._id, status: 'draft', is_active: true, version: expectedVersion },
    {
      $set: { status: 'withdrawn', is_active: false },
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!discarded) {
    const err = new Error('Versi pengajuan tidak sesuai atau telah diubah.');
    err.statusCode = 409;
    throw err;
  }

  return true;
}

async function getAdminSubmissions(query = {}) {
  const { page, limit, jenis, status, q } = query;
  const filter = {};

  filter.status = status || 'pending';
  if (jenis) {
    filter.jenis = jenis;
  }
  if (q) {
    filter.nama_kos = { $regex: safeSearchTerm(q), $options: 'i' };
  }

  const { pageNum, limitNum } = parsePagination(page, limit, 12);
  const totalData = await Pengajuan.countDocuments(filter);
  const totalPages = totalData > 0 ? Math.ceil(totalData / limitNum) : 1;
  const currentPage = totalData > 0 ? Math.min(Math.max(1, pageNum), totalPages) : 1;
  const clampedSkip = (currentPage - 1) * limitNum;

  const submissions = await Pengajuan.find(filter)
    .populate('pemilik_id', 'nama email role')
    .populate('reviewed_by', 'nama email role')
    .sort({ submitted_at: 1, _id: 1 })
    .skip(clampedSkip)
    .limit(limitNum);

  return {
    data: submissions.map((s) => toSubmissionDto(s)),
    pagination: {
      totalData,
      totalPages,
      currentPage,
      limit: limitNum,
    },
  };
}

async function getAdminSubmissionDetail(submissionId) {
  if (!mongoose.Types.ObjectId.isValid(submissionId)) {
    const err = new Error('ID pengajuan tidak valid');
    err.statusCode = 400;
    err.code = 'MALFORMED_ID';
    throw err;
  }

  const pengajuan = await Pengajuan.findById(submissionId)
    .populate('pemilik_id', 'nama email role')
    .populate('reviewed_by', 'nama email role');

  if (!pengajuan) {
    const err = new Error('Pengajuan tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  return toSubmissionDto(pengajuan);
}

async function decideSubmission(adminUser, submissionId, decisionInput) {
  if (!mongoose.Types.ObjectId.isValid(submissionId)) {
    const err = new Error('ID pengajuan tidak valid');
    err.statusCode = 400;
    err.code = 'MALFORMED_ID';
    throw err;
  }

  const { keputusan, catatan_verifikasi, expected_version } = decisionInput || {};

  if (!['approved', 'revision', 'rejected'].includes(keputusan)) {
    const err = new Error('Keputusan harus salah satu dari: approved, revision, atau rejected');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (['revision', 'rejected'].includes(keputusan)) {
    if (!catatan_verifikasi || typeof catatan_verifikasi !== 'string' || !catatan_verifikasi.trim()) {
      const err = new Error('Catatan verifikasi wajib diisi untuk penolakan atau permintaan revisi');
      err.statusCode = 422;
      err.code = 'VALIDATION_ERROR';
      err.errors = { catatan_verifikasi: ['Catatan verifikasi wajib diisi'] };
      throw err;
    }
  }

  if (catatan_verifikasi && String(catatan_verifikasi).length > 1000) {
    const err = new Error('Catatan verifikasi maksimal 1000 karakter');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (typeof expected_version !== 'number') {
    const err = new Error('expected_version wajib disertakan');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const session = await mongoose.startSession();
  let committedPengajuan = null;

  try {
    await session.withTransaction(async () => {
      // 1. Baca ulang pengajuan di DALAM callback transaksi
      const pengajuan = await Pengajuan.findById(submissionId).session(session);
      if (!pengajuan) {
        const err = new Error('Pengajuan tidak ditemukan');
        err.statusCode = 404;
        throw err;
      }

      if (pengajuan.status !== 'pending') {
        const err = new Error(`Pengajuan tidak dalam status pending (status saat ini: ${pengajuan.status})`);
        err.statusCode = 409;
        throw err;
      }

      if (pengajuan.version !== expected_version) {
        const err = new Error('Versi pengajuan tidak sesuai (konflik keputusan admin konkuren). Muat ulang lalu coba lagi.');
        err.statusCode = 409;
        throw err;
      }

      // 2. Baca ulang Kos di DALAM callback transaksi
      const kos = await Kos.findById(pengajuan.kos_id).session(session);
      if (!kos) {
        const err = new Error('Kos terkait pengajuan tidak ditemukan');
        err.statusCode = 404;
        throw err;
      }

      if (kos.deleted_at !== null) {
        const err = new Error('Listing telah dihapus dan pengajuan tidak dapat diputuskan.');
        err.statusCode = 409;
        throw err;
      }

      // 3. Validasi approval terhadap stok terkini dan base_version
      if (keputusan === 'approved') {
        if (pengajuan.after.jumlah_kamar_total < kos.jumlah_kamar_tersedia) {
          const err = new Error('Jumlah kamar total yang diajukan lebih kecil dari ketersediaan kamar saat ini');
          err.statusCode = 409;
          throw err;
        }

        if (pengajuan.jenis === 'perubahan') {
          if (pengajuan.base_version !== kos.version) {
            const err = new Error('Versi dasar listing telah berubah sejak pengajuan dibuat.');
            err.statusCode = 409;
            throw err;
          }
        }
      }

      // 4. Update conditional CAS pengajuan di dalam transaksi
      const updatedPengajuan = await Pengajuan.findOneAndUpdate(
        { _id: pengajuan._id, status: 'pending', version: expected_version },
        {
          $set: {
            status: keputusan,
            is_active: false,
            catatan_verifikasi: catatan_verifikasi ? String(catatan_verifikasi).trim() : null,
            reviewed_at: new Date(),
            reviewed_by: adminUser._id,
          },
          $inc: { version: 1 },
        },
        { session, new: true }
      );

      if (!updatedPengajuan) {
        const err = new Error('Pengajuan telah diproses oleh admin lain (konflik keputusan admin konkuren).');
        err.statusCode = 409;
        throw err;
      }

      // 5. Update Kos secara sequential di dalam transaksi
      if (keputusan === 'approved') {
        const updatedKos = await Kos.findOneAndUpdate(
          { _id: kos._id, version: kos.version },
          {
            $set: {
              nama: pengajuan.after.nama,
              deskripsi: pengajuan.after.deskripsi,
              alamat: pengajuan.after.alamat,
              area_kampus: pengajuan.after.area_kampus,
              koordinat: pengajuan.after.koordinat,
              harga_per_bulan: pengajuan.after.harga_per_bulan,
              tipe: pengajuan.after.tipe,
              fasilitas: pengajuan.after.fasilitas,
              peraturan: pengajuan.after.peraturan,
              luas_kamar: pengajuan.after.luas_kamar,
              jumlah_kamar_total: pengajuan.after.jumlah_kamar_total,
              foto: (pengajuan.after.foto || []).map((f) => f.url),
              foto_id_list: pengajuan.foto_ids || [],
              status_verifikasi: 'approved',
              draft_konten: null,
              diverifikasi_oleh: adminUser._id,
              diverifikasi_pada: new Date(),
              catatan_verifikasi: catatan_verifikasi ? String(catatan_verifikasi).trim() : '',
            },
            $inc: { version: 1 },
          },
          { session, new: true }
        );

        if (!updatedKos) {
          const err = new Error('Versi listing kos telah berubah (konflik konkurensi).');
          err.statusCode = 409;
          throw err;
        }
      } else {
        // revision atau rejected
        if (pengajuan.jenis === 'baru') {
          await Kos.findOneAndUpdate(
            { _id: kos._id, version: kos.version },
            {
              $set: {
                status_verifikasi: keputusan,
                catatan_verifikasi: catatan_verifikasi ? String(catatan_verifikasi).trim() : '',
                diverifikasi_oleh: adminUser._id,
                diverifikasi_pada: new Date(),
              },
              $inc: { version: 1 },
            },
            { session }
          );
        }
      }

      // 6. Catat entri AuditLog append-only di dalam transaksi
      const aksi = pengajuan.jenis === 'baru'
        ? (keputusan === 'approved' ? 'KOS_APPROVE' : keputusan === 'revision' ? 'KOS_REVISION' : 'KOS_REJECT')
        : (keputusan === 'approved' ? 'CHANGE_APPROVE' : keputusan === 'revision' ? 'CHANGE_REVISION' : 'CHANGE_REJECT');

      await logAdminAction({
        admin: adminUser._id,
        aksi,
        target_type: 'pengajuan',
        target_id: pengajuan._id,
        pengajuan_id: pengajuan._id,
        catatan: catatan_verifikasi || null,
        session,
      });

      committedPengajuan = updatedPengajuan;
    });
  } finally {
    await session.endSession();
  }

  // Notifikasi asinkron setelah transaksi commit (kegagalan notifikasi tidak membatalkan transaksi)
  try {
    const judulNotif = keputusan === 'approved'
      ? `Pengajuan ${committedPengajuan.jenis === 'baru' ? 'Listing' : 'Perubahan'} Disetujui`
      : keputusan === 'revision'
      ? `Permintaan Revisi ${committedPengajuan.jenis === 'baru' ? 'Listing' : 'Perubahan'}`
      : `Pengajuan ${committedPengajuan.jenis === 'baru' ? 'Listing' : 'Perubahan'} Ditolak`;

    const pesanNotif = catatan_verifikasi
      ? `Catatan admin: ${catatan_verifikasi}`
      : 'Pengajuan Anda telah disetujui oleh Administrator.';

    const tipeNotif =
      keputusan === 'approved'
        ? 'kos_disetujui'
        : keputusan === 'revision'
        ? 'kos_revisi'
        : 'kos_ditolak';

    const targetUserId = committedPengajuan.pemilik_id._id || committedPengajuan.pemilik_id;
    await kirimNotifikasi(targetUserId, {
      tipe: tipeNotif,
      judul: judulNotif,
      isi: pesanNotif,
      tautan: `/pemilik`,
    });
  } catch (notifErr) {
    console.error('[Notification Error]:', notifErr.message);
  }

  await committedPengajuan.populate('pemilik_id', 'nama email role');
  await committedPengajuan.populate('reviewed_by', 'nama email role');
  return toSubmissionDto(committedPengajuan);
}

module.exports = {
  createDraft,
  getOwnerKosList,
  getOwnerKosDetail,
  updateDraft,
  submitInitialKos,
  withdrawInitialKos,
  updateAvailability,
  updatePublication,
  softDeleteKos,
  getChangeSubmission,
  upsertChangeDraft,
  submitChangeDraft,
  withdrawChangeDraft,
  discardChangeDraft,
  getAdminSubmissions,
  getAdminSubmissionDetail,
  decideSubmission,
};
