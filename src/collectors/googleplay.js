const { google } = require('googleapis');
const { GooglePlayData, CollectionLog } = require('../models');
const logger = require('../utils/logger');

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

async function collect(userId, credentials) {
  const start = Date.now();
  const source = 'googleplay';

  const packageNames = (credentials.packageNames || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!credentials.serviceAccountJson || packageNames.length === 0) {
    await CollectionLog.create({ userId, source, status: 'skipped', message: 'Not configured' });
    return;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(credentials.serviceAccountJson),
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const play = google.androidpublisher({ version: 'v3', auth });
    const dateStr = yesterday();
    let recordCount = 0;

    for (const packageName of packageNames) {
      let latestVersionCode = null, latestVersionName = null, track = 'production', releaseStatus = null;

      try {
        const editRes = await play.edits.insert({ packageName, requestBody: {} });
        const editId = editRes.data.id;
        const trackRes = await play.edits.tracks.get({ packageName, editId, track: 'production' });
        const releases = trackRes.data?.releases || [];
        if (releases.length > 0) {
          const latest = releases[0];
          latestVersionName = latest.name || null;
          releaseStatus = latest.status;
          const codes = latest.versionCodes || [];
          latestVersionCode = codes.length > 0 ? parseInt(codes[codes.length - 1], 10) : null;
        }
        await play.edits.delete({ packageName, editId });
      } catch (e) {
        logger.warn(`Google Play: failed to get tracks for ${packageName}: ${e.message}`);
      }

      let averageRating = null, totalRatings = 0;
      try {
        const reviewsRes = await play.reviews.list({ packageName });
        const reviews = reviewsRes.data?.reviews || [];
        if (reviews.length > 0) {
          const ratings = reviews.map(r => r.comments?.[0]?.userComment?.starRating).filter(Boolean);
          totalRatings = ratings.length;
          averageRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
        }
      } catch (e) {
        logger.warn(`Google Play: failed to get reviews for ${packageName}: ${e.message}`);
      }

      await GooglePlayData.findOneAndUpdate(
        { userId, date: dateStr, packageName },
        { appName: packageName, latestVersionCode, latestVersionName, track, releaseStatus, totalInstalls: 0, activeInstalls: 0, activeSubscriptions: 0, revenue: 0, averageRating, totalRatings },
        { upsert: true }
      );
      recordCount++;
    }

    const duration = Date.now() - start;
    await CollectionLog.create({ userId, source, status: 'success', message: `Collected ${recordCount} packages for ${dateStr}`, recordsCollected: recordCount, durationMs: duration });
    logger.info(`Google Play: collected ${recordCount} packages for user ${userId} in ${duration}ms`);
  } catch (err) {
    const duration = Date.now() - start;
    await CollectionLog.create({ userId, source, status: 'error', message: err.message, durationMs: duration });
    logger.error('Google Play collection failed:', err);
  }
}

module.exports = { collect };
