const express = require('express');
const { Parser } = require('json2csv');
const { requireAuth } = require('../middleware/auth');
const { App, AdmobRevenue, AppStoreData, GooglePlayData, StripeData, CollectionLog, User } = require('../models');
const { collectForUser } = require('../collectors');
const logger = require('../utils/logger');

const router = express.Router();

router.use(requireAuth);

// Helper: parse date range
function dateRange(query) {
  const filter = {};
  if (query.from) filter.date = { ...filter.date, $gte: query.from };
  if (query.to) filter.date = { ...filter.date, $lte: query.to };
  return filter;
}

// ========== AdMob ==========
router.get('/admob', async (req, res) => {
  try {
    const where = { userId: req.user.id, ...dateRange(req.query) };
    const data = await AdmobRevenue.find(where).sort({ date: -1 }).limit(parseInt(req.query.limit, 10) || 100).lean();
    res.json(data);
  } catch (err) {
    logger.error('API /admob error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/admob/summary', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const match = { userId: mongoose.Types.ObjectId.createFromHexString(req.user.id) };
    if (req.query.from) match.date = { ...match.date, $gte: req.query.from };
    if (req.query.to) match.date = { ...match.date, $lte: req.query.to };

    const summary = await AdmobRevenue.aggregate([
      { $match: match },
      { $group: { _id: '$date', totalRevenue: { $sum: '$estimatedRevenue' }, totalImpressions: { $sum: '$impressions' }, totalClicks: { $sum: '$clicks' } } },
      { $sort: { _id: -1 } },
      { $limit: 30 },
      { $project: { date: '$_id', totalRevenue: 1, totalImpressions: 1, totalClicks: 1, _id: 0 } },
    ]);
    res.json(summary);
  } catch (err) {
    logger.error('API /admob/summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== App Store ==========
router.get('/appstore', async (req, res) => {
  try {
    const where = { userId: req.user.id, ...dateRange(req.query) };
    const data = await AppStoreData.find(where).sort({ date: -1 }).limit(parseInt(req.query.limit, 10) || 100).lean();
    res.json(data);
  } catch (err) {
    logger.error('API /appstore error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== Google Play ==========
router.get('/googleplay', async (req, res) => {
  try {
    const where = { userId: req.user.id, ...dateRange(req.query) };
    const data = await GooglePlayData.find(where).sort({ date: -1 }).limit(parseInt(req.query.limit, 10) || 100).lean();
    res.json(data);
  } catch (err) {
    logger.error('API /googleplay error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== Stripe ==========
router.get('/stripe', async (req, res) => {
  try {
    const where = { userId: req.user.id, ...dateRange(req.query) };
    const data = await StripeData.find(where).sort({ date: -1 }).limit(parseInt(req.query.limit, 10) || 100).lean();
    res.json(data);
  } catch (err) {
    logger.error('API /stripe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== Collection Logs ==========
router.get('/logs', async (req, res) => {
  try {
    const data = await CollectionLog.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(parseInt(req.query.limit, 10) || 50).lean();
    res.json(data);
  } catch (err) {
    logger.error('API /logs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== Trigger manual collection ==========
router.post('/collect', async (req, res) => {
  try {
    const summary = await collectForUser(req.user.id);
    res.json({ message: 'Collection complete', summary });
  } catch (err) {
    logger.error('API /collect error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== Export ==========
router.get('/export/:source', async (req, res) => {
  try {
    const { source } = req.params;
    const format = req.query.format || 'json';
    const where = { userId: req.user.id, ...dateRange(req.query) };

    const models = {
      admob: AdmobRevenue,
      appstore: AppStoreData,
      googleplay: GooglePlayData,
      stripe: StripeData,
    };

    const Model = models[source];
    if (!Model) return res.status(400).json({ error: `Unknown source: ${source}` });

    const data = await Model.find(where).sort({ date: -1 }).lean();

    if (format === 'csv') {
      if (data.length === 0) {
        return res.status(200).type('text/csv').send('');
      }
      const parser = new Parser({ fields: Object.keys(data[0]) });
      const csv = parser.parse(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${source}_export.csv"`);
      return res.send(csv);
    }

    res.json(data);
  } catch (err) {
    logger.error('API /export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== Unified summary ==========
router.get('/summary', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const days = parseInt(req.query.days, 10) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];
    const where = { userId: req.user.id, date: { $gte: sinceStr } };

    const [admob, appstore, googleplay, stripe, logs] = await Promise.all([
      AdmobRevenue.aggregate([
        { $match: { userId: mongoose.Types.ObjectId.createFromHexString(req.user.id), date: { $gte: sinceStr } } },
        { $group: { _id: '$date', revenue: { $sum: '$estimatedRevenue' }, impressions: { $sum: '$impressions' } } },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', revenue: 1, impressions: 1, _id: 0 } },
      ]),
      AppStoreData.find(where).sort({ date: -1 }).lean(),
      GooglePlayData.find(where).sort({ date: -1 }).lean(),
      StripeData.find(where).sort({ date: 1 }).lean(),
      CollectionLog.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    res.json({ admob, appstore, googleplay, stripe, logs, period: { days, since: sinceStr } });
  } catch (err) {
    logger.error('API /summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== Apps CRUD ==========
router.get('/apps', async (req, res) => {
  try {
    const data = await App.find({ userId: req.user.id }).sort({ name: 1 }).lean();
    res.json(data);
  } catch (err) {
    logger.error('API /apps error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/apps', async (req, res) => {
  try {
    // Check plan limits
    const user = await User.findById(req.user.id).lean();
    if (user.plan === 'free') {
      const count = await App.countDocuments({ userId: req.user.id });
      if (count >= 2) {
        return res.status(403).json({ error: 'Free plan limited to 2 apps. Upgrade to Pro for unlimited apps.' });
      }
    }
    const app = new App({ ...req.body, userId: req.user.id });
    await app.save();
    res.status(201).json(app);
  } catch (err) {
    logger.error('API POST /apps error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/apps/:id', async (req, res) => {
  try {
    const app = await App.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!app) return res.status(404).json({ error: 'App not found' });
    res.json(app);
  } catch (err) {
    logger.error('API /apps/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/apps/:id', async (req, res) => {
  try {
    const app = await App.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    ).lean();
    if (!app) return res.status(404).json({ error: 'App not found' });
    res.json(app);
  } catch (err) {
    logger.error('API PUT /apps/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
