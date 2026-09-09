const express = require('express');
const { supabase } = require('../db');
const { authRequired, superAdminRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  const { data: plans, error } = await supabase.from('platformPlans').select('*');
  if (error) return res.status(500).json({ error: error.message });

  const result = plans.map(p => {
    const { isDefault, ...rest } = p;
    return rest;
  });
  res.json({ plans: result });
});

router.post('/', authRequired, superAdminRequired, async (req, res) => {
  const { tier, name, priceDT, maxMembers, maxTrainers, features } = req.body || {};
  if (!['starter', 'pro', 'business'].includes(tier)) {
    return res.status(400).json({ error: 'tier must be starter, pro, or business' });
  }
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const price = Number(priceDT);
  const members = Number(maxMembers);
  const trainers = Number(maxTrainers);
  if (Number.isNaN(price) || price < 0) return res.status(400).json({ error: 'priceDT must be ≥ 0' });
  if (Number.isNaN(members) || members < 1) return res.status(400).json({ error: 'maxMembers must be ≥ 1' });
  if (Number.isNaN(trainers) || trainers < 1) return res.status(400).json({ error: 'maxTrainers must be ≥ 1' });

  const { data: existing } = await supabase.from('platformPlans').select('id').eq('tier', tier).maybeSingle();
  if (existing) {
    return res.status(409).json({ error: `A ${tier} plan already exists. Use PATCH to update it.` });
  }

  const plan = {
    id: 'pp_' + tier + '_' + Math.random().toString(36).slice(2, 8),
    tier, name: name.trim(), priceDT: price, maxMembers: members, maxTrainers: trainers,
    features: Array.isArray(features) ? features.slice(0, 16).map(f => String(f).trim()).filter(Boolean) : [],
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { error: insErr } = await supabase.from('platformPlans').insert(plan);
  if (insErr) return res.status(500).json({ error: insErr.message });

  res.json(plan);
});

router.patch('/:id', authRequired, superAdminRequired, async (req, res) => {
  const { name, priceDT, maxMembers, maxTrainers, features } = req.body || {};
  const updates = {};

  if (typeof name === 'string' && name.trim()) updates.name = name.trim();
  if (priceDT !== undefined) {
    const p = Number(priceDT);
    if (Number.isNaN(p) || p < 0) return res.status(400).json({ error: 'priceDT must be ≥ 0' });
    updates.priceDT = p;
  }
  if (maxMembers !== undefined) {
    const m = Number(maxMembers);
    if (Number.isNaN(m) || m < 1) return res.status(400).json({ error: 'maxMembers must be ≥ 1' });
    updates.maxMembers = m;
  }
  if (maxTrainers !== undefined) {
    const t = Number(maxTrainers);
    if (Number.isNaN(t) || t < 1) return res.status(400).json({ error: 'maxTrainers must be ≥ 1' });
    updates.maxTrainers = t;
  }
  if (Array.isArray(features)) updates.features = features.slice(0, 16).map(f => String(f).trim()).filter(Boolean);
  updates.updatedAt = new Date().toISOString();

  const { data: plan, error: upErr } = await supabase.from('platformPlans').update(updates).eq('id', req.params.id).select().single();
  if (upErr || !plan) return res.status(404).json({ error: 'Plan not found' });

  res.json(plan);
});

router.delete('/:id', authRequired, superAdminRequired, async (req, res) => {
  const { error } = await supabase.from('platformPlans').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
