const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const { User } = require('../models');
const { sendVerificationEmail } = require('../services/email');
const logger = require('../utils/logger');

const router = express.Router();

// GET /register
router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

// POST /register
router.post('/register', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    if (!email || !password) {
      return res.render('register', { error: 'Email and password are required' });
    }
    if (password !== confirmPassword) {
      return res.render('register', { error: 'Passwords do not match' });
    }
    if (password.length < 8) {
      return res.render('register', { error: 'Password must be at least 8 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.render('register', { error: 'An account with this email already exists' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await User.create({
      email: email.toLowerCase().trim(),
      passwordHash: hash,
      verificationToken,
      verificationExpires,
      isVerified: false,
    });

    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (emailErr) {
      logger.error('Failed to send verification email:', emailErr);
    }

    res.render('verify-pending', { email });
  } catch (err) {
    logger.error('Registration error:', err);
    res.render('register', { error: 'Server error, please try again' });
  }
});

// GET /verify-email
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.render('error', { message: 'Invalid verification link' });
    }

    const user = await User.findOne({
      verificationToken: token,
      verificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.render('error', { message: 'Invalid or expired verification link. Please register again.' });
    }

    user.isVerified = true;
    user.verificationToken = null;
    user.verificationExpires = null;
    await user.save();

    res.redirect('/login?verified=1');
  } catch (err) {
    logger.error('Verification error:', err);
    res.render('error', { message: 'Verification failed' });
  }
});

// GET /login
router.get('/login', (req, res) => {
  const verified = req.query.verified === '1';
  res.render('login', { error: null, verified });
});

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase().trim() });

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.render('login', { error: 'Invalid email or password', verified: false });
    }

    if (!user.isVerified) {
      return res.render('login', { error: 'Please verify your email before signing in', verified: false });
    }

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: config.env === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.redirect('/dashboard');
  } catch (err) {
    logger.error('Login error:', err);
    res.render('login', { error: 'Server error', verified: false });
  }
});

// POST /api/login
router.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase().trim() });

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Email not verified' });
    }

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({ token, expiresIn: '24h' });
  } catch (err) {
    logger.error('API login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /logout
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

module.exports = router;
