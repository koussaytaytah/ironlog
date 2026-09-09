// Tiny audit log writer + reader.
// Pushed by routes that perform sensitive mutations so super-admins (and the gym
// owner, scoped to their gym) can review who did what.

const { v4: uuidv4 } = require('uuid');

function log(db, { actor, action, target, meta }) {
  if (!Array.isArray(db.auditLog)) db.auditLog = [];
  db.auditLog.push({
    id: 'aud_' + uuidv4().slice(0, 8),
    actorId: actor ? actor.id : null,
    actorName: actor ? actor.name : null,
    actorRole: actor ? actor.role : null,
    gymId: actor ? actor.gymId : null,
    action,
    target: target || null,
    meta: meta || null,
    at: new Date().toISOString(),
  });
}

// Read recent log entries. Super-admin sees everything; everyone else is scoped
// to their own gym. Optional filters: actorId, action, sinceISO, untilISO.
function list(db, scope, filters = {}) {
  let rows = db.auditLog || [];
  if (scope.role !== 'super_admin') {
    rows = rows.filter(r => r.gymId && r.gymId === scope.gymId);
  }
  if (filters.actorId) rows = rows.filter(r => r.actorId === filters.actorId);
  if (filters.action) rows = rows.filter(r => r.action === filters.action);
  if (filters.sinceISO) rows = rows.filter(r => r.at >= filters.sinceISO);
  if (filters.untilISO) rows = rows.filter(r => r.at <= filters.untilISO);
  // Newest first, cap at 200.
  return rows.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200);
}

module.exports = { log, list };
