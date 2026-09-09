const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'meal_' + uuidv4() + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 6 * 1024 * 1024 } });

// Member logs a meal photo — becomes a pending task for their coach
router.post('/', authRequired, upload.single('photo'), async (req, res) => {
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Only members can log meals' });
  if (!req.file) return res.status(400).json({ error: 'A photo is required' });

  const log = {
    id: 'meal_' + uuidv4().slice(0, 8),
    clientId: req.user.id,
    photo: '/uploads/' + req.file.filename,
    caption: req.body.caption || '',
    date: new Date().toISOString(),
    status: 'pending',
    trainerFeedback: ''
  };

  const { error: logErr } = await supabase.from('mealLogs').insert(log);
  if (logErr) return res.status(500).json({ error: logErr.message });

  const { data: member } = await supabase.from('users').select('*').eq('id', req.user.id).single();
  if (member && member.trainerId) {
    await supabase.from('notifications').insert({
      id: 'notif_' + uuidv4().slice(0, 8),
      gymId: req.user.gymId, userId: member.trainerId, kind: 'meal',
      title: `🍽️ New meal log`,
      body: `${member.name} logged a meal${log.caption ? ': "' + log.caption.slice(0, 60) + '"' : ''}.`,
      link: '/coach/meals',
      read: 0, createdAt: new Date().toISOString(),
    });
  }

  await supabase.from('auditLog').insert({
    id: 'audit_' + uuidv4().slice(0, 8),
    actorId: req.user.id, actorName: req.user.name, actorRole: req.user.role, gymId: req.user.gymId,
    action: 'meal.log',
    target: JSON.stringify({ type: 'mealLog', id: log.id }),
    meta: JSON.stringify({ hasCaption: !!log.caption }),
    at: new Date().toISOString(),
  });

  res.json(log);
});

router.get('/mine', authRequired, async (req, res) => {
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Members only' });
  const { data: logs, error } = await supabase.from('mealLogs').select('*').eq('clientId', req.user.id).order('date', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(logs);
});

// Everything waiting on / already reviewed by this coach, across all their clients
router.get('/for-coach', authRequired, async (req, res) => {
  if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Coaches only' });

  const { data: clients, error: cErr } = await supabase.from('users').select('id').eq('trainerId', req.user.id);
  if (cErr) return res.status(500).json({ error: cErr.message });

  if (!clients || clients.length === 0) return res.json([]);

  const clientIds = clients.map(c => c.id);
  const { data: logs, error: lErr } = await supabase.from('mealLogs').select('*').in('clientId', clientIds).order('date', { ascending: false });
  if (lErr) return res.status(500).json({ error: lErr.message });
  res.json(logs);
});

router.get('/for-client/:clientId', authRequired, async (req, res) => {
  if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Coaches only' });

  const { data: client, error: cErr } = await supabase.from('users').select('*').eq('id', req.params.clientId).single();
  if (cErr || !client || client.trainerId !== req.user.id) return res.status(403).json({ error: 'Not your client' });

  const { data: logs, error: lErr } = await supabase.from('mealLogs').select('*').eq('clientId', req.params.clientId).order('date', { ascending: false });
  if (lErr) return res.status(500).json({ error: lErr.message });
  res.json(logs);
});

// Coach leaves a note on a meal photo and marks it reviewed
router.patch('/:id/feedback', authRequired, async (req, res) => {
  if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Coaches only' });

  const { data: log, error: lErr } = await supabase.from('mealLogs').select('*').eq('id', req.params.id).single();
  if (lErr || !log) return res.status(404).json({ error: 'Not found' });

  const { data: client, error: cErr } = await supabase.from('users').select('*').eq('id', log.clientId).single();
  if (cErr || !client || client.trainerId !== req.user.id) return res.status(403).json({ error: 'Not your client\'s meal log' });

  const updates = {
    trainerFeedback: req.body.feedback || '',
    status: 'reviewed'
  };

  const { data: updatedLog, error: upErr } = await supabase.from('mealLogs').update(updates).eq('id', req.params.id).select().single();
  if (upErr) return res.status(500).json({ error: upErr.message });

  await supabase.from('auditLog').insert({
    id: 'audit_' + uuidv4().slice(0, 8),
    actorId: req.user.id, actorName: req.user.name, actorRole: req.user.role, gymId: req.user.gymId,
    action: 'meal.review',
    target: JSON.stringify({ type: 'mealLog', id: log.id }),
    meta: JSON.stringify({ hasFeedback: !!updates.trainerFeedback }),
    at: new Date().toISOString(),
  });

  await supabase.from('notifications').insert({
    id: 'notif_' + uuidv4().slice(0, 8),
    gymId: req.user.gymId, userId: log.clientId, kind: 'meal',
    title: `🍽️ Coach reviewed your meal`,
    body: updates.trainerFeedback ? `"${updates.trainerFeedback.slice(0, 80)}"` : 'Your meal was reviewed.',
    link: '/meals',
    read: 0, createdAt: new Date().toISOString(),
  });

  res.json(updatedLog);
});

module.exports = router;
