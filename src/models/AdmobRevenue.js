const mongoose = require('mongoose');

const admobRevenueSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appRefId: { type: mongoose.Schema.Types.ObjectId, ref: 'App', default: null },
  date: { type: String, required: true },
  appId: { type: String, default: null },
  appName: { type: String, default: null },
  country: { type: String, default: null },
  estimatedRevenue: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  ecpm: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
}, {
  timestamps: true,
});

admobRevenueSchema.index({ userId: 1, date: 1, appId: 1, country: 1 }, { unique: true });

module.exports = mongoose.model('AdmobRevenue', admobRevenueSchema);
