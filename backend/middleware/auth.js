const jwt = require('jsonwebtoken');
const { readDB } = require('../db');
const { isLocked } = require('../lib/subscription');

// In production, set a real secret via the JWT_SECRET environment variable.
const SECRET = process.env.JWT_SECRET || 'ironlog-dev-secret-change-me';

// Decode the JWT payload without throwing. Used by enforceSubscription which
// runs *before* authRequired when mounted as app-level middleware.
function decodePayload(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try { return jwt.verify(token, SECRET); } catch (e) { return null; }
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, SECRET); // { id, role, gymId, orgId }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function superAdminRequired(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Missing token' });
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Super admin only' });
  next();
}

function ownerOrSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Missing token' });
  if (req.user.role === 'super_admin') return next();
  if (req.user.role === 'owner' && req.user.gymId === req.params.id) return next();
  return res.status(403).json({ error: 'Forbidden' });
}

// Blocks owner/trainer/client once their gym's subscription has been locked
// past the grace period. Super admin bypasses always. Unauthenticated requests
// pass through (this lets public endpoints like GET /api/gyms render before login).
// Decodes the JWT itself because it runs BEFORE authRequired when mounted
// at the app level. Returns 402 with status info so the frontend can render
// the paywall.
function enforceSubscription(req, res, next) {
  const user = req.user || decodePayload(req);
  if (!user) return next();
  if (user.role === 'super_admin') return next();
  if (!user.gymId) return next();
  const db = readDB();
  // Check the specific gym the user is accessing
  const gymId = req.params.id || user.gymId;
  const sub = db.subscriptions.find(s => s.gymId === gymId);
  if (isLocked(sub)) {
    return res.status(402).json({
      error: 'Subscription locked — payment required to continue.',
      code: 'subscription_locked',
      paidThrough: sub ? sub.paidThrough : null,
    });
  }
  next();
}

function isStaff(role) {
  return ['owner', 'manager', 'receptionist', 'trainer', 'super_admin'].includes(role);
}

function staffRequired(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Missing token' });
  if (!isStaff(req.user.role)) return res.status(403).json({ error: 'Staff access only' });
  next();
}

module.exports = { authRequired, superAdminRequired, ownerOrSuperAdmin, enforceSubscription, staffRequired, isStaff, SECRET };
