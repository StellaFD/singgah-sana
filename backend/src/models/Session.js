const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  token_hash: { type: String, required: true, unique: true },
  csrf_hash: { type: String, required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  expires_at: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
