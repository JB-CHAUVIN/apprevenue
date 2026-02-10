/**
 * Landing page route — GET /:lang
 * Mounted LAST in app.js to avoid conflicts with other routes.
 */
const express = require('express');
const theme = require('../theme');
const { i18nMiddleware } = require('../middleware/i18n');

const router = express.Router();

router.get('/:lang', (req, res, next) => {
  // Only handle valid locale slugs
  if (!theme.locales.includes(req.params.lang)) {
    return next();
  }
  next();
}, i18nMiddleware, (req, res) => {
  res.render('landing/index');
});

module.exports = router;
