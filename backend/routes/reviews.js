const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/', authRequired, async (req, res) => {
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Only members can leave a review' });
  const { trainerId, rating, comment } = req.body;
  const r = Number(rating);
  if (!trainerId || !r || r < 1 || r > 5) return res.status(400).json({ error: 'trainerId and a rating from 1-5 are required' });

  const { data: client } = await supabase.from('users').select('*').eq('id', req.user.id).single();

  const { data: existingReview } = await supabase.from('reviews').select('*').eq('trainerId', trainerId).eq('clientId', req.user.id).maybeSingle();

  let review;
  if (existingReview) {
    review = { ...existingReview, rating: r, comment: comment || '', date: new Date().toISOString() };
    const { error: upErr } = await supabase.from('reviews').update(review).eq('id', existingReview.id);
    if (upErr) return res.status(500).json({ error: upErr.message });
  } else {
    review = { id: 'rev_' + uuidv4().slice(0, 8), trainerId, clientId: req.user.id, clientName: client?.name || req.user.name, rating: r, comment: comment || '', date: new Date().toISOString() };
    const { error: insErr } = await supabase.from('reviews').insert(review);
    if (insErr) return res.status(500).json({ error: insErr.message });
  }

  await supabase.from('auditLog').insert({
    id: 'audit_' + uuidv4().slice(0, 8),
    actorId: req.user.id, actorName: req.user.name, actorRole: req.user.role, gymId: req.user.gymId,
    action: 'review.submit',
    target: JSON.stringify({ type: 'review', id: review.id, trainerId }),
    meta: JSON.stringify({ rating: r, hasComment: !!comment }),
    at: new Date().toISOString(),
  });

  await supabase.from('notifications').insert({
    id: 'notif_' + uuidv4().slice(0, 8),
    gymId: req.user.gymId, userId: trainerId, kind: 'review',
    title: `⭐ New review: ${r}/5`,
    body: `${client?.name || req.user.name} rated you ${r}/5${comment ? ': "' + comment.slice(0, 60) + (comment.length > 60 ? '…' : '') + '"' : ''}`,
    link: '/profile',
    read: 0, createdAt: new Date().toISOString(),
  });

  res.json(review);
});

router.get('/for/:trainerId', async (req, res) => {
  const { data: reviews, error } = await supabase.from('reviews').select('*').eq('trainerId', req.params.trainerId).order('date', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(reviews);
});

router.get('/mine-for/:trainerId', authRequired, async (req, res) => {
  const { data: review, error } = await supabase.from('reviews').select('*').eq('trainerId', req.params.trainerId).eq('clientId', req.user.id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(review);
});

module.exports = router;
