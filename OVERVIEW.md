# IRONLOG — One-page Overview

> A short pitch, the full service inventory, and a phone-friendliness audit.
> Written for gym owners evaluating the platform. No code; just the product.

---

## The pitch (one paragraph)

**IRONLOG is the all-in-one app that turns "join the gym" into "actually show up every day."** It's a multi-tenant SaaS for gym owners and their coaching staff: every member gets a personal streak, a daily check-in, a coach-assigned workout or meal plan, and a phone-friendly feed of PRs, achievements, and WhatsApp nudges when their subscription is about to expire. The owner gets a 360° dashboard — who's in the gym right now, peak hours this month, who's about to churn, which members owe what — and can run the entire operation from one screen on a phone or laptop. **Pricing: 400 DT/month per gym** (≈ $130 USD), 14-day free trial, no setup fees. Built in Tunisia, for Tunisian gyms; works in French or English.

---

## Who it's for

- **Gym owners** who want to see real engagement numbers, not just "members on file"
- **Coaches** who are tired of WhatsApp spreadsheets for tracking their clients' programs
- **Members** who want to know "am I getting stronger?" without thinking about it

---

## The demo (live right now)

There's one demo gym pre-loaded with believable data: **Iron Temple Sousse** — 18 members, 3 coaches, 4 programs, 159 check-ins over the last 30 days, 32 payments on the ledger, 30 personal records, 6 reviews. All passwords are `demo1234`.

| Role | Email |
|---|---|
| Owner  | `demo-owner@ironlog.test` |
| Coach  | `demo-coach-hatem@ironlog.test`, `demo-coach-sirine@ironlog.test`, `demo-coach-karim@ironlog.test` |
| Member | `demo-member1@ironlog.test` … `demo-member18@ironlog.test` |

Live URL: **http://localhost:4000** (landing page at `/landing.html`)

To regenerate the demo: `cd backend && node seed-pitch.js`

---

## Service inventory — what we ship

Every feature below is in production today. Each row is labeled **mobile** (looks great on a phone), **desktop** (full layout), or both.

### For members

