const crypto = require('crypto');

function ensureAbsoluteUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
}

function toPhotoDto(photo, assetMap = {}) {
  if (!photo) return null;
  if (typeof photo === 'object' && (photo.asset_id || photo._id)) {
    const id = photo.asset_id || photo._id;
    return {
      asset_id: String(id),
      url: ensureAbsoluteUrl(photo.url),
      alt: typeof photo.alt === 'string' ? photo.alt : '',
    };
  }
  // Snapshot foto legacy: URL tanpa MediaAsset (mis. dibuat oleh backfill)
  if (typeof photo === 'object' && typeof photo.url === 'string' && photo.url) {
    return {
      asset_id: null,
      url: ensureAbsoluteUrl(photo.url),
      alt: typeof photo.alt === 'string' ? photo.alt : '',
    };
  }
  if (typeof photo === 'string') {
    const asset = assetMap[photo];
    return {
      asset_id: asset ? String(asset._id) : null,
      url: ensureAbsoluteUrl(photo),
      alt: asset?.alt || '',
    };
  }
  return null;
}

function toUserSummary(user) {
  if (!user) return null;
  const id = user._id || user.id || user;
  return {
    _id: String(id),
    nama: typeof user.nama === 'string' && user.nama.trim() ? user.nama.trim() : 'Pengelola kos',
  };
}

function toKosContent(source, assetMap = {}) {
  if (!source) return null;
  const data = typeof source.toObject === 'function' ? source.toObject() : source;

  const rawFoto = Array.isArray(data.foto) ? data.foto : [];
  const storedIds = Array.isArray(data.foto_id_list) ? data.foto_id_list : [];
  const fotoList = rawFoto
    .map((photo, index) => {
      // These IDs are persisted together by the validated approval transaction.
      if (typeof photo === 'string' && storedIds.length === rawFoto.length && storedIds[index]) {
        return toPhotoDto({ asset_id: storedIds[index], url: photo }, assetMap);
      }
      return toPhotoDto(photo, assetMap);
    })
    .filter(Boolean)
    .slice(0, 5);

  const lat = data.koordinat?.latitude;
  const lng = data.koordinat?.longitude;
  const hasCoordinates =
    typeof lat === 'number' && !Number.isNaN(lat) &&
    typeof lng === 'number' && !Number.isNaN(lng);

  return {
    nama: data.nama || '',
    deskripsi: data.deskripsi || '',
    alamat: data.alamat || '',
    area_kampus: data.area_kampus || '',
    koordinat: hasCoordinates
      ? { latitude: lat, longitude: lng }
      : { latitude: 0, longitude: 0 },
    harga_per_bulan: Number(data.harga_per_bulan || 0),
    tipe: ['putra', 'putri', 'campur'].includes(data.tipe) ? data.tipe : 'campur',
    fasilitas: Array.isArray(data.fasilitas) ? data.fasilitas : [],
    peraturan: Array.isArray(data.peraturan) ? data.peraturan : [],
    luas_kamar: data.luas_kamar ? String(data.luas_kamar) : null,
    jumlah_kamar_total: Number(data.jumlah_kamar_total || 0),
    foto: fotoList,
  };
}

