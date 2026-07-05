# Auth & Database Setup (Supabase)

The app now uses **real Supabase Auth** end-to-end. Identity lives in
`auth.users`; app data (`profiles`, `user_settings`, `vehicles`, `issues`) is
scoped per-user and protected by RLS. This file is the one-time wiring you need
to make it run locally.

## 1. Get your keys

Supabase Dashboard → **Project Settings → API**. You need three values:

| Value | Where it goes | Secret? |
|-------|---------------|---------|
| **Project URL** | server `.env` + client environment | no |
| **anon public** key | client environment only | no (RLS-limited) |
| **service_role** key | server `.env` only | **YES — never client/commit** |

## 2. Server — `server/.env`

Add (alongside your existing eBay/CarAPI keys):

```
SUPABASE_URL=https://<your-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

The server fails fast on startup with a clear message if these are missing.

## 3. Client — `client/src/environments/environment.ts`

Replace the placeholders:

```ts
supabaseUrl: 'https://<your-ref>.supabase.co',
supabaseAnonKey: '<anon public key>',
```

(Do the same in `environment.prod.ts` before deploying.)

## 4. Apply the DB schema (if not already done)

Run `server/db/migrations/0001_init.sql` in the Supabase SQL Editor. This creates
the tables, RLS policies, and the new-user trigger that auto-provisions a
`profiles` + `user_settings` row on signup.

## 5. Run it

```bash
npm run dev   # from repo root — starts server + client together
```

## How it works

- **Sign up / in**: the header **Sign in** button → `/login` (email + password).
  Supabase handles credentials in the browser (anon key). On signup the DB
  trigger creates the user's profile + settings rows automatically.
- **API calls**: an HTTP interceptor attaches the Supabase access token
  (`Authorization: Bearer <jwt>`) to every `/api` request.
- **Server**: `requireAuth` middleware verifies that token, resolves
  `req.userId` (= `auth.uid()`), and 401s if it's missing/invalid. All
  `/api/account/*` routes are gated by it.
- **DB access**: the server queries Postgres with the **service_role** client
  (bypasses RLS) and scopes every query to `req.userId`.
- **Protected pages**: `My Vehicles` and `Issue History` use `authGuard` — a
  signed-out visit redirects to `/login?redirect=<path>` and returns after login.
- **Sign out**: clears the Supabase session and all account state, returns Home.

## End-to-end smoke test

1. Start the app, open Home — header shows **Sign in** (signed out).
2. Click a protected nav item (My Vehicles) → bounced to `/login`.
3. Sign up with an email + password.
   - If **email confirmation** is ON (Supabase default): you'll be told to
     confirm via email, then sign in. To skip this in dev, turn it off in
     **Authentication → Providers → Email → "Confirm email"**.
4. Once signed in: the header shows your avatar; My Vehicles / Issue History
   load; add a vehicle and refresh — it **persists** (it's in Postgres now).
5. Verify in Supabase **Table Editor → vehicles** that the row exists with your
   `user_id`.
6. Sign out → header returns to **Sign in**, protected pages redirect again.

## Notes / follow-ups

- **Email confirmation** is the main dev-vs-prod toggle; decide per environment.
- `issues` has a table and RLS but **no API routes yet** — the Issue History
  page still reads local seed data (`client/src/app/data/issue-history.ts`).
  Wiring `/api/account/issues` + moving the page onto it is the natural next step.
- The **parts catalog** remains static TS reference data (not in the DB).
