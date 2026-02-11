const logger = require('../utils/logger');

async function testAdmob(credentials) {
  const { google } = require('googleapis');
  const oauth2Client = new google.auth.OAuth2(credentials.clientId, credentials.clientSecret);
  oauth2Client.setCredentials({ refresh_token: credentials.refreshToken });
  try {
    const admob = google.admob({ version: 'v1', auth: oauth2Client });
    const result = await admob.accounts.list();
    const accounts = result.data?.account || [];
    return { success: true, message: `AdMob connection successful${accounts.length ? ' (' + accounts.length + ' account(s) found)' : ''}` };
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('unauthorized_client')) {
      throw new Error('unauthorized_client — The refresh token does not match the Client ID/Secret, or the OAuth Playground redirect URI is missing from your OAuth client settings. See the troubleshooting section above.');
    }
    if (msg.includes('invalid_grant')) {
      throw new Error('invalid_grant — The refresh token has expired or been revoked. Generate a new one from the OAuth Playground.');
    }
    throw err;
  }
}

async function testStripe(credentials) {
  const Stripe = require('stripe');
  const stripe = new Stripe(credentials.secretKey);
  const account = await stripe.account.retrieve();
  return { success: true, message: `Connected to Stripe account: ${account.id}` };
}

async function testAppStore(credentials) {
  const jwt = require('jsonwebtoken');
  const fetch = require('node-fetch');
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    { iss: credentials.issuerId, iat: now, exp: now + 20 * 60, aud: 'appstoreconnect-v1' },
    credentials.privateKey,
    { algorithm: 'ES256', keyid: credentials.keyId }
  );
  const res = await fetch('https://api.appstoreconnect.apple.com/v1/apps?limit=1', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`App Store API returned ${res.status}`);
  return { success: true, message: 'App Store Connect connection successful' };
}

async function testGooglePlay(credentials) {
  const { google } = require('googleapis');
  const parsed = JSON.parse(credentials.serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials: parsed,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  // Validate that the service account credentials are valid by requesting a token
  const client = await auth.getClient();
  await client.getAccessToken();

  // If user has configured apps with Android package names, test access to the first one
  try {
    const { App } = require('../models');
    const apps = await App.find({ androidPackageName: { $ne: null } }).lean();
    if (apps.length > 0) {
      const play = google.androidpublisher({ version: 'v3', auth });
      const pkg = apps[0].androidPackageName;
      try {
        const editRes = await play.edits.insert({ packageName: pkg, requestBody: {} });
        await play.edits.delete({ packageName: pkg, editId: editRes.data.id });
      } catch (e) {
        const msg = e.message || '';
        if (msg.includes('does not have permission') || msg.includes('403') || msg.includes('permission')) {
          throw new Error(`PERMISSION_ERROR: Authentication OK, but the service account does not have permission for "${pkg}". Go to Google Play Console → Settings → API access and grant permissions to your service account.`);
        }
        throw e;
      }
    }
  } catch (e) {
    if (e.message && e.message.startsWith('PERMISSION_ERROR:')) throw e;
    // If we can't check apps (no App model, etc.), just return auth success
  }

  return { success: true, message: `Google Play connection successful (service account: ${parsed.client_email || 'ok'})` };
}

module.exports = { testAdmob, testStripe, testAppStore, testGooglePlay };
