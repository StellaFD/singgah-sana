const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  register,
  login,
  googleAuth,
  getMe,
  updateProfile,
  uploadProfilePhoto,
  deleteProfilePhoto,
  deleteAccount,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
} = require('../controllers/authController');
const { getCsrf, logout } = require('../middlewares/sessionMiddleware');
const { protect } = require('../middlewares/authMiddleware');
const rateLimit = require('../middlewares/authRateLimit');
const { tokenAttemptRateLimit } = require('../middlewares/recoveryRateLimit');

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const requireLoginForm = (req, res, next) => {
  if (req.sessionRecord || process.env.NODE_ENV === 'test' || process.env.ALLOW_LEGACY_BEARER_AUTH === 'true') return next();
  return res.status(403).json({ success: false, code: 'CSRF_INVALID', message: 'Muat formulir masuk sebelum melanjutkan.' });
};

const recoverySecurityHeaders = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
};

router.post('/register', requireLoginForm, rateLimit, register);
router.post('/login', requireLoginForm, rateLimit, login);
router.post('/google', requireLoginForm, rateLimit, googleAuth);
router.post('/forgot-password', recoverySecurityHeaders, requireLoginForm, forgotPassword);
router.post('/reset-password', recoverySecurityHeaders, requireLoginForm, tokenAttemptRateLimit, resetPassword);
router.post('/verify-email', recoverySecurityHeaders, requireLoginForm, tokenAttemptRateLimit, verifyEmail);
router.post('/resend-verification', recoverySecurityHeaders, protect, resendVerification);
router.get('/csrf', getCsrf);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.delete('/me', protect, deleteAccount);
router.put('/profile', protect, updateProfile);
router.patch('/profile', protect, updateProfile);
router.post('/profile/photo', protect, avatarUpload.single('file'), uploadProfilePhoto);
router.delete('/profile/photo', protect, deleteProfilePhoto);
router.patch('/password', protect, changePassword);
router.get('/notification-preferences', protect, (req, res) => {
  res.json({ success: true, data: req.user.notification_preferences });
});
router.put('/notification-preferences', protect, async (req, res, next) => {
  try {
    const fields = ['pesanPemilik', 'pembaruanFavorit', 'kabarProduk'];
    if (fields.some(field => typeof req.body[field] !== 'boolean')) return res.status(422).json({ success: false, message: 'Preferensi harus berupa pilihan aktif atau nonaktif.' });
    for (const field of fields) req.user.notification_preferences[field] = req.body[field];
    await req.user.save();
    res.json({ success: true, data: req.user.notification_preferences });
  } catch (error) { next(error); }
});

module.exports = router;