| Service | Mobile | Desktop | Notes |
|---|---|---|---|
| Login + signup with phone number | ✓ | ✓ | Phone is E.164, normalized, used for WhatsApp deep-links |
| Member dashboard — streak hero, week strip, today's check-in | ✓ | ✓ | Mobile-first, single column on phones |
| Daily check-in / check-out (idempotent — won't double-count) | ✓ | ✓ | QR, manual search, or coach-side check-in |
| Streak math with 36-hour grace window | ✓ | ✓ | Don't lose streak if you check in late evening or early morning |
| Today's workout — exactly what the coach assigned, with weight/reps inputs | ✓ | ✓ | PR auto-detected when you log weight/reps |
| Today's meal plan | ✓ | ✓ | Photo upload + coach feedback |
| Personal records (PRs) — heaviest weight + max reps-at-weight | ✓ | ✓ | New PR triggers in-app notification + WhatsApp template |
| Achievements (badges) — first check-in, 3/7/30-day streaks, 10/50/100/500 visits, early bird, night owl | ✓ | ✓ | Bronze/silver/gold tier colors |
| Leaderboard — most check-ins + longest streak (week/month/all-time) | ✓ | ✓ | Podium + ranked table + "my rank" banner |
| Subscription card — status, expiry, renew/freeze/cancel | ✓ | ✓ | One-tap renew from phone |
| In-app messaging with coach | ✓ | ✓ | Threaded, read/unread |
| Reviews — rate your coach 1-5 stars | ✓ | ✓ | |
| Profile — name + phone editable | ✓ | ✓ | |

### For coaches

| Service | Mobile | Desktop | Notes |
|---|---|---|---|
| Coach dashboard — today's roster, pending meal reviews, pending payment approvals | ✓ | ✓ | "Today at gym" widget first |
| Member roster — searchable, filterable | ✓ | ✓ | Cards on mobile, table on desktop |
| Member 360° view — profile, billing, program, attendance, PRs, achievements, message, WhatsApp | ✓ | ✓ | One screen per member, with action buttons |
| Build workout programs (multi-week schedule) | △ | ✓ | Editor is desktop-first; mobile is view-only |
| Build meal/diet programs (flat items list) | △ | ✓ | Same |
| Assign program to member (sets start date) | ✓ | ✓ | Member gets notification |
| Restart a member on a program | ✓ | ✓ | Wipes check-offs, resets streak |
| Approve / reject pending payments | ✓ | ✓ | One-tap on the member's billing tab |
| Freeze / unfreeze / cancel / reactivate subscriptions | ✓ | ✓ | All write to audit log |
| Coach-side check-in (manual search, manual entry) | ✓ | ✓ | Useful at the front desk on a phone |
| Mark a member's assigned coach | ✓ | ✓ | |
| WhatsApp deep-link — 4 templates (check-in nudge, expiring, renewal, weekly check-in) | ✓ | ✓ | One-tap opens WhatsApp chat with pre-written French message |
| Coach profile (public to members) | ✓ | ✓ | Specialty, bio, years exp |

### For owners

| Service | Mobile | Desktop | Notes |
|---|---|---|---|
| Owner dashboard — revenue, active members, expiring-this-week, today's gym activity, peak hours chart, pending payments | ✓ | ✓ | The full business view in one screen |
| Trial / overdue / active status banners | ✓ | ✓ | Auto-trial is 14 days on signup |
| Billing & payments — approve/reject queue | ✓ | ✓ | D17, Flouci, CCP, bank, cash — all logged |
| Membership plans CRUD (Monthly, Trimestriel, Annuel VIP, …) | △ | ✓ | Editor is desktop-first |
| Audit log — who did what, when | ✓ | ✓ | Filterable by action, actor, date |
| Notification feed (system-wide) | ✓ | ✓ | |
| Daily digest trigger — pushes check-in reminders + expiring/expired nudges | n/a | ✓ | Owner clicks once; members get notified |
| Member self-service via `/me/billing` view | ✓ | ✓ | Member sees their own subscription card |

### For super-admins (us)

| Service | Mobile | Desktop | Notes |
|---|---|---|---|
| All-gyms overview, stats, revenue | △ | ✓ | |
| Suspend a gym (blocks login) | △ | ✓ | |
| Platform plan CRUD (Starter 200 / Pro 400 / Business 800 DT) | n/a | ✓ | |

### Cross-cutting (everyone)

| Service | Mobile | Desktop |
|---|---|---|
| JWT auth (30-day token) | ✓ | ✓ |
| Cross-tenant guards (a member can't see another gym's data) | ✓ | ✓ |
| Subscription enforcement (locked gyms blocked from gym-scoped routes) | ✓ | ✓ |
| Notification bell + unread badge | ✓ | ✓ |
| Bilingual-ready (FR + AR hooks in place) | ✓ | ✓ |
| Cache-busted single-page app (works offline after first load) | ✓ | ✓ |
| Audit log on every mutation | ✓ | ✓ |

---

## Phone-friendliness audit

The app is built mobile-first because that's where members live. Here's the verdict:

| What | Verdict |
|---|---|
| Login / signup forms | ✓ — single column, big tap targets, phone keypad for the phone field |
| Member dashboard | ✓ — vertical stack: streak hero, week strip, today's workout, recent PRs |
| Check-in flow | ✓ — single button + search field; coach-side check-in is a one-tap search |
| Today's workout checklist | ✓ — tap to check off; weight/reps inputs are number-keypad |
| Today's meal plan | ✓ — coach feedback shows under each photo |
| PRs + Achievements pages | ✓ — vertical cards, tier-colored |
| Leaderboard | ✓ — podium on top, ranked table below, "my rank" sticky banner |
| Member 360° view (coach side) | ✓ — vertical cards, action buttons full-width |
| Billing / subscription | ✓ — status pill up top, renew button in viewport |
| WhatsApp action buttons | ✓ — one tap, opens WhatsApp |
| Owner dashboard | ✓ — widgets stack vertically; peak-hours chart is responsive |
| Plan editor (admin) | △ — desktop-first; usable on phone but cramped. Members never hit this. |
| Program editor (coach) | △ — desktop-first; same caveat |

**Bottom line:** every flow a *member* touches is fully phone-friendly. Editor surfaces (plan/program builder) lean desktop because coaches typically build them from a laptop; they're view-only on mobile.

---

## Architecture notes (for the technical buyer)

- **Backend:** Node.js + Express, JSON file DB (small dataset, fast). Designed to swap to SQLite when volume justifies it.
- **Frontend:** Vanilla JS single-page app, no build step. One HTML, one CSS, one JS file. ~3,500 lines total.
- **Auth:** JWT with 30-day expiry. Cross-tenant 403s on every scoped endpoint.
- **Notifications:** in-app only today; WhatsApp deep-link integration shipped; email/SMS hooks ready for next phase.
- **Deployment:** single Node process serves both API and static frontend on port 4000. Runs anywhere Node runs.

---

## Roadmap (what's NOT in the demo yet)

1. **Manager + Receptionist roles** — let owners delegate without giving away owner credentials
2. **CSV bulk-import** — bring 500 existing members in via one upload
3. **Email digest** — daily summary email to owners ("3 members expiring this week, 1 pending payment")
4. **Real SQLite backend** — once any gym crosses ~500 active members
5. **Multi-branch** — owners with 2+ locations see them as one org

---

## Contact

Built by Koussay. Demo available on request.
