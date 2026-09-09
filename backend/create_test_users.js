const { supabase } = require('./db');
const bcrypt = require('bcryptjs');

async function setup() {
  const password = 'Password123!';
  const hash = await bcrypt.hash(password, 10);

  console.log('Creating Gym...');
  const { data: gym, error: gErr } = await supabase
    .from('gyms')
    .insert({
      id: 'gym_' + Math.random().toString(36).slice(2, 8),
      name: 'Test Iron Gym',
      location: 'Tunis, Tunisia',
      suspended: 0,
    })
    .select()
    .single();

  if (gErr) {
    console.error('Error creating gym:', gErr);
    return;
  }
  const gymId = gym.id;
  console.log('Gym created:', gymId);

  const users = [
    { email: 'super@ironlog.com', passwordHash: hash, role: 'super_admin', name: 'Super Admin' },
    { email: 'owner@testgym.com', passwordHash: hash, role: 'owner', name: 'Gym Owner', gymId: gymId },
    { email: 'coach@testgym.com', passwordHash: hash, role: 'trainer', name: 'Coach Mike', gymId: gymId },
    { email: 'member@testgym.com', passwordHash: hash, role: 'client', name: 'John Member', gymId: gymId },
  ];

  for (const u of users) {
    const { error: uErr } = await supabase.from('users').insert(u);
    if (uErr) console.error(`Error creating user ${u.email}:`, uErr);
    else console.log(`User created: ${u.email}`);
  }

  console.log('\n--- TEST CREDENTIALS ---');
  console.log('Password for all: ' + password);
  users.forEach(u => console.log(`${u.role}: ${u.email}`));
  console.log('------------------------');
}

setup();
