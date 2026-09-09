const express = require('express');
const { supabase } = require('../db');
const { authRequired } = require('../middleware/auth');
const { listFor } = require('../lib/personalRecords');

const router = express.Router();

router.get('/me', authRequired, async (req, res) => {
  const list = await listFor(supabase, req.user.id);
  res.json({ exercises: list, total: list.length });
});

router.get('/:memberId', authRequired, async (req, res) => {
  const { data: member, error: mErr } = await supabase.from('users').select('*').eq('id', req.params.memberId).eq('role', 'client').single();
  if (mErr || !member) return res.status(404).json({ error: 'Member not found' });
  if (req.user.role !== 'super_admin' && member.gymId !== req.user.gymId) {
    return res.status(403).json({ error: 'Cross-gym access denied' });
  }
  const list = await listFor(supabase, member.id);
  res.json({ member: { id: member.id, name: member.name }, exercises: list });
});

module.exports = router;
