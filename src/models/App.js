const mongoose = require('mongoose');

const appSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  icon: { type: String, default: null },
  iosBundleId: { type: String, default: null },
  iosAppId: { type: String, default: null },
  androidPackageName: { type: String, default: null },
  admobAppId: { type: String, default: null },
  stripeProductId: { type: String, default: null },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
});

module.exports = mongoose.model('App', appSchema);
