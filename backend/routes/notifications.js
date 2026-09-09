const express = require('express');
const { supabase } = require('../db');
const { authRequired } = require('../middleware/auth');
const { runDailyDigests } = require('../lib/digests');

const router = express.Router();

router.get('/', authRequired, async (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 30);
  const unreadOnly = req.query.unread === '1';

  const { data: items, error: iErr } = await supabase
    .from('notifications')
    .select('*')
    .eq('userId', req.user.id)
    .order('createdAt', { ascending: false })
    .range(0, limit - 1);

  if (iErr) return res.status(500).json({ error: iErr.message });

  const filteredItems = unreadOnly ? items.filter(n => !n.read) : items;

  const { count: unread, error: uErr } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('userId', req.user.id)
    .eq('read', 0);

  if (uErr) return res.status(500).json({ error: uErr.message });

  res.json({
    items: filteredItems,
    unread: unread || 0,
  });
});

router.post('/refresh-digests', authRequired, async (req, res) => {
  if (!['owner', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only owners can run digests' });
  }

  const counts = await runDailyDigests(supabase, new Date());
  res.json({ ok: true, counts });
});

router.post('/:id/read', authRequired, async (req, res) => {
  const { data: n, error } = await supabase
    .from('notifications')
    .update({ read: 1 })
    .eq('id', req.params.id)
    .eq('userId', req.user.id)
    .select()
    .single();

  if (error || !n) return res.status(404).json({ error: 'Not found' });
  res.json(n);
});

router.post('/read-all', authRequired, async (req, res) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: 1 })
    .eq('userId', req.user.id)
    .eq('read', 0);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, unread: 0 });
});

module.exports = router;
