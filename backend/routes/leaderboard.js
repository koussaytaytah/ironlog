const express = require('express');
const { supabase } = require('../db');
const { authRequired } = require('../middleware/auth');
const { computeStreakFor } = require('./attendance');

const router = express.Router();

const DAY_MS = 86400000;

router.get('/', authRequired, async (req, res) => {
  const period = String(req.query.period || 'week');
  const cutoff = period === 'week' ? (Date.now() - 7 * DAY_MS)
    : period === 'month' ? (Date.now() - 30 * DAY_MS)
    : 0;

  const gymId = req.query.gymId || req.user.gymId;
  if (!gymId) return res.status(400).json({ error: 'gymId is required' });
  if (req.user.role !== 'super_admin' && gymId !== req.user.gymId) {
    return res.status(403).json({ error: 'Cross-gym access denied' });
  }

  const { data: members, error: mErr } = await supabase.from('users').select('*').eq('gymId', gymId).eq('role', 'client');
  if (mErr) return res.status(500).json({ error: mErr.message });

  const { data: allAtt, error: aErr } = await supabase.from('attendance').select('memberId, checkInAt').eq('gymId', gymId);
  if (aErr) return res.status(500).json({ error: aErr.message });

  const rows = members.map(m => {
    const myAtt = allAtt.filter(a => a.memberId === m.id);
    const checkins = cutoff
      ? myAtt.filter(a => new Date(a.checkInAt).getTime() >= cutoff).length
      : myAtt.length;
    const streak = computeStreakFor(allAtt || [], m.id).current;
    return {
      memberId: m.id,
      name: m.name,
      checkins,
      streak,
      initials: m.name.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase(),
    };
  });

  const byCheckins = [...rows].sort((a, b) => b.checkins - a.checkins || b.streak - a.streak);
  byCheckins.forEach((r, i) => { r.checkinRank = i + 1; });
  const byStreak = [...rows].sort((a, b) => b.streak - a.streak || b.checkins - a.checkins);
  byStreak.forEach((r, i) => { r.streakRank = i + 1; });

  const top10 = byCheckins.slice(0, 10);
  const top3ByStreak = byStreak.slice(0, 3);

  const me = req.user.role === 'client'
    ? byCheckins.find(r => r.memberId === req.user.id) || null
    : null;

  const totalCheckins = rows.reduce((s, r) => s + r.checkins, 0);

  res.json({
    period,
    gymId,
    totalMembers: rows.length,
    totalCheckins,
    topByCheckins: top10,
    topByStreak: top3ByStreak,
    me,
    generatedAt: new Date().toISOString(),
  });
});

module.exports = router;
