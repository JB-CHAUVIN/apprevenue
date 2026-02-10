const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');

async function requireAuth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    if (req.headers.accept?.includes('text/html')) {
      return res.redirect('/login');
    }
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.id).lean();
    if (!user) {
      if (req.headers.accept?.includes('text/html')) {
        return res.redirect('/login');
      }
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = { id: user._id.toString(), email: user.email, plan: user.plan, displayName: user.displayName };
    next();
  } catch (err) {
    if (req.headers.accept?.includes('text/html')) {
      return res.redirect('/login');
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
