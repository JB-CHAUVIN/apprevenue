const cron = require('node-cron');
const config = require('./config');
const { collectForUser } = require('./collectors');
const { User, UserCredential } = require('./models');
const logger = require('./utils/logger');

function startCron() {
  // Run every hour
  logger.info(`Scheduling collection cron: ${config.cron.schedule}`);

  cron.schedule(config.cron.schedule, async () => {
    logger.info('Cron triggered: starting per-user collection');
    try {
      const users = await User.find({ isVerified: true }).lean();
      for (const user of users) {
        const hasCredentials = await UserCredential.countDocuments({ userId: user._id, isConfigured: true });
        if (hasCredentials === 0) continue;

        const now = new Date();
        if (user.plan === 'pro') {
          // Pro: collect every hour
          await collectForUser(user._id.toString());
          await User.findByIdAndUpdate(user._id, { lastCollectionAt: now });
        } else {
          // Free: collect once per 24h
          const lastCollection = user.lastCollectionAt ? new Date(user.lastCollectionAt) : new Date(0);
          const hoursSince = (now - lastCollection) / (1000 * 60 * 60);
          if (hoursSince >= 24) {
            await collectForUser(user._id.toString());
            await User.findByIdAndUpdate(user._id, { lastCollectionAt: now });
          }
        }
      }
    } catch (err) {
      logger.error('Cron collection error:', err);
    }
  });

  logger.info('Cron scheduler started');
}

if (process.argv.includes('--once')) {
  require('dotenv').config();
  const { connectDB } = require('./models');
  (async () => {
    await connectDB();
    logger.info('Running one-time collection for all users...');
    const users = await User.find({ isVerified: true }).lean();
    for (const user of users) {
      await collectForUser(user._id.toString());
    }
    logger.info('Done.');
    process.exit(0);
  })();
}

module.exports = { startCron };
