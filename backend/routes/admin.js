const express = require('express');
const { supabase, MONTHLY_PRICE_DT } = require('../db');
const { authRequired, superAdminRequired } = require('../middleware/auth');
const { summarize, effectiveStatus, summarize: summarizeSub } = require('../lib/subscription');

const router = express.Router();
const strip = ({ passwordHash, ...rest }) => rest;

router.use(authRequired, superAdminRequired);

async function runRenewalCheck() {
  const now = new Date().toISOString();
  await supabase
    .from('subscriptions')
    .update({ status: 'active', unfrozenAt: now })
    .eq('status', 'frozen')
    .lt('frozenUntil', now);
}

// Platform-wide stats
router.get('/stats', async (req, res) => {
  await runRenewalCheck();

  const { data: gyms = [], error: gErr } = await supabase.from('gyms').select('*');
  if (gErr) return res.status(500).json({ error: gErr.message });

  const { data: users = [], error: uErr } = await supabase.from('users').select('*');
  if (uErr) return res.status(500).json({ error: uErr.message });

  const { data: programs = [], error: pErr } = await supabase.from('programs').select('gymId');
  if (pErr) return res.status(500).json({ error: pErr.message });

  const gymStats = gyms.map(g => {
    const trainers = users.filter(u => u.gymId === g.id && u.role === 'trainer').length;
    const clients = users.filter(u => u.gymId === g.id && u.role === 'client').length;
    const progCount = programs.filter(p => p.gymId === g.id).length;
    return { ...strip(g), trainers, clients, programs: progCount };
  });

  const now = Date.now();
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const newGymsThisMonth = gyms.filter(g => new Date(g.createdAt).getTime() >= monthAgo).length;
  const newUsersThisMonth = users.filter(u => new Date(u.createdAt).getTime() >= monthAgo).length;
  const totalUsers = users.length;
  const totalTrainers = users.filter(u => u.role === 'trainer').length;
  const totalClients = users.filter(u => u.role === 'client').length;

  const { data: subs = [] } = await supabase.from('subscriptions').select('*');
  const activeGyms = subs.filter(s => effectiveStatus(s) === 'active').length;
  const monthlyRecurringDT = activeGyms * MONTHLY_PRICE_DT;

  const { data: payments = [] } = await supabase.from('payments').select('status');
  const pendingPayments = payments.filter(p => p.status === 'pending').length;

  res.json({
    gyms: { count: gyms.length, list: gymStats, newThisMonth: newGymsThisMonth },
    users: { total: totalUsers, trainers: totalTrainers, clients: totalClients, newThisMonth: newUsersThisMonth },
    revenue: { monthlyDT: monthlyRecurringDT, pricePerGymDT: MONTHLY_PRICE_DT, activeGyms },
    programs: programs.length,
    assignments: 0, // would need to fetch assignments count
    payments: { pending: pendingPayments },
  });
});

// Every subscription with its computed effective status, for the admin table.
router.get('/subscriptions', async (req, res) => {
  await runRenewalCheck();

  const { data: gyms = [] } = await supabase.from('gyms').select('*');
  const { data: users = [] } = await supabase.from('users').select('*');
  const { data: subs = [] } = await supabase.from('subscriptions').select('*');

  const out = gyms.map(g => {
    const sub = subs.find(s => s.gymId === g.id);
    const owner = users.find(u => u.id === g.ownerId);
    const summary = summarizeSub(sub);
    return {
      gymId: g.id,
      gymName: g.name,
      location: g.location || null,
      logo: g.logo || null,
      ownerEmail: owner ? owner.email : null,
      ownerName: owner ? owner.name : null,
      createdAt: g.createdAt,
      suspended: !!g.suspended,
      ...summary,
    };
  });
  res.json(out);
});

// Revenue: MRR, YTD, pending amount, overdue gym count, last 30 days approved payments.
router.get('/revenue', async (req, res) => {
  await runRenewalCheck();

  const { data: payments = [] } = await supabase.from('payments').select('*');
  const { data: subs = [] } = await supabase.from('subscriptions').select('*');
  const { data: gyms = [] } = await supabase.from('gyms').select('id, name');

  const approved = payments.filter(p => p.status === 'approved');
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const ytdTotal = approved
    .filter(p => p.reviewedAt >= startOfYear)
    .reduce((s, p) => s + (p.amount || 0), 0);

  const pendingAmount = payments
    .filter(p => p.status === 'pending')
    .reduce((s, p) => s + (p.amount || 0), 0);

  const overdueGyms = subs
    .filter(s => effectiveStatus(s) === 'overdue')
    .map(s => {
      const gym = gyms.find(g => g.id === s.gymId);
      return gym ? { gymId: gym.id, gymName: gym.name, daysOverdue: summarizeSub(s).daysOverdue } : null;
    })
    .filter(Boolean);

  const buckets = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = 0;
  }
  approved
    .filter(p => p.reviewedAt >= monthAgo)
    .forEach(p => {
      const key = (p.reviewedAt || '').slice(0, 10);
      if (key in buckets) buckets[key] += p.amount || 0;
    });
  const last30Days = Object.entries(buckets).map(([date, amount]) => ({ date, amount }));

  const activeGyms = subs.filter(s => effectiveStatus(s) === 'active').length;
  const mrr = activeGyms * MONTHLY_PRICE_DT;

  res.json({
    mrr,
    ytd: ytdTotal,
    pendingAmount,
    pendingCount: payments.filter(p => p.status === 'pending').length,
    overdueCount: overdueGyms.length,
    overdueGyms,
    activeGyms,
    pricePerGymDT: MONTHLY_PRICE_DT,
    last30Days,
  });
});

// All users (gym filter optional)
router.get('/users', async (req, res) => {
  await runRenewalCheck();

  const { gymId, role } = req.query;
  let query = supabase.from('users').select('*');

  if (gymId) query = query.eq('gymId', gymId);
  if (role) query = query.eq('role', role);

  const { data: users = [], error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const { data: gyms = [] } = await supabase.from('gyms').select('id, name');

  const out = users.map(u => {
    const gym = gyms.find(g => g.id === u.gymId);
    return { ...strip(u), gymName: gym ? gym.name : null };
  });
  res.json(out);
});

// Suspend / unsuspend a gym (flag only — doesn't delete data)
router.post('/gyms/:id/suspend', async (req, res) => {
  const { data: gym, error } = await supabase
    .from('gyms')
    .select('suspended')
    .eq('id', req.params.id)
    .single();

  if (error || !gym) return res.status(404).json({ error: 'Gym not found' });

  const newSuspended = !gym.suspended;
  const { error: upErr } = await supabase
    .from('gyms')
    .update({ suspended: newSuspended })
    .eq('id', req.params.id);

  if (upErr) return res.status(500).json({ error: upErr.message });
  res.json({ id: req.params.id, suspended: newSuspended });
});

module.exports = router;
