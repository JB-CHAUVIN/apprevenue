const express = require('express');
const Stripe = require('stripe');
const config = require('../config');
const { User } = require('../models');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = new Stripe(config.stripe.secretKey);
  let event;

  try {
    if (config.stripe.webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.stripe.webhookSecret);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    logger.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const user = await User.findOne({ stripeCustomerId: session.customer });
        if (user) {
          user.plan = 'pro';
          user.stripeSubscriptionId = session.subscription;
          await user.save();
          logger.info(`User ${user.email} upgraded to Pro`);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const user = await User.findOne({ stripeCustomerId: subscription.customer });
        if (user) {
          user.plan = 'free';
          user.stripeSubscriptionId = null;
          await user.save();
          logger.info(`User ${user.email} downgraded to Free`);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        logger.warn(`Payment failed for customer ${invoice.customer}`);
        break;
      }
    }
  } catch (err) {
    logger.error('Webhook processing error:', err);
  }

  res.json({ received: true });
});

module.exports = router;
