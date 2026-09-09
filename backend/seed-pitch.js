// Seed one believable gym for sales pitches: "Iron Temple Sousse".
// Wipes everything else so the landing page demo is uncluttered.
// Run: node seed-pitch.js

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const { readDB, writeDB } = require('./db');

function id(prefix) { return prefix + '_' + Math.random().toString(36).slice(2, 10); }
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }
function inDays(n) { return new Date(Date.now() + n * 86400000).toISOString(); }
function isoDate(d) { return new Date(d).toISOString().slice(0, 10); }
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Deterministic-ish PRNG so the demo is reproducible
let seed = 42;
function rand() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

const db = readDB();

// =========================================================
// Wipe & reset
// =========================================================
for (const k of Object.keys(db)) if (Array.isArray(db[k])) db[k] = [];
// Re-seed platform plans + achievement catalog so the app stays usable
db.platformPlans = [
  { id: 'pp_starter', tier: 'starter', name: 'Starter', priceDT: 200, maxMembers: 50, maxTrainers: 2,
    features: ['Up to 50 members', '2 coaches', 'Member check-ins', 'Workout & diet programs', 'In-app messaging', '14-day free trial'],
    isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'pp_pro', tier: 'pro', name: 'Pro', priceDT: 400, maxMembers: 200, maxTrainers: 8,
    features: ['Up to 200 members', '8 coaches', 'Everything in Starter', 'Member billing & plans', 'Attendance + streaks', 'Peak hours analytics', 'Priority support'],
    isDefault: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'pp_business', tier: 'business', name: 'Business', priceDT: 800, maxMembers: 1000, maxTrainers: 30,
    features: ['Unlimited members', 'Unlimited coaches', 'Everything in Pro', 'Multi-branch (soon)', 'White-label (soon)', 'Dedicated success manager'],
    isDefault: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];
db.achievements = [
  { key: 'first_checkin',  name: 'First step',     emoji: '🚪', tier: 'bronze', description: 'Your very first check-in',          threshold: 1 },
  { key: 'streak_3',       name: '3-day streak',   emoji: '🔥', tier: 'bronze', description: 'Checked in 3 days in a row',        threshold: 3 },
  { key: 'streak_7',       name: '7-day streak',   emoji: '🔥', tier: 'silver', description: 'A full week of consistency',        threshold: 3 },
  { key: 'streak_30',      name: '30-day streak',  emoji: '🌟', tier: 'gold',   description: 'A month without missing a day',     threshold: 30 },
  { key: 'visits_10',      name: '10 visits',      emoji: '💯', tier: 'bronze', description: 'Reached 10 lifetime check-ins',     threshold: 10 },
  { key: 'visits_50',      name: '50 visits',      emoji: '💯', tier: 'silver', description: 'Reached 50 lifetime check-ins',     threshold: 50 },
  { key: 'visits_100',     name: '100 visits',     emoji: '🏆', tier: 'gold',   description: 'Reached 100 lifetime check-ins',    threshold: 100 },
  { key: 'visits_500',     name: '500 visits',     emoji: '👑', tier: 'gold',   description: '500 lifetime check-ins — legend',  threshold: 500 },
  { key: 'early_bird',     name: 'Early bird',     emoji: '🌅', tier: 'bronze', description: 'Checked in before 7am',             threshold: 1 },
  { key: 'night_owl',      name: 'Night owl',      emoji: '🦉', tier: 'bronze', description: 'Checked in after 10pm',             threshold: 1 },
];

// =========================================================
// The Gym: Iron Temple Sousse
// =========================================================
const gymId = id('gym');
const ownerId = id('usr');
const coachIds = [id('usr'), id('usr'), id('usr')];

db.gyms.push({
  id: gymId,
  name: 'Iron Temple Sousse',
  createdAt: daysAgo(220),
  ownerId,
  logo: null,
  location: 'Sousse Ville 4000',
  description: "Salle référence à Sousse depuis 2018. 480m², équipement Hammer Strength, vestiaires premium, cours collectifs."
});

db.users.push({
  id: ownerId,
  name: 'Sami Boukhris',
  email: 'demo-owner@ironlog.test',
  passwordHash: bcrypt.hashSync('demo1234', 10),
  role: 'owner',
  gymId,
  phone: '21625424728',
  createdAt: daysAgo(220),
});

const coaches = [
  { id: coachIds[0], name: 'Hatem Bouazizi', specialty: 'Force & Haltérophilie',  bio: "Coach équipe nationale junior haltérophilie. 12 ans d'expérience.", yearsExp: 12 },
  { id: coachIds[1], name: 'Sirine Mejri',    specialty: 'Bodybuilding & Nutrition', bio: 'Championne nationale 2023, certifiée Precision Nutrition.', yearsExp: 6 },
  { id: coachIds[2], name: 'Karim Jebali',    specialty: 'CrossFit & HIIT',         bio: 'Ex-athlète national, CrossFit L2.', yearsExp: 5 },
];
coaches.forEach(c => {
  db.users.push({
    id: c.id, name: c.name, email: `demo-coach-${c.name.split(' ')[0].toLowerCase()}@ironlog.test`,
    passwordHash: bcrypt.hashSync('demo1234', 10),
    role: 'trainer', gymId, phone: '216' + rnd(20000000, 99999999),
    bio: c.bio, specialty: c.specialty, yearsExp: c.yearsExp,
    createdAt: daysAgo(180),
  });
});

// =========================================================
// Members — 18 members with realistic Tunisian names,
// phones, mix of subscription states and attendance streaks
// =========================================================
const memberSeeds = [
  { name: 'Ahmed Trabelsi',  trainer: 0, phone: '21650111222', status: 'active',    joinedDays: 180, streak: 23 },
  { name: 'Mariem Khlifi',   trainer: 1, phone: '21692233445', status: 'active',    joinedDays: 150, streak: 14 },
  { name: 'Yassine Bouazizi',trainer: 0, phone: '21650123456', status: 'active',    joinedDays: 120, streak: 7 },
  { name: 'Imen Gharbi',     trainer: 1, phone: '21698567432', status: 'active',    joinedDays: 90,  streak: 41 },
  { name: 'Mohamed Amri',    trainer: 2, phone: '21650222333', status: 'active',    joinedDays: 75,  streak: 5 },
  { name: 'Sarra Mejri',     trainer: 1, phone: '21692888777', status: 'active',    joinedDays: 60,  streak: 12 },
  { name: 'Bilel Hamdi',     trainer: 0, phone: '21650444555', status: 'active',    joinedDays: 45,  streak: 3 },
  { name: 'Nour El Houda',   trainer: 1, phone: '21693666777', status: 'trialing',  joinedDays: 7,   streak: 3 },
  { name: 'Rami Jebali',     trainer: 2, phone: '21650777888', status: 'active',    joinedDays: 200, streak: 67 },
  { name: 'Ines Cherni',     trainer: 0, phone: '21693999000', status: 'active',    joinedDays: 110, streak: 19 },
  { name: 'Fares Belhaj',    trainer: 2, phone: '21650888999', status: 'frozen',    joinedDays: 95,  streak: 0 },
  { name: 'Hela Mansour',    trainer: 1, phone: '21694111222', status: 'active',    joinedDays: 80,  streak: 9 },
  { name: 'Zied Ayari',      trainer: 0, phone: '21650000111', status: 'active',    joinedDays: 50,  streak: 4 },
  { name: 'Lina Khelifi',    trainer: 1, phone: '21694333444', status: 'active',    joinedDays: 35,  streak: 11 },
  { name: 'Skander Toumi',   trainer: 2, phone: '21650555666', status: 'active',    joinedDays: 25,  streak: 6 },
  { name: 'Asma Rezig',      trainer: 1, phone: '21694777888', status: 'active',    joinedDays: 15,  streak: 2 },
  { name: 'Wafa Ghribi',     trainer: 0, phone: '21650999000', status: 'expired',   joinedDays: 200, streak: 0 },
  { name: 'Adel Sfar',       trainer: 2, phone: '21650111222', status: 'active',    joinedDays: 5,   streak: 1 },
];

const members = memberSeeds.map((m, i) => ({
  id: id('usr'),
  ...m,
  email: `demo-member${i+1}@ironlog.test`,
  passwordHash: bcrypt.hashSync('demo1234', 10),
  role: 'client',
  gymId,
  trainerId: coachIds[m.trainer],
  createdAt: daysAgo(m.joinedDays),
  unlockedAchievements: ['first_checkin', 'visits_10', 'visits_50', 'early_bird']
    .filter(() => rand() > 0.5),
}));

members.forEach(m => db.users.push({
  id: m.id, name: m.name, email: m.email, passwordHash: m.passwordHash,
  role: 'client', gymId, phone: m.phone,
  trainerId: m.trainerId, createdAt: m.createdAt,
  unlockedAchievements: m.unlockedAchievements,
}));

// =========================================================
// Membership plans (gym-scoped)
// =========================================================
const plans = [
  { name: 'Mensuel',   durationDays: 30,  priceDT: 100, features: ['Accès salle', 'Vestiaires', '1h coaching/sem'] },
  { name: 'Trimestriel', durationDays: 90,  priceDT: 270, features: ['Accès salle', 'Vestiaires', '2h coaching/sem', '1 cours collectif'] },
  { name: 'Annuel VIP', durationDays: 365, priceDT: 900, features: ['Accès illimité', 'Coaching illimité', 'Tous cours', 'Sauna', 'Bilan nutritionnel'] },
];
plans.forEach(p => db.membershipPlans.push({
  id: id('pln'), gymId, ...p, createdAt: daysAgo(150),
}));

// =========================================================
// Member subscriptions + payment ledger
// =========================================================
members.forEach(m => {
  if (m.status === 'expired') {
    const subId = id('msub');
    db.memberSubscriptions.push({
      id: subId, gymId, memberId: m.id, planId: plans[0].id ? '' : '',
      status: 'expired', startAt: daysAgo(m.joinedDays), endAt: daysAgo(2),
      autoRenew: false, frozenAt: null, frozenUntil: null,
      createdAt: daysAgo(m.joinedDays),
    });
    return;
  }
  if (m.status === 'frozen') {
    const plan = plans[1];
    const subId = id('msub');
    const startAt = daysAgo(m.joinedDays);
    db.memberSubscriptions.push({
      id: subId, gymId, memberId: m.id, planId: plan.id,
      status: 'frozen', startAt, endAt: inDays(45),
      autoRenew: false, frozenAt: daysAgo(10), frozenUntil: inDays(20),
      createdAt: startAt,
    });
    db.memberPayments.push({
      id: id('mp'), gymId, memberId: m.id, planId: plan.id,
      amount: plan.priceDT, method: 'cash', periodStart: startAt, periodEnd: daysAgo(m.joinedDays - 90),
      status: 'approved', receiptUrl: null, note: '3-month plan',
      createdAt: startAt, reviewedBy: ownerId, reviewedAt: startAt,
    });
    return;
  }

  const plan = m.status === 'trialing' ? plans[0] : plans[rnd(0, 2)];
  const subId = id('msub');
  const startAt = daysAgo(m.joinedDays);
  const endAt = inDays(m.status === 'trialing' ? 7 : rnd(5, 25));
  db.memberSubscriptions.push({
    id: subId, gymId, memberId: m.id, planId: plan.id,
    status: m.status, startAt, endAt,
    autoRenew: rand() > 0.5, frozenAt: null, frozenUntil: null,
    createdAt: startAt,
  });
  // 1-3 historical approved payments
  const numPayments = rnd(1, 3);
  for (let i = 0; i < numPayments; i++) {
    db.memberPayments.push({
      id: id('mp'), gymId, memberId: m.id, planId: plan.id,
      amount: plan.priceDT, method: ['cash','d17','flouci','bank'][rnd(0,3)],
      periodStart: daysAgo(m.joinedDays - i * plan.durationDays),
      periodEnd: daysAgo(m.joinedDays - (i+1) * plan.durationDays + plan.durationDays),
      status: 'approved', receiptUrl: null, note: null,
      createdAt: daysAgo(m.joinedDays - i * plan.durationDays),
      reviewedBy: ownerId, reviewedAt: daysAgo(m.joinedDays - i * plan.durationDays),
    });
  }
});

// One pending payment (so the owner's review-queue demo looks real)
db.memberPayments.push({
  id: id('mp'), gymId, memberId: members[5].id, planId: plans[0].id,
  amount: 100, method: 'd17', periodStart: daysAgo(0), periodEnd: inDays(30),
  status: 'pending', receiptUrl: null, note: 'Awaiting D17 confirmation',
  createdAt: daysAgo(1), reviewedBy: null, reviewedAt: null,
});

// =========================================================
// Programs — workout schedule-based for realism
// =========================================================
function buildSchedule(weeks, days, exercises) {
  const schedule = [];
  for (let w = 1; w <= weeks; w++) {
    for (let d = 1; d <= days; d++) {
      const dayExercises = exercises[d-1] || exercises[0];
      schedule.push({
        weekNumber: w, dayNumber: d,
        label: ['Push','Pull','Legs','Upper','Full Body','Active Recovery','Rest'][d-1] || 'Day ' + d,
        exercises: dayExercises.map(e => ({ ...e })),
      });
    }
  }
  return schedule;
}

const programs = [
  { trainerIdx: 0, title: 'Powerlifting 8 Semaines', weeks: 8, days: 3,
    days_ex: [
      [{ exerciseId: 'ex_squat',    name: 'Back Squat',  sets: 5, reps: 5, weight: 100 },
       { exerciseId: 'ex_bench',    name: 'Bench Press', sets: 5, reps: 5, weight: 80 },
       { exerciseId: 'ex_row',      name: 'Barbell Row', sets: 4, reps: 8, weight: 70 }],
      [{ exerciseId: 'ex_deadlift', name: 'Deadlift',    sets: 3, reps: 3, weight: 140 },
       { exerciseId: 'ex_ohp',      name: 'Overhead Press', sets: 4, reps: 6, weight: 50 },
       { exerciseId: 'ex_pullup',   name: 'Pull-Up',     sets: 4, reps: 8, weight: 0 }],
      [{ exerciseId: 'ex_fsquat',   name: 'Front Squat', sets: 4, reps: 5, weight: 80 },
       { exerciseId: 'ex_pbench',   name: 'Pause Bench', sets: 4, reps: 6, weight: 70 },
       { exerciseId: 'ex_rdl',      name: 'Romanian Deadlift', sets: 3, reps: 8, weight: 90 }],
    ]},
  { trainerIdx: 1, title: 'Bodybuilding PPL 12 Semaines', weeks: 12, days: 5,
    days_ex: [
      [{ exerciseId: 'ex_bench',    name: 'Bench Press', sets: 4, reps: 8, weight: 70 },
       { exerciseId: 'ex_idb',      name: 'Incline DB Press', sets: 3, reps: 10, weight: 28 },
       { exerciseId: 'ex_fly',      name: 'Cable Fly', sets: 3, reps: 12, weight: 20 }],
      [{ exerciseId: 'ex_pullup',   name: 'Pull-Up', sets: 4, reps: 8, weight: 0 },
       { exerciseId: 'ex_row',      name: 'Barbell Row', sets: 4, reps: 8, weight: 60 },
       { exerciseId: 'ex_curl',     name: 'Bicep Curl', sets: 3, reps: 12, weight: 14 }],
      [{ exerciseId: 'ex_squat',    name: 'Back Squat', sets: 4, reps: 8, weight: 90 },
       { exerciseId: 'ex_rdl',      name: 'Romanian Deadlift', sets: 3, reps: 10, weight: 80 },
       { exerciseId: 'ex_leg',      name: 'Leg Press', sets: 3, reps: 12, weight: 160 }],
      [{ exerciseId: 'ex_ohp',      name: 'Overhead Press', sets: 4, reps: 8, weight: 40 },
       { exerciseId: 'ex_lat',      name: 'Lat Raise', sets: 3, reps: 15, weight: 8 }],
      [{ exerciseId: 'ex_deadlift', name: 'Deadlift', sets: 3, reps: 5, weight: 120 },
       { exerciseId: 'ex_curl',     name: 'Bicep Curl', sets: 3, reps: 12, weight: 14 }],
    ]},
  { trainerIdx: 1, title: 'Régime Prise de Masse 3500 kcal', type: 'diet', items: [
    { name: 'Petit-déjeuner (8h)', detail: '6 oeufs entiers + 80g flocons d\'avoine + 1 banane + 1 cuillère de miel (≈800 kcal, P: 35g, G: 80g, L: 35g)' },
    { name: 'Collation 1 (10h30)', detail: '30g whey + 1 poignée d\'amandes + 1 pomme (≈400 kcal, P: 30g, G: 35g, L: 18g)' },
    { name: 'Déjeuner (13h)', detail: '200g blanc de poulet + 200g riz basmati cuit + légumes grillés + 1 c.à.s huile d\'olive (≈900 kcal, P: 60g, G: 110g, L: 20g)' },
    { name: 'Collation 2 (16h - pré-workout)', detail: '40g whey + 50g flocons d\'avoine + 1 banane (≈450 kcal, P: 35g, G: 60g, L: 8g)' },
    { name: 'Post-workout (18h)', detail: '40g whey + 100g riz basmati (≈450 kcal, P: 35g, G: 70g, L: 3g)' },
    { name: 'Dîner (21h)', detail: '200g steak haché 5% + 300g patate douce + salade verte + 1 c.à.s huile d\'olive (≈850 kcal, P: 55g, G: 90g, L: 25g)' },
  ]},
  { trainerIdx: 2, title: 'CrossFit WOD Cycle 4 Semaines', weeks: 4, days: 4,
    days_ex: [
      [{ exerciseId: 'ex_thrust',  name: 'Thruster',  sets: 5, reps: 5, weight: 40 },
       { exerciseId: 'ex_pullup',  name: 'Pull-Up',   sets: 5, reps: 10, weight: 0 }],
      [{ exerciseId: 'ex_deadlift',name: 'Deadlift',  sets: 5, reps: 5, weight: 100 },
       { exerciseId: 'ex_burpee',  name: 'Burpee',    sets: 5, reps: 15, weight: 0 }],
      [{ exerciseId: 'ex_wall',    name: 'Wall Ball', sets: 5, reps: 20, weight: 9 },
       { exerciseId: 'ex_box',     name: 'Box Jump',  sets: 5, reps: 10, weight: 0 }],
      [{ exerciseId: 'ex_clean',   name: 'Clean & Jerk', sets: 5, reps: 5, weight: 50 }],
    ]},
];

const programIds = [];
programs.forEach(p => {
  const progId = id('prog');
  programIds.push(progId);
  if (p.type === 'diet') {
    db.programs.push({
      id: progId, gymId, trainerId: coachIds[p.trainerIdx], title: p.title, type: 'diet',
      items: p.items, createdAt: daysAgo(45),
    });
  } else {
    db.programs.push({
      id: progId, gymId, trainerId: coachIds[p.trainerIdx], title: p.title, type: 'workout',
      weeks: p.weeks, daysPerWeek: p.days, schedule: buildSchedule(p.weeks, p.days, p.days_ex),
      createdAt: daysAgo(45),
    });
  }
});

// =========================================================
// Assignments + check-offs + PRs
// =========================================================
const exerciseBasePRs = {
  'Ahmed Trabelsi':   { 'ex_squat': { hw: 140, reps: 5 }, 'ex_bench': { hw: 100, reps: 5 }, 'ex_deadlift': { hw: 180, reps: 3 } },
  'Imen Gharbi':      { 'ex_squat': { hw: 90, reps: 8 }, 'ex_bench': { hw: 55, reps: 8 }, 'ex_deadlift': { hw: 110, reps: 5 } },
  'Rami Jebali':      { 'ex_squat': { hw: 160, reps: 5 }, 'ex_bench': { hw: 115, reps: 5 }, 'ex_deadlift': { hw: 200, reps: 3 } },
  'Ines Cherni':      { 'ex_squat': { hw: 70, reps: 8 }, 'ex_bench': { hw: 50, reps: 8 } },
  'Hela Mansour':     { 'ex_squat': { hw: 80, reps: 8 }, 'ex_bench': { hw: 50, reps: 8 } },
  'Mariem Khlifi':    { 'ex_squat': { hw: 75, reps: 8 }, 'ex_bench': { hw: 45, reps: 8 } },
};

// Active members get an assignment; map member → program by index pattern
members.filter(m => ['active','trialing'].includes(m.status)).forEach((m, i) => {
  const progId = programIds[i % programIds.length];
  const prog = db.programs.find(p => p.id === progId);
  const sub = db.memberSubscriptions.find(s => s.memberId === m.id);
  const startedAt = sub ? sub.startAt : daysAgo(m.joinedDays);
  db.assignments.push({
    id: id('asg'), programId: progId, clientId: m.id, clientName: m.name,
    assignedAt: daysAgo(m.joinedDays - 5),
    startedAt, progress: rnd(15, 75),
    completedItems: [],
  });
  // Seed PRs for some members
  const memberPRs = exerciseBasePRs[m.name];
  if (memberPRs) {
    Object.entries(memberPRs).forEach(([exId, pr]) => {
      db.personalRecords.push({
        id: id('pr'), memberId: m.id, exerciseId: exId, exerciseName: prog.schedule ? prog.schedule.find(s=>s.exercises && s.exercises.find(e=>e.exerciseId===exId))?.exercises.find(e=>e.exerciseId===exId).name : exId,
        kind: 'heaviest_weight', value: pr.hw, repsAtValue: pr.reps,
        achievedAt: daysAgo(rnd(2, 30)),
      });
      db.personalRecords.push({
        id: id('pr'), memberId: m.id, exerciseId: exId, exerciseName: prog.schedule ? prog.schedule.find(s=>s.exercises && s.exercises.find(e=>e.exerciseId===exId))?.exercises.find(e=>e.exerciseId===exId).name : exId,
        kind: 'max_reps_at_weight', value: pr.hw, repsAtValue: pr.reps,
        achievedAt: daysAgo(rnd(2, 30)),
      });
    });
  }
});

// =========================================================
// Attendance — last 30 days for active members with streaks
// =========================================================
// Guarantee that at least 6 active members have a check-in TODAY so the
// owner's "today at gym" widget shows real numbers when pitching.
const todayCheckinMemberIds = members
  .filter(m => ['active','trialing'].includes(m.status))
  .slice(0, 6)
  .map(m => m.id);

members.forEach(m => {
  if (m.status === 'expired' || m.status === 'frozen') return;
  // Build up streak: today and previous days back m.streak
  for (let d = 0; d < Math.min(m.streak, 30); d++) {
    const checkIn = new Date(Date.now() - d * 86400000);
    // Skip Sundays for variety
    if (checkIn.getDay() === 0 && d > 0) continue;
    checkIn.setHours(rnd(6, 22), rnd(0, 59), 0, 0);
    // For the chosen today-checkin members, leave checkOutAt null if d===0
    // (so the dashboard's "open now" count is non-zero).
    const isToday = d === 0;
    const isOpen = isToday && todayCheckinMemberIds.includes(m.id);
    const checkOut = isOpen ? null : new Date(checkIn.getTime() + (60 + rnd(0, 60)) * 60 * 1000);
    db.attendance.push({
      id: id('att'), gymId, memberId: m.id,
      checkInAt: checkIn.toISOString(), checkOutAt: checkOut ? checkOut.toISOString() : null,
      method: ['qr','manual','search'][rnd(0,2)], note: null,
    });
  }
});

// =========================================================
// Meal logs + reviews + messages + notifications
// =========================================================
const mealCaptions = [
  'Petit-déj post-réveil, j\'ai pris 50g de flocons en plus',
  'Déjeuner pré-training, poulet + riz + brocoli',
  'Shake post-workout, 40g whey',
  'Dîner léger avant 20h',
  'Cheat meal du samedi soir 😅',
  'Collation entre 2 séances, banane + amandes',
  'Pdj rapide avant la salle, omelette 4 oeufs',
];
members.slice(0, 12).forEach((m, i) => {
  db.mealLogs.push({
    id: id('ml'), clientId: m.id, photo: null,
    caption: mealCaptions[i % mealCaptions.length],
    date: daysAgo(i),
    status: i % 3 === 0 ? 'pending' : 'reviewed',
    trainerFeedback: i % 3 === 0 ? null : (i % 2 === 0 ? 'Bien joué, les macros sont clean ✅' : 'Pense à boire plus, 2L/jour minimum 💧'),
  });
});

const reviewTexts = [
  { rating: 5, text: "Hatem est le meilleur coach que j'ai eu — j'ai gagné 30kg à mon squat en 3 mois." },
  { rating: 5, text: "Sirine m'a transformé physiquement, ses programmes sont précis et le suivi WhatsApp est top." },
  { rating: 5, text: "Karim motive même les jours où t'as pas envie. L'ambiance de la salle est parfaite." },
  { rating: 4, text: "Coaching sérieux, pas comme les autres salles qui te laissent te débrouiller seul." },
  { rating: 5, text: "Le meilleur rapport qualité/prix à Sousse. Vestiaires nickels, matériel au top." },
  { rating: 5, text: "J'avais testé 3 salles avant, Iron Temple est la seule où je me sens suivi." },
];
members.slice(0, 6).forEach((m, i) => {
  db.reviews.push({
    id: id('rev'), trainerId: coachIds[i % 3], clientId: m.id, clientName: m.name,
    rating: reviewTexts[i].rating, comment: reviewTexts[i].text,
    date: daysAgo(rnd(5, 60)),
  });
});

const msgs = [
  { from: 'coach', text: 'Salem, comment tu te sens sur le programme cette semaine ?' },
  { from: 'member', text: 'Bien mais le squat me fait mal au genou gauche' },
  { from: 'coach', text: 'Ok, on remplace par front squat et tu m\'envoies une vidéo lundi' },
  { from: 'member', text: 'Parfait merci coach 🙏' },
  { from: 'coach', text: 'N\'oublie pas de m\'envoyer ta feuille de suivi vendredi' },
];
for (let i = 0; i < msgs.length; i++) {
  const sender = msgs[i].from === 'coach' ? coachIds[0] : members[0].id;
  const receiver = msgs[i].from === 'coach' ? members[0].id : coachIds[0];
  db.messages.push({
    id: id('msg'), fromId: sender, toId: receiver,
    text: msgs[i].text, timestamp: daysAgo(i), read: i < 2,
  });
}

// Notifications for the owner + a few for members
db.notifications.push(
  { id: id('ntf'), gymId, userId: ownerId, kind: 'payment', title: '💳 Payment pending review',
    body: `${members[5].name} submitted a 100 DT D17 payment.`, link: '/owner/members/' + members[5].id, read: false, createdAt: daysAgo(1) },
  { id: id('ntf'), gymId, userId: ownerId, kind: 'pr', title: '🔥 New PR alert',
    body: `${members[0].name} hit a ${140}kg squat — heaviest yet.`, link: '/owner/members/' + members[0].id, read: false, createdAt: daysAgo(2) },
  { id: id('ntf'), gymId, userId: ownerId, kind: 'review', title: '⭐ New 5-star review',
    body: `${members[2].name} rated Coach Hatem 5/5.`, link: '/profile/' + coachIds[0].id, read: false, createdAt: daysAgo(3) },
);
members.slice(0, 6).forEach((m, i) => {
  db.notifications.push({
    id: id('ntf'), gymId, userId: m.id, kind: 'pr',
    title: `🔥 New PR: Back Squat`,
    body: `You hit 140kg × 5 — your heaviest yet.`, link: '/progress',
    read: i > 2, createdAt: daysAgo(rnd(0, 14)),
  });
  db.notifications.push({
    id: id('ntf'), gymId, userId: m.id, kind: 'checkin_reminder',
    title: `💪 Time to train`,
    body: `You haven't checked in today. Keep your streak alive.`,
    link: '/checkin', read: i % 2 === 0,
    createdAt: new Date().toISOString().slice(0,10) === isoDate(new Date()) ? new Date().toISOString() : daysAgo(0),
  });
});

// Gym subscription: 220 days ago, paid through now (active)
db.subscriptions.push({
  id: id('sub'), gymId, status: 'active', amount: 400, currency: 'DT',
  startedAt: daysAgo(220), paidThrough: inDays(15), trialEndsAt: null,
  createdAt: daysAgo(220), notes: 'Iron Temple Sousse — Pro tier',
});

// Audit log entries
db.auditLog.push(
  { id: id('aud'), actorId: ownerId, actorName: 'Sami Boukhris', actorRole: 'owner', gymId,
    action: 'gym.signup', target: { type: 'gym', id: gymId }, meta: null, at: daysAgo(220) },
  { id: id('aud'), actorId: coachIds[0], actorName: 'Hatem Bouazizi', actorRole: 'trainer', gymId,
    action: 'program.create', target: { type: 'program', id: programIds[0] }, meta: { title: 'Powerlifting 8 Semaines' }, at: daysAgo(45) },
  { id: id('aud'), actorId: coachIds[1], actorName: 'Sirine Mejri', actorRole: 'trainer', gymId,
    action: 'program.create', target: { type: 'program', id: programIds[2] }, meta: { title: 'Régime Prise de Masse 3500 kcal' }, at: daysAgo(40) },
  { id: id('aud'), actorId: ownerId, actorName: 'Sami Boukhris', actorRole: 'owner', gymId,
    action: 'payment.approve', target: { type: 'payment', id: 'demo' }, meta: { memberId: members[0].id, amount: 100, method: 'cash' }, at: daysAgo(2) },
);

writeDB(db);

console.log('\n=== PITCH-READY DEMO SEEDED ===\n');
console.log('Gym: Iron Temple Sousse');
console.log('  Owner:  demo-owner@ironlog.test / demo1234');
console.log('  Coach:  demo-coach-hatem@ironlog.test / demo1234');
console.log('  Member: demo-member1@ironlog.test / demo1234');
console.log('');
console.log('Stats:');
console.log('  Users:     ', db.users.length);
console.log('  Programs:  ', db.programs.length);
console.log('  Assignments:', db.assignments.length);
console.log('  Attendance: ', db.attendance.length);
console.log('  Subs:      ', db.memberSubscriptions.length);
console.log('  Payments:  ', db.memberPayments.length);
console.log('  Reviews:   ', db.reviews.length);
console.log('  PRs:       ', db.personalRecords.length);
console.log('  Notifs:    ', db.notifications.length);
console.log('  Audit log: ', db.auditLog.length);
