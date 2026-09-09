const express = require('express');
const { supabase } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/', authRequired, async (req, res) => {
  if (!['super_admin', 'owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Coaches and members do not have an audit feed' });
  }

  let query = supabase.from('auditLog').select('*');

  if (req.user.role !== 'super_admin') {
    query = query.eq('gymId', req.user.gymId);
  }

  if (req.query.actorId) query = query.eq('actorId', req.query.actorId);
  if (req.query.action) query = query.eq('action', req.query.action);
  if (req.query.since) query = query.gte('at', req.query.since);
  if (req.query.until) query = query.lte('at', req.query.until);

  const { data: rows, error } = await query.order('at', { ascending: false }).limit(200);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ entries: rows, total: rows.length });
});

module.exports = router;
