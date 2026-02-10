/**
 * Centralized theme configuration.
 * All design tokens, site name, fonts, colors, and locale list.
 */
module.exports = {
  siteName: process.env.SITE_NAME || 'AppRevenue',
  siteUrl: process.env.SITE_URL || 'https://apprevenue.app',

  fonts: {
    display: 'Orbitron',
    body: 'Space Grotesk',
    mono: 'JetBrains Mono',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
  },

  colors: {
    // Landing / glassmorphism
    bgDark: '#050816',
    bgGrid: 'rgba(255,255,255,0.03)',
    neonCyan: '#00f0ff',
    neonPurple: '#a855f7',
    neonPink: '#ec4899',
    glassWhite: 'rgba(255,255,255,0.05)',
    glassBorder: 'rgba(255,255,255,0.1)',
    glassBlur: '16px',
    text: '#e2e8f0',
    textMuted: '#94a3b8',

    // Dashboard (backward compatible)
    dashBg: '#0f172a',
    dashSurface: '#1e293b',
    dashBorder: '#334155',
    dashText: '#e2e8f0',
    dashMuted: '#94a3b8',
    dashAccent: '#3b82f6',
    dashGreen: '#22c55e',
    dashRed: '#ef4444',
    dashOrange: '#f59e0b',
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
    section: '80px',
  },

  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
  },

  locales: ['en', 'fr', 'es', 'zh', 'hi', 'ar', 'pt', 'bn', 'ru', 'ja'],

  rtlLocales: ['ar'],
};
