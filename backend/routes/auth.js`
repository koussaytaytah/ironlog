const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../db');
const { normalizePhone } = require('../lib/whatsapp');
const { authRequired, SECRET } = require('../middleware/auth');

const router = express.Router();
const strip = ({ passwordHash, ...rest }) => rest;

// Sign up as owner (creates a gym), coach, or member (joins an existing gym)
router.post('/signup', async (req, res) => {
  const { name, email, password, role, gymName, gymId, trainerId, phone } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password and role are required' });
  }
  if (!['owner', 'trainer', 'client'].includes(role)) {
    return res.status(400).json({ error: 'role must be owner, trainer or client' });
  }

  const { data: existingUser } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).single();
  if (existingUser) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const normalizedPhone = phone ? normalizePhone(phone) : null;
  let user;

  if (role === 'owner') {
    if (!gymName || !gymName.trim()) return res.status(400).json({ error: 'gymName is required for owners' });
    const orgId = 'org_' + uuidv4().slice(0, 8);
    const userId = 'usr_' + uuidv4().slice(0, 8);
    const gymId = 'gym_' + uuidv4().slice(0, 8);

    const org = { id: orgId, name: gymName.trim(), ownerId: userId, createdAt: new Date().toISOString() };
    const gym = { id: gymId, orgId, name: gymName.trim(), createdAt: new Date().toISOString(), ownerId: userId };
    user = {
      id: userId, name, email: email.toLowerCase(), passwordHash,
      role: 'owner', gymId: gymId, orgId, phone: normalizedPhone, createdAt: new Date().toISOString()
    };

    const { error: orgErr } = await supabase.from('organizations').insert(org);
    if (orgErr) return res.status(500).json({ error: orgErr.message });
    const { error: gymErr } = await supabase.from('gyms').insert(gym);
    if (gymErr) return res.status(500).json({ error: gymErr.message });

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { error: subErr } = await supabase.from('subscriptions').insert({
      id: 'sub_' + uuidv4().slice(0, 8),
      gymId: gymId,
      status: 'trialing',
      amount: 400,
      currency: 'DT',
      startedAt: gym.createdAt,
      paidThrough: trialEndsAt,
      trialEndsAt,
      createdAt: new Date().toISOString(),
      notes: '14-day trial (auto)',
    });
    if (subErr) return res.status(500).json({ error: subErr.message });
  } else {
    if (!gymId) return res.status(400).json({ error: 'gymId is required — pick a gym to join' });
    const { data: gym } = await supabase.from('gyms').select('orgId').eq('id', gymId).single();
    if (!gym) return res.status(404).json({ error: 'Gym not found' });
    user = {
      id: 'usr_' + uuidv4().slice(0, 8), name, email: email.toLowerCase(), passwordHash,
      role, gymId, orgId: gym.orgId, phone: normalizedPhone, createdAt: new Date().toISOString()
    };
    if (role === 'client') user.trainerId = trainerId || null;
  }

  const { error: userErr } = await supabase.from('users').insert(user);
  if (userErr) return res.status(500).json({ error: userErr.message });

  const token = jwt.sign({ id: user.id, role: user.role, gymId: user.gymId, orgId: user.orgId }, SECRET, { expiresIn: '30d' });
  res.json({ token, user: strip(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const { data: user, error } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).single();
  if (error || !user) return res.status(401).json({ error: 'Invalid email or password' });

  if (user.suspended) return res.status(403).json({ error: 'This account is suspended' });
  if (user.gymId) {
    const { data: gym } = await supabase.from('gyms').select('suspended').eq('id', user.gymId).single();
    if (gym && gym.suspended) return res.status(403).json({ error: 'Your gym is suspended. Contact platform support.' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  const token = jwt.sign({ id: user.id, role: user.role, gymId: user.gymId, orgId: user.orgId }, SECRET, { expiresIn: '30d' });
  res.json({ token, user: strip(user) });
});

router.get('/me', authRequired, async (req, res) => {
  const { data: user, error } = await supabase.from('users').select('*').eq('id', req.user.id).single();
  if (error || !user) return res.status(404).json({ error: 'User not found' });
  res.json(strip(user));
});

module.exports = router;
