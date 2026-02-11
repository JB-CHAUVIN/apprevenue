const express = require('express');
const { Parser } = require('json2csv');
const { requireAuth } = require('../middleware/auth');
const { App, AdmobRevenue, AppStoreData, GooglePlayData, StripeData, CollectionLog, User, UserCredential } = require('../models');
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

// ========== Service connection status ==========
router.get('/services/status', async (req, res) => {
  try {
    const credentialTest = require('../services/credential-test');
    const creds = await UserCredential.find({ userId: req.user.id }).lean();
    const credMap = {};
    for (const c of creds) credMap[c.source] = c;

    const sources = ['admob', 'stripe', 'appstore', 'googleplay'];
    const results = {};

    await Promise.all(sources.map(async (source) => {
      const cred = credMap[source];
      if (!cred?.credentials || !cred.isConfigured) {
        results[source] = { status: 'not_configured' };
        return;
      }
      try {
        const testFn = {
          admob: credentialTest.testAdmob,
          stripe: credentialTest.testStripe,
          appstore: credentialTest.testAppStore,
          googleplay: credentialTest.testGooglePlay,
        }[source];
        await testFn(cred.credentials);
        await UserCredential.findByIdAndUpdate(cred._id, { lastTestedAt: new Date(), testStatus: 'success' });
        results[source] = { status: 'success' };
      } catch (err) {
        await UserCredential.findByIdAndUpdate(cred._id, { lastTestedAt: new Date(), testStatus: 'error' });
        results[source] = { status: 'error', message: err.message };
      }
    }));

    res.json(results);
  } catch (err) {
    logger.error('API /services/status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== Service listings (for app form dropdowns) ==========

// List iOS apps from App Store Connect
router.get('/services/appstore/apps', async (req, res) => {
  try {
    const cred = await UserCredential.findOne({ userId: req.user.id, source: 'appstore' }).lean();
    if (!cred?.credentials?.issuerId || !cred?.credentials?.keyId || !cred?.credentials?.privateKey) {
      return res.json({ configured: false, items: [] });
    }
    const jwt = require('jsonwebtoken');
    const fetch = require('node-fetch');
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
      { iss: cred.credentials.issuerId, iat: now, exp: now + 20 * 60, aud: 'appstoreconnect-v1' },
      cred.credentials.privateKey,
      { algorithm: 'ES256', keyid: cred.credentials.keyId }
    );
    const apiRes = await fetch('https://api.appstoreconnect.apple.com/v1/apps?fields[apps]=name,bundleId&limit=200', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!apiRes.ok) throw new Error(`App Store API returned ${apiRes.status}`);
    const body = await apiRes.json();
    const items = (body.data || []).map(app => ({
      appId: app.id,
      name: app.attributes?.name || app.id,
      bundleId: app.attributes?.bundleId || '',
    }));
    res.json({ configured: true, items });
  } catch (err) {
    logger.error('API /services/appstore/apps error:', err);
    res.status(500).json({ error: err.message });
  }
});

// List Stripe products
router.get('/services/stripe/products', async (req, res) => {
  try {
    const cred = await UserCredential.findOne({ userId: req.user.id, source: 'stripe' }).lean();
    if (!cred?.credentials?.secretKey) {
      return res.json({ configured: false, items: [] });
    }
    const Stripe = require('stripe');
    const stripe = new Stripe(cred.credentials.secretKey);
    const products = await stripe.products.list({ limit: 100, active: true });
    const items = products.data.map(p => ({
      productId: p.id,
      name: p.name || p.id,
    }));
    res.json({ configured: true, items });
  } catch (err) {
    logger.error('API /services/stripe/products error:', err);
    res.status(500).json({ error: err.message });
  }
});

// List AdMob apps from collected data
router.get('/services/admob/apps', async (req, res) => {
  try {
    const cred = await UserCredential.findOne({ userId: req.user.id, source: 'admob' }).lean();
    if (!cred?.credentials?.publisherId) {
      return res.json({ configured: false, items: [] });
    }
    const items = await AdmobRevenue.aggregate([
      { $match: { userId: require('mongoose').Types.ObjectId.createFromHexString(req.user.id) } },
      { $group: { _id: '$appId', appName: { $last: '$appName' } } },
      { $project: { appId: '$_id', appName: 1, _id: 0 } },
      { $sort: { appName: 1 } },
    ]);
    res.json({ configured: true, items });
  } catch (err) {
    logger.error('API /services/admob/apps error:', err);
    res.status(500).json({ error: err.message });
  }
});

// List Google Play apps — try Reporting API first, fallback to local data
router.get('/services/googleplay/apps', async (req, res) => {
  try {
    const cred = await UserCredential.findOne({ userId: req.user.id, source: 'googleplay' }).lean();
    if (!cred?.credentials?.serviceAccountJson) {
      return res.json({ configured: false, items: [] });
    }

    // 1) Try Play Developer Reporting API (apps.search)
    let items = [];
    try {
      const { google } = require('googleapis');
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(cred.credentials.serviceAccountJson),
        scopes: ['https://www.googleapis.com/auth/playdeveloperreporting'],
      });
      const reporting = google.playdeveloperreporting({ version: 'v1beta1', auth });

      let pageToken;
      do {
        const result = await reporting.apps.search({ pageSize: 100, pageToken });
        for (const app of (result.data.apps || [])) {
          items.push({
            packageName: app.packageName || '',
            appName: app.displayName || app.packageName || '',
          });
        }
        pageToken = result.data.nextPageToken;
      } while (pageToken);
    } catch (e) {
      logger.warn('Play Developer Reporting API failed, falling back to local data:', e.message);
    }

    // 2) Fallback: merge from App model + collected GooglePlayData
    if (items.length === 0) {
      const mongoose = require('mongoose');
      const [fromApps, fromData] = await Promise.all([
        App.find({ userId: req.user.id, androidPackageName: { $ne: null } }).lean(),
        GooglePlayData.aggregate([
          { $match: { userId: mongoose.Types.ObjectId.createFromHexString(req.user.id) } },
          { $group: { _id: '$packageName', appName: { $last: '$appName' } } },
          { $project: { packageName: '$_id', appName: 1, _id: 0 } },
        ]),
      ]);

      const seen = new Map();
      for (const app of fromApps) {
        if (app.androidPackageName) seen.set(app.androidPackageName, app.name);
      }
      for (const d of fromData) {
        if (d.packageName && !seen.has(d.packageName)) seen.set(d.packageName, d.appName || d.packageName);
      }
      items = Array.from(seen.entries()).map(([packageName, appName]) => ({ packageName, appName }));
    }

    items.sort((a, b) => a.appName.localeCompare(b.appName));
    res.json({ configured: true, items });
  } catch (err) {
    logger.error('API /services/googleplay/apps error:', err);
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

router.delete('/apps/:id', async (req, res) => {
  try {
    const app = await App.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!app) return res.status(404).json({ error: 'App not found' });
    res.json({ message: 'App deleted' });
  } catch (err) {
    logger.error('API DELETE /apps/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
