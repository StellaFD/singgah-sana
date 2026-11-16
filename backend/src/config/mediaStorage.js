function storageError(message, code = 'MEDIA_STORAGE_UNAVAILABLE') {
  const error = new Error(message);
  error.statusCode = 503;
  error.code = code;
  return error;
}

function getMediaProvider() {
  const configured = process.env.MEDIA_STORAGE_PROVIDER?.trim();
  const hasCloudSettings = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
    .some(key => Boolean(process.env[key]));
  const provider = configured || (process.env.NODE_ENV === 'test'
    ? 'local'
    : process.env.NODE_ENV === 'production' || hasCloudSettings ? 'cloudinary' : 'local');

  if (!['local', 'cloudinary'].includes(provider) ||
      (process.env.NODE_ENV === 'production' && provider !== 'cloudinary')) {
    throw storageError('Konfigurasi penyimpanan foto tidak valid.', 'MEDIA_STORAGE_NOT_CONFIGURED');
  }
  return provider;
}

function getCloudinaryOptions() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloud_name || !api_key || !api_secret || !/^[a-z\d_-]+$/i.test(cloud_name)) {
    throw storageError('Penyimpanan foto belum dikonfigurasi.', 'MEDIA_STORAGE_NOT_CONFIGURED');
  }
  return { cloud_name, api_key, api_secret, secure: true, timeout: 12000 };
}

function assertMediaStorageReady() {
  if (getMediaProvider() === 'cloudinary') getCloudinaryOptions();
}

module.exports = { getMediaProvider, getCloudinaryOptions, assertMediaStorageReady, storageError };
