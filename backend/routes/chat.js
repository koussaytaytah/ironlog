const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

const EXERCISES = [
  { id:'ex_bench_bb', name:'Barbell Bench Press', primary:'Chest', secondary:['Anterior Deltoid','Triceps'], equipment:'Barbell', mechanics:'Compound', force:'Push', level:'Intermediate' },
  { id:'ex_bench_db', name:'Dumbbell Bench Press', primary:'Chest', secondary:['Anterior Deltoid','Triceps'], equipment:'Dumbbells', mechanics:'Compound', force:'Push', level:'Beginner' },
  { id:'ex_incline_bb', name:'Incline Barbell Bench Press', primary:'Upper Chest', secondary:['Anterior Deltoid','Triceps'], equipment:'Barbell', mechanics:'Compound', force:'Push', level:'Intermediate' },
  { id:'ex_incline_db', name:'Incline Dumbbell Bench Press', primary:'Upper Chest', secondary:['Anterior Deltoid','Triceps'], equipment:'Dumbbells', mechanics:'Compound', force:'Push', level:'Beginner' },
  { id:'ex_decline_bb', name:'Decline Barbell Bench Press', primary:'Lower Chest', secondary:['Triceps'], equipment:'Barbell', mechanics:'Compound', force:'Push', level:'Intermediate' },
  { id:'ex_pushup', name:'Push-Up', primary:'Chest', secondary:['Triceps','Anterior Deltoid','Core'], equipment:'Bodyweight', mechanics:'Compound', force:'Push', level:'Beginner' },
  { id:'ex_dip', name:'Chest Dip', primary:'Lower Chest', secondary:['Triceps','Anterior Deltoid'], equipment:'Bodyweight', mechanics:'Compound', force:'Push', level:'Intermediate' },
  { id:'ex_cable_fly', name:'Cable Chest Fly', primary:'Chest', secondary:['Anterior Deltoid'], equipment:'Cable', mechanics:'Isolation', force:'Push', level:'Beginner' },
  { id:'ex_pec_deck', name:'Pec Deck Machine', primary:'Chest', secondary:['Anterior Deltoid'], equipment:'Machine', mechanics:'Isolation', force:'Push', level:'Beginner' },
  { id:'ex_row_bb', name:'Bent-Over Barbell Row', primary:'Back (Lats, Rhomboids)', secondary:['Biceps','Rear Deltoid'], equipment:'Barbell', mechanics:'Compound', force:'Pull', level:'Intermediate' },
  { id:'ex_pullup', name:'Pull-Up', primary:'Back (Lats)', secondary:['Biceps','Rear Deltoid'], equipment:'Bodyweight', mechanics:'Compound', force:'Pull', level:'Intermediate' },
  { id:'ex_chinup', name:'Chin-Up', primary:'Back (Lats)', secondary:['Biceps'], equipment:'Bodyweight', mechanics:'Compound', force:'Pull', level:'Intermediate' },
  { id:'ex_lat_pulldown', name:'Lat Pulldown', primary:'Back (Lats)', secondary:['Biceps','Rear Deltoid'], equipment:'Cable', mechanics:'Compound', force:'Pull', level:'Beginner' },
  { id:'ex_seated_row', name:'Seated Cable Row', primary:'Mid Back', secondary:['Biceps','Rear Deltoid'], equipment:'Cable', mechanics:'Compound', force:'Pull', level:'Beginner' },
  { id:'ex_tbar_row', name:'T-Bar Row', primary:'Mid Back', secondary:['Biceps','Rear Deltoid'], equipment:'Barbell', mechanics:'Compound', force:'Pull', level:'Intermediate' },
  { id:'ex_dumbbell_row', name:'One-Arm Dumbbell Row', primary:'Back (Lats)', secondary:['Biceps','Rear Deltoid'], equipment:'Dumbbell', mechanics:'Compound', force:'Pull', level:'Beginner' },
  { id:'ex_face_pull', name:'Face Pull', primary:'Rear Deltoid', secondary:['Upper Back','Trapezius'], equipment:'Cable', mechanics:'Isolation', force:'Pull', level:'Beginner' },
  { id:'ex_deadlift', name:'Conventional Deadlift', primary:'Back (Lower, Traps)', secondary:['Glutes','Hamstrings','Forearms'], equipment:'Barbell', mechanics:'Compound', force:'Pull', level:'Advanced' },
  { id:'ex_shrug', name:'Barbell Shrug', primary:'Trapezius', secondary:['Forearms'], equipment:'Barbell', mechanics:'Isolation', force:'Pull', level:'Beginner' },
  { id:'ex_ohp_bb', name:'Overhead Press (Barbell)', primary:'Anterior Deltoid', secondary:['Lateral Deltoid','Triceps','Upper Chest'], equipment:'Barbell', mechanics:'Compound', force:'Push', level:'Intermediate' },
  { id:'ex_ohp_db', name:'Seated Dumbbell Shoulder Press', primary:'Anterior Deltoid', secondary:['Triceps','Lateral Deltoid'], equipment:'Dumbbells', mechanics:'Compound', force:'Push', level:'Beginner' },
  { id:'ex_lateral_raise', name:'Dumbbell Lateral Raise', primary:'Lateral Deltoid', secondary:['Trapezius'], equipment:'Dumbbells', mechanics:'Isolation', force:'Push', level:'Beginner' },
  { id:'ex_front_raise', name:'Dumbbell Front Raise', primary:'Anterior Deltoid', secondary:['Lateral Deltoid'], equipment:'Dumbbells', mechanics:'Isolation', force:'Push', level:'Beginner' },
  { id:'ex_rear_delt_fly', name:'Reverse Pec Deck', primary:'Rear Deltoid', secondary:['Mid Back'], equipment:'Machine', mechanics:'Isolation', force:'Pull', level:'Beginner' },
  { id:'ex_arnold_press', name:'Arnold Press', primary:'Anterior Deltoid', secondary:['Lateral Deltoid','Triceps'], equipment:'Dumbbells', mechanics:'Compound', force:'Push', level:'Intermediate' },
  { id:'ex_squat_bb', name:'Barbell Back Squat', primary:'Quads', secondary:['Glutes','Hamstrings','Core'], equipment:'Barbell', mechanics:'Compound', force:'Push', level:'Intermediate' },
  { id:'ex_squat_front', name:'Front Squat', primary:'Quads', secondary:['Glutes','Core'], equipment:'Barbell', mechanics:'Compound', force:'Push', level:'Advanced' },
  { id:'ex_lunge', name:'Walking Lunge', primary:'Quads', secondary:['Glutes','Hamstrings'], equipment:'Dumbbells', mechanics:'Compound', force:'Push', level:'Beginner' },
  { id:'ex_leg_press', name:'Leg Press', primary:'Quads', secondary:['Glutes','Hamstrings'], equipment:'Machine', mechanics:'Compound', force:'Push', level:'Beginner' },
  { id:'ex_leg_ext', name:'Leg Extension', primary:'Quads', secondary:[], equipment:'Machine', mechanics:'Isolation', force:'Push', level:'Beginner' },
  { id:'ex_leg_curl', name:'Lying Leg Curl', primary:'Hamstrings', secondary:['Calves'], equipment:'Machine', mechanics:'Isolation', force:'Pull', level:'Beginner' },
  { id:'ex_rdl', name:'Romanian Deadlift', primary:'Hamstrings', secondary:['Glutes','Lower Back'], equipment:'Barbell', mechanics:'Compound', force:'Pull', level:'Intermediate' },
  { id:'ex_hip_thrust', name:'Barbell Hip Thrust', primary:'Glutes', secondary:['Hamstrings'], equipment:'Barbell', mechanics:'Compound', force:'Push', level:'Intermediate' },
  { id:'ex_calf_raise', name:'Standing Calf Raise', primary:'Calves', secondary:[], equipment:'Machine', mechanics:'Isolation', force:'Push', level:'Beginner' },
  { id:'ex_stepup', name:'Dumbbell Step-Up', primary:'Quads', secondary:['Glutes'], equipment:'Dumbbells', mechanics:'Compound', force:'Push', level:'Beginner' },
  { id:'ex_curl_bb', name:'Barbell Bicep Curl', primary:'Biceps', secondary:['Forearms'], equipment:'Barbell', mechanics:'Isolation', force:'Pull', level:'Beginner' },
  { id:'ex_curl_db', name:'Dumbbell Bicep Curl', primary:'Biceps', secondary:['Forearms'], equipment:'Dumbbells', mechanics:'Isolation', force:'Pull', level:'Beginner' },
  { id:'ex_hammer_curl', name:'Hammer Curl', primary:'Brachialis / Biceps', secondary:['Forearms'], equipment:'Dumbbells', mechanics:'Isolation', force:'Pull', level:'Beginner' },
  { id:'ex_preacher_curl', name:'Preacher Curl', primary:'Biceps', secondary:[], equipment:'Barbell', mechanics:'Isolation', force:'Pull', level:'Beginner' },
  { id:'ex_tricep_pushdown', name:'Tricep Pushdown', primary:'Triceps', secondary:[], equipment:'Cable', mechanics:'Isolation', force:'Push', level:'Beginner' },
  { id:'ex_skullcrusher', name:'Skullcrusher', primary:'Triceps', secondary:[], equipment:'Barbell', mechanics:'Isolation', force:'Pull', level:'Beginner' },
  { id:'ex_overhead_ext', name:'Overhead Tricep Extension', primary:'Triceps', secondary:[], equipment:'Dumbbell', mechanics:'Isolation', force:'Push', level:'Beginner' },
  { id:'ex_close_grip_bench', name:'Close-Grip Bench Press', primary:'Triceps', secondary:['Chest','Anterior Deltoid'], equipment:'Barbell', mechanics:'Compound', force:'Push', level:'Intermediate' },
  { id:'ex_plank', name:'Plank', primary:'Core (Rectus Abdominis, Transverse)', secondary:['Shoulders','Glutes'], equipment:'Bodyweight', mechanics:'Isolation', force:'Hold', level:'Beginner' },
  { id:'ex_crunch', name:'Crunch', primary:'Rectus Abdominis', secondary:[], equipment:'Bodyweight', mechanics:'Isolation', force:'Pull', level:'Beginner' },
  { id:'ex_hanging_leg', name:'Hanging Leg Raise', primary:'Rectus Abdominis', secondary:['Hip Flexors'], equipment:'Bodyweight', mechanics:'Isolation', force:'Pull', level:'Intermediate' },
  { id:'ex_cable_crunch', name:'Cable Crunch', primary:'Rectus Abdominis', secondary:[], equipment:'Cable', mechanics:'Isolation', force:'Pull', level:'Beginner' },
  { id:'ex_russian_twist', name:'Russian Twist', primary:'Obliques', secondary:['Rectus Abdominis'], equipment:'Bodyweight', mechanics:'Isolation', force:'Hold', level:'Beginner' },
  { id:'ex_ab_wheel', name:'Ab Wheel Rollout', primary:'Core', secondary:['Shoulders','Lats'], equipment:'Wheel', mechanics:'Isolation', force:'Pull', level:'Advanced' },
  { id:'ex_mountain_climber', name:'Mountain Climber', primary:'Core', secondary:['Shoulders','Hip Flexors'], equipment:'Bodyweight', mechanics:'Compound', force:'Push', level:'Beginner' },
  { id:'ex_burpee', name:'Burpee', primary:'Full Body', secondary:['Cardiovascular'], equipment:'Bodyweight', mechanics:'Compound', force:'Push', level:'Beginner' },
  { id:'ex_kb_swing', name:'Kettlebell Swing', primary:'Glutes', secondary:['Hamstrings','Core','Shoulders'], equipment:'Kettlebell', mechanics:'Compound', force:'Pull', level:'Intermediate' },
  { id:'ex_jump_rope', name:'Jump Rope', primary:'Calves', secondary:['Cardiovascular','Shoulders'], equipment:'Rope', mechanics:'Compound', force:'Push', level:'Beginner' },
  { id:'ex_box_jump', name:'Box Jump', primary:'Quads', secondary:['Glutes','Calves'], equipment:'Box', mechanics:'Compound', force:'Push', level:'Intermediate' },
  { id:'ex_assault_bike', name:'Assault Bike (Sprints)', primary:'Cardiovascular', secondary:['Quads','Hamstrings','Shoulders'], equipment:'Machine', mechanics:'Compound', force:'Push', level:'Beginner' },
];

