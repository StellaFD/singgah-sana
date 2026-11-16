const crypto = require('crypto');
const AuthAttempt = require('../models/AuthAttempt');

function hashValue(val) {
  return crypto.createHash('sha256').update(String(val).trim().toLowerCase()).digest('hex');
}

/**
 * Klaim cooldown durasi tertentu secara atomik tanpa race condition.
 * Memanfaatkan indeks unique pada field `key`.
 */
async function claimCooldown(key, durationSeconds = 60) {
  const now = Date.now();
  const expiresAt = new Date(now + durationSeconds * 1000);

  // 1. Coba perbarui atomic jika record cooldown sebelumnya sudah kedaluwarsa
  const updated = await AuthAttempt.findOneAndUpdate(
    {
      key,
      expires_at: { $lte: new Date(now) },
    },
    {
      $set: { count: 1, expires_at: expiresAt },
    },
    { new: true }
  );

  if (updated) {
    return { allowed: true };
  }

  // 2. Jika tidak terupdate, record mungkin belum ada. Coba buat baru.
  try {
    await AuthAttempt.create({
      key,
      count: 1,
      expires_at: expiresAt,
    });
    return { allowed: true };
  } catch (err) {
    if (err.code === 11000) {
      // Record sudah dibuat oleh request paralel atau masih aktif. Cek sisa waktu.
      const existing = await AuthAttempt.findOne({ key });
      if (existing && existing.expires_at > new Date(now)) {
        const retryAfter = Math.max(1, Math.ceil((existing.expires_at.getTime() - now) / 1000));
        return { allowed: false, retryAfter };
      }
      // Jika tepat saat ini expired, coba update sekali lagi
      const secondChance = await AuthAttempt.findOneAndUpdate(
        { key, expires_at: { $lte: new Date(now) } },
        { $set: { count: 1, expires_at: expiresAt } },
        { new: true }
      );
      if (secondChance) return { allowed: true };
      return { allowed: false, retryAfter: 1 };
    }
    throw err;
  }
}

/**
 * Memeriksa dan mencatat pembatasan laju untuk permintaan pemulihan kata sandi (forgot password):
 * 1. Cooldown 60 detik per alamat email (klaim atomik)
 * 2. Maksimal 5 permintaan per 15 menit per alamat email (bebas dari rotasi IP)
 * 3. Maksimal 10 permintaan per 15 menit per alamat IP
 */
async function checkForgotRateLimit(req, rawEmail) {
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  const emailHash = hashValue(email);
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const ipHash = hashValue(ip);
  const now = Date.now();

  // 1. Klaim Cooldown 60 detik per email secara atomik
  const cooldownKey = `cooldown:forgot:${emailHash}`;
  const cooldownClaim = await claimCooldown(cooldownKey, 60);
  if (!cooldownClaim.allowed) {
    return {
      allowed: false,
      code: 'RATE_LIMITED',
      retryAfter: cooldownClaim.retryAfter,
      message: `Mohon tunggu ${cooldownClaim.retryAfter} detik sebelum meminta tautan pemulihan kembali.`,
    };
  }

  // 2. Cek Limit Akun / Email (Maks 5 per 15 menit)
  const bucket15m = Math.floor(now / 900000);
  const emailLimitKey = `limit:forgot:email:${emailHash}:${bucket15m}`;
  const expiresAt15m = new Date((bucket15m + 1) * 900000);

  let emailAttempt;
  try {
    emailAttempt = await AuthAttempt.findOneAndUpdate(
      { key: emailLimitKey },
      { $inc: { count: 1 }, $setOnInsert: { expires_at: expiresAt15m } },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code === 11000) {
      emailAttempt = await AuthAttempt.findOneAndUpdate(
        { key: emailLimitKey },
        { $inc: { count: 1 } },
        { new: true }
      );
    } else {
      throw err;
    }
  }

  if (emailAttempt && emailAttempt.count > 5) {
    const retryAfter = Math.max(1, Math.ceil((expiresAt15m.getTime() - now) / 1000));
    return {
      allowed: false,
      code: 'RATE_LIMITED',
      retryAfter,
      message: 'Terlalu banyak permintaan pemulihan untuk akun ini. Silakan coba beberapa menit lagi.',
    };
  }

  // 3. Cek Limit IP (Maks 10 per 15 menit)
  const ipLimitKey = `limit:forgot:ip:${ipHash}:${bucket15m}`;
  let ipAttempt;
  try {
    ipAttempt = await AuthAttempt.findOneAndUpdate(
      { key: ipLimitKey },
      { $inc: { count: 1 }, $setOnInsert: { expires_at: expiresAt15m } },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code === 11000) {
      ipAttempt = await AuthAttempt.findOneAndUpdate(
        { key: ipLimitKey },
        { $inc: { count: 1 } },
        { new: true }
      );
    } else {
      throw err;
    }
  }

  if (ipAttempt && ipAttempt.count > 10) {
    const retryAfter = Math.max(1, Math.ceil((expiresAt15m.getTime() - now) / 1000));
    return {
      allowed: false,
      code: 'RATE_LIMITED',
      retryAfter,
      message: 'Terlalu banyak permintaan dari alamat IP ini. Silakan coba beberapa menit lagi.',
    };
  }

  return { allowed: true };
}

