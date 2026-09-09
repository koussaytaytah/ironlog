const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// Make sure the uploads folder exists (meal check-in photos live here)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadsDir));

const { enforceSubscription } = require('./middleware/auth');

app.use('/api/auth', require('./routes/auth'));
// Subscription-locked gyms are blocked from all gym-scoped routes (except auth/payments/admin).
// The public GET /api/gyms and GET /api/gyms/:id are reached from the landing page before
// login, so they stay ungated. Per-route gating is already in place in each router.
app.use('/api/gyms', enforceSubscription, require('./routes/gyms'));
app.use('/api/programs', enforceSubscription, require('./routes/programs'));
app.use('/api/assignments', enforceSubscription, require('./routes/assignments'));
app.use('/api/meallogs', enforceSubscription, require('./routes/mealLogs'));
app.use('/api/messages', enforceSubscription, require('./routes/messages'));
app.use('/api/reviews', enforceSubscription, require('./routes/reviews'));
app.use('/api/users', enforceSubscription, require('./routes/users'));
app.use('/api/admin', require('./routes/admin')); // admin always bypasses
app.use('/api/chat', require('./routes/chat'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/attendance', enforceSubscription, require('./routes/attendance'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/email', require('./routes/email'));
app.use('/api/gyms', require('./routes/membershipPlans'));        // /api/gyms/:id/membership-plans
app.use('/api/members', enforceSubscription, require('./routes/memberBilling')); // /api/members/:id/...
app.use('/api/platform-plans', require('./routes/platformPlans')); // GET public, others super-admin
app.use('/api/leaderboard', enforceSubscription, require('./routes/leaderboard'));
app.use('/api/achievements', enforceSubscription, require('./routes/achievements'));
app.use('/api/personal-records', enforceSubscription, require('./routes/personalRecords'));
app.use('/api/audit', enforceSubscription, require('./routes/audit'));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'ironlog-backend' }));

// Serve the frontend (static files) from the same server, so the whole app
// runs from one process at http://localhost:4000
const frontendDir = path.join(__dirname, '../frontend');
app.use(express.static(frontendDir));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(frontendDir, 'index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`IRONLOG backend running → http://localhost:${PORT}`));
