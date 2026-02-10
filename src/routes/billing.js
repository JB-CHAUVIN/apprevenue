const express = require('express');
const Stripe = require('stripe');
const { requireAuth } = require('../middleware/auth');
const { User } = require('../models');
const config = require('../config');
const logger = require('../utils/logger');

const router = express.Router();

function getStripe() {
  return new Stripe(config.stripe.secretKey);
}

// GET /dashboard/billing
router.get('/dashboard/billing', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    res.render('billing', { user, activePage: 'billing', error: null });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
});

// POST /dashboard/billing/checkout — Create Stripe Checkout Session
router.post('/dashboard/billing/checkout', requireAuth, async (req, res) => {
  try {
    const stripe = getStripe();
    const user = await User.findById(req.user.id);

    // Create or reuse Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: config.stripe.priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${config.appUrl}/dashboard/billing?success=1`,
      cancel_url: `${config.appUrl}/dashboard/billing?canceled=1`,
    });

    res.redirect(303, session.url);
  } catch (err) {
    logger.error('Checkout error:', err);
    const user = await User.findById(req.user.id).lean();
    res.render('billing', { user, activePage: 'billing', error: 'Failed to start checkout' });
  }
});

// POST /dashboard/billing/portal — Stripe Customer Portal
router.post('/dashboard/billing/portal', requireAuth, async (req, res) => {
  try {
    const stripe = getStripe();
    const user = await User.findById(req.user.id).lean();
    if (!user.stripeCustomerId) {
      return res.redirect('/dashboard/billing');
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${config.appUrl}/dashboard/billing`,
    });
    res.redirect(303, session.url);
  } catch (err) {
    logger.error('Portal error:', err);
    res.redirect('/dashboard/billing');
  }
});

module.exports = router;
