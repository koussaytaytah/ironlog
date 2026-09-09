const express = require('express');
const nodemailer = require('nodemailer');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Config for email
// In production, these would be env vars
const EMAIL_CONFIG = {
  user: process.env.EMAIL_USER || 'notifications@ironlog.tn',
  pass: process.env.EMAIL_PASS || 'password',
  from: process.env.EMAIL_FROM || 'no-reply@ironlog.tn'
};

async function sendEmail(to, subject, text, html) {
  // If no credentials, we just log to console (dev mode)
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('--- [DEV EMAIL] ---');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Body:', text);
    console.log('------------------');
    return { success: true, dev: true };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail', // Or custom SMTP
    auth: {
      user: EMAIL_CONFIG.user,
      pass: EMAIL_CONFIG.pass,
    },
  });

  return transporter.sendMail({
    from: EMAIL_CONFIG.from,
    to,
    subject,
    text,
    html,
  });
}

// Public contact endpoint for landing page
router.post('/contact', async (req, res) => {
  const { email, message, name } = req.body;
  if (!email || !message) {
    return res.status(400).json({ error: 'Email and message are required' });
  }

  try {
    await sendEmail(
      'admin@ironlog.tn',
      `New Lead from Landing Page: ${name || 'Unknown'}`,
      `From: ${email}\nName: ${name}\n\nMessage:\n${message}`
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Email error:', e);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

module.exports = router;
