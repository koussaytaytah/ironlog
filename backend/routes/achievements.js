const express = require('express');
const { supabase } = require('../db');
const { authRequired } = require('../middleware/auth');
const { progressFor } = require('../lib/achievements');

const router = express.Router();

router.get('/me', authRequired, async (req, res) => {
  const { data: user, error: uErr } = await supabase.from('users').select('*').eq('id', req.user.id).single();
  if (uErr || !user) return res.status(404).json({ error: 'User not found' });

  const list = await progressFor(supabase, user);
  const unlockedCount = list.filter(a => a.unlocked).length;
  res.json({ achievements: list, unlockedCount, total: list.length });
});

router.get('/:memberId', authRequired, async (req, res) => {
  const { data: member, error: mErr } = await supabase.from('users').select('*').eq('id', req.params.memberId).eq('role', 'client').single();
  if (mErr || !member) return res.status(404).json({ error: 'Member not found' });
  if (req.user.role !== 'super_admin' && member.gymId !== req.user.gymId) {
    return res.status(403).json({ error: 'Cross-gym access denied' });
  }

  const list = await progressFor(supabase, member);
  res.json({ member: { id: member.id, name: member.name }, achievements: list });
});

module.exports = router;
