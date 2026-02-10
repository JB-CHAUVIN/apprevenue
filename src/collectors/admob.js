const { google } = require('googleapis');
const { AdmobRevenue, CollectionLog } = require('../models');
const logger = require('../utils/logger');

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

async function collect(userId, credentials) {
  const start = Date.now();
  const source = 'admob';

  if (!credentials.clientId || !credentials.publisherId) {
    await CollectionLog.create({ userId, source, status: 'skipped', message: 'Not configured' });
    return;
  }

  try {
    const oauth2Client = new google.auth.OAuth2(credentials.clientId, credentials.clientSecret);
    oauth2Client.setCredentials({ refresh_token: credentials.refreshToken });
    const admob = google.admob({ version: 'v1', auth: oauth2Client });
    const dateStr = yesterday();
    const [year, month, day] = dateStr.split('-').map(Number);

    const response = await admob.accounts.networkReport.generate({
      parent: `accounts/${credentials.publisherId}`,
      requestBody: {
        reportSpec: {
          dateRange: {
            startDate: { year, month, day },
            endDate: { year, month, day },
          },
          dimensions: ['APP', 'COUNTRY'],
          metrics: ['ESTIMATED_EARNINGS', 'IMPRESSIONS', 'CLICKS', 'AD_REQUESTS'],
          sortConditions: [{ dimension: null, metric: 'ESTIMATED_EARNINGS', order: 'DESCENDING' }],
        },
      },
    });

    const rows = response.data || [];
    let recordCount = 0;

    for (const item of rows) {
      if (!item.row) continue;
      const row = item.row;
      const appId = row.dimensionValues?.APP?.value || 'unknown';
      const appName = row.dimensionValues?.APP?.displayLabel || appId;
      const country = row.dimensionValues?.COUNTRY?.value || 'XX';
      const earnings = row.metricValues?.ESTIMATED_EARNINGS?.microsValue;
      const impressions = row.metricValues?.IMPRESSIONS?.integerValue;
      const clicks = row.metricValues?.CLICKS?.integerValue;
      const revenueUsd = earnings ? parseInt(earnings, 10) / 1_000_000 : 0;
      const imp = impressions ? parseInt(impressions, 10) : 0;
      const clk = clicks ? parseInt(clicks, 10) : 0;
      const ecpm = imp > 0 ? (revenueUsd / imp) * 1000 : 0;

      await AdmobRevenue.findOneAndUpdate(
        { userId, date: dateStr, appId, country },
        { appName, estimatedRevenue: revenueUsd, impressions: imp, clicks: clk, ecpm, currency: 'USD' },
        { upsert: true }
      );
      recordCount++;
    }

    const duration = Date.now() - start;
    await CollectionLog.create({ userId, source, status: 'success', message: `Collected ${recordCount} rows for ${dateStr}`, recordsCollected: recordCount, durationMs: duration });
    logger.info(`AdMob: collected ${recordCount} rows for user ${userId} in ${duration}ms`);
  } catch (err) {
    const duration = Date.now() - start;
    await CollectionLog.create({ userId, source, status: 'error', message: err.message, durationMs: duration });
    logger.error('AdMob collection failed:', err);
  }
}

module.exports = { collect };
