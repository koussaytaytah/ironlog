// Single source of truth for billing math.
// States: trialing | active | overdue | past_due | frozen | cancelled | expired | locked | unknown
// "locked" = gym can't access anything; "expired" = member's personal sub ran out (different concept).

const { GRACE_DAYS, MONTHLY_PRICE_DT } = require('../db');

const DAY_MS = 24 * 60 * 60 * 1000;

function daysOverdue(sub, now = Date.now()) {
  if (!sub || !sub.paidThrough) return 0;
  const due = new Date(sub.paidThrough).getTime();
  if (now <= due) return 0;
  return Math.ceil((now - due) / DAY_MS);
}

function effectiveStatus(sub, now = Date.now()) {
  if (!sub) return 'unknown';
  if (sub.status === 'suspended') return 'locked';
  if (sub.status === 'cancelled') return 'cancelled';
  if (sub.status === 'frozen') {
    // While frozen, the sub is paused — access may still be allowed if frozenUntil is in the future.
    if (sub.frozenUntil && new Date(sub.frozenUntil).getTime() < now) {
      // Auto-thaw: resume counting toward end date from frozenUntil
      return 'active';
    }
    return 'frozen';
  }
  if (sub.status === 'trialing') {
    if (sub.trialEndsAt && new Date(sub.trialEndsAt).getTime() < now) return 'expired';
    return 'trialing';
  }
  const d = daysOverdue(sub, now);
  if (sub.status === 'active' && d === 0) return 'active';
  if (sub.status === 'active' && d > 0 && d <= GRACE_DAYS) return 'overdue';
  if (d > GRACE_DAYS) return 'locked';
  return sub.status || 'unknown';
}

function isLocked(sub, now = Date.now()) {
  return effectiveStatus(sub, now) === 'locked';
}

function isOverdue(sub, now = Date.now()) {
  return effectiveStatus(sub, now) === 'overdue';
}

function isActive(sub, now = Date.now()) {
  const s = effectiveStatus(sub, now);
  return s === 'active' || s === 'trialing' || s === 'overdue' || s === 'frozen';
}

function trialDaysLeft(sub, now = Date.now()) {
  if (!sub || !sub.trialEndsAt) return 0;
  const ms = new Date(sub.trialEndsAt).getTime() - now;
  return Math.max(0, Math.ceil(ms / DAY_MS));
}

function findSubForGym(db, gymId) {
  return db.subscriptions.find(s => s.gymId === gymId) || null;
}

function summarize(sub, now = Date.now()) {
  if (!sub) {
    return {
      status: 'unknown',
      daysOverdue: 0,
      paidThrough: null,
      amount: 0,
      currency: 'DT',
      trialDaysLeft: 0,
      trialEndsAt: null,
      frozenUntil: null,
    };
  }
  return {
    status: effectiveStatus(sub, now),
    daysOverdue: daysOverdue(sub, now),
    paidThrough: sub.paidThrough,
    amount: sub.amount,
    currency: sub.currency,
    trialDaysLeft: trialDaysLeft(sub, now),
    trialEndsAt: sub.trialEndsAt || null,
    frozenUntil: sub.frozenUntil || null,
  };
}

// Compute end date for a member subscription given start and durationDays
function computeEndDate(startAt, durationDays) {
  const d = new Date(startAt);
  d.setDate(d.getDate() + Number(durationDays || 30));
  return d.toISOString();
}

// Reconcile all subscriptions in the DB against the live clock.
// Writes back any state transitions so the persisted status matches what
// effectiveStatus() returns. Returns true if anything changed.
function reconcileAll(db, now = Date.now()) {
  let dirty = false;
  for (const sub of db.subscriptions) {
    const live = effectiveStatus(sub, now);
    if (live === 'unknown') continue;
    // Persisted 'status' lags behind the live status — sync it.
    if (sub.status !== live && !['locked', 'overdue', 'past_due'].includes(sub.status)) {
      // Don't downgrade persisted locked/overdue states — only escalate forward.
      if (live === 'active' && (sub.status === 'frozen' && (!sub.frozenUntil || new Date(sub.frozenUntil).getTime() < now))) {
        sub.status = 'active';
        sub.unfrozenAt = new Date(now).toISOString();
        dirty = true;
      }
    }
  }
  return dirty;
}

module.exports = {
  GRACE_DAYS,
  MONTHLY_PRICE_DT,
  DAY_MS,
  daysOverdue,
  effectiveStatus,
  isLocked,
  isOverdue,
  isActive,
  trialDaysLeft,
  findSubForGym,
  summarize,
  computeEndDate,
  reconcileAll,
};
