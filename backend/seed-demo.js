// Seed Monastir demo data — generates 2 realistic gyms (for pitching to real gym owners)
// Run: node seed-demo.js

const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));

function id(prefix) { return prefix + '_' + Math.random().toString(36).slice(2, 10); }
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }

// ====================================================================
// GYM 1: "PowerHouse Monastir" — modern strength gym, owner real name
// ====================================================================
const gym1Id = id('gym');
const owner1Id = id('usr');
const coach1AId = id('usr');
const coach1BId = id('usr');
const coach1CId = id('usr');
const client1Ids = Array.from({length: 8}, () => id('usr'));

db.gyms.push({
  id: gym1Id,
  name: 'PowerHouse Monastir',
  createdAt: daysAgo(120),
  ownerId: owner1Id,
  logo: null,
  location: 'Centre-ville, Monastir 5000',
  description: 'Salle de musculation et powerlifting au coeur de Monastir. Coaching personnalisé, atmosphère sérieuse, équipement Eleiko.'
});

// Owner
db.users.push({
  id: owner1Id,
  name: 'Youssef Ben Salah',
  email: 'demo-owner1@ironlog.test',
  passwordHash: bcrypt.hashSync('demo1234', 10),
  role: 'owner',
  gymId: gym1Id,
  createdAt: daysAgo(120)
});

// Coaches
const coaches1 = [
  { id: coach1AId, name: 'Coach Mehdi', specialty: 'Powerlifting & Force', bio: '10 ans d\'expérience, certifié IPF', yearsExp: 10 },
  { id: coach1BId, name: 'Coach Amal', specialty: 'Bodybuilding & Nutrition', bio: 'Championne nationale 2023', yearsExp: 6 },
  { id: coach1CId, name: 'Coach Karim', specialty: 'CrossFit & HIIT', bio: 'Ex-athlète national, L2 CrossFit', yearsExp: 4 }
];

coaches1.forEach(c => {
  db.users.push({
    id: c.id,
    name: c.name,
    email: `demo-${c.name.toLowerCase().replace(/\s+/g,'')}@ironlog.test`,
    passwordHash: bcrypt.hashSync('demo1234', 10),
    role: 'trainer',
    gymId: gym1Id,
    createdAt: daysAgo(100),
    bio: c.bio,
    specialty: c.specialty,
    yearsExp: c.yearsExp
  });
});

// Members (mix of names that sound real in Tunisia)
const memberNames = [
  'Ahmed Trabelsi', 'Mariem Khlifi', 'Yassine Bouazizi', 'Imen Gharbi',
  'Mohamed Amri', 'Sarra Mejri', 'Bilel Hamdi', 'Nour El Houda'
];
client1Ids.forEach((cid, i) => {
  db.users.push({
    id: cid,
    name: memberNames[i],
    email: `demo-member${i+1}@ironlog.test`,
    passwordHash: bcrypt.hashSync('demo1234', 10),
    role: 'client',
    gymId: gym1Id,
    trainerId: coaches1[i % 3].id,
    createdAt: daysAgo(90 - i * 5)
  });
});

// Programs for gym 1
const programs1 = [
  { trainerId: coach1AId, title: 'Powerlifting — Programme Force 8 Semaines', type: 'workout',
    items: ['Squat 5x5 @ 80%','Bench Press 5x5 @ 80%','Deadlift 3x3 @ 85%','Overhead Press 4x6','Barbell Row 4x8','Front Squat 3x5','Pause Bench 3x6','Romanian Deadlift 3x8'] },
  { trainerId: coach1AId, title: 'Push/Pull/Legs — Intermédiaire', type: 'workout',
    items: ['Bench Press','Incline DB Press','Cable Fly','Overhead Press','Lateral Raise','Tricep Pushdown','Deadlift','Pull-Up','Barbell Row','Face Pull','Bicep Curl'] },
  { trainerId: coach1BId, title: 'Régime Prise de Masse 3500 kcal', type: 'diet',
    items: ['Petit-déjeuner: 6 oeufs + flocons d\'avoine + banane (800 kcal)','Déjeuner: poulet + riz + légumes (900 kcal)','Collation: shake whey + amandes (400 kcal)','Dîner: steak + patate douce + salade (850 kcal)','Post-workout: whey + riz basmati (550 kcal)'] },
  { trainerId: coach1BId, title: 'Bodybuilding Split 5 Jours', type: 'workout',
    items: ['Lundi — Push','Mardi — Pull','Mercredi — Legs','Jeudi — Bras','Vendredi — Full Body','Samedi — Cardio HIIT','Dimanche — Repos'] },
  { trainerId: coach1CId, title: 'CrossFit WOD — Semaine 1', type: 'workout',
    items: ['Fran (21-15-9 Thrusters + Pull-ups)','Cindy (20 min AMRAP)','Helen (3 RFT)','Grace (30 Clean & Jerk)','Murph (if you dare)'] }
];