const EQUIP_CLASS = {
  Barbell: 'free_weight',
  'Barbell/Dumbbells': 'free_weight',
  Dumbbells: 'free_weight',
  Dumbbell: 'free_weight',
  Kettlebell: 'free_weight',
  Bodyweight: 'bodyweight',
  Cable: 'cable',
  Machine: 'machine',
  Rope: 'cardio',
  Wheel: 'other',
  Box: 'other',
};

router.post('/apply-substitution', authRequired, async (req, res) => {
  if (!['owner', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only gym owners can apply program substitutions' });
  }
  const { brokenExerciseId, substituteExerciseId, programId } = req.body;
  if (!brokenExerciseId || !substituteExerciseId) {
    return res.status(400).json({ error: 'brokenExerciseId and substituteExerciseId are required' });
  }

  const scope = req.user.role === 'super_admin' ? 'platform' : req.user.gymId;

  let programsToUpdate = [];
  if (programId) {
    const { data: p, error } = await supabase.from('programs').select('*').eq('id', programId).single();
    if (error || !p) return res.status(404).json({ error: 'Program not found' });
    if (scope !== 'platform' && p.gymId !== scope) return res.status(403).json({ error: 'Access denied' });
    programsToUpdate = [p];
  } else {
    const query = supabase.from('programs').select('*');
    if (scope !== 'platform') query.eq('gymId', scope);
    const { data: allProgs, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    programsToUpdate = allProgs.filter(p =>
      p.schedule && p.schedule.some(s => s.exercises && s.exercises.some(e => e.exerciseId === brokenExerciseId))
    );
  }

  if (programsToUpdate.length === 0) {
    return res.status(404).json({ error: 'No programs found using the broken exercise' });
  }

  let updateCount = 0;
  for (const p of programsToUpdate) {
    const updatedSchedule = p.schedule.map(s => ({
      ...s,
      exercises: s.exercises ? s.exercises.map(e => e.exerciseId === brokenExerciseId ? { ...e, exerciseId: substituteExerciseId } : e) : []
    }));
    const { error: upErr } = await supabase.from('programs').update({ schedule: updatedSchedule }).eq('id', p.id);
    if (!upErr) updateCount++;
  }

  res.json({ success: true, updatedCount: updateCount });
});

router.post('/', authRequired, async (req, res) => {
  if (!['owner', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'AI assistant is for gym owners and super admins only' });
  }
  const { messages, brokenExerciseId } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const scope = req.user.role === 'super_admin' ? 'platform' : req.user.gymId;

  const { data: gyms } = await supabase.from('gyms').select('*'); // Filtered later if needed
  const { data: users } = await supabase.from('users').select('*');
  const { data: programs } = await supabase.from('programs').select('*');
  const { data: assignments } = await supabase.from('assignments').select('*');

  const filteredGyms = scope === 'platform' ? gyms : gyms.filter(g => g.id === scope);
  const filteredUsers = scope === 'platform' ? users : users.filter(u => u.gymId === scope);
  const filteredPrograms = scope === 'platform' ? programs : programs.filter(p => p.gymId === scope);
  const filteredAssignments = scope === 'platform' ? assignments : assignments.filter(a => filteredPrograms.some(p => p.id === a.programId));

  const summary = {
    role: req.user.role,
    scope: scope === 'platform' ? 'ALL GYMS (super admin)' : 'your gym only',
    gymCount: filteredGyms.length,
    userCount: filteredUsers.length,
    programCount: filteredPrograms.length,
    assignmentCount: filteredAssignments.length,
    gymNames: filteredGyms.map(g => ({ id: g.id, name: g.name, location: g.location, members: filteredUsers.filter(u => u.gymId === g.id && u.role === 'client').length, coaches: filteredUsers.filter(u => u.gymId === g.id && u.role === 'trainer').length })),
  };

  let substitution = null;
  let affectedPrograms = [];
  if (brokenExerciseId) {
    const broken = EXERCISES.find(e => e.id === brokenExerciseId);
    if (broken) {
      const eqClass = EQUIP_CLASS[broken.equipment] || 'other';
      const candidates = EXERCISES.filter(e => {
        if (e.id === broken.id) return false;
        if (e.primary !== broken.primary) return false;
        if ((EQUIP_CLASS[e.equipment] || 'other') !== eqClass) return false;
        if (e.mechanics !== broken.mechanics) return false;
        return true;
      });
      substitution = { broken: { id: broken.id, name: broken.name, primary: broken.primary, equipment: broken.equipment }, candidates };
      affectedPrograms = filteredPrograms.filter(p => p.schedule && p.schedule.some(s => s.exercises && s.exercises.some(e => e.exerciseId === brokenExerciseId)))
        .map(p => ({ id: p.id, title: p.title, type: p.type, trainerId: p.trainerId, itemCount: p.schedule ? p.schedule.reduce((acc, s) => acc + (s.exercises ? s.exercises.length : 0), 0) : 0 }));
    }
  } else {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (lastUser) {
      const text = lastUser.text.toLowerCase();
      const normalized = text.replace(/[^a-z0-9 ]/g, ' ');
      const detected = EXERCISES.find(e => normalized.includes(e.name.toLowerCase().split('(')[0].trim().toLowerCase().split(' ').slice(0, 3).join(' ')));
      if (detected) {
        const eqClass = EQUIP_CLASS[detected.equipment] || 'other';
        const candidates = EXERCISES.filter(e => {
          if (e.id === detected.id) return false;
          if (e.primary !== detected.primary) return false;
          if ((EQUIP_CLASS[e.equipment] || 'other') !== eqClass) return false;
                                          if (e.mechanics !== detected.mechanics) return false;
          return true;
        });
        substitution = { broken: { id: detected.id, name: detected.name, primary: detected.primary, equipment: detected.equipment }, candidates };
        affectedPrograms = filteredPrograms.filter(p => p.schedule && p.schedule.some(s => s.exercises && s.exercises.some(e => e.exerciseId === detected.id)))
          .map(p => ({ id: p.id, title: p.title, type: p.type, trainerId: p.trainerId, itemCount: p.schedule ? p.schedule.reduce((acc, s) => acc + (s.exercises ? s.exercises.length : 0), 0) : 0 }));
      }
    }
  }

  if (!GROQ_API_KEY) {
    return res.json({
      reply: buildOfflineReply(substitution, affectedPrograms, summary),
      substitution,
      affectedPrograms,
      offline: true,
    });
  }

  const systemPrompt = `You are an expert gym operations assistant for IRONLOG, a multi-tenant coaching platform used in Tunisia.
Your job is to help ${req.user.role === 'super_admin' ? 'the platform owner (super admin) analyze all gyms' : 'a gym owner run their gym'}.
Keep replies short, friendly, and actionable. Use the same language the user wrote in (default: French or English).
You can substitute broken exercises using the same primary muscle + equipment class + movement pattern.${substitution ? `
DETECTED ISSUE: "${substitution.broken.name}" is broken/unavailable.
- Primary muscle: ${substitution.broken.primary}
- Equipment class: ${substitution.broken.equipment}
- Recommend ONLY from these candidates (same primary muscle, same equipment class, same mechanics): ${JSON.stringify(substitution.candidates.map(c => c.name))}
- Programs at ${req.user.role === 'super_admin' ? 'any gym' : 'this gym'} affected: ${affectedPrograms.map(p => '"' + p.title + '"').join(', ') || 'none'}` : ''}`;

  try {
    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + GROQ_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.5,
        max_tokens: 600,
      }),
    });
    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return res.json({
        reply: buildOfflineReply(substitution, affectedPrograms, summary),
        substitution,
        affectedPrograms,
        offline: true,
        groqError: errText.slice(0, 200),
      });
    }
    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || buildOfflineReply(substitution, affectedPrograms, summary);
    res.json({ reply, substitution, affectedPrograms, offline: false });
  } catch (e) {
    res.json({
      reply: buildOfflineReply(substitution, affectedPrograms, summary),
      substitution,
      affectedPrograms,
      offline: true,
      error: e.message,
    });
  }
});