function toKosDraft(draftObj, assetMap = {}) {
  if (!draftObj) return null;
  const data = typeof draftObj.toObject === 'function' ? draftObj.toObject() : draftObj;

  const result = {};

  if (typeof data.nama === 'string' && data.nama.trim()) {
    result.nama = data.nama.trim();
  }

  if (typeof data.deskripsi === 'string' && data.deskripsi.trim()) {
    result.deskripsi = data.deskripsi.trim();
  }

  if (typeof data.alamat === 'string' && data.alamat.trim()) {
    result.alamat = data.alamat.trim();
  }

  if (typeof data.area_kampus === 'string' && data.area_kampus.trim()) {
    result.area_kampus = data.area_kampus.trim();
  }

  const lat = data.koordinat?.latitude;
  const lng = data.koordinat?.longitude;
  if (
    typeof lat === 'number' && !Number.isNaN(lat) &&
    typeof lng === 'number' && !Number.isNaN(lng)
  ) {
    result.koordinat = {
      latitude: lat,
      longitude: lng,
    };
  }

  if (data.harga_per_bulan !== undefined && data.harga_per_bulan !== null && data.harga_per_bulan !== '') {
    const harga = Number(data.harga_per_bulan);
    if (!Number.isNaN(harga)) {
      result.harga_per_bulan = harga;
    }
  }

  if (data.tipe && ['putra', 'putri', 'campur'].includes(data.tipe)) {
    result.tipe = data.tipe;
  }

  if (Array.isArray(data.fasilitas)) {
    result.fasilitas = data.fasilitas;
  }

  if (Array.isArray(data.peraturan)) {
    result.peraturan = data.peraturan;
  }

  if (data.luas_kamar !== undefined && data.luas_kamar !== null) {
    result.luas_kamar = String(data.luas_kamar);
  }

  if (data.jumlah_kamar_total !== undefined && data.jumlah_kamar_total !== null && data.jumlah_kamar_total !== '') {
    const total = Number(data.jumlah_kamar_total);
    if (!Number.isNaN(total)) {
      result.jumlah_kamar_total = total;
    }
  }

  if (Array.isArray(data.foto) && data.foto.length > 0) {
    const fotoList = data.foto
      .map((p) => toPhotoDto(p, assetMap))
      .filter(Boolean)
      .slice(0, 5);
    result.foto = fotoList;
  } else {
    result.foto = [];
  }

  return result;
}

function computeDiff(before, after) {
  if (!before || !after) return [];
  const fields = [
    'nama',
    'deskripsi',
    'alamat',
    'area_kampus',
    'koordinat',
    'harga_per_bulan',
    'tipe',
    'fasilitas',
    'peraturan',
    'luas_kamar',
    'jumlah_kamar_total',
    'foto',
  ];

  const diffs = [];
  for (const field of fields) {
    const bVal = JSON.stringify(before[field]);
    const aVal = JSON.stringify(after[field]);
    if (bVal !== aVal) {
      diffs.push({
        field,
        before: before[field] ?? null,
        after: after[field] ?? null,
      });
    }
  }
  return diffs;
}

function toSubmissionSummaryDto(pengajuan) {
  if (!pengajuan) return null;
  return {
    _id: String(pengajuan._id),
    kos_id: String(pengajuan.kos_id),
    jenis: pengajuan.jenis,
    status: pengajuan.status,
    version: Number(pengajuan.version || 1),
    submitted_at: pengajuan.submitted_at ? new Date(pengajuan.submitted_at).toISOString() : null,
    catatan_verifikasi: pengajuan.catatan_verifikasi || null,
  };
}

function toSubmissionDto(pengajuan, userMap = {}, assetMap = {}) {
  if (!pengajuan) return null;
  const p = typeof pengajuan.toObject === 'function' ? pengajuan.toObject() : pengajuan;

  const pemilik = p.pemilik_id ? (userMap[String(p.pemilik_id._id || p.pemilik_id)] || p.pemilik_id) : null;
  const reviewer = p.reviewed_by ? (userMap[String(p.reviewed_by._id || p.reviewed_by)] || p.reviewed_by) : null;

  const beforeContent = p.before ? toKosContent(p.before, assetMap) : null;
  const afterContent = toKosContent(p.after, assetMap);
  const diff = computeDiff(beforeContent, afterContent);

  return {
    _id: String(p._id),
    kos_id: String(p.kos_id),
    jenis: p.jenis,
    status: p.status,
    version: Number(p.version || 1),
    submitted_at: p.submitted_at ? new Date(p.submitted_at).toISOString() : null,
    catatan_verifikasi: p.catatan_verifikasi || null,
    base_version: Number(p.base_version || 1),
    before: beforeContent,
    after: afterContent,
    nama_kos: p.nama_kos || afterContent?.nama || '',
    pemilik: toUserSummary(pemilik),
    reviewed_at: p.reviewed_at ? new Date(p.reviewed_at).toISOString() : null,
    reviewed_by: reviewer ? toUserSummary(reviewer) : null,
    perubahan: diff,
  };
}

