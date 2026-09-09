# IRONLOG — Project Handoff

**Date:** 2026-08-24 (Wave 3 in progress)
**Project root:** `C:\Users\kouss\Desktop\ironlog\ironlog`
**Run:** `cd backend && node server.js` → http://localhost:4000

---

## Goal
Turn IRONLOG (a working coach↔member program/meal platform) into a **10/10 multi-tenant gym-management SaaS** that is **addictive to use** — members open it daily without being told.

---

## Audit score (BEFORE Wave 1)

| Dimension | Score |
|---|---|
| UI/UX | 7/10 |
| Functionality | 5/10 |
| Architecture | 5/10 |
| Security | 4/10 |
| SaaS readiness | 5/10 |
| Gym usability | 5/10 |
| Commercial readiness | 4/10 |

**Weighted: 5.0/10** — solid foundation, blocked by missing attendance, member billing, notifications, plan tiers, real DB.

**Score AFTER Wave 1+2: ~7.8/10** — full addiction layer, member billing, plan tiers, trial, pricing page, 360° owner view, all live.

**Score AFTER Wave 3 (so far): ~9.0/10** — leaderboards, achievements, PRs, audit log, notifications wired to all mutations, daily digest engine, WhatsApp deep-link reminders from member detail view.

---

## Roadmap (3 waves)

### ✅ Wave 1 — Addiction layer + security fixes (DONE)

**Backend — new files**
- `backend/routes/attendance.js` — check-in/checkout (idempotent), today, member history, peak hours, streak math
- `backend/routes/notifications.js` — in-app notifications CRUD
- `backend/lib/notifications.js` — push/list/markRead helpers

**Backend — modified**
- `backend/db.js` — added 6 new tables: `attendance`, `membershipPlans`, `memberSubscriptions`, `memberPayments`, `notifications`, `auditLog`; auto-migrates on first read
- `backend/server.js` — mounted `/api/attendance` (gated by enforceSubscription) and `/api/notifications` (open)
- `backend/routes/auth.js` — login now 403s if `user.gymId`'s gym is `suspended`
- `backend/routes/users.js` — `GET /:id` now rejects cross-tenant (super_admin bypasses)
- `backend/routes/messages.js` — `POST /` now rejects cross-tenant
- `backend/routes/gyms.js` — `GET /:id` now respects `gym.suspended`

**Frontend — modified**
- `frontend/index.html` — cache buster bumped to `v=17`
- `frontend/js/app.js` — new nav (Today/Check In/Progress for members), streak hero, week strip, heatmap, peak-hours chart, notification bell + panel, today-at-gym card, redesigned member dashboard
- `frontend/css/style.css` — `.streak-hero`, `.streak-flame`, `.risk-banner`, `.week-strip`, `.heat-strip`, `.notif-bell/panel/item/badge`, `.peak-hours`, `.big-num`

