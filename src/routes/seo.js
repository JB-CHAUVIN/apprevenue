/**
 * SEO routes: robots.txt, sitemap.xml, llms.txt
 */
const express = require('express');
const theme = require('../theme');

const router = express.Router();

// GET /robots.txt
router.get('/robots.txt', (req, res) => {
  const siteUrl = theme.siteUrl;
  res.type('text/plain').send(
`User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`);
});

// GET /sitemap.xml — auto-generated from locales
router.get('/sitemap.xml', (req, res) => {
  const siteUrl = theme.siteUrl;
  const now = new Date().toISOString().split('T')[0];

  let urls = '';

  // Landing pages for each locale
  for (const locale of theme.locales) {
    const priority = locale === 'en' ? '1.0' : '0.8';
    urls += `  <url>
    <loc>${siteUrl}/${locale}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
${theme.locales.map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${siteUrl}/${l}" />`).join('\n')}
  </url>\n`;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}</urlset>`;

  res.type('application/xml').send(xml);
});

// GET /llms.txt — AI crawler description
router.get('/llms.txt', (req, res) => {
  res.type('text/plain').send(
`# ${theme.siteName}

> ${theme.siteName} is a free, open-source unified revenue tracking dashboard for mobile app developers.

## What it does
- Aggregates revenue data from AdMob, App Store Connect, Google Play Console, and Stripe
- Provides real-time analytics with charts and KPI cards
- Supports daily automated data collection via cron jobs
- Offers CSV and JSON data export with a full REST API
- Self-hosted on your own infrastructure for complete data privacy

## Tech stack
- Backend: Node.js, Express, Sequelize ORM, SQLite
- Frontend: EJS templates, Chart.js
- Authentication: JWT with bcrypt password hashing

## Supported languages
${theme.locales.map(l => `- ${l}`).join('\n')}

## Links
- Website: ${theme.siteUrl}
- Login: ${theme.siteUrl}/login
`);
});

module.exports = router;
