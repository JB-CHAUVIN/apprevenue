const logger = require('../utils/logger');

async function testAdmob(credentials) {
  const { google } = require('googleapis');
  const oauth2Client = new google.auth.OAuth2(credentials.clientId, credentials.clientSecret);
  oauth2Client.setCredentials({ refresh_token: credentials.refreshToken });
  const admob = google.admob({ version: 'v1', auth: oauth2Client });
  await admob.accounts.list();
  return { success: true, message: 'AdMob connection successful' };
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
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials.serviceAccountJson),
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const play = google.androidpublisher({ version: 'v3', auth });
  // Try to list reviews for the first package
  if (credentials.packageNames) {
    const pkg = credentials.packageNames.split(',')[0].trim();
    if (pkg) {
      await play.reviews.list({ packageName: pkg });
    }
  }
  return { success: true, message: 'Google Play connection successful' };
}

module.exports = { testAdmob, testStripe, testAppStore, testGooglePlay };
