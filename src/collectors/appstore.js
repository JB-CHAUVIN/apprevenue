const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const { AppStoreData, CollectionLog } = require('../models');
const logger = require('../utils/logger');

const ASC_BASE = 'https://api.appstoreconnect.apple.com/v1';

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

async function collect(userId, credentials) {
  const start = Date.now();
  const source = 'appstore';

  if (!credentials.issuerId || !credentials.keyId || !credentials.privateKey) {
    await CollectionLog.create({ userId, source, status: 'skipped', message: 'Not configured' });
    return;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
      { iss: credentials.issuerId, iat: now, exp: now + 20 * 60, aud: 'appstoreconnect-v1' },
      credentials.privateKey,
      { algorithm: 'ES256', keyid: credentials.keyId }
    );

    async function apiGet(path) {
      const res = await fetch(`${ASC_BASE}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`App Store API ${res.status}: ${await res.text()}`);
      return res.json();
    }

    const dateStr = yesterday();
    let recordCount = 0;

    const appsResponse = await apiGet('/apps?fields[apps]=name,bundleId&limit=50');
    const apps = appsResponse.data || [];

    for (const app of apps) {
      const appId = app.id;
      const appName = app.attributes?.name || appId;
      let latestVersion = null, latestBuild = null, buildStatus = null;

      try {
        const versionsRes = await apiGet(`/apps/${appId}/appStoreVersions?limit=1&sort=-versionString&fields[appStoreVersions]=versionString,appStoreState`);
        const ver = versionsRes.data?.[0];
        if (ver) { latestVersion = ver.attributes?.versionString; buildStatus = ver.attributes?.appStoreState; }
        const buildsRes = await apiGet(`/apps/${appId}/builds?limit=1&sort=-uploadedDate&fields[builds]=version`);
        const build = buildsRes.data?.[0];
        if (build) latestBuild = build.attributes?.version;
      } catch (e) {
        logger.warn(`App Store: failed to get version for ${appId}: ${e.message}`);
      }

      await AppStoreData.findOneAndUpdate(
        { userId, date: dateStr, appId },
        { appName, latestVersion, latestBuild, buildStatus, downloads: 0, updates: 0, proceeds: 0, averageRating: null, totalRatings: 0 },
        { upsert: true }
      );
      recordCount++;
    }

    const duration = Date.now() - start;
    await CollectionLog.create({ userId, source, status: 'success', message: `Collected ${recordCount} apps for ${dateStr}`, recordsCollected: recordCount, durationMs: duration });
    logger.info(`App Store: collected ${recordCount} apps for user ${userId} in ${duration}ms`);
  } catch (err) {
    const duration = Date.now() - start;
    await CollectionLog.create({ userId, source, status: 'error', message: err.message, durationMs: duration });
    logger.error('App Store collection failed:', err);
  }
}

module.exports = { collect };
