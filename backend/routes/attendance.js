const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../db');
const { authRequired } = require('../middleware/auth');
const { pushNotification } = require('../lib/notifications');
const { evaluateAchievements } = require('../lib/achievements');

const router = express.Router();

const DAY_MS = 86400000;
const STREAK_GRACE_HOURS = 36;

function startOfDay(iso) {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function computeStreakFor(attendance, memberId, now = new Date()) {
  const myAtt = attendance.filter(a => a.memberId === memberId);
  if (myAtt.length === 0) return { current: 0, longest: 0, todayDone: false, justExtended: false };

  const days = new Set(myAtt.map(a => startOfDay(a.checkInAt)));
  const todayStart = startOfDay(now);
  const todayDone = days.has(todayStart);

  const lastDoneAt = Math.max(...myAtt.map(a => new Date(a.checkInAt).getTime()));
  const hoursSinceLast = (now.getTime() - lastDoneAt) / (1000 * 60 * 60);

  let current = 0;
  if (hoursSinceLast > STREAK_GRACE_HOURS && !todayDone) {
    current = 0;
  } else {
    let cursor = todayDone ? todayStart : todayStart - DAY_MS;
    while (cursor > 0 && days.has(cursor)) {
      current++;
      cursor -= DAY_MS;
    }
  }

  const sorted = [...days].sort((a, b) => a - b);
  let longest = sorted.length > 0 ? 1 : 0, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === DAY_MS) { run++; longest = Math.max(longest, run); }
    else run = 1;
  }

  const justExtended = todayDone && days.has(todayStart - DAY_MS);

  return { current, longest, todayDone, justExtended };
}

router.post('/checkin', authRequired, async (req, res) => {
  const targetId = (req.user.role === 'client') ? req.user.id : (req.body.memberId || null);
  if (!targetId) return res.status(400).json({ error: 'memberId is required when called by a coach/owner' });

  const { data: member, error: mErr } = await supabase.from('users').select('*').eq('id', targetId).eq('role', 'client').single();
  if (mErr || !member) return res.status(404).json({ error: 'Member not found' });
  if (req.user.role !== 'super_admin' && member.gymId !== req.user.gymId) {
    return res.status(403).json({ error: 'Member is not in your gym' });
  }

  const { data: openCheckin } = await supabase.from('attendance').select('*').eq('memberId', targetId).is('checkOutAt', null).maybeSingle();
  if (openCheckin) {
    const { data: allAtt } = await supabase.from('attendance').select('checkInAt').eq('memberId', targetId);
    const streak = computeStreakFor(allAtt || [], member.id);
    return res.json({ ...openCheckin, alreadyOpen: true, streak });
  }

  const row = {
    id: 'att_' + uuidv4().slice(0, 8),
    gymId: member.gymId,
    memberId: targetId,
    memberName: member.name,
    checkInAt: new Date().toISOString(),
    checkOutAt: null,
    method: req.body.method || (req.user.role === 'client' ? 'self' : 'manual'),
    note: null,
  };

  const { error: insErr } = await supabase.from('attendance').insert(row);
  if (insErr) return res.status(500).json({ error: insErr.message });

  const { data: allAttAfter } = await supabase.from('attendance').select('checkInAt').eq('memberId', targetId);
  const streak = computeStreakFor(allAttAfter || [], member.id);

  await pushNotification(supabase, {
    gymId: member.gymId,
    userId: member.id,
    kind: streak.justExtended ? 'streak_extended' : 'checkin',
    title: streak.justExtended ? `🔥 ${streak.current} day streak` : 'Checked in',
    body: streak.justExtended
      ? `You're on fire. See you tomorrow?`
      : `Welcome in. Let's get to work.`,
    link: '/dashboard',
  });

  const newAchievements = await evaluateAchievements(supabase, member, row);

  res.json({ ...row, streak, newAchievements });
});

router.post('/checkout', authRequired, async (req, res) => {
  const targetId = (req.user.role === 'client') ? req.user.id : (req.body.memberId || null);
  if (!targetId) return res.status(400).json({ error: 'memberId is required when called by a coach/owner' });

  const { data: member, error: mErr } = await supabase.from('users').select('*').eq('id', targetId).eq('role', 'client').single();
  if (mErr || !member) return res.status(404).json({ error: 'Member not found' });
  if (req.user.role !== 'super_admin' && member.gymId !== req.user.gymId) {
    return res.status(403).json({ error: 'Member is not in your gym' });
  }

  const { data: open, error: oErr } = await supabase.from('attendance').select('*').eq('memberId', targetId).is('checkOutAt', null).maybeSingle();
  if (oErr || !open) return res.status(404).json({ error: 'No open check-in to close' });

  const { data: updated, error: upErr } = await supabase.from('attendance').update({ checkOutAt: new Date().toISOString() }).eq('id', open.id).select().single();
  if (upErr) return res.status(500).json({ error: upErr.message });

  res.json(updated);
});

router.get('/today', authRequired, async (req, res) => {
  const gymId = req.user.gymId;
  const start = startOfDay(new Date());

  const { data: todays, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('gymId', gymId)
    .gte('checkInAt', new Date(start).toISOString())
    .order('checkInAt', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const openCount = todays.filter(a => !a.checkOutAt).length;
  const uniqueMembers = new Set(todays.map(a => a.memberId)).size;

  res.json({
    date: new Date(start).toISOString(),
    count: todays.length,
    uniqueMembers,
    openCount,
    entries: todays,
  });
});

router.get('/member/:memberId', authRequired, async (req, res) => {
  const { data: member, error: mErr } = await supabase.from('users').select('*').eq('id', req.params.memberId).eq('role', 'client').single();
  if (mErr || !member) return res.status(404).json({ error: 'Member not found' });
  if (req.user.role !== 'super_admin' && member.gymId !== req.user.gymId) {
    return res.status(403).json({ error: 'Member is not in your gym' });
  }

  const { data: list, error: lErr } = await supabase.from('attendance').select('*').eq('memberId', member.id).order('checkInAt', { ascending: false });
  if (lErr) return res.status(500).json({ error: lErr.message });

  res.json({ member: { id: member.id, name: member.name }, entries: list, streak: computeStreakFor(list || [], member.id) });
});

router.get('/peak-hours', authRequired, async (req, res) => {
  const gymId = req.user.gymId;
  const cutoff = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const { data: attendance, error } = await supabase.from('attendance').select('checkInAt').eq('gymId', gymId).gte('checkInAt', cutoff);
  if (error) return res.status(500).json({ error: error.message });

  const buckets = new Array(24).fill(0);
  for (const a of attendance) {
    const hour = new Date(a.checkInAt).getHours();
    buckets[hour]++;
  }
  res.json({ buckets, rangeDays: 30 });
});

module.exports = router;
module.exports.computeStreakFor = computeStreakFor;
