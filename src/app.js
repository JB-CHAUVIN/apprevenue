require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { connectDB, User } = require('./models');
const logger = require('./utils/logger');
const bcrypt = require('bcryptjs');

// Middleware
const { themeMiddleware } = require('./middleware/i18n');

// Routes
const seoRoutes = require('./routes/seo');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const apiRoutes = require('./routes/api');
const settingsRoutes = require('./routes/settings');
const billingRoutes = require('./routes/billing');
const webhookRoutes = require('./routes/webhooks');
const landingRoutes = require('./routes/landing');

// Cron
const { startCron } = require('./cron');

const app = express();

// Stripe webhooks need raw body — mount BEFORE express.json()
app.use('/webhooks/stripe', webhookRoutes);

// Global middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('short', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Theme middleware global
app.use(themeMiddleware);

// Views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// SEO routes
app.use('/', seoRoutes);

// Auth routes (/login, /logout, /register, /verify-email)
app.use('/', authRoutes);

// Dashboard routes
app.use('/', dashboardRoutes);

// Settings routes
app.use('/', settingsRoutes);

// Billing routes
app.use('/', billingRoutes);

// API routes
app.use('/api', apiRoutes);

// Root redirect
app.get('/', (req, res) => res.redirect('/en'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Landing routes (/:lang) — LAST (greedy pattern)
app.use('/', landingRoutes);

// 404
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found' });
});

// Error handler
app.use((err, req, res, _next) => {
  logger.error('Unhandled error:', err);
  res.status(500).render('error', { message: 'Internal server error' });
});

// Start
async function start() {
  try {
    await connectDB();

    // Ensure admin user exists
    const existing = await User.findOne({ email: config.admin.email });
    if (!existing) {
      const hash = bcrypt.hashSync(config.admin.password, 10);
      await User.create({ email: config.admin.email, passwordHash: hash, isVerified: true });
      logger.info(`Admin user created: ${config.admin.email}`);
    }

    startCron();

    app.listen(config.port, () => {
      logger.info(`${require('./theme').siteName} running at http://localhost:${config.port}`);
      logger.info(`Landing: http://localhost:${config.port}/en`);
      logger.info(`Dashboard: http://localhost:${config.port}/dashboard`);
    });
  } catch (err) {
    logger.error('Startup failed:', err);
    process.exit(1);
  }
}

start();

module.exports = app;
