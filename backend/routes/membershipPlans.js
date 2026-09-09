// Per-gym membership plans. Each gym creates the plans it sells to members
// (Monthly, 3-month, VIP, Couples, Student, …). Members are subscribed to one
// of these plans; the plan is the source of truth for price + duration.

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/:id/membership-plans', authRequired, async (req, res) => {
  const gymId = req.params.id;
  if (req.user.role !== 'super_admin' && req.user.gymId !== gymId) {
    return res.status(403).json({ error: 'Cross-gym access denied' });
  }

  const { data: plans, error } = await supabase
    .from('membershipPlans')
    .select('*')
    .eq('gymId', gymId)
    .order('priceDT', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Enrich with active subscriber count
  const enriched = await Promise.all(plans.map(async (p) => {
    const { count } = await supabase
      .from('memberSubscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('planId', p.id)
      .in('status', ['active', 'trialing']);
    return { ...p, activeSubscribers: count || 0 };
  }));

  res.json({ plans: enriched });
});

router.post('/:id/membership-plans', authRequired, async (req, res) => {
  const gymId = req.params.id;
  if (req.user.role !== 'owner' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only owners can create plans' });
  }
  if (req.user.role === 'owner' && req.user.gymId !== gymId) {
    return res.status(403).json({ error: 'Not your gym' });
  }

  const { data: gym, error: gErr } = await supabase.from('gyms').select('*').eq('id', gymId).single();
  if (gErr || !gym) return res.status(404).json({ error: 'Gym not found' });

  const { name, durationDays, priceDT, features, accent, popular } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Plan name is required' });
  const dur = Number(durationDays);
  const price = Number(priceDT);
  if (!dur || dur < 1 || dur > 730) return res.status(400).json({ error: 'durationDays must be 1–730' });
  if (Number.isNaN(price) || price < 0) return res.status(400).json({ error: 'priceDT must be ≥ 0' });

  const plan = {
    id: 'pln_' + uuidv4().slice(0, 8),
    gymId,
    name: name.trim(),
    durationDays: dur,
    priceDT: price,
    features: Array.isArray(features) ? features.slice(0, 12).map(f => String(f).trim()).filter(Boolean) : [],
    accent: accent || null,
    popular: !!popular,
    archived: false,
    createdAt: new Date().toISOString(),
  };

  const { error: insErr } = await supabase.from('membershipPlans').insert(plan);
  if (insErr) return res.status(500).json({ error: insErr.message });

  res.json(plan);
});

router.patch('/:id/membership-plans/:planId', authRequired, async (req, res) => {
  const { id: gymId, planId } = req.params;
  if (req.user.role !== 'owner' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only owners can edit plans' });
  }
  if (req.user.role === 'owner' && req.user.gymId !== gymId) {
    return res.status(403).json({ error: 'Not your gym' });
  }

  const { data: plan, error: pErr } = await supabase
    .from('membershipPlans')
    .select('*')
    .eq('id', planId)
    .eq('gymId', gymId)
    .single();

  if (pErr || !plan) return res.status(404).json({ error: 'Plan not found' });

  const { name, durationDays, priceDT, features, accent, popular, archived } = req.body || {};
  const updates = {};

  if (typeof name === 'string' && name.trim()) updates.name = name.trim();
  if (durationDays !== undefined) {
    const d = Number(durationDays);
    if (!d || d < 1 || d > 730) return res.status(400).json({ error: 'durationDays must be 1–730' });
    updates.durationDays = d;
  }
  if (priceDT !== undefined) {
    const p = Number(priceDT);
    if (Number.isNaN(p) || p < 0) return res.status(400).json({ error: 'priceDT must be ≥ 0' });
    updates.priceDT = p;
  }
  if (Array.isArray(features)) updates.features = features.slice(0, 12).map(f => String(f).trim()).filter(Boolean);
  if (accent !== undefined) updates.accent = accent || null;
  if (popular !== undefined) updates.popular = !!popular;
  if (archived !== undefined) updates.archived = !!archived;
  updates.updatedAt = new Date().toISOString();

  const { data: updatedPlan, error: upErr } = await supabase
    .from('membershipPlans')
    .update(updates)
    .eq('id', planId)
    .select()
    .single();

  if (upErr) return res.status(500).json({ error: upErr.message });
  res.json(updatedPlan);
});

router.delete('/:id/membership-plans/:planId', authRequired, async (req, res) => {
  const { id: gymId, planId } = req.params;
  if (req.user.role !== 'owner' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only owners can delete plans' });
  }
  if (req.user.role === 'owner' && req.user.gymId !== gymId) {
    return res.status(403).json({ error: 'Not your gym' });
  }

  const { data: plan, error: pErr } = await supabase
    .from('membershipPlans')
    .select('*')
    .eq('id', planId)
    .eq('gymId', gymId)
    .single();

  if (pErr || !plan) return res.status(404).json({ error: 'Plan not found' });

  const { count } = await supabase
    .from('memberSubscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('planId', planId)
    .in('status', ['active', 'trialing']);

  const activeCount = count || 0;

  if (activeCount > 0) {
    const { error: archErr } = await supabase
      .from('membershipPlans')
      .update({ archived: true, archivedAt: new Date().toISOString() })
      .eq('id', planId);

    if (archErr) return res.status(500).json({ error: archErr.message });
    res.json({ ok: true, archived: true, activeCount });
  } else {
    const { error: delErr } = await supabase.from('membershipPlans').delete().eq('id', planId);
    if (delErr) return res.status(500).json({ error: delErr.message });
    res.json({ ok: true, archived: false, activeCount });
  }
});

module.exports = router;