const program1Ids = [];
programs1.forEach(p => {
  const progId = id('prog');
  program1Ids.push(progId);
  db.programs.push({
    id: progId,
    gymId: gym1Id,
    trainerId: p.trainerId,
    title: p.title,
    type: p.type,
    items: p.items.map(name => ({ name, detail: 'Voir coach pour charge et tempo' })),
    createdAt: daysAgo(60 - program1Ids.length * 5)
  });
});

// Assignments — distribute programs to members
client1Ids.forEach((cid, i) => {
  const progIdx = i % program1Ids.length;
  const progId = program1Ids[progIdx];
  const prog = db.programs.find(p => p.id === progId);
  const completedCount = Math.floor(Math.random() * prog.items.length * 0.7);
  const completedItems = prog.items.slice(0, completedCount).map(it => it.name);
  db.assignments.push({
    id: id('asn'),
    programId: progId,
    clientId: cid,
    clientName: db.users.find(u => u.id === cid).name,
    assignedAt: daysAgo(30 - i),
    progress: Math.round(completedCount / prog.items.length * 100),
    completedItems
  });
});

// Meal logs
const mealCaptions = [
  'Petit-déjeuner post-réveil','Déjeuner pré-training','Shake post-workout',
  'Dîner léger avant 20h','Collation entre 2 séances','Repas cheat du samedi'
];
const statuses = ['pending','approved','approved','pending'];
client1Ids.slice(0, 6).forEach((cid, i) => {
  db.mealLogs.push({
    id: id('ml'),
    clientId: cid,
    photo: null,
    caption: mealCaptions[i],
    date: new Date(Date.now() - i * 86400000).toISOString().slice(0,10),
    status: statuses[i % statuses.length],
    trainerFeedback: i % 2 === 0 ? null : 'Bien joué,继续保持' + (i % 2 ? '!' : '.')
  });
});

// Reviews
const reviewTexts = [
  'Mehdi est le meilleur coach que j\'ai eu — j\'ai gagné 30kg à mon squat en 3 mois.',
  'Amal m\'a transformé physiquement, ses programmes sont précis et le suivi WhatsApp est top.',
  'Karim motive même les jours où t\'as pas envie. L\'ambiance de la salle est parfaite.',
  'Coaching sérieux, pas comme les autres salles qui te laissent te débrouiller seul.'
];
client1Ids.slice(0, 4).forEach((cid, i) => {
  db.reviews.push({
    id: id('rev'),
    trainerId: coaches1[i % 3].id,
    clientId: cid,
    clientName: db.users.find(u => u.id === cid).name,
    rating: 4 + (i % 2),
    comment: reviewTexts[i],
    date: daysAgo(15 - i * 3)
  });
});

// Messages
const msgs = [
  { from: 'coach', to: 'client', text: 'Salem, comment tu te sens sur le programme cette semaine ?' },
  { from: 'client', to: 'coach', text: 'Bien mais le squat me fait mal au genou gauche' },
  { from: 'coach', to: 'client', text: 'Ok, on remplace par front squat et tu m\'envoies une vidéo lundi' },
  { from: 'client', to: 'coach', text: 'Parfait, merci coach' }
];
db.messages = db.messages.concat(msgs.map((m, i) => ({
  id: id('msg'),
  fromId: m.from === 'coach' ? coach1AId : client1Ids[0],
  toId: m.from === 'coach' ? client1Ids[0] : coach1AId,
  text: m.text,
  timestamp: daysAgo(i),
  read: i < 2
})));

// ====================================================================
// GYM 2: "Iron Temple Sousse" — bigger, more established
// ====================================================================
const gym2Id = id('gym');
const owner2Id = id('usr');
const coach2AId = id('usr');
const coach2BId = id('usr');
const client2Ids = Array.from({length: 12}, () => id('usr'));

db.gyms.push({
  id: gym2Id,
  name: 'Iron Temple Sousse',
  createdAt: daysAgo(180),
  ownerId: owner2Id,
  logo: null,
  location: 'Sousse Ville 4000',
  description: 'Salle référence à Sousse depuis 2015. 400m², équipement Hammer Strength, sauna, vestiaires premium.'
});

db.users.push({
  id: owner2Id,
  name: 'Sami Boukhris',
  email: 'demo-owner2@ironlog.test',
  passwordHash: bcrypt.hashSync('demo1234', 10),
  role: 'owner',
  gymId: gym2Id,
  createdAt: daysAgo(180)
});

