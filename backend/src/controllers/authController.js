const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const { getJwtSecret } = require('../config/jwt');
const { getMailConfig } = require('../config/mail');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../services/emailService');
const { checkForgotRateLimit, checkResendVerificationRateLimit } = require('../middlewares/recoveryRateLimit');
const Session = require('../models/Session');
const { createSession } = require('../middlewares/sessionMiddleware');
const { uploadAvatarBuffer } = require('../services/cloudinaryStorage');
const { OAuth2Client } = require('google-auth-library');

function validateMagicBytes(buffer, mimetype) {
  if (!buffer || buffer.length < 12) return false;
  if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  if (mimetype === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  }
  if (mimetype === 'image/webp') {
    const isRiff = buffer.subarray(0, 4).toString('ascii') === 'RIFF';
    const isWebp = buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    return isRiff && isWebp;
  }
  return false;
}

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

    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(422).json({ success: false, message: 'Kata sandi minimal 8 karakter dan maksimal 72 karakter.' });
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
        errors: { email: ['Email sudah terdaftar pada akun lain.'] },
      });
    }

    const phone = nomor_telepon.trim();
    const existingPhone = await User.findOne({ nomor_telepon: phone });
    if (existingPhone) {
      return res.status(409).json({
        success: false,
        code: 'CONFLICT',
        message: 'Nomor telepon sudah terdaftar, silakan gunakan nomor lain.',
        errors: { telepon: ['Nomor kontak sudah terdaftar pada akun lain.'] },
      });
    }

    const user = await User.create({
      nama: nama.trim(),
      email,
      password,
      nomor_telepon: phone,
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
    if (nomor_telepon) {
      const trimmedPhone = nomor_telepon.trim();
      const existingPhone = await User.findOne({ nomor_telepon: trimmedPhone, _id: { $ne: req.user._id } });
      if (existingPhone) {
        return res.status(409).json({
          success: false,
          code: 'CONFLICT',
          message: 'Nomor telepon sudah terdaftar pada akun lain.',
          errors: { telepon: ['Nomor kontak sudah digunakan oleh akun lain.'] },
        });
      }
      user.nomor_telepon = trimmedPhone;
    }

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
        password_baru.length < 8 || Buffer.byteLength(password_baru, 'utf8') > 72 || password_lama === password_baru) {
      return res.status(422).json({ success: false, message: 'Gunakan sandi baru minimal 8 karakter, maksimal 72 karakter, dan berbeda dari sandi lama.' });
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
      password.length < 8 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(422).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Kata sandi minimal 8 karakter dan maksimal 72 karakter.',
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

const uploadProfilePhoto = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'Berkas foto tidak ditemukan.' });
    }
    const { buffer, mimetype, size } = req.file;
    if (size > 2 * 1024 * 1024) {
      return res.status(422).json({ success: false, message: 'Ukuran foto maksimal 2 MB.' });
    }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(mimetype) || !validateMagicBytes(buffer, mimetype)) {
      return res.status(422).json({ success: false, message: 'Format berkas harus berupa JPG, PNG, atau WebP yang valid.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    let photoUrl = '';
    try {
      const result = await uploadAvatarBuffer(buffer, user._id);
      photoUrl = result.url;
    } catch {
      // Fallback ke penyimpanan lokal jika Cloudinary terkendala
      const uploadAvatarsDir = path.join(__dirname, '../../uploads/avatars');
      if (!fs.existsSync(uploadAvatarsDir)) {
        fs.mkdirSync(uploadAvatarsDir, { recursive: true });
      }
      const ext = mimetype === 'image/png' ? '.png' : mimetype === 'image/webp' ? '.webp' : '.jpg';
      const filename = `avatar-${user._id}-${Date.now()}${ext}`;
      const localPath = path.join(uploadAvatarsDir, filename);
      fs.writeFileSync(localPath, buffer);
      photoUrl = `/uploads/avatars/${filename}`;
    }

    user.foto_profil = photoUrl;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Foto profil berhasil diperbarui.',
      data: userDto(user),
    });
  } catch (error) {
    next(error);
  }
};

