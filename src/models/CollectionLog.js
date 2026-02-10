const mongoose = require('mongoose');

const collectionLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  source: { type: String, required: true },
  status: { type: String, enum: ['success', 'error', 'skipped'], required: true },
  message: { type: String, default: null },
  recordsCollected: { type: Number, default: 0 },
  durationMs: { type: Number, default: null },
}, {
  timestamps: true,
});

module.exports = mongoose.model('CollectionLog', collectionLogSchema);