function buildOfflineReply(substitution, affectedPrograms, summary) {
  if (!substitution) {
    return `Bonjour ! Je suis l'assistant IRONLOG. Je vois ${summary.gymCount} salle(s), ${summary.userCount} utilisateurs, ${summary.programCount} programmes.
Dites-moi par exemple : "La leg press est en panne" — je trouverai des substitutions pour tous vos programmes touchés.`;
  }
  const c = substitution.candidates;
  if (c.length === 0) {
    return `⚠️ "${substitution.broken.name}" est cassé. Je n'ai trouvé pas de remplacement direct (même muscle + même équipement). Voici les options :
- Remplacer temporairement par un bodyweight équivalent
- Demander au coach de remplacer sur le programme
Programmes touchés : ${affectedPrograms.map(p => p.title).join(', ') || 'aucun'}`;
  }
  return `⚠️ "${substitution.broken.name}" est cassé. Je recommande ces remplacements (même muscle "${substitution.broken.primary}", même type d'équipement) :
${c.map((x, i) => `${i + 1}. ${x.name} (${x.equipment})`).join('\n')}
Programmes touchés : ${affectedPrograms.map(p => '"' + p.title + '"').join(', ') || 'aucun'}.
Dites "remplace dans le programme X" pour que je vous aide à rédiger le swap.`;
}

module.exports = router;
