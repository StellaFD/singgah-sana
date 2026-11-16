const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const MediaAsset = require('../models/MediaAsset');
const Kos = require('../models/Kos');
const Pengajuan = require('../models/Pengajuan');
const { ensureAbsoluteUrl } = require('../dto/submissionDto');
const { getMediaProvider } = require('../config/mediaStorage');
const cloudinaryStorage = require('./cloudinaryStorage');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MiB

function validateMagicBytes(buffer, mimetype) {
  if (!buffer || buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mimetype === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0D &&
      buffer[5] === 0x0A &&
      buffer[6] === 0x1A &&
      buffer[7] === 0x0A
    );
  }

  // WebP: RIFF .... WEBP
  if (mimetype === 'image/webp') {
    const isRiff = buffer.subarray(0, 4).toString('ascii') === 'RIFF';
    const isWebp = buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    return isRiff && isWebp;
  }

  return false;
}

function getExtension(mimetype) {
  switch (mimetype) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '.bin';
  }
}

async function uploadMediaAsset({ file, alt, userId }) {
  if (!file) {
    const err = new Error('Berkas foto wajib diunggah');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (file.size > MAX_FILE_SIZE) {
    const err = new Error('Ukuran berkas melebihi batas maksimum 5 MiB');
    err.statusCode = 413;
    throw err;
  }

  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(file.mimetype)) {
    const err = new Error('Format gambar tidak didukung. Gunakan JPEG, PNG, atau WebP');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  let buffer;
  if (file.buffer) {
    buffer = file.buffer;
  } else if (file.path) {
    buffer = await fs.promises.readFile(file.path);
  } else {
    const err = new Error('Berkas tidak dapat dibaca');
    err.statusCode = 400;
    throw err;
  }

  if (!validateMagicBytes(buffer, file.mimetype)) {
    if (file.path) {
      await fs.promises.unlink(file.path).catch(() => {});
    }
    const err = new Error('Tanda tangan berkas (magic bytes) tidak sesuai dengan format gambar yang dideklarasikan');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (getMediaProvider() === 'cloudinary') {
    const stored = await cloudinaryStorage.uploadImageBuffer(buffer, userId);
    try {
      const asset = await MediaAsset.create({
        ...stored,
        user_id: userId,
        alt: typeof alt === 'string' ? alt.slice(0, 160) : '',
        original_filename: file.originalname || '',
        mime_type: file.mimetype,
        file_size: buffer.length,
      });
      return { asset_id: String(asset._id), url: asset.url, alt: asset.alt };
    } catch (error) {
      await cloudinaryStorage.deleteImage({
        publicId: stored.cloudinary_public_id,
        cloudName: stored.cloudinary_cloud_name,
      }).catch(() => console.error('[Media] Pembersihan unggahan tertunda setelah penyimpanan metadata gagal.'));
      throw error;
    }
  }

  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });

  const ext = getExtension(file.mimetype);
  const filename = `media-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const targetPath = path.join(UPLOAD_DIR, filename);

  if (file.path && file.path !== targetPath) {
    await fs.promises.rename(file.path, targetPath);
  } else if (buffer) {
    await fs.promises.writeFile(targetPath, buffer);
  }

  const relativeUrl = `/uploads/${filename}`;
  try {
    const asset = await MediaAsset.create({
      user_id: userId,
      file_path: targetPath,
      url: relativeUrl,
      alt: typeof alt === 'string' ? alt.slice(0, 160) : '',
      original_filename: file.originalname || filename,
      mime_type: file.mimetype,
      file_size: file.size,
    });

    return {
      asset_id: String(asset._id),
      url: ensureAbsoluteUrl(asset.url),
      alt: asset.alt,
    };
  } catch (metaError) {
    await fs.promises.unlink(targetPath).catch(() => {});
    throw metaError;
  }
}

async function validateAndResolveFotoIds(userId, fotoIds) {
  if (!Array.isArray(fotoIds) || fotoIds.length === 0) {
    return [];
  }

  const idPattern = /^[0-9a-fA-F]{24}$/;
  for (const id of fotoIds) {
    if (typeof id !== 'string' || !idPattern.test(id)) {
      const err = new Error(`ID foto '${id}' tidak valid`);
      err.statusCode = 422;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
  }

  const assets = await MediaAsset.find({
    _id: { $in: fotoIds },
    is_deleted: false,
  });

  if (assets.length !== fotoIds.length) {
    const err = new Error('Satu atau lebih ID foto tidak ditemukan pada sistem penyimpanan');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  for (const asset of assets) {
    if (String(asset.user_id) !== String(userId)) {
      const err = new Error('Akses ditolak: Anda tidak memiliki izin untuk menggunakan aset media milik pengguna lain');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
  }

  // Mengembalikan dalam urutan persis seperti fotoIds
  const assetMap = new Map(assets.map((a) => [String(a._id), a]));
  return fotoIds.map((id) => {
    const a = assetMap.get(String(id));
    return {
      asset_id: String(a._id),
      url: ensureAbsoluteUrl(a.url),
      alt: a.alt || '',
    };
  });
}

async function deleteMediaAsset(userId, assetId) {
  if (!mongoose.Types.ObjectId.isValid(assetId)) {
    const err = new Error('ID aset media tidak valid');
    err.statusCode = 400;
    err.code = 'MALFORMED_ID';
    throw err;
  }

  const asset = await MediaAsset.findOne({ _id: assetId, user_id: userId, is_deleted: false });
  if (!asset) {
    const err = new Error('Aset media tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }

  const filename = path.basename(asset.url);

  // Periksa apakah aset sedang direferensikan pada kos (aktif atau soft-deleted)
  // atau pada riwayat pengajuan (semua status: pending, draft, approved, revision, rejected, withdrawn)
  const [referencedInKos, referencedInPengajuan] = await Promise.all([
    Kos.findOne({
      $or: [
        { foto_id_list: asset._id },
        { 'draft_konten.foto_ids': String(asset._id) },
        { 'draft_konten.foto.asset_id': String(asset._id) },
        { foto: { $regex: filename } },
      ],
    }),
    Pengajuan.findOne({
      $or: [
        { foto_ids: asset._id },
        { 'before.foto.asset_id': String(asset._id) },
        { 'after.foto.asset_id': String(asset._id) },
        { 'before.foto.url': { $regex: filename } },
        { 'after.foto.url': { $regex: filename } },
      ],
    }),
  ]);

  if (referencedInKos || referencedInPengajuan) {
    const err = new Error('Aset media masih digunakan pada listing atau riwayat pengajuan');
    err.statusCode = 409;
    throw err;
  }

  if (asset.storage_kind === 'cloudinary') {
    await cloudinaryStorage.deleteImage({
      publicId: asset.cloudinary_public_id,
      cloudName: asset.cloudinary_cloud_name,
    });
  }

  asset.is_deleted = true;
  await asset.save();

  if (asset.storage_kind === 'local' && asset.file_path) {
    await fs.promises.unlink(asset.file_path).catch(() => {});
  }

  return true;
}

module.exports = {
  UPLOAD_DIR,
  validateMagicBytes,
  uploadMediaAsset,
  validateAndResolveFotoIds,
  deleteMediaAsset,
};
