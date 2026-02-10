const admob = require('./admob');
const appstore = require('./appstore');
const googleplay = require('./googleplay');
const stripe = require('./stripe');
const { UserCredential, CollectionLog } = require('../models');
const logger = require('../utils/logger');

async function collectForUser(userId) {
  logger.info(`=== Starting collection for user ${userId} ===`);
  const start = Date.now();

  const credentials = await UserCredential.find({ userId, isConfigured: true }).lean();
  const results = [];

  for (const cred of credentials) {
    try {
      let result;
      switch (cred.source) {
        case 'admob':
          result = await admob.collect(userId, cred.credentials);
          break;
        case 'appstore':
          result = await appstore.collect(userId, cred.credentials);
          break;
        case 'googleplay':
          result = await googleplay.collect(userId, cred.credentials);
          break;
        case 'stripe':
          result = await stripe.collect(userId, cred.credentials);
          break;
      }
      results.push({ source: cred.source, status: 'fulfilled' });
    } catch (err) {
      results.push({ source: cred.source, status: 'rejected', error: err.message });
      logger.error(`Collection failed for ${cred.source}:`, err);
    }
  }

  logger.info(`=== Collection complete for user ${userId} in ${Date.now() - start}ms ===`);
  return results;
}

module.exports = { collectForUser, admob, appstore, googleplay, stripe };
