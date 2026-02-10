const mongoose = require('mongoose');

const googlePlayDataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appRefId: { type: mongoose.Schema.Types.ObjectId, ref: 'App', default: null },
  date: { type: String, required: true },
  packageName: { type: String, required: true },
  appName: { type: String, default: null },
  latestVersionCode: { type: Number, default: null },
  latestVersionName: { type: String, default: null },
  track: { type: String, default: 'production' },
  releaseStatus: { type: String, default: null },
  totalInstalls: { type: Number, default: 0 },
  activeInstalls: { type: Number, default: 0 },
  activeSubscriptions: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  averageRating: { type: Number, default: null },
  totalRatings: { type: Number, default: 0 },
}, {
  timestamps: true,
});

googlePlayDataSchema.index({ userId: 1, date: 1, packageName: 1 }, { unique: true });

module.exports = mongoose.model('GooglePlayData', googlePlayDataSchema);