const deleteProfilePhoto = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    user.foto_profil = '';
    await user.save();
    res.status(200).json({
      success: true,
      message: 'Foto profil berhasil dihapus.',
      data: userDto(user),
    });
  } catch (error) {
    next(error);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body || {};

    if (!password) {
      return res.status(422).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Masukkan kata sandi saat ini untuk konfirmasi penghapusan akun.',
        errors: { password: ['Kata sandi wajib diisi.'] },
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(422).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Kata sandi saat ini tidak sesuai.',
        errors: { password: ['Kata sandi saat ini tidak sesuai.'] },
      });
    }

    // Role Safeguards
    if (user.role === 'admin') {
      const otherAdmins = await User.countDocuments({ role: 'admin', _id: { $ne: user._id } });
      if (otherAdmins === 0) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'Akun administrator tunggal tidak dapat dihapus.',
        });
      }
    }

    // Jika pemilik, nonaktifkan seluruh kos miliknya
    if (user.role === 'pemilik') {
      const Kos = require('../models/Kos');
      await Kos.updateMany(
        { pemilik_id: user._id },
        { status_publikasi: 'inactive', status_verifikasi: 'archived' }
      );
    }

    // Cascading Cleanup
    const Favorit = require('../models/Favorit');
    const Notifikasi = require('../models/Notifikasi');
    const Session = require('../models/Session');

    await Promise.all([
      Favorit.deleteMany({ user_id: user._id }),
      Notifikasi.deleteMany({ user_id: user._id }),
      Session.deleteMany({ user_id: user._id }),
    ]);

    // Hapus dokumen pengguna secara fisik dari MongoDB Atlas
    await User.findByIdAndDelete(user._id);

    // Hapus cookie sesi dari browser
    res.clearCookie('sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    res.clearCookie('ss.sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return res.status(200).json({
      success: true,
      message: 'Akun Anda berhasil dihapus secara permanen.',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

const googleAuth = async (req, res, next) => {
  try {
    const { credential, role } = req.body;
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({
        success: false,
        code: 'CREDENTIAL_REQUIRED',
        message: 'Kredensial Google wajib disertakan.',
      });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({
        success: false,
        message: 'Konfigurasi Google Client ID belum disetel pada server.',
      });
    }

    const googleClient = new OAuth2Client(clientId);
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_GOOGLE_TOKEN',
        message: 'Token Google tidak valid atau telah kedaluwarsa. Silakan coba lagi.',
      });
    }

    if (!payload || !payload.email) {
      return res.status(400).json({
        success: false,
        message: 'Gagal memperoleh informasi email dari akun Google Anda.',
      });
    }

    const email = payload.email.trim().toLowerCase();
    let user = await User.findOne({ email }).select('+token_version');

    if (user) {
      if (user.status === 'suspended') {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_SUSPENDED',
          message: 'Akun Anda ditangguhkan.',
        });
      }

      let shouldSave = false;
      if (!user.google_id) {
        user.google_id = payload.sub;
        shouldSave = true;
      }
      if (!user.foto_profil && payload.picture) {
        user.foto_profil = payload.picture;
        shouldSave = true;
      }
      if (!user.email_verified_at && payload.email_verified) {
        user.email_verified_at = new Date();
        shouldSave = true;
      }
      if (shouldSave) {
        await user.save();
      }

      await createSession(req, res, user._id, user.token_version || 0);

      return res.status(200).json({
        success: true,
        message: 'Berhasil masuk dengan Google!',
        data: userDto(user),
      });
    }

    // Pengguna belum terdaftar
    const validRoles = ['pencari', 'pemilik'];
    if (!role || !validRoles.includes(role)) {
      return res.status(200).json({
        success: true,
        code: 'NEED_ROLE',
        message: 'Silakan pilih jenis akun untuk menyelesaikan pendaftaran.',
        data: {
          email,
          nama: payload.name || 'Pengguna Google',
          foto_profil: payload.picture || '',
        },
      });
    }

    user = new User({
      nama: payload.name || 'Pengguna Google',
      email,
      role,
      foto_profil: payload.picture || '',
      google_id: payload.sub,
      email_verified_at: payload.email_verified ? new Date() : null,
    });
    await user.save();

    await createSession(req, res, user._id, user.token_version || 0);

    return res.status(201).json({
      success: true,
      message: 'Pendaftaran dengan Google berhasil!',
      data: userDto(user),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
