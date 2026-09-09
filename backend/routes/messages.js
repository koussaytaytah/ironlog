const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/', authRequired, async (req, res) => {
  const { toId, text } = req.body;
  if (!toId || !text || !text.trim()) return res.status(400).json({ error: 'toId and text are required' });

  const { data: toUser, error: uErr } = await supabase.from('users').select('*').eq('id', toId).single();
  if (uErr || !toUser) return res.status(404).json({ error: 'Recipient not found' });

  // Cross-tenant guard: super_admin bypasses; everyone else can only message users in their own gym
  if (req.user.role !== 'super_admin') {
    if (toUser.gymId !== req.user.gymId) {
      return res.status(403).json({ error: 'You can only message users in your own gym' });
    }
  }

  const msg = {
    id: 'msg_' + uuidv4().slice(0, 8),
    fromId: req.user.id,
    toId,
    text: text.trim(),
    timestamp: new Date().toISOString(),
    read: false
  };

  const { error: insErr } = await supabase.from('messages').insert(msg);
  if (insErr) return res.status(500).json({ error: insErr.message });

  res.json(msg);
});

// Full thread between the logged-in user and one other user
router.get('/with/:userId', authRequired, async (req, res) => {
  const userId = req.params.userId;
  const { data: thread, error } = await supabase
    .from('messages')
    .select('*')
    .or(`(fromId.eq.${req.user.id},toId.eq.${req.user.id})`)
    .or(`(fromId.eq.${userId},toId.eq.${userId})`)
    .order('timestamp', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // The above .or filters might be slightly wrong for "between these two people".
  // Correct logic: (from=me AND to=them) OR (from=them AND to=me)
  // Supabase .or() for complex AND/OR can be tricky. Let's refine.

  // Better approach: get all messages involving either, then filter in JS if needed,
  // or use a more precise query.

  // Let's refine the query to strictly between these two:
  const { data: threadFiltered, error: filterErr } = await supabase
    .from('messages')
    .select('*')
    .or(`and(fromId.eq.${req.user.id},toId.eq.${userId}),and(fromId.eq.${userId},toId.eq.${req.user.id})`)
    .order('timestamp', { ascending: true });

  if (filterErr) return res.status(500).json({ error: filterErr.message });
  res.json(threadFiltered || []);
});

router.get('/unread-count', authRequired, async (req, res) => {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('toId', req.user.id)
    .eq('read', false);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ count: count || 0 });
});

module.exports = router;
