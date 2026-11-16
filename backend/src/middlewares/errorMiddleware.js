const multer = require('multer');

const notFound = (req, res, next) => {
  const error = new Error(`Rute tidak ditemukan - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  let message = err.message;
  let code = err.code;
  let errors = err.errors;

  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    code = 'MALFORMED_ID';
    message = `Format ID tidak valid: '${err.value}'`;
  }

  if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'field';
    message = `Data duplikat: Nilai pada bidang '${field}' sudah terdaftar.`;
  }

  if (err instanceof multer.MulterError) {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = 'VALIDATION_ERROR';
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran berkas foto melebihi batas maksimal 5MB'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'Jumlah foto melebihi batas maksimal (5 berkas) atau nama field tidak sesuai'
        : `Gagal mengunggah berkas: ${err.message}`;
  }

  if (err.name === 'ValidationError') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    const errorMap = {};
    Object.values(err.errors).forEach((val) => {
      errorMap[val.path] = [val.message];
    });
    errors = errorMap;
    message = Object.values(err.errors).map((val) => val.message).join(', ');
  }

  // Normalisasi kode kesalahan standar jika belum ditentukan eksplisit
  if (!code) {
    if (statusCode === 409) {
      code = 'CONFLICT';
    } else if (statusCode === 422) {
      code = 'VALIDATION_ERROR';
    }
  }

  // Pada environment produksi, cegah kebocoran internal server error / stack / Mongo payload
  if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
    message = 'Terjadi kesalahan pada server';
    code = 'INTERNAL_SERVER_ERROR';
    errors = undefined;
  }

  const responseBody = {
    success: false,
    message,
  };

  if (code && typeof code === 'string') {
    responseBody.code = code;
  }
  if (errors) {
    responseBody.errors = errors;
  }
  if (process.env.NODE_ENV === 'development') {
    responseBody.stack = err.stack;
  }

  res.status(statusCode).json(responseBody);
};

module.exports = { notFound, errorHandler };
