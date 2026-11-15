const crypto = require('crypto');
const AuthAttempt = require('../models/AuthAttempt');

module.exports = async (req, res, next) => {
  try {
    const bucket = Math.floor(Date.now() / 600000);
    const identity = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const key = crypto.createHash('sha256').update(`${req.path}:${identity}:${req.ip}:${bucket}`).digest('hex');
    let attempt;
    try {
      attempt = await AuthAttempt.findOneAndUpdate({ key }, { $inc: { count: 1 },
        $setOnInsert: { expires_at: new Date((bucket + 1) * 600000) } }, { upsert: true, new: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      attempt = await AuthAttempt.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true });
    }
    if (attempt.count > 20) {
      res.setHeader('Retry-After', Math.ceil(((bucket + 1) * 600000 - Date.now()) / 1000));
      return res.status(429).json({ success: false, code: 'RATE_LIMITED', message: 'Terlalu banyak percobaan. Tunggu beberapa menit.' });
    }
    next();
  } catch (error) { next(error); }
};
