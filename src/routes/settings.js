const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { UserCredential } = require('../models');
const credentialTest = require('../services/credential-test');
const logger = require('../utils/logger');

const router = express.Router();

const sources = ['admob', 'stripe', 'appstore', 'googleplay'];

// Generic GET /dashboard/settings/:source
sources.forEach(source => {
  router.get(`/dashboard/settings/${source}`, requireAuth, async (req, res) => {
    try {
      const cred = await UserCredential.findOne({ userId: req.user.id, source }).lean();
      res.render(`settings/${source}`, {
        user: req.user,
        activePage: `settings-${source}`,
        credential: cred || {},
        error: null,
        success: null,
      });
    } catch (err) {
      res.status(500).render('error', { message: err.message });
    }
  });

  // POST /dashboard/settings/:source — save credentials
  router.post(`/dashboard/settings/${source}`, requireAuth, async (req, res) => {
    try {
      const credentials = req.body;
      await UserCredential.findOneAndUpdate(
        { userId: req.user.id, source },
        { credentials, isConfigured: true },
        { upsert: true, new: true }
      );
      const cred = await UserCredential.findOne({ userId: req.user.id, source }).lean();
      res.render(`settings/${source}`, {
        user: req.user,
        activePage: `settings-${source}`,
        credential: cred,
        error: null,
        success: 'Credentials saved successfully',
      });
    } catch (err) {
      logger.error(`Settings save error (${source}):`, err);
      res.render(`settings/${source}`, {
        user: req.user,
        activePage: `settings-${source}`,
        credential: {},
        error: 'Failed to save credentials',
        success: null,
      });
    }
  });

  // POST /dashboard/settings/:source/test — test connection
  router.post(`/dashboard/settings/${source}/test`, requireAuth, async (req, res) => {
    try {
      const testFn = {
        admob: credentialTest.testAdmob,
        stripe: credentialTest.testStripe,
        appstore: credentialTest.testAppStore,
        googleplay: credentialTest.testGooglePlay,
      }[source];

      const result = await testFn(req.body);
      
      await UserCredential.findOneAndUpdate(
        { userId: req.user.id, source },
        { lastTestedAt: new Date(), testStatus: 'success' }
      );

      res.json(result);
    } catch (err) {
      await UserCredential.findOneAndUpdate(
        { userId: req.user.id, source },
        { lastTestedAt: new Date(), testStatus: 'error' }
      );
      res.json({ success: false, message: err.message });
    }
  });
});

module.exports = router;
