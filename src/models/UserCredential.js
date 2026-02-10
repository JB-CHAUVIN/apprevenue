const mongoose = require('mongoose');

const userCredentialSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  source: { type: String, enum: ['admob', 'appstore', 'googleplay', 'stripe'], required: true },
  credentials: { type: mongoose.Schema.Types.Mixed, default: {} },
  isConfigured: { type: Boolean, default: false },
  lastTestedAt: { type: Date, default: null },
  testStatus: { type: String, default: null },
}, {
  timestamps: true,
});

userCredentialSchema.index({ userId: 1, source: 1 }, { unique: true });

module.exports = mongoose.model('UserCredential', userCredentialSchema);