const coaches2 = [
  { id: coach2AId, name: 'Coach Hatem', specialty: 'Strength & Conditioning', bio: 'Coach équipe nationale junior haltérophilie', yearsExp: 12 },
  { id: coach2BId, name: 'Coach Sirine', specialty: 'Yoga & Mobilité', bio: 'Certifiée Yoga Alliance 500h', yearsExp: 5 }
];
coaches2.forEach(c => {
  db.users.push({
    id: c.id,
    name: c.name,
    email: `demo-${c.name.toLowerCase().replace(/\s+/g,'')}@ironlog.test`,
    passwordHash: bcrypt.hashSync('demo1234', 10),
    role: 'trainer',
    gymId: gym2Id,
    createdAt: daysAgo(150),
    bio: c.bio,
    specialty: c.specialty,
    yearsExp: c.yearsExp
  });
});

const member2Names = ['Rami Jebali','Ines Cherni','Fares Belhaj','Hela Mansour','Zied Ayari','Lina Khelifi','Montassar Feki','Rim Daoud','Adel Sfar','Wafa Ghribi','Skander Toumi','Asma Rezig'];
client2Ids.forEach((cid, i) => {
  db.users.push({
    id: cid,
    name: member2Names[i],
    email: `demo-sousse-m${i+1}@ironlog.test`,
    passwordHash: bcrypt.hashSync('demo1234', 10),
    role: 'client',
    gymId: gym2Id,
    trainerId: coaches2[i % 2].id,
    createdAt: daysAgo(120 - i * 8)
  });
});

const programs2 = [
  { trainerId: coach2AId, title: 'Haltérophilie — Technique Snatch', type: 'workout',
    items: ['Snatch Pull 5x3','Hang Snatch 5x2','Full Snatch singles','Snatch Balance 4x3','Front Squat 4x5','Good Morning 3x8'] },
  { trainerId: coach2AId, title: 'Régime Sèche 2200 kcal', type: 'diet',
    items: ['PDJ: omelette + pain complet (350 kcal)','Déj: poulet grillé + quinoa (500 kcal)','Collation: yaourt grec + fruits rouges (200 kcal)','Dîner: poisson + légumes vapeur (450 kcal)','Shake pré-training (250 kcal)','Dîner 2: soupe légumes (200 kcal)'] },
  { trainerId: coach2BId, title: 'Yoga & Mobilité — 30 Jours', type: 'workout',
    items: ['Vinyasa Flow 30min','Yin Yoga 45min','Mobility Hips & Shoulders','Sun Salutation A','Sun Salutation B','Pigeon Pose hold','Savasana'] }
];

const program2Ids = [];
programs2.forEach(p => {
  const progId = id('prog');
  program2Ids.push(progId);
  db.programs.push({
    id: progId,
    gymId: gym2Id,
    trainerId: p.trainerId,
    title: p.title,
    type: p.type,
    items: p.items.map(name => ({ name, detail: 'À adapter selon ton niveau' })),
    createdAt: daysAgo(45 - program2Ids.length * 7)
  });
});

client2Ids.forEach((cid, i) => {
  const progId = program2Ids[i % program2Ids.length];
  const prog = db.programs.find(p => p.id === progId);
  const completedCount = Math.floor(Math.random() * prog.items.length * 0.8);
  db.assignments.push({
    id: id('asn'),
    programId: progId,
    clientId: cid,
    clientName: db.users.find(u => u.id === cid).name,
    assignedAt: daysAgo(25 - i),
    progress: Math.round(completedCount / prog.items.length * 100),
    completedItems: prog.items.slice(0, completedCount).map(it => it.name)
  });
});

// ====================================================================
// Save
// ====================================================================
fs.writeFileSync(path.join(__dirname, 'data.json'), JSON.stringify(db, null, 2));
console.log('\n=== MONASTIR DEMO DATA SEEDED ===\n');
console.log('Gym 1: PowerHouse Monastir');
console.log('  Owner:  demo-owner1@ironlog.test / demo1234');
console.log('  Coach:  demo-coachmehdi@ironlog.test / demo1234');
console.log('  Member: demo-member1@ironlog.test / demo1234');
console.log('');
console.log('Gym 2: Iron Temple Sousse');
console.log('  Owner:  demo-owner2@ironlog.test / demo1234');
console.log('  Coach:  demo-coachhatem@ironlog.test / demo1234');
console.log('  Member: demo-sousse-m1@ironlog.test / demo1234');
console.log('\nGyms now in DB:', db.gyms.length);
console.log('Users now in DB:', db.users.length);
console.log('Programs now in DB:', db.programs.length);
console.log('Assignments now in DB:', db.assignments.length);
console.log('\n[IMPORTANT] These gyms will appear on the public landing page when pitching.');