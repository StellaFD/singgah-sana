const mongoose = require('mongoose');
module.exports = mongoose.model('AuthAttempt', new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  count: { type: Number, default: 0 },
  expires_at: { type: Date, index: { expires: 0 } },
}));