/**
 * Memeriksa dan mencatat pembatasan laju untuk pengiriman ulang verifikasi email:
 * 1. Cooldown 60 detik per pengguna (klaim atomik)
 * 2. Maksimal 5 permintaan per 15 menit
 */
async function checkResendVerificationRateLimit(req, userId, rawEmail) {
  const userIdentifier = String(userId || rawEmail || '').trim().toLowerCase();
  const userHash = hashValue(userIdentifier);
  const now = Date.now();

  const cooldownKey = `cooldown:resend:${userHash}`;
  const cooldownClaim = await claimCooldown(cooldownKey, 60);
  if (!cooldownClaim.allowed) {
    return {
      allowed: false,
      code: 'RATE_LIMITED',
      retryAfter: cooldownClaim.retryAfter,
      message: `Mohon tunggu ${cooldownClaim.retryAfter} detik sebelum meminta email verifikasi kembali.`,
    };
  }

  const bucket15m = Math.floor(now / 900000);
  const limitKey = `limit:resend:${userHash}:${bucket15m}`;
  const expiresAt15m = new Date((bucket15m + 1) * 900000);

  let attempt;
  try {
    attempt = await AuthAttempt.findOneAndUpdate(
      { key: limitKey },
      { $inc: { count: 1 }, $setOnInsert: { expires_at: expiresAt15m } },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code === 11000) {
      attempt = await AuthAttempt.findOneAndUpdate(
        { key: limitKey },
        { $inc: { count: 1 } },
        { new: true }
      );
    } else {
      throw err;
    }
  }

  if (attempt && attempt.count > 5) {
    const retryAfter = Math.max(1, Math.ceil((expiresAt15m.getTime() - now) / 1000));
    return {
      allowed: false,
      code: 'RATE_LIMITED',
      retryAfter,
      message: 'Terlalu banyak permintaan pengiriman ulang email verifikasi. Silakan coba beberapa menit lagi.',
    };
  }

  return { allowed: true };
}

/**
 * Middleware untuk membatasi percobaan reset password atau verifikasi email (anti token brute-force)
 */
async function tokenAttemptRateLimit(req, res, next) {
  try {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const bucket = Math.floor(Date.now() / 600000); // 10 menit
    const key = crypto
      .createHash('sha256')
      .update(`token-attempt:${req.path}:${ip}:${bucket}`)
      .digest('hex');

    let attempt;
    try {
      attempt = await AuthAttempt.findOneAndUpdate(
        { key },
        { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date((bucket + 1) * 600000) } },
        { upsert: true, new: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      attempt = await AuthAttempt.findOneAndUpdate(
        { key },
        { $inc: { count: 1 } },
        { new: true }
      );
    }

    if (attempt && attempt.count > 15) {
      res.setHeader('Retry-After', Math.ceil(((bucket + 1) * 600000 - Date.now()) / 1000));
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message: 'Terlalu banyak percobaan pada tautan ini. Tunggu beberapa menit.',
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  checkForgotRateLimit,
  checkResendVerificationRateLimit,
  tokenAttemptRateLimit,
};
