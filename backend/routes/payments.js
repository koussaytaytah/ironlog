const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { supabase, MONTHLY_PRICE_DT } = require('../db');
const { authRequired, superAdminRequired } = require('../middleware/auth');
const { summarize } = require('../lib/subscription');

const router = express.Router();

const receiptsDir = path.join(__dirname, '../uploads/receipts');
if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });

const ALLOWED_METHODS = ['d17', 'flouci', 'ccp', 'bank', 'cash'];

const receiptStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads/receipts');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, 'rcpt_' + req.user.id + '_' + Date.now() + ext);
  },
});
const receiptUpload = multer({
  storage: receiptStorage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif|heic|heif)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Receipt must be an image (PNG, JPEG, WEBP, GIF, HEIC)'));
  },
});

function add30Days(iso) {
  const d = new Date(iso);
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}

async function getPublicPayment(payment) {
  const { data: gym } = await supabase.from('gyms').select('name').eq('id', payment.gymId).single();
  const { data: submitter } = await supabase.from('users').select('name').eq('id', payment.submittedBy).single();
  const { data: reviewer } = await supabase.from('users').select('name').eq('id', payment.reviewedBy).single();

  return {
    ...payment,
    gymName: gym ? gym.name : null,
    submittedByName: submitter ? submitter.name : null,
    reviewedByName: reviewer ? reviewer.name : (payment.reviewedBy === 'system' ? 'system' : null),
  };
}

router.get('/status', authRequired, async (req, res) => {
  if (req.user.role === 'super_admin') return res.json({ role: 'super_admin' });
  if (!req.user.gymId) return res.status(400).json({ error: 'No gym linked' });

  const { data: sub, error: sErr } = await supabase.from('subscriptions').select('*').eq('gymId', req.user.gymId).maybeSingle();
  if (sErr) return res.status(500).json({ error: sErr.message });

  const { data: gym, error: gErr } = await supabase.from('gyms').select('name').eq('id', req.user.gymId).single();
  if (gErr) return res.status(400).json({ error: 'Gym not found' });

  res.json({
    gymName: gym.name,
    monthlyPriceDT: MONTHLY_PRICE_DT,
    subscription: summarize(sub),
  });
});

router.post('/', authRequired, receiptUpload.single('receipt'), async (req, res) => {
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'Only gym owners can submit payments' });
  const { method, periodStart, note } = req.body;
  if (!ALLOWED_METHODS.includes(method)) {
    return res.status(400).json({ error: `method must be one of: ${ALLOWED_METHODS.join(', ')}` });
  }
  const start = periodStart ? new Date(periodStart) : new Date();
  if (isNaN(start.getTime())) return res.status(400).json({ error: 'periodStart must be a valid date' });
  const end = add30Days(start.toISOString());

  const payment = {
    id: 'pay_' + uuidv4().slice(0, 8),
    gymId: req.user.gymId,
    amount: MONTHLY_PRICE_DT,
    method,
    receiptUrl: req.file ? '/uploads/receipts/' + req.file.filename : null,
    submittedBy: req.user.id,
    submittedAt: new Date().toISOString(),
    reviewedBy: null,
    reviewedAt: null,
    status: 'pending',
    rejectionReason: null,
    periodStart: start.toISOString(),
    periodEnd: end,
    note: note || null,
  };

  const { error: pErr } = await supabase.from('payments').insert(payment);
  if (pErr) return res.status(500).json({ error: pErr.message });

  res.json(await getPublicPayment(payment));
});

router.get('/mine', authRequired, async (req, res) => {
  if (req.user.role === 'super_admin') return res.json([]);
  const { data: payments, error } = await supabase.from('payments').select('*').eq('gymId', req.user.gymId).order('submittedAt', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const result = [];
  for (const p of payments) {
    result.push(await getPublicPayment(p));
  }
  res.json(result);
});

router.get('/pending', authRequired, superAdminRequired, async (req, res) => {
  const { data: payments, error } = await supabase.from('payments').select('*').eq('status', 'pending').order('submittedAt', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  const result = [];
  for (const p of payments) {
    result.push(await getPublicPayment(p));
  }
  res.json(result);
});

router.get('/all', authRequired, superAdminRequired, async (req, res) => {
  const { data: payments, error } = await supabase.from('payments').select('*').order('submittedAt', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const result = [];
  for (const p of payments) {
    result.push(await getPublicPayment(p));
  }
  res.json(result);
});

router.post('/:id/approve', authRequired, superAdminRequired, async (req, res) => {
  const { data: payment, error: pErr } = await supabase.from('payments').select('*').eq('id', req.params.id).single();
  if (pErr || !payment) return res.status(404).json({ error: 'Payment not found' });
  if (payment.status !== 'pending') return res.status(400).json({ error: `Payment already ${payment.status}` });

  const paymentUpdates = {
    status: 'approved',
    reviewedBy: req.user.id,
    reviewedAt: new Date().toISOString(),
    rejectionReason: null,
  };

  const { error: upErr } = await supabase.from('payments').update(paymentUpdates).eq('id', req.params.id);
  if (upErr) return res.status(500).json({ error: upErr.message });

  let sub = await supabase.from('subscriptions').select('*').eq('gymId', payment.gymId).maybeSingle();
  sub = sub.data;

  if (!sub) {
    const newSub = {
      id: 'sub_' + uuidv4().slice(0, 8),
      gymId: payment.gymId,
      status: 'active',
      amount: MONTHLY_PRICE_DT,
      currency: 'DT',
      startedAt: payment.periodStart,
      paidThrough: payment.periodEnd,
      createdAt: new Date().toISOString(),
      notes: null,
    };
    const { error: sInsErr } = await supabase.from('subscriptions').insert(newSub);
    if (sInsErr) return res.status(500).json({ error: sInsErr.message });
    sub = newSub;
  } else {
    const existing = new Date(sub.paidThrough).getTime();
    const candidate = new Date(payment.periodEnd).getTime();
    const updates = { status: 'active', amount: MONTHLY_PRICE_DT };
    if (candidate > existing) updates.paidThrough = payment.periodEnd;

    const { error: sUpErr } = await supabase.from('subscriptions').update(updates).eq('id', sub.id);
    if (sUpErr) return res.status(500).json({ error: sUpErr.message });
    sub = { ...sub, ...updates };
  }

  res.json({
    payment: await getPublicPayment({ ...payment, ...paymentUpdates }),
    subscription: summarize(sub),
  });
});

router.post('/:id/reject', authRequired, superAdminRequired, async (req, res) => {
  const reason = (req.body && req.body.reason) ? String(req.body.reason).trim() : '';
  if (!reason) return res.status(400).json({ error: 'reason is required when rejecting a payment' });

  const { data: payment, error: pErr } = await supabase.from('payments').select('*').eq('id', req.params.id).single();
  if (pErr || !payment) return res.status(404).json({ error: 'Payment not found' });
  if (payment.status !== 'pending') return res.status(400).json({ error: `Payment already ${payment.status}` });

  const updates = {
    status: 'rejected',
    reviewedBy: req.user.id,
    reviewedAt: new Date().toISOString(),
    rejectionReason: reason,
  };

  const { error: upErr } = await supabase.from('payments').update(updates).eq('id', req.params.id);
  if (upErr) return res.status(500).json({ error: upErr.message });

  res.json(await getPublicPayment({ ...payment, ...updates }));
});

module.exports = router;
