/**
 * i18n loader — reads JSON translation files and provides a t() helper.
 */
const fs = require('fs');
const path = require('path');
const theme = require('../theme');

const translations = {};

// Load all locale files
for (const locale of theme.locales) {
  const filePath = path.join(__dirname, `${locale}.json`);
  if (fs.existsSync(filePath)) {
    translations[locale] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
}

/**
 * Get a translation value by dot-notation key.
 * Falls back to English, then returns the key itself.
 */
function t(locale, key) {
  const keys = key.split('.');
  let val = translations[locale];
  for (const k of keys) {
    if (val == null) break;
    val = val[k];
  }
  if (val != null) return val;

  // Fallback to English
  if (locale !== 'en') {
    let fallback = translations.en;
    for (const k of keys) {
      if (fallback == null) break;
      fallback = fallback[k];
    }
    if (fallback != null) return fallback;
  }

  return key;
}

function getTranslations(locale) {
  return translations[locale] || translations.en || {};
}

module.exports = { t, getTranslations, translations };
