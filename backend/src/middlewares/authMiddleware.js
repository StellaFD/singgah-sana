const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../config/jwt');
async function sessionUser(req) {
  if (req.sessionRecord?.user_id) return User.findById(req.sessionRecord.user_id);
  return null;
}

const protect = async (req, res, next) => {
  try {
    const current = await sessionUser(req);
    if (current) {
      if (current.status === 'suspended') return res.status(403).json({ success: false, message: 'Akun ditangguhkan.' });
      req.user = current;
      return next();
    }
  } catch (error) { return next(error); }
  let token;

  if (process.env.NODE_ENV !== 'test' && process.env.ALLOW_LEGACY_BEARER_AUTH !== 'true') {
    return res.status(401).json({ success: false, message: 'Silakan masuk kembali.' });
  }

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Akses ditolak: Token autentikasi tidak ditemukan. Silakan login terlebih dahulu.',
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());

    const user = await User.findById(decoded.id).select('+token_version');
    if (user && (decoded.version || 0) !== (user.token_version || 0)) {
      return res.status(401).json({ success: false, message: 'Sesi sudah dicabut.' });
    }
    if (user?.status === 'suspended') return res.status(403).json({ success: false, message: 'Akun ditangguhkan.' });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Pengguna yang terkait dengan token ini tidak ditemukan',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token tidak valid atau telah kedaluwarsa',
    });
  }
};

const optionalProtect = async (req, res, next) => {
  try {
    const current = await sessionUser(req);
    if (current && current.status !== 'suspended') { req.user = current; return next(); }
  } catch { /* Reads may proceed anonymously. */ }
  if (process.env.NODE_ENV !== 'test' && process.env.ALLOW_LEGACY_BEARER_AUTH !== 'true') return next();
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret());
      const user = await User.findById(decoded.id).select('+token_version');
      if (user && user.status !== 'suspended' && (decoded.version || 0) === (user.token_version || 0)) {
        req.user = user;
      }
    } catch (err) {
      // Abaikan error pada mode opsional
    }
  }

  next();
};

module.exports = { protect, optionalProtect };
