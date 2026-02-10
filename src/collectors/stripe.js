const Stripe = require('stripe');
const { StripeData, CollectionLog } = require('../models');
const logger = require('../utils/logger');

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function startOfDay(dateStr) {
  return Math.floor(new Date(dateStr + 'T00:00:00Z').getTime() / 1000);
}

function endOfDay(dateStr) {
  return Math.floor(new Date(dateStr + 'T23:59:59Z').getTime() / 1000);
}

async function collect(userId, credentials) {
  const start = Date.now();
  const source = 'stripe';

  if (!credentials.secretKey) {
    await CollectionLog.create({ userId, source, status: 'skipped', message: 'Not configured' });
    return;
  }

  try {
    const stripe = new Stripe(credentials.secretKey);
    const dateStr = yesterday();
    const dayStart = startOfDay(dateStr);
    const dayEnd = endOfDay(dateStr);

    let activeSubscriptions = 0, hasMore = true, startingAfter;
    while (hasMore) {
      const subs = await stripe.subscriptions.list({ status: 'active', limit: 100, starting_after: startingAfter });
      activeSubscriptions += subs.data.length;
      hasMore = subs.has_more;
      if (hasMore) startingAfter = subs.data[subs.data.length - 1].id;
    }

    let newSubscriptions = 0;
    hasMore = true; startingAfter = undefined;
    while (hasMore) {
      const subs = await stripe.subscriptions.list({ created: { gte: dayStart, lte: dayEnd }, limit: 100, starting_after: startingAfter });
      newSubscriptions += subs.data.length;
      hasMore = subs.has_more;
      if (hasMore) startingAfter = subs.data[subs.data.length - 1].id;
    }

    let canceledSubscriptions = 0;
    hasMore = true; startingAfter = undefined;
    while (hasMore) {
      const subs = await stripe.subscriptions.list({ status: 'canceled', created: { gte: dayStart, lte: dayEnd }, limit: 100, starting_after: startingAfter });
      canceledSubscriptions += subs.data.length;
      hasMore = subs.has_more;
      if (hasMore) startingAfter = subs.data[subs.data.length - 1].id;
    }

    let successfulPayments = 0, failedPayments = 0, totalRevenue = 0;
    hasMore = true; startingAfter = undefined;
    while (hasMore) {
      const charges = await stripe.charges.list({ created: { gte: dayStart, lte: dayEnd }, limit: 100, starting_after: startingAfter });
      for (const charge of charges.data) {
        if (charge.paid && !charge.refunded) { successfulPayments++; totalRevenue += charge.amount / 100; }
        else if (charge.status === 'failed') failedPayments++;
      }
      hasMore = charges.has_more;
      if (hasMore) startingAfter = charges.data[charges.data.length - 1].id;
    }

    let refundsTotal = 0;
    hasMore = true; startingAfter = undefined;
    while (hasMore) {
      const refunds = await stripe.refunds.list({ created: { gte: dayStart, lte: dayEnd }, limit: 100, starting_after: startingAfter });
      for (const refund of refunds.data) refundsTotal += refund.amount / 100;
      hasMore = refunds.has_more;
      if (hasMore) startingAfter = refunds.data[refunds.data.length - 1].id;
    }

    let mrr = 0;
    hasMore = true; startingAfter = undefined;
    while (hasMore) {
      const subs = await stripe.subscriptions.list({ status: 'active', limit: 100, starting_after: startingAfter });
      for (const sub of subs.data) {
        for (const item of sub.items.data) {
          const amount = item.price?.unit_amount || 0;
          const interval = item.price?.recurring?.interval;
          if (interval === 'month') mrr += amount / 100;
          else if (interval === 'year') mrr += amount / 100 / 12;
          else if (interval === 'week') mrr += (amount / 100) * 4.33;
          else if (interval === 'day') mrr += (amount / 100) * 30;
        }
      }
      hasMore = subs.has_more;
      if (hasMore) startingAfter = subs.data[subs.data.length - 1].id;
    }

    const arr = mrr * 12;
    const totalSubs = activeSubscriptions + canceledSubscriptions;
    const churnRate = totalSubs > 0 ? (canceledSubscriptions / totalSubs) * 100 : 0;

    await StripeData.findOneAndUpdate(
      { userId, date: dateStr },
      { activeSubscriptions, newSubscriptions, canceledSubscriptions, mrr: Math.round(mrr * 100) / 100, arr: Math.round(arr * 100) / 100, totalRevenue: Math.round(totalRevenue * 100) / 100, successfulPayments, failedPayments, refunds: Math.round(refundsTotal * 100) / 100, churnRate: Math.round(churnRate * 100) / 100 },
      { upsert: true }
    );

    const duration = Date.now() - start;
    await CollectionLog.create({ userId, source, status: 'success', message: `Collected Stripe data for ${dateStr}`, recordsCollected: 1, durationMs: duration });
    logger.info(`Stripe: collected data for user ${userId} in ${duration}ms`);
  } catch (err) {
    const duration = Date.now() - start;
    await CollectionLog.create({ userId, source, status: 'error', message: err.message, durationMs: duration });
    logger.error('Stripe collection failed:', err);
  }
}

module.exports = { collect };
