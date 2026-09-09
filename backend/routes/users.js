const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { supabase } = require('../db');
const { authRequired } = require('../middleware/auth');
const { normalizePhone } = require('../lib/whatsapp');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });
const strip = ({ passwordHash, ...rest }) => rest;

// Bulk import members from CSV.
router.post('/bulk-import', authRequired, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'owner' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only owners can bulk import members' });
  }

  if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

  const results = { success: 0, failed: 0, errors: [] };
  const gymId = req.user.gymId;

  const members = [];
  const stream = fs.createReadStream(req.file.path).pipe(csv());

  for await (const row of stream) {
    const { name, email, phone } = row;
    if (!name || !email) {
      results.failed++;
      results.errors.push(`Missing name or email for row: ${JSON.stringify(row)}`);
      continue;
    }

    const { data: existingUser } = await supabase.from('users').select('id').eq('email', email.trim().toLowerCase()).single();
    if (existingUser) {
      results.failed++;
      results.errors.push(`User with email ${email} already exists`);
      continue;
    }

    const normalizedPhone = phone ? normalizePhone(phone) : null;

    members.push({
      id: 'usr_' + uuidv4().slice(0, 8),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: 'NOT_SET', // User will need to reset password or owner sets it
      role: 'client',
      gymId,
      phone: normalizedPhone,
      createdAt: new Date().toISOString(),
    });
    results.success++;
  }

  if (members.length > 0) {
    const { error } = await supabase.from('users').insert(members);
    if (error) return res.status(500).json({ error: error.message });
  }

  fs.unlinkSync(req.file.path);

  res.json({
    message: `Import completed. ${results.success} members added, ${results.failed} failed.`,
    ...results,
  });
});

// Update own profile (name, phone). Email and role can't change here.
router.patch('/me', authRequired, async (req, res) => {
  const { name, phone } = req.body || {};
  const updates = {};
  if (typeof name === 'string' && name.trim()) updates.name = name.trim();
  if (typeof phone === 'string') {
    if (phone.trim() === '') {
      updates.phone = null;
    } else {
      const normalized = normalizePhone(phone);
      if (!normalized) return res.status(400).json({ error: 'phone is not a valid Tunisian number' });
      updates.phone = normalized;
    }
  }

  if (Object.keys(updates).length === 0) return res.json({ error: 'No valid updates provided' });

  const { data: user, error } = await supabase.from('users').update(updates).eq('id', req.user.id).select().single();
  if (error || !user) return res.status(404).json({ error: 'Not found' });

  res.json(strip(user));
});

// Member picks (or changes) their coach — coach must belong to the member's own gym
router.patch('/me/trainer', authRequired, async (req, res) => {
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Only members can pick a coach' });
  const { trainerId } = req.body;

  const { data: trainer, error: trainerErr } = await supabase.from('users').select('*').eq('id', trainerId).eq('role', 'trainer').single();
  if (trainerErr || !trainer || trainer.gymId !== req.user.gymId) return res.status(400).json({ error: 'That coach is not part of your gym' });

  const { data: user, error: userErr } = await supabase.from('users').update({ trainerId }).eq('id', req.user.id).select().single();
  if (userErr || !user) return res.status(500).json({ error: 'Failed to update trainer' });

  res.json(strip(user));
});

// Coach's own client roster
router.get('/clients/mine', authRequired, async (req, res) => {
  if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Coaches only' });

  const { data: users, error } = await supabase.from('users').select('*').eq('trainerId', req.user.id).eq('role', 'client');
  if (error) return res.status(500).json({ error: error.message });

  res.json(users.map(strip));
});

router.get('/:id', authRequired, async (req, res) => {
  const { data: user, error } = await supabase.from('users').select('*').eq('id', req.params.id).single();
  if (error || !user) return res.status(404).json({ error: 'Not found' });

  if (req.user.role !== 'super_admin') {
    if (user.gymId && req.user.gymId && user.gymId !== req.user.gymId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  res.json(strip(user));
});

module.exports = router;
