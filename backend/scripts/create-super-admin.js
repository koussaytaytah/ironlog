// One-time script: create a super admin user (you) with full access to every gym.
// Run: node scripts/create-super-admin.js
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { readDB, writeDB } = require('../db');

const EMAIL = 'admin@ironlog.tn';
const PASSWORD = 'ironlog-admin-2026';
const NAME = 'Super Admin';

(async () => {
  const db = readDB();
  if (db.users.find(u => u.email.toLowerCase() === EMAIL.toLowerCase())) {
    console.log('Super admin already exists:', EMAIL);
    process.exit(0);
  }
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = {
    id: 'usr_' + uuidv4().slice(0, 8),
    name: NAME,
    email: EMAIL,
    passwordHash,
    role: 'super_admin',
    gymId: null,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  writeDB(db);
  console.log('Super admin created:');
  console.log('  email:', EMAIL);
  console.log('  password:', PASSWORD);
  console.log('  user id:', user.id);
})();
