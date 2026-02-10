const mongoose = require('mongoose');
const logger = require('../utils/logger');

const User = require('./User');
const App = require('./App');
const AdmobRevenue = require('./AdmobRevenue');
const AppStoreData = require('./AppStoreData');
const GooglePlayData = require('./GooglePlayData');
const StripeData = require('./StripeData');
const CollectionLog = require('./CollectionLog');
const UserCredential = require('./UserCredential');

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/apprevenue';
  try {
    await mongoose.connect(uri);
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('MongoDB connection failed:', err);
    throw err;
  }
}

module.exports = {
  connectDB,
  mongoose,
  User,
  App,
  AdmobRevenue,
  AppStoreData,
  GooglePlayData,
  StripeData,
  CollectionLog,
  UserCredential,
};
