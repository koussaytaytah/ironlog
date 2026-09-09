# IRONLOG — Gym Coaching Platform

A full-stack web app for a gym with three account types:

- **Owner** — creates the gym, sees every coach, every member, every program, coach ratings, and how many people use each plan.
- **Coach (personal trainer)** — joins a gym, builds workout/diet plans, assigns them to clients, reviews meal-photo check-ins, leaves notes, and messages clients.
- **Member (client)** — joins a gym, picks a coach, sees assigned plans, checks off exercises/meals, taps an exercise to see an animated form demo, logs meal photos, messages the coach, and rates them.

Signing up shows every gym that has an account as a clickable card (logo + name). Coaches and members join one gym; after that, everything they see — coaches, programs — is scoped to that gym only.

## Project structure

```
ironlog/
  backend/            Node.js + Express API
    server.js         entry point
    db.js             tiny JSON-file database (swap for Postgres/Mongo later)
    middleware/auth.js JWT auth check
    routes/            one file per resource (auth, gyms, programs, assignments, mealLogs, messages, reviews, users)
    uploads/           meal check-in photos land here
  frontend/           static HTML/CSS/JS (no build step)
    index.html
    css/style.css
    js/api.js          fetch wrapper that talks to the backend
    js/app.js          all screens/rendering logic
    js/icons.js         icon set + the animated exercise SVGs
```

## Running it

Requires Node.js 18+.

```bash
cd backend
npm install
npm start
```

Then open **http://localhost:4000** — the backend also serves the frontend, so that's the only URL you need.

The database is a single file, `backend/data.json`, created automatically on first run. Delete it any time to reset the app to empty. Uploaded meal photos are saved to `backend/uploads/`.

## How auth works

- Passwords are hashed with bcrypt before being stored.
- Login returns a JWT, which the frontend stores in `localStorage` and sends as `Authorization: Bearer <token>` on every request.
- Each API route checks the caller's role (owner / trainer / client) and, where relevant, that the record being accessed belongs to their own gym — e.g. a coach can only see their own clients, an owner can only see their own gym's overview.

## What's simplified (and what to change before going to real production)

- **Database**: `db.js` is a flat JSON file rewritten on every write. Fine for a prototype or a very small gym; swap in Postgres/MySQL/Mongo for real usage (only `db.js` needs to change — every route calls `readDB()`/`writeDB()`).
- **File storage**: meal photos are saved to local disk. For production, use S3 or similar so uploads survive redeploys.
- **Exercise demos**: the "3D exercise video" is a lightweight animated SVG diagram (muscle highlight + moving limb), not a real 3D render or filmed video — see `frontend/js/icons.js` → `exerciseAnimSVG()`. Real 3D animation would need a proper animation/rendering pipeline or licensed video content.
- **JWT secret**: set the `JWT_SECRET` environment variable in production instead of using the default dev value in `middleware/auth.js`.
- **No email verification / password reset** — signup just checks the email isn't already used.

## Extending it

- Add more exercises: edit the `EXERCISES` array in `frontend/js/icons.js`.
- Add a new API resource: create a file in `backend/routes/`, `require` it in `backend/server.js`.
- Add a new screen: add a `render...()` function and a case in `renderPage()` in `frontend/js/app.js`, plus a nav entry in `navItemsForRole()`.
