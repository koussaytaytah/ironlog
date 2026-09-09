const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

const MAX_WEEKS = 12;
const MAX_DAYS = 7;

function buildScheduleFromItems(items) {
  return [{
    weekNumber: 1,
    dayNumber: 1,
    label: 'Day 1',
    exercises: items.map(it => ({
      exerciseId: it.exerciseId || null,
      name: it.name,
      sets: it.sets || null,
      reps: it.reps || null,
      weight: it.weight || null,
      restSec: it.restSec || null,
      notes: it.detail || it.notes || '',
    })),
  }];
}

function validateSchedule(body) {
  if (body.type === 'diet') {
    if (Array.isArray(body.schedule) && body.schedule.length) {
      return { error: 'Diet programs use flat items, not a schedule' };
    }
    return null;
  }
  if (!Array.isArray(body.schedule) || body.schedule.length === 0) return null;
  const weeks = Number(body.weeks) || 1;
  const daysPerWeek = Number(body.daysPerWeek) || 3;
  if (weeks < 1 || weeks > MAX_WEEKS) return { error: `weeks must be 1-${MAX_WEEKS}` };
  if (daysPerWeek < 1 || daysPerWeek > MAX_DAYS) return { error: `daysPerWeek must be 1-${MAX_DAYS}` };
  for (const entry of body.schedule) {
    if (typeof entry.weekNumber !== 'number' || typeof entry.dayNumber !== 'number') {
      return { error: 'every schedule entry needs numeric weekNumber + dayNumber' };
    }
    if (!Array.isArray(entry.exercises)) entry.exercises = [];
  }
  return { weeks, daysPerWeek, schedule: body.schedule };
}

router.post('/', authRequired, async (req, res) => {
  if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Only coaches can create programs' });
  const { title, type } = req.body;
  if (!title || !['workout', 'diet'].includes(type)) {
    return res.status(400).json({ error: 'title and type (workout|diet) are required' });
  }

  const program = {
    id: 'prog_' + uuidv4().slice(0, 8),
    gymId: req.user.gymId,
    trainerId: req.user.id,
    title, type,
    createdAt: new Date().toISOString(),
  };

  if (type === 'workout') {
    const v = validateSchedule(req.body);
    if (v && v.error) return res.status(400).json({ error: v.error });
    if (v) {
      program.weeks = v.weeks;
      program.daysPerWeek = v.daysPerWeek;
      program.schedule = v.schedule;
    } else {
      const items = Array.isArray(req.body.items) ? req.body.items : [];
      if (items.length === 0) return res.status(400).json({ error: 'a workout program needs a schedule or items[]' });
      program.weeks = 1;
      program.daysPerWeek = 1;
      program.schedule = buildScheduleFromItems(items);
      program.items = items;
    }
  } else {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) return res.status(400).json({ error: 'a diet program needs at least one meal' });
    program.items = items;
  }

  const { error: insErr } = await supabase.from('programs').insert(program);
  if (insErr) return res.status(500).json({ error: insErr.message });

  await supabase.from('auditLog').insert({
    id: 'audit_' + uuidv4().slice(0, 8),
    actorId: req.user.id, actorName: req.user.name, actorRole: req.user.role, gymId: req.user.gymId,
    action: 'program.create',
    target: JSON.stringify({ type: 'program', id: program.id }),
    meta: JSON.stringify({ title, type, weeks: program.weeks || null, daysPerWeek: program.daysPerWeek || null }),
    at: new Date().toISOString(),
  });

  res.json(program);
});

router.get('/mine', authRequired, async (req, res) => {
  if (req.user.role !== 'trainer') return res.status(403).json({ error: 'Coaches only' });
  const { data: programs, error } = await supabase.from('programs').select('*').eq('trainerId', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json(programs);
});

router.get('/:id', authRequired, async (req, res) => {
  const { data: program, error } = await supabase.from('programs').select('*').eq('id', req.params.id).single();
  if (error || !program) return res.status(404).json({ error: 'Not found' });

  if (req.user.role === 'trainer' && program.trainerId === req.user.id) return res.json(program);
  if (req.user.role === 'client') {
    const { data: assigned } = await supabase.from('assignments').select('id').eq('programId', program.id).eq('clientId', req.user.id).maybeSingle();
    if (assigned) return res.json(program);
  }
  return res.status(403).json({ error: 'Forbidden' });
});

module.exports = router;
