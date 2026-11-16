const crypto = require('crypto');
const AuthAttempt = require('../models/AuthAttempt');

// Durable per-account limit; shared by all backend instances.
module.exports = async (req, res, next) => {
  try {
    const windowMs = 10 * 60 * 1000;
    const bucket = Math.floor(Date.now() / windowMs);
    const key = crypto.createHash('sha256').update(`media:${req.user._id}:${bucket}`).digest('hex');
    let attempt;
    try {
      attempt = await AuthAttempt.findOneAndUpdate({ key }, {
        $inc: { count: 1 },
        $setOnInsert: { expires_at: new Date((bucket + 1) * windowMs) },
      }, { upsert: true, new: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      attempt = await AuthAttempt.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true });
    }
    if (attempt.count > 20) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil(((bucket + 1) * windowMs - Date.now()) / 1000)));
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message: 'Batas unggah foto tercapai. Coba lagi dalam beberapa menit.',
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};