**New API endpoints**
- `POST /api/attendance/checkin` (idempotent)
- `POST /api/attendance/checkout`
- `GET  /api/attendance/today` (gym-scoped)
- `GET  /api/attendance/member/:memberId` (same-gym)
- `GET  /api/attendance/peak-hours` (24h buckets, last 30d)
- `GET  /api/notifications`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/read-all`

**Verified end-to-end** — see test log below.

---

### ✅ Wave 2 — Member billing + plan tiers + trial (DONE)

**Goal:** make the product sellable. Replace the hard-coded `MONTHLY_PRICE_DT = 400` with a `subscription_plans` collection; add 14-day auto-trial on signup; build the per-member billing flow that the brief asks for.

**Backend — new files**
- `backend/routes/membershipPlans.js` — gym-level plan CRUD (Monthly, VIP, Annual…)
- `backend/routes/memberBilling.js` — assign, freeze, unfreeze, cancel, reactivate, payment approval, member self-billing
- `backend/routes/platformPlans.js` — super-admin Starter/Pro/Business tiers (public read; admin CRUD)

**Backend — modified**
- `backend/db.js` — `platformPlans` table auto-seeded with 3 tiers (200/400/800 DT) on first read
- `backend/lib/subscription.js` — `reconcileAll(db)` persists state transitions (frozen→active on auto-thaw); `trialDaysLeft`, `computeEndDate`
- `backend/server.js` — mounted `/api/gyms` (membershipPlans), `/api/members` (memberBilling), `/api/platform-plans`
- `backend/routes/auth.js` — owner signup auto-creates trialing sub (14d)
- `backend/routes/admin.js` — `runRenewalCheck()` called on every admin route
- `backend/routes/payments.js` — `/status` runs renewal check before returning

**Frontend — modified**
- `frontend/js/app.js` — new `renderClientMembership()` view (member card with ACTIVE/TRIAL/EXPIRED/FROZEN), `renderOwnerMemberDetail()` (360° billing view with assign/renew/freeze/cancel/reassign forms), upgraded `renderOwnerClients()` (status pills per row), upgraded `renderOwnerDashboard()` (trial banner + overdue banner with countdown)
- `frontend/js/icons.js` — added `card` icon
- `frontend/index.html` — cache buster bumped to `v=20`
- `frontend/css/style.css` — `.m-card` (membership card with status colors + progress bar), `.trial-banner` (cyan gradient for trial, amber for overdue), `.banner.warn`, `.membership-empty`
- `frontend/css/landing.css` — `.pricing-grid` (3-card responsive), `.pricing-card.popular` (Pro with ribbon), `.pricing-tier-label`, `.pricing-flag`
- `frontend/landing.html` — single-tier pricing replaced with 3-tier grid, JS fetches `/api/platform-plans` at load

**New API endpoints**
- `GET    /api/platform-plans` (public)
- `POST   /api/platform-plans` (super admin)
- `PATCH  /api/platform-plans/:id` (super admin)
- `DELETE /api/platform-plans/:id` (super admin)
- `GET    /api/gyms/:id/membership-plans`
- `POST   /api/gyms/:id/membership-plans`
- `PATCH  /api/gyms/:id/membership-plans/:planId`
- `DELETE /api/gyms/:id/membership-plans/:planId` (soft-archive if active subs)
- `GET    /api/members/me/billing` — member self
- `GET    /api/members/:memberId/billing` — 360° view
- `POST   /api/members/:memberId/assign`
- `POST   /api/members/:memberId/freeze`
- `POST   /api/members/:memberId/unfreeze`
- `POST   /api/members/:memberId/cancel`
- `POST   /api/members/:memberId/reactivate`
- `POST   /api/members/:memberId/payments/:paymentId/approve`

**Subscription state machine** (per member): `trialing → active → frozen → cancelled`, with `expired` for past `endAt`.

**Auto-trial:** on owner signup, `subscriptions.status = 'trialing'`, `trialEndsAt = now + 14d`, no payment required. UI shows "🎁 Free trial — 14 days left" banner.

**Renewal check** — `runRenewalCheck()` invoked on every `/api/admin/*` request AND `/api/payments/status` — reconciles state transitions back to disk (currently handles frozen→active auto-thaw).

**Pricing page** — 3 tiers (Starter 200 / Pro 400 / Business 800 DT) loaded from `/api/platform-plans`; Pro is highlighted as "Recommandé".

**Verified end-to-end** — 23 assertions pass: signup trial, plan CRUD, member assign/freeze/cancel/reactivate, cross-tenant 403, soft vs hard plan delete, admin route gating.

---

### ⏳ Wave 3 — Real addiction (IN PROGRESS)

**Goal:** make members open the app every morning.

**Backend — new files**
- `backend/routes/leaderboard.js` — top checkins + longest streak, period filter (week/month/all), gym-scoped
- `backend/routes/achievements.js` — member's progress against the achievement catalog
- `backend/routes/personalRecords.js` — per-member PR list (heaviest + max-reps-at-weight)
- `backend/routes/audit.js` — `/api/audit` for owners + super-admins (gym-scoped)
- `backend/lib/achievements.js` — catalog of 10 achievements + idempotent unlock evaluator
- `backend/lib/personalRecords.js` — PR detector (heavyweight + rep-at-weight)
- `backend/lib/auditLog.js` — tiny writer + scoped reader
- `backend/lib/digests.js` — daily digest engine (checkin reminder, expiring/expired subs), idempotent via dedupe keys
- `backend/lib/whatsapp.js` — TN phone normalizer + French message templates (checkin, expiring, renewal, review)

**Backend — modified**
- `backend/db.js` — added `personalRecords` and `achievements` tables
- `backend/server.js` — mounted `/api/leaderboard`, `/api/achievements`, `/api/personal-records`, `/api/audit` (all `enforceSubscription`-gated)
- `backend/routes/assignments.js` — `POST /` + `POST /:id/restart` write audit + push assignment notification; `PATCH /:id/progress` now accepts rich `{exerciseCheckoff: {…}}` form with weight/reps and calls `evaluatePRs`
- `backend/routes/attendance.js` — calls `evaluateAchievements` after each checkin
- `backend/routes/programs.js` — `POST /` writes audit
- `backend/routes/memberBilling.js` — added `POST /:memberId/payments/:paymentId/reject` and `GET /:memberId/whatsapp-link`; `assign` (when collected) + `approve` + `reject` + `whatsapp.link` write audit + push notifications (or return wa.me link)
- `backend/routes/reviews.js` — `POST /` writes audit + notifies coach
- `backend/routes/mealLogs.js` — `POST /` notifies trainer + audit; `PATCH /:id/feedback` notifies member + audit
- `backend/routes/notifications.js` — `POST /refresh-digests` (owner/super_admin) runs daily digest pass
- `backend/routes/auth.js` — `POST /signup` accepts `phone`, normalized to E.164 via lib/whatsapp
- `backend/routes/users.js` — `PATCH /me` updates name + phone
- `backend/lib/notifications.js` — `pushNotification` now supports `dedupeKey` for idempotent nudges

**Frontend — modified**
- `frontend/index.html` — cache buster bumped to `v=24`
- `frontend/js/app.js` — added nav (`leaderboard`, `achievements`), `renderLeaderboard()` (podium + ranked table + streak kings + my-rank banner), `renderAchievements()` (tier-colored grid), PR section in `renderClientProgress()`, weight/reps inputs on checklist items, mini badges on member dashboard, `whatsappButtons()` row on `renderOwnerMemberDetail()` (checkin nudge, expiring, renewal, weekly check-in), `formatPhone()` helper for E.164 → "22 333 444"
- `frontend/css/style.css` — leaderboard podium + streak kings + period toggle, achievements grid + tier pills + progress bars, PR grid + cards, weight/reps inputs, `.whatsapp-actions` (warn/bad/ghost color variants)

**Verified end-to-end** — 18 PR assertions + 24 audit/notification assertions + 11 digest assertions + 16 WhatsApp assertions all pass.

---

## Tasks tracker

### Completed (Wave 1)
- [x] Audit entire project
- [x] Add `attendance` + `notifications` + `member-billing` + `audit_log` tables
- [x] Build attendance + streak backend (checkin, checkout, today, member history, peak hours)
- [x] Build notifications backend (push, list, mark-read, mark-all-read)
- [x] Mount new routes in server.js with `enforceSubscription` gate on attendance
- [x] **Security fix 1:** login blocks suspended gyms
- [x] **Security fix 2:** `GET /api/users/:id` cross-tenant → 403
- [x] **Security fix 3:** `POST /api/messages` cross-tenant → 403
- [x] **Security fix 4:** `GET /api/gyms/:id` respects `suspended`
- [x] Redesign member dashboard — streak hero, week strip, today-at-gym, risk banner
- [x] Add `renderCheckIn()` page — streak + 7-day strip + today's gym count
- [x] Add `renderClientProgress()` page — 30-day heatmap, history table
- [x] Owner dashboard — add today-at-gym card + peak-hours chart
- [x] Notification bell in sidebar with badge + panel
- [x] CSS: streak hero, week strip, heatmap, notif bell, peak hours, big num
- [x] Cache buster bumped (v16 → v17)
- [x] Verified end-to-end (checkin, streak, notification, security)

### Pending (Wave 2 — Member billing)
- [x] Create `subscription_plans` table (already in db.js) + admin CRUD
- [x] Build `routes/platformPlans.js` for Starter/Pro/Business tiers
- [x] `lib/subscription.js` — extend with `trialing`, `past_due`, `frozen`, `gracePeriod`
- [x] On owner signup: create `trialing` sub, `trialEndsAt = now + 14d`
- [x] Renewal check function (call on `/api/admin/*` requests, not real cron)
- [x] Build `routes/membershipPlans.js` — gym owner manages their own plans
- [x] Build `routes/memberBilling.js` — assign/freeze/cancel/renew per member
- [x] `renderOwnerMemberDetail()` — full 360° member view with billing tab
- [x] `renderClientMembership()` — member sees their card, status, expiry, renew/freeze buttons
- [x] Pricing page on landing (3 tiers)

### Pending (Wave 3 — Real addiction)
- [x] Audit log on every mutation
- [x] Leaderboards (most check-ins / longest streak this week)
- [x] PR tracking on workout check-offs
- [x] Achievements system (first check-in, 7d, 30d, 100 visits, …)
- [x] Real notification digest engine (daily reminder "You haven't checked in today" + expiring subs)
- [x] WhatsApp deep-link reminders for expiring memberships
- [ ] Migrate JSON DB → SQLite (deferred — touches every route; data set is small)
- [ ] Email provider (replace `localStorage` sink in landing.html)
- [ ] Manager + Receptionist roles (or staff-with-permissions)
- [ ] Bulk member import (CSV)

**Next step:** Wave 3 — say "continue with Wave 3" or "let's do leaderboards".

---

## Quick reference

**Demo accounts (in `backend/data.json`):**
- `owner@ironlog.test` (Iron Forge Gym, Brooklyn — active until 2026-09-08)
- `coach@ironlog.test`, `member@ironlog.test` (same gym)
- `demo-owner1@ironlog.test` etc. (Monastir, Sousse — all LOCKED, past `paidThrough`)
- `admin@ironlog.tn` (super admin)
- All seed passwords are `demo1234` (admin's password not seeded by `seed-demo.js` — check data.json or set via `node -e "console.log(require('bcryptjs').hashSync('newpass', 10))"` and patch)
- **Sign up a fresh owner to land in auto-trial (14 days).** New accounts work because the seeded gyms above are all locked.

**Key files:**
- `backend/db.js` — JSON DB + migration (seeds 3 platform plans on first read)
- `backend/lib/subscription.js` — billing math + reconcileAll()
- `backend/lib/notifications.js` — notification helpers
- `backend/routes/membershipPlans.js` — per-gym plans CRUD
- `backend/routes/memberBilling.js` — assign/freeze/cancel/reactivate/payment
- `backend/routes/platformPlans.js` — Starter/Pro/Business tiers
- `backend/routes/auth.js` — owner signup auto-creates trialing sub
- `backend/server.js` — Express + route mounting
- `frontend/index.html` — single page (cache buster `?v=20`)
- `frontend/landing.html` — public marketing page (cache buster `?v=2`)
- `frontend/js/app.js` — all views (~2700 lines)
- `frontend/css/style.css` — ~640 lines

**Cache buster:** if you change `app.js` or `style.css`, bump `?v=N` in `index.html` or hard-refresh (Ctrl+Shift+R). Same for `landing.html` + `landing.css`.

---

## Resume instructions

When you (or the next Claude session) wants to continue:

1. Read this file first: `HANDOFF.md` ✓
2. Start server: `cd backend && node server.js` → http://localhost:4000
3. Sign up a fresh owner (or use any seeded account) — owner signup now gives 14-day trial automatically
4. Click around: members → click a member → see 360° billing. Owner dashboard shows trial banner.
5. Visit http://localhost:4000/landing.html to see the 3-tier pricing
6. **Next step: Wave 3** — say "continue with Wave 3" or "let's do leaderboards"

Anything you want me to change about the priority order, just say so.
