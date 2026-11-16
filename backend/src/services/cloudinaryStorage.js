const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;
const { getCloudinaryOptions, storageError } = require('../config/mediaStorage');

function isManagedPublicId(publicId) {
  return typeof publicId === 'string' &&
    /^singgah-sana\/(development|production|test)\/kos\/[a-f\d]{24}\/[a-f\d-]{36}$/.test(publicId);
}

async function deleteImage({ publicId, cloudName }) {
  const options = getCloudinaryOptions();
  if (cloudName !== options.cloud_name || !isManagedPublicId(publicId)) {
    throw storageError('Konfigurasi penyimpanan tidak sesuai dengan aset foto.');
  }
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      ...options, resource_type: 'image', type: 'upload', invalidate: true,
    });
    if (!['ok', 'not found'].includes(result?.result)) throw new Error('Delete failed');
  } catch {
    throw storageError('Foto belum dapat dihapus dari penyimpanan. Coba lagi.');
  }
}

async function uploadImageBuffer(buffer, userId) {
  const options = getCloudinaryOptions();
  if (!/^[a-f\d]{24}$/.test(String(userId))) {
    throw storageError('Identitas pemilik foto tidak valid.');
  }
  const environment = process.env.NODE_ENV === 'production' ? 'production'
    : process.env.NODE_ENV === 'test' ? 'test' : 'development';
  const publicId = `singgah-sana/${environment}/kos/${userId}/${crypto.randomUUID()}`;
  let uploaded;
  try {
    uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        ...options,
        resource_type: 'image',
        public_id: publicId,
        overwrite: false,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      }, (error, result) => error ? reject(error) : resolve(result));
      stream.on('error', reject);
      stream.end(buffer);
    });
  } catch {
    throw storageError('Foto belum dapat diunggah ke penyimpanan. Coba lagi.');
  }

  let url;
  try { url = new URL(uploaded.secure_url); } catch { /* Rejected below. */ }
  if (!url || url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' ||
      url.username || url.password || url.port ||
      !url.pathname.startsWith(`/${options.cloud_name}/image/upload/`) ||
      uploaded.public_id !== publicId || uploaded.resource_type !== 'image' || !uploaded.asset_id) {
    await deleteImage({ publicId, cloudName: options.cloud_name }).catch(() => {});
    throw storageError('Respons penyimpanan foto tidak valid.');
  }

  return {
    storage_kind: 'cloudinary',
    file_path: null,
    url: url.href,
    cloudinary_public_id: publicId,
    cloudinary_asset_id: uploaded.asset_id,
    cloudinary_cloud_name: options.cloud_name,
  };
}

module.exports = { uploadImageBuffer, deleteImage };
