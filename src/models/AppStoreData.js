const mongoose = require('mongoose');

const appStoreDataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appRefId: { type: mongoose.Schema.Types.ObjectId, ref: 'App', default: null },
  date: { type: String, required: true },
  appId: { type: String, required: true },
  appName: { type: String, default: null },
  latestVersion: { type: String, default: null },
  latestBuild: { type: String, default: null },
  buildStatus: { type: String, default: null },
  downloads: { type: Number, default: 0 },
  updates: { type: Number, default: 0 },
  proceeds: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  averageRating: { type: Number, default: null },
  totalRatings: { type: Number, default: 0 },
}, {
  timestamps: true,
});

appStoreDataSchema.index({ userId: 1, date: 1, appId: 1 }, { unique: true });

module.exports = mongoose.model('AppStoreData', appStoreDataSchema);