function toKosOwnerDto(kosDoc, activePengajuan = null, assetMap = {}) {
  if (!kosDoc) return null;
  const kos = typeof kosDoc.toObject === 'function' ? kosDoc.toObject() : kosDoc;

  const isApproved = kos.status_verifikasi === 'approved';
  const dataPublik = isApproved ? toKosContent(kos, assetMap) : null;

  let draft = null;
  if (!isApproved) {
    const pendingSnapshot = kos.status_verifikasi === 'pending' ? activePengajuan?.after : null;
    draft = toKosDraft(pendingSnapshot || kos.draft_konten || kos, assetMap);
  }

  let perubahanTertunda = null;
  if (activePengajuan) {
    perubahanTertunda = toSubmissionSummaryDto(activePengajuan);
  }

  return {
    _id: String(kos._id),
    pemilik: toUserSummary(kos.pemilik_id),
    status_verifikasi: kos.status_verifikasi || 'draft',
    status_publikasi: kos.status_publikasi || 'active',
    status_moderasi: kos.status_moderasi || 'normal',
    version: Number(kos.version || 1),
    ketersediaan: {
      jumlah_kamar_tersedia: Number(kos.jumlah_kamar_tersedia || 0),
      version_ketersediaan: Number(kos.version_ketersediaan || 1),
      ketersediaan_diperbarui_pada: kos.ketersediaan_diperbarui_pada
        ? new Date(kos.ketersediaan_diperbarui_pada).toISOString()
        : null,
    },
    data_publik: dataPublik,
    draft,
    perubahan_tertunda: perubahanTertunda,
    deleted_at: kos.deleted_at ? new Date(kos.deleted_at).toISOString() : null,
    createdAt: new Date(kos.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(kos.updatedAt || Date.now()).toISOString(),
  };
}

function toKosAdminDto(kosDoc, activePengajuan = null, assetMap = {}) {
  const base = toKosOwnerDto(kosDoc, activePengajuan, assetMap);
  if (!base) return null;

  const kos = typeof kosDoc.toObject === 'function' ? kosDoc.toObject() : kosDoc;
  const user = kos.pemilik_id;

  const pemilikDetail = user && typeof user === 'object' && user.email
    ? {
        _id: String(user._id),
        nama: user.nama || '',
        email: user.email || '',
        nomor_telepon: user.nomor_telepon || null,
        role: user.role || 'pemilik',
        status: user.status || 'active',
        email_verified: Boolean(user.email_verified),
        version: Number(user.version || 1),
        createdAt: new Date(user.createdAt || Date.now()).toISOString(),
        updatedAt: new Date(user.updatedAt || Date.now()).toISOString(),
        alasan_suspend: user.alasan_suspend || null,
      }
    : {
        _id: base.pemilik._id,
        nama: base.pemilik.nama,
        email: '',
        nomor_telepon: null,
        role: 'pemilik',
        status: 'active',
        email_verified: false,
        version: 1,
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
        alasan_suspend: null,
      };

  return {
    ...base,
    pemilik_detail: pemilikDetail,
    alasan_suspend: kos.alasan_suspend || null,
  };
}

function toAuditDto(auditLog, adminUser = null) {
  if (!auditLog) return null;
  const a = typeof auditLog.toObject === 'function' ? auditLog.toObject() : auditLog;
  const adminObj = adminUser || a.admin;

  return {
    _id: String(a._id),
    admin: toUserSummary(adminObj),
    aksi: a.aksi,
    target_type: a.target_type,
    target_id: String(a.target_id),
    pengajuan_id: a.pengajuan_id ? String(a.pengajuan_id) : null,
    laporan_id: a.laporan_id ? String(a.laporan_id) : null,
    catatan: a.catatan || null,
    createdAt: new Date(a.createdAt || Date.now()).toISOString(),
  };
}

module.exports = {
  ensureAbsoluteUrl,
  toPhotoDto,
  toUserSummary,
  toKosContent,
  toKosDraft,
  computeDiff,
  toSubmissionSummaryDto,
  toSubmissionDto,
  toKosOwnerDto,
  toKosAdminDto,
  toAuditDto,
};
