const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const { App, AdmobRevenue, AppStoreData, GooglePlayData, StripeData, CollectionLog, UserCredential, User } = require('../models');

const router = express.Router();

function toObjectId(id) {
  return mongoose.Types.ObjectId.createFromHexString(id);
}

// GET /dashboard — Global view
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days, 10) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    const [admobDaily, appstore, googleplay, stripe, logs, apps, credentials] = await Promise.all([
      AdmobRevenue.aggregate([
        { $match: { userId: toObjectId(userId), date: { $gte: sinceStr } } },
        { $group: { _id: '$date', revenue: { $sum: '$estimatedRevenue' }, impressions: { $sum: '$impressions' }, clicks: { $sum: '$clicks' } } },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', revenue: 1, impressions: 1, clicks: 1, _id: 0 } },
      ]),
      AppStoreData.find({ userId, date: { $gte: sinceStr } }).sort({ date: -1 }).lean(),
      GooglePlayData.find({ userId, date: { $gte: sinceStr } }).sort({ date: -1 }).lean(),
      StripeData.find({ userId, date: { $gte: sinceStr } }).sort({ date: 1 }).lean(),
      CollectionLog.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
      App.find({ userId, isActive: true }).sort({ name: 1 }).lean(),
      UserCredential.find({ userId, isConfigured: true }).lean(),
    ]);

    const totalAdmobRevenue = admobDaily.reduce((s, r) => s + (r.revenue || 0), 0);
    const totalImpressions = admobDaily.reduce((s, r) => s + (r.impressions || 0), 0);
    const latestStripe = stripe.length > 0 ? stripe[stripe.length - 1] : null;

    res.render('dashboard', {
      user: req.user,
      days,
      admobDaily,
      appstore,
      googleplay,
      stripe,
      logs,
      apps,
      currentApp: null,
      credentials,
      activePage: 'dashboard',
      totals: {
        admobRevenue: totalAdmobRevenue.toFixed(2),
        impressions: totalImpressions.toLocaleString(),
        mrr: latestStripe ? parseFloat(latestStripe.mrr).toFixed(2) : '0.00',
        activeApps: apps.length,
      },
    });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
});

// GET /dashboard/app/:id — Per-app view
router.get('/dashboard/app/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const app = await App.findOne({ _id: req.params.id, userId }).lean();
    if (!app) {
      return res.status(404).render('error', { message: 'App not found' });
    }

    const days = parseInt(req.query.days, 10) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    const [admobDaily, appstore, googleplay, stripe, apps] = await Promise.all([
      AdmobRevenue.aggregate([
        { $match: { userId: toObjectId(userId), date: { $gte: sinceStr }, appRefId: app._id } },
        { $group: { _id: '$date', revenue: { $sum: '$estimatedRevenue' }, impressions: { $sum: '$impressions' }, clicks: { $sum: '$clicks' } } },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', revenue: 1, impressions: 1, clicks: 1, _id: 0 } },
      ]),
      AppStoreData.find({ userId, date: { $gte: sinceStr }, appRefId: app._id }).sort({ date: -1 }).lean(),
      GooglePlayData.find({ userId, date: { $gte: sinceStr }, appRefId: app._id }).sort({ date: -1 }).lean(),
      StripeData.find({ userId, date: { $gte: sinceStr }, appRefId: app._id }).sort({ date: 1 }).lean(),
      App.find({ userId, isActive: true }).sort({ name: 1 }).lean(),
    ]);

    const totalAdmobRevenue = admobDaily.reduce((s, r) => s + (r.revenue || 0), 0);
    const totalImpressions = admobDaily.reduce((s, r) => s + (r.impressions || 0), 0);
    const latestStripe = stripe.length > 0 ? stripe[stripe.length - 1] : null;

    res.render('dashboard', {
      user: req.user,
      days,
      admobDaily,
      appstore,
      googleplay,
      stripe,
      logs: [],
      apps,
      currentApp: app,
      credentials: [],
      activePage: 'dashboard',
      totals: {
        admobRevenue: totalAdmobRevenue.toFixed(2),
        impressions: totalImpressions.toLocaleString(),
        mrr: latestStripe ? parseFloat(latestStripe.mrr).toFixed(2) : '0.00',
        activeApps: apps.length,
      },
    });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
});

// GET /dashboard/profile
router.get('/dashboard/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    res.render('profile', { user, activePage: 'profile', error: null, success: null });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
});

// POST /dashboard/profile
router.post('/dashboard/profile', requireAuth, async (req, res) => {
  try {
    const { displayName, firstName, lastName } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { displayName, firstName, lastName },
      { new: true }
    ).lean();
    res.render('profile', { user, activePage: 'profile', error: null, success: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
});

// POST /dashboard/profile/password
router.post('/dashboard/profile/password', requireAuth, async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
      return res.render('profile', { user: user.toObject(), activePage: 'profile', error: 'Current password is incorrect', success: null });
    }
    if (newPassword !== confirmNewPassword) {
      return res.render('profile', { user: user.toObject(), activePage: 'profile', error: 'New passwords do not match', success: null });
    }
    if (newPassword.length < 8) {
      return res.render('profile', { user: user.toObject(), activePage: 'profile', error: 'Password must be at least 8 characters', success: null });
    }

    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    await user.save();
    res.render('profile', { user: user.toObject(), activePage: 'profile', error: null, success: 'Password changed successfully' });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
});

module.exports = router;
