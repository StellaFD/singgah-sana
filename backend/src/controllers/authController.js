const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../config/jwt');
const { getMailConfig } = require('../config/mail');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../services/emailService');
const { checkForgotRateLimit, checkResendVerificationRateLimit } = require('../middlewares/recoveryRateLimit');
const Session = require('../models/Session');
const { createSession } = require('../middlewares/sessionMiddleware');

const userDto = (user) => ({
  _id: user._id,
  id: user._id,
  nama: user.nama,
  email: user.email,
  nomor_telepon: user.nomor_telepon,
  role: user.role,
  status: user.status || 'active',
  foto_profil: user.foto_profil,
  email_verified: Boolean(user.email_verified_at),
  email_verified_at: user.email_verified_at || null,
  createdAt: user.createdAt,
  password_updated_at: user.password_updated_at,
});

const generateToken = (id, role, version = 0) => {
  return jwt.sign(
    { id, role, version },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const register = async (req, res, next) => {
  try {
    const { nama, password, nomor_telepon, role } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (typeof nama !== 'string' || nama.trim().length < 3 || !email || typeof password !== 'string' || typeof nomor_telepon !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Mohon lengkapi seluruh field wajib: nama, email, password, nomor_telepon',
      });
    }

    if (typeof password !== 'string' || password.length < 15 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(422).json({ success: false, message: 'Kata sandi minimal 15 karakter dan maksimal 72 byte.' });
    }
    let userRole = typeof role === 'string' ? role.toLowerCase() : 'pencari';
    if (userRole === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Pendaftaran akun dengan peran Administrator tidak diizinkan melalui form publik',
      });
    }

    if (!['pencari', 'pemilik'].includes(userRole)) {
      return res.status(400).json({
        success: false,
        message: 'Peran pengguna haruslah "pencari" atau "pemilik"',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah terdaftar, silakan gunakan email lain atau login',
      });
    }

    const user = await User.create({
      nama,
      email,
      password,
      nomor_telepon,
      role: userRole,
    });

    const token = req.sessionRecord ? undefined : generateToken(user._id, user.role, user.token_version || 0);
    if (req.sessionRecord) await createSession(req, res, user._id, user.token_version || 0);

    res.status(201).json({
      success: true,
      message: 'Registrasi akun berhasil!',
      data: {
        _id: user._id,
        nama: user.nama,
        email: user.email,
        nomor_telepon: user.nomor_telepon,
        role: user.role,
        foto_profil: user.foto_profil,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { password } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!email || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Mohon masukkan email dan password',
      });
    }

    const user = await User.findOne({ email }).select('+password +token_version');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email atau kata sandi tidak sesuai.',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email atau kata sandi tidak sesuai.',
      });
    }

    if (user.status === 'suspended') return res.status(403).json({ success: false, message: 'Akun ditangguhkan.' });
    const token = req.sessionRecord ? undefined : generateToken(user._id, user.role, user.token_version || 0);
    if (req.sessionRecord) await createSession(req, res, user._id, user.token_version || 0);

    res.status(200).json({
      success: true,
      message: 'Login berhasil!',
      data: {
        _id: user._id,
        nama: user.nama,
        email: user.email,
        nomor_telepon: user.nomor_telepon,
        role: user.role,
        foto_profil: user.foto_profil,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({
      success: true,
      data: userDto(user),
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { nama, nomor_telepon } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
    }

    const errors = {};
    if (nama !== undefined && (typeof nama !== 'string' || nama.trim().length < 3 || nama.length > 100)) errors.nama = ['Nama harus terdiri dari 3–100 karakter.'];
    if (nomor_telepon !== undefined && (typeof nomor_telepon !== 'string' || !/^(\+62|62|0)8\d{7,12}$/.test(nomor_telepon))) errors.telepon = ['Nomor kontak tidak valid.'];
    if (Object.keys(errors).length) return res.status(422).json({ success: false, code: 'VALIDATION_ERROR', message: 'Periksa kembali isian profil.', errors });
    if (nama) user.nama = nama.trim();
    if (nomor_telepon) user.nomor_telepon = nomor_telepon;

    const updatedUser = await user.save();

    res.status(200).json({
      success: true,
      message: 'Profil berhasil diperbarui',
      data: userDto(updatedUser),
    });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { password_lama, password_baru } = req.body;
    if (typeof password_lama !== 'string' || typeof password_baru !== 'string' ||
        password_baru.length < 15 || Buffer.byteLength(password_baru, 'utf8') > 72 || password_lama === password_baru) {
      return res.status(422).json({ success: false, message: 'Gunakan sandi baru minimal 15 karakter, maksimal 72 byte, dan berbeda dari sandi lama.' });
    }
    const user = await User.findById(req.user._id).select('+password +token_version');
    if (!await user.matchPassword(password_lama)) return res.status(422).json({ success: false, message: 'Kata sandi lama tidak sesuai.' });
    user.password = password_baru;
    user.password_updated_at = new Date();
    user.token_version = (user.token_version || 0) + 1;
    // Perubahan sandi biasa harus membatalkan token reset yang masih aktif
    user.reset_password_token_hash = null;
    user.reset_password_expires_at = null;
    await user.save();
    await Session.deleteMany({ user_id: user._id });
    if (req.sessionRecord) await createSession(req, res, user._id, user.token_version);
    res.json({ success: true, message: 'Kata sandi diganti. Sesi perangkat lain dicabut.', data: null });
  } catch (error) { next(error); }
};

/**
 * POST /api/auth/forgot-password
 * Meminta tautan pemulihan kata sandi via email.
 * Respons generik dan seragam untuk mencegah enumerasi akun (termasuk saat kegagalan SMTP).
 */
const forgotPassword = async (req, res, next) => {
  try {
    const rawEmail = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rawEmail)) {
      return res.status(422).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Masukkan alamat email yang valid.',
      });
    }

    // 1. Cek ketersediaan konfigurasi SMTP
    const mailConfig = getMailConfig();
    if (!mailConfig.isConfigured) {
      return res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Layanan email pemulihan kata sandi saat ini belum tersedia. Hubungi administrator.',
      });
    }

    // 2. Terapkan pembatasan laju (cooldown 60s, max 5/15m email, max 10/15m IP)
    const rateCheck = await checkForgotRateLimit(req, rawEmail);
    if (!rateCheck.allowed) {
      if (rateCheck.retryAfter) {
        res.setHeader('Retry-After', rateCheck.retryAfter);
      }
      return res.status(429).json({
        success: false,
        code: rateCheck.code || 'RATE_LIMITED',
        message: rateCheck.message,
      });
    }

    const genericSuccessResponse = {
      success: true,
      message: 'Permintaan diterima. Jika alamat email terdaftar dan valid, instruksi pemulihan akan dikirimkan.',
      data: null,
    };

    // 3. Cari pengguna berdasarkan email
    const user = await User.findOne({ email: rawEmail }).select(
      '+token_version +reset_password_token_hash'
    );

    // Pengguna tidak ditemukan atau akun suspended -> kembalikan respons generik yang sama persis
    if (!user || user.status === 'suspended') {
      return res.status(200).json(genericSuccessResponse);
    }

    // 4. Buat token acak berkekuatan tinggi (>= 32 bytes)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 menit

    // Simpan hanya hash SHA-256 ke DB
    user.reset_password_token_hash = tokenHash;
    user.reset_password_expires_at = expiresAt;
    await user.save();

    // 5. Kirim email pemulihan
    try {
      await sendPasswordResetEmail(user.email, user.nama, rawToken);
    } catch (err) {
      // Invalidate token secara bersyarat: hanya jika hash masih sama agar tidak menghapus token request yang lebih baru
      await User.updateOne(
        {
          _id: user._id,
          reset_password_token_hash: tokenHash,
        },
        {
          $set: {
            reset_password_token_hash: null,
            reset_password_expires_at: null,
          },
        }
      ).catch(() => {});

      const errCode = (err && typeof err.code === 'string') ? err.code : 'UNKNOWN_ERROR';
      console.error(`[Mail Error] Forgot password delivery failed: ${errCode}`);

      // Tetap kembalikan respons generik 200 yang sama persis agar tidak membocorkan eksistensi akun
      return res.status(200).json(genericSuccessResponse);
    }

    return res.status(200).json(genericSuccessResponse);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/reset-password
 * Mengatur ulang kata sandi dengan token yang valid.
 * Sekali pakai atomik, mencabut semua sesi lama, tanpa auto-login.
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (typeof token !== 'string' || !token.trim() || token.trim().length < 32) {
      return res.status(400).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Tautan pemulihan kata sandi tidak valid atau sudah kedaluwarsa.',
      });
    }

    if (
      typeof password !== 'string' ||
      password.length < 15 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(422).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Kata sandi minimal 15 karakter dan maksimal 72 byte.',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    // 1. Baca kandidat token tanpa langsung mengonsumsi
    const userCandidate = await User.findOne({
      reset_password_token_hash: tokenHash,
      reset_password_expires_at: { $gt: new Date() },
    }).select('+password +token_version status email nama');

    if (!userCandidate) {
      return res.status(400).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Tautan pemulihan kata sandi tidak valid atau sudah kedaluwarsa.',
      });
    }

    if (userCandidate.status !== 'active') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_SUSPENDED',
        message: 'Akun ditangguhkan.',
      });
    }

    // 2. Pastikan kata sandi baru berbeda dari kata sandi sebelumnya (token tetap utuh jika validasi gagal)
    const isSame = await userCandidate.matchPassword(password);
    if (isSame) {
      return res.status(422).json({
        success: false,
        code: 'PASSWORD_SAME',
        message: 'Gunakan kata sandi baru yang berbeda dari kata sandi lama.',
      });
    }

    // 3. Hash kata sandi baru sekali dengan bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const candidateVersion = userCandidate.token_version ?? 0;
    const nextTokenVersion = candidateVersion + 1;

    // Filter CAS aman untuk user legacy (token_version 0 atau field belum ada di dokumen)
    const versionMatch = candidateVersion === 0
      ? { $or: [{ token_version: 0 }, { token_version: { $exists: false } }] }
      : { token_version: candidateVersion };

    const updateFilter = {
      _id: userCandidate._id,
      status: 'active',
      reset_password_token_hash: tokenHash,
      reset_password_expires_at: { $gt: new Date() },
      ...versionMatch,
    };

    // 4. Update CAS atomik dan konsumsi token sekaligus (tanpa .save() untuk mencegah double-hash)
    const updatedUser = await User.findOneAndUpdate(
      updateFilter,
      {
        $set: {
          password: hashedPassword,
          password_updated_at: new Date(),
          reset_password_token_hash: null,
          reset_password_expires_at: null,
          token_version: nextTokenVersion,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(400).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Tautan pemulihan kata sandi tidak valid atau sudah kedaluwarsa.',
      });
    }

    // 5. Cabut seluruh sesi aktif lama di database secara best-effort (versi sesi server sudah memblokir sesi lama)
    try {
      await Session.deleteMany({ user_id: userCandidate._id });
    } catch (err) {
      const errCode = (err && typeof err.code === 'string') ? err.code : 'SESSION_CLEANUP_FAILED';
      console.error(`[Session Cleanup] Gagal mencabut sesi lama via deleteMany: ${errCode}`);
    }

    // Jangan auto-login dan jangan otomatis menandai email terverifikasi
    return res.status(200).json({
      success: true,
      message: 'Kata sandi berhasil diperbarui. Silakan masuk menggunakan kata sandi baru.',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/verify-email
 * Mengonfirmasi verifikasi alamat email via token.
 * Sekali pakai atomik, tanpa auto-login / sesi baru, mengembalikan data: null.
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (typeof token !== 'string' || !token.trim() || token.trim().length < 32) {
      return res.status(400).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Tautan verifikasi email tidak valid atau sudah kedaluwarsa.',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    // 1. Validasi token dan status aktif sebelum update
    const candidate = await User.findOne({
      verify_email_token_hash: tokenHash,
      verify_email_expires_at: { $gt: new Date() },
    });

    if (!candidate) {
      return res.status(400).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Tautan verifikasi email tidak valid atau sudah kedaluwarsa.',
      });
    }

    if (candidate.status !== 'active') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_SUSPENDED',
        message: 'Akun ditangguhkan.',
      });
    }

    // 2. Konsumsi atomik sekali pakai dengan filter status active
    const user = await User.findOneAndUpdate(
      {
        _id: candidate._id,
        status: 'active',
        verify_email_token_hash: tokenHash,
        verify_email_expires_at: { $gt: new Date() },
      },
      {
        $set: {
          verify_email_token_hash: null,
          verify_email_expires_at: null,
          email_verified_at: new Date(),
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Tautan verifikasi email tidak valid atau sudah kedaluwarsa.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Alamat email berhasil diverifikasi!',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/resend-verification
 * Mengirimkan ulang tautan verifikasi email untuk akun yang sedang login.
 */
const resendVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna tidak ditemukan.',
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Akun ditangguhkan.',
      });
    }

    if (user.email_verified_at) {
      return res.status(400).json({
        success: false,
        message: 'Alamat email sudah diverifikasi sebelumnya.',
      });
    }

    const mailConfig = getMailConfig();
    if (!mailConfig.isConfigured) {
      return res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Layanan email verifikasi saat ini belum tersedia. Hubungi administrator.',
      });
    }

    const rateCheck = await checkResendVerificationRateLimit(req, user._id, user.email);
    if (!rateCheck.allowed) {
      if (rateCheck.retryAfter) {
        res.setHeader('Retry-After', rateCheck.retryAfter);
      }
      return res.status(429).json({
        success: false,
        code: rateCheck.code || 'RATE_LIMITED',
        message: rateCheck.message,
      });
    }

    // Token verifikasi acak 32 bytes berlaku 24 jam
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.verify_email_token_hash = tokenHash;
    user.verify_email_expires_at = expiresAt;
    await user.save();

    try {
      await sendVerificationEmail(user.email, user.nama, rawToken);
    } catch (err) {
      // Invalidate token secara bersyarat: hanya jika hash masih sama
      await User.updateOne(
        {
          _id: user._id,
          verify_email_token_hash: tokenHash,
        },
        {
          $set: {
            verify_email_token_hash: null,
            verify_email_expires_at: null,
          },
        }
      ).catch(() => {});

      const errCode = (err && typeof err.code === 'string') ? err.code : 'UNKNOWN_ERROR';
      console.error(`[Mail Error] Resend verification delivery failed: ${errCode}`);

      return res.status(503).json({
        success: false,
        code: 'MAIL_DELIVERY_FAILED',
        message: 'Gagal mengirim email verifikasi. Silakan coba kembali dalam beberapa saat.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Tautan verifikasi baru berhasil dikirim ke email kamu.',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
};
