require('dotenv').config();
const bcrypt = require('bcryptjs');
const config = require('../config');
const { connectDB, User, App, AdmobRevenue, AppStoreData, GooglePlayData, StripeData } = require('../models');
const logger = require('../utils/logger');

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

async function seed() {
  await connectDB();

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    App.deleteMany({}),
    AdmobRevenue.deleteMany({}),
    AppStoreData.deleteMany({}),
    GooglePlayData.deleteMany({}),
    StripeData.deleteMany({}),
  ]);
  logger.info('Cleared existing data');

  // Create admin user
  const hash = bcrypt.hashSync(config.admin.password, 10);
  const admin = await User.create({
    email: config.admin.email,
    passwordHash: hash,
    isVerified: true,
    displayName: 'Admin',
    plan: 'pro',
  });
  logger.info(`Admin user created: ${admin.email}`);
  const userId = admin._id;

  // Create 3 sample apps
  const app1 = await App.create({ userId, name: 'My iOS App', iosBundleId: 'com.myapp.ios', iosAppId: '1234567890', admobIosAppId: 'ca-app-pub-1234567890~1234567890', stripeProductId: 'prod_ios_001' });
  const app2 = await App.create({ userId, name: 'My Android App', androidPackageName: 'com.myapp.android', admobAndroidAppId: 'ca-app-pub-9876543210~9876543210' });
  const app3 = await App.create({ userId, name: 'My Cross-Platform App', iosBundleId: 'com.myapp.cross', iosAppId: '9999999999', androidPackageName: 'com.myapp.cross', admobIosAppId: 'ca-app-pub-5555555555~5555555555', admobAndroidAppId: 'ca-app-pub-5555555555~6666666666', stripeProductId: 'prod_cross_001' });
  logger.info('Sample apps created');

  // AdMob data (30 days) — App 1
  for (let i = 1; i <= 30; i++) {
    const revenue = +(Math.random() * 50 + 5).toFixed(6);
    const impressions = Math.floor(Math.random() * 20000 + 1000);
    const clicks = Math.floor(impressions * (Math.random() * 0.03));
    await AdmobRevenue.create({ userId, date: daysAgo(i), appId: 'ca-app-pub-1234567890~1234567890', appName: 'My iOS App', country: 'US', estimatedRevenue: revenue, impressions, clicks, ecpm: +((revenue / impressions) * 1000).toFixed(4), appRefId: app1._id });
  }

  // AdMob data (30 days) — App 2
  for (let i = 1; i <= 30; i++) {
    const revenue = +(Math.random() * 30 + 3).toFixed(6);
    const impressions = Math.floor(Math.random() * 15000 + 500);
    const clicks = Math.floor(impressions * (Math.random() * 0.025));
    await AdmobRevenue.create({ userId, date: daysAgo(i), appId: 'ca-app-pub-9876543210~9876543210', appName: 'My Android App', country: 'US', estimatedRevenue: revenue, impressions, clicks, ecpm: +((revenue / impressions) * 1000).toFixed(4), appRefId: app2._id });
  }
  logger.info('AdMob data seeded');

  // App Store data — App 1
  for (let i = 1; i <= 7; i++) {
    await AppStoreData.create({ userId, date: daysAgo(i), appId: '1234567890', appName: 'My iOS App', latestVersion: '2.1.0', latestBuild: '142', buildStatus: 'READY_FOR_SALE', downloads: Math.floor(Math.random() * 200 + 50), proceeds: +(Math.random() * 100 + 10).toFixed(2), averageRating: +(Math.random() * 1.5 + 3.5).toFixed(2), totalRatings: Math.floor(Math.random() * 50 + 100), appRefId: app1._id });
  }

  // App Store data — App 3
  for (let i = 1; i <= 7; i++) {
    await AppStoreData.create({ userId, date: daysAgo(i), appId: '9999999999', appName: 'My Cross-Platform App', latestVersion: '1.5.0', latestBuild: '88', buildStatus: 'READY_FOR_SALE', downloads: Math.floor(Math.random() * 100 + 20), proceeds: +(Math.random() * 50 + 5).toFixed(2), averageRating: +(Math.random() * 1 + 4).toFixed(2), totalRatings: Math.floor(Math.random() * 30 + 50), appRefId: app3._id });
  }
  logger.info('App Store data seeded');

  // Google Play data — App 2
  for (let i = 1; i <= 7; i++) {
    await GooglePlayData.create({ userId, date: daysAgo(i), packageName: 'com.myapp.android', appName: 'My Android App', latestVersionCode: 42, latestVersionName: '2.1.0', track: 'production', releaseStatus: 'completed', totalInstalls: Math.floor(Math.random() * 500 + 1000), activeInstalls: Math.floor(Math.random() * 300 + 800), averageRating: +(Math.random() * 1 + 4).toFixed(2), totalRatings: Math.floor(Math.random() * 100 + 200), appRefId: app2._id });
  }

  // Google Play data — App 3
  for (let i = 1; i <= 7; i++) {
    await GooglePlayData.create({ userId, date: daysAgo(i), packageName: 'com.myapp.cross', appName: 'My Cross-Platform App', latestVersionCode: 30, latestVersionName: '1.5.0', track: 'production', releaseStatus: 'completed', totalInstalls: Math.floor(Math.random() * 300 + 500), activeInstalls: Math.floor(Math.random() * 200 + 400), averageRating: +(Math.random() * 0.8 + 4.2).toFixed(2), totalRatings: Math.floor(Math.random() * 60 + 80), appRefId: app3._id });
  }
  logger.info('Google Play data seeded');

  // Stripe data (30 days) — linked to App 1
  for (let i = 1; i <= 30; i++) {
    const active = Math.floor(Math.random() * 20 + 80);
    const mrr = +(active * 9.99).toFixed(2);
    await StripeData.create({ userId, date: daysAgo(i), activeSubscriptions: active, newSubscriptions: Math.floor(Math.random() * 5), canceledSubscriptions: Math.floor(Math.random() * 3), mrr, arr: +(mrr * 12).toFixed(2), totalRevenue: +(Math.random() * 200 + 50).toFixed(2), successfulPayments: Math.floor(Math.random() * 10 + 1), failedPayments: Math.floor(Math.random() * 2), refunds: +(Math.random() * 20).toFixed(2), churnRate: +(Math.random() * 3).toFixed(2), appRefId: app1._id });
  }
  logger.info('Stripe data seeded');

  logger.info('Seed complete.');
  process.exit(0);
}

seed().catch(err => {
  logger.error('Seed failed:', err);
  process.exit(1);
});
