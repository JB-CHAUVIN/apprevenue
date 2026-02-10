const mongoose = require('mongoose');

const stripeDataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appRefId: { type: mongoose.Schema.Types.ObjectId, ref: 'App', default: null },
  date: { type: String, required: true },
  activeSubscriptions: { type: Number, default: 0 },
  newSubscriptions: { type: Number, default: 0 },
  canceledSubscriptions: { type: Number, default: 0 },
  mrr: { type: Number, default: 0 },
  arr: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  successfulPayments: { type: Number, default: 0 },
  failedPayments: { type: Number, default: 0 },
  refunds: { type: Number, default: 0 },
  churnRate: { type: Number, default: 0 },
  currency: { type: String, default: 'usd' },
}, {
  timestamps: true,
});

stripeDataSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('StripeData', stripeDataSchema);
