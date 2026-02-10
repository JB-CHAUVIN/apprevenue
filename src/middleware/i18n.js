/**
 * i18n middleware — injects t(), locale, isRtl, theme, siteName into res.locals.
 */
const theme = require('../theme');
const { t, getTranslations } = require('../i18n');

function i18nMiddleware(req, res, next) {
  const locale = req.params.lang && theme.locales.includes(req.params.lang)
    ? req.params.lang
    : 'en';

  res.locals.locale = locale;
  res.locals.isRtl = theme.rtlLocales.includes(locale);
  res.locals.theme = theme;
  res.locals.siteName = theme.siteName;
  res.locals.t = (key) => t(locale, key);
  res.locals.i18n = getTranslations(locale);

  next();
}

/**
 * Global theme middleware — injects theme and siteName for dashboard/login pages.
 */
function themeMiddleware(req, res, next) {
  res.locals.theme = theme;
  res.locals.siteName = theme.siteName;
  next();
}

module.exports = { i18nMiddleware, themeMiddleware };
