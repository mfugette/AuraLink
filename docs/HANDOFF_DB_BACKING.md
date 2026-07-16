# Handoff — DB-Backing Pass (2026-07-14)

State of the "flesh out the DB + make the APIs functional" work, for the next session's agent. Read this first.

## ✅ Progress update (2026-07-15) — steps 1–4 done
The three blockers below are cleared and the tester caps are runtime-verified:
1. **Migrations 0004–0008 applied** — endpoints return data (verified live below).
2. **Gemini key/quota fixed** — prepayment credits were depleted (429 `RESOURCE_EXHAUSTED`); purchased credits, Aura streams again. Key + model (`gemini-3.1-flash-lite`) were always valid; it was purely billing.
3. **Karma suite green** — was 7 failures, all in specs that predated this pass (stale localStorage-seed assumptions + a component that gained a 5th hero stat + one boundary-fragile telemetry timer test). Rewrote `repair-log.component.spec.ts`, `notifications.component.spec.ts`, fixed `home-page.component.spec.ts` (4→5 hero stats) and `telemetry.service.spec.ts` (assert newest-timestamp advances, not monotonic history length). **Now 269 passing, 0 failing, stable across repeated runs.** These were test-only edits — no product code changed.
4. **Tester caps verified against the LIVE server (:3000)** with throwaway Supabase users (created via Admin API, deleted after):
   - Vehicles: POST #1–3 → 201, **#4 → 403** `"You can save up to 3 vehicles on your current plan."` Delete-at-cap frees a slot (live count, not high-water mark).
   - Aura: chat #1–15 → 200, **#16 → 429** `"You've reached today's Aura limit (15 messages). It resets tomorrow."` Cap persists across a **fresh session token for the same user** → confirmed DB-backed per-user/day, not per-session (a client can't reset it by re-authenticating).

## ✅ Progress update (2026-07-15, later) — SMS sending wired (part of step 6)
`notify.route.ts` SMS is now wired to **real Twilio** (was a `console.log` stub), committed on this branch as `a3b5ab8`:
- Added **`requireAuth`** — the route was an open guest relay (spam/cost-abuse risk); every send is now attributable to a signed-in user (`req.userId`).
- Real `twilio.messages.create` for SMS; **every attempt logged** to `notification_deliveries` (0004) via `notificationsStore.logDelivery()` with status `sent`/`failed`. Missing creds → 503, provider failure → 502.
- Client: `parts-locator.component.ts` guests get a "sign in to send" prompt; the **mobile native-SMS-link** path still works signed-out (no server involved). Client suite **271 passing** (added guest-gate + signed-in-POST specs).
- **Verified end-to-end against the live server** (throwaway user + real JWT): auth accepted → Twilio called → failure caught → clean 502 → `failed` audit row written. The success path is the identical code with `status: 'sent'`.
- **⚠️ Remaining blocker is Twilio account state, NOT code:** the trial account returns **`572006`** on REST-API `messages.create` — the Console "Try out SMS" UI can send, but the programmatic API can't until the trial is **upgraded/credited**. Once upgraded, the same code path returns `sent` with no code change. Creds in `server/.env` (`TWILIO_ACCOUNT_SID`/`_AUTH_TOKEN`/`_FROM`).
- **Email is still a stub** (SendGrid/Nodemailer — `SMTP_FROM` slot exists, nothing sends yet).

Remaining: step 5 (optional test-row seeding) and the rest of step 6 (real billing; email sending). The DB-backing pass + Twilio SMS are committed on `feat/db-backing-pass` (`8e4df70`, `a3b5ab8`) — not pushed.

## ℹ️ UI pass landed on this branch (2026-07-15, later) — not DB-related
Separate from the DB work, a UI restyle was committed on `feat/db-backing-pass` as `534f83c` (icons + notifications). Flagged here only because it moved the client test count and touched `notifications.component`:
- **Icons reverted to Angular Material `<mat-icon>`** (Material Symbols Outlined font, tuned axes) — the pixel-art `<app-icon>` system + `pixelarticons` dep were **removed entirely** (`components/shared/icon/` deleted, incl. its spec). This reverses the old "Material icons retired" convention; CLAUDE.md updated.
- **Notifications trigger moved** from the top bar to a fixed right-edge pull-tab; the slide-in pane now mirrors the left sidebar's height + mobile drawer.
- **Client tests: 271 → 263** — the drop is *only* the removed `icon.component.spec.ts` (~8 tests); all 263 pass. No server or DB code changed. (Older references to "271 passing" below predate this.)

## Goal of this pass
Wire the features that were mocked (localStorage / in-memory seed) to real Postgres tables, so everything except hardware-dependent telemetry is testable end-to-end. Schema-first, then routes, then client swaps.

## ⚠️ BLOCKING — must happen before any of this works at runtime
1. **Apply migrations `0004`–`0008` in the Supabase SQL editor, in numeric order.** They are written but NOT applied (no migration runner in this project — see CLAUDE.md). Symptom if skipped: inserts/reads 500 with `column/relation … does not exist`.
2. **Aura "can't connect" is a KEY/QUOTA issue, not code.** The code path in `server/src/routes/assistant.route.ts` is fine; it throws at line ~41 if `GEMINI_API_KEY` is empty/invalid, or returns 429 on depleted quota. Verify the value in `server/.env` is non-empty and the key has quota in Google AI Studio, then restart the server (nodemon doesn't reliably reload `.env`).
3. **Full test suites were NOT run.** Only `tsc --noEmit` passed (server + client app + client spec tsconfigs, all clean). The Karma suite needs `CHROME_BIN` set (see CLAUDE.md). Run it and fix any runtime spec failures.

## Decisions locked this pass (context for the schema)
- **Hardware-dependent tables DEFERRED** — no `telemetry_sessions`/drive-session tables. `SessionService`/`TelemetryService` stay mocked until the adapter/desktop-terminal produces real PID data. Don't add guessed columns.
- **Maintenance = repair-log mileage** (not adapter). "Is it due?" is computed at read time from `vehicles.mileage` + the latest matching repair.
- **Simplified "tester" caps, not the full Plus/Pro matrix.** Every authenticated user gets: **15 Aura messages/day, 3 saved vehicles, Find/nearby allowed.** Enforced server-side. Per-tier differentiation is deferred (the `subscriptions.tier` column exists but is NOT yet honored for enforcement).

## What was built (all typecheck-clean)

### Migrations — `server/db/migrations/` (NOT YET APPLIED)
- `0004_notifications.sql` — `notifications` (inbox), `notification_sms_prefs` (1 row/user, column per category), `notification_deliveries` (audit log; **no anon write** — service-role only). Extends `handle_new_user`, backfills existing users.
- `0005_repairs.sql` — `repairs` (= `RepairRecord`). Note: DB column is **`service_date`**, API field is **`date`** (mapped in the store).
- `0006_subscriptions.sql` — `subscriptions` (1:1, default `free`) + `billing_history`. **Read-your-own, service-role-write-only** — a client must never grant itself a tier or forge a charge. Extends `handle_new_user`, backfills.
- `0007_maintenance.sql` — `maintenance_intervals` (rules; `vehicle_id` NULL = per-user default; unique per user/vehicle/category via COALESCE index).
- `0008_aura_usage.sql` — `aura_usage` (per-user/day tally) + `increment_aura_usage(uuid)` SQL function for the atomic daily-cap increment.

`handle_new_user` is redefined (create-or-replace) in 0004 and 0006; the **0006 version is final** (all inserts). Order matters — the numeric sequence guarantees it.

### Server — new files
- `server/src/config/access.ts` — **single source of truth for tester caps** (`TESTER_LIMITS`, `limitsForUser()`). When real billing lands, change ONLY this to resolve per-tier from the subscriptions row; call sites don't change.
- `server/src/data/{notifications,repairs,subscriptions,aura-usage,maintenance}.store.ts` — mirror `account.store.ts` conventions (snake↔camel `to*` mappers, `userId`-scoped, service-role client).

### Server — modified
- `account.route.ts` — **+13 endpoints**: repairs (GET/POST/DELETE), notifications (GET, `:id/read`, `read-all`, sms-prefs GET/PATCH), maintenance (`checks`, intervals GET/POST/DELETE), subscription (GET). Vehicles POST now enforces the **3-vehicle cap** (403 over limit).
- `account.store.ts` — `exportData()` extended to include repairs, notifications, sms prefs, subscription, billing, maintenance (GDPR export completeness). Deletion cascade already covered (all tables `ON DELETE CASCADE` from `auth.users`).
- `assistant.route.ts` — **15/day Aura cap**. Increments `aura_usage` atomically and rejects (429) when over. Two deliberate choices: (a) increments BEFORE the Gemini call, so a message that later errors still counts (simpler + race-safe); (b) **fails OPEN** on a counter DB error (logs, allows the message) so a tally glitch never blocks a tester.
- `notify.route.ts` — delivery-logging intentionally **NOT wired**. That route is guest/unauthenticated (no `req.userId`); logging needs a user. Documented to wire `notificationsStore.logDelivery()` WHEN `requireAuth` is added there (a prerequisite for real Twilio/SendGrid sending anyway).

### Client — modified
- `services/inbox.service.ts`, `services/repair-log.service.ts`, `services/subscription.service.ts` — swapped from localStorage/seed to the API. **Same public signals + method signatures** so consumers (`notifications.component`, `repair-log.component`, `checkout-page`, `my-plan-page`) are untouched. Methods are optimistic-update + persist, with `load()` (sign-in) / `clear()` (sign-out).
- `components/account-menu/account-menu.component.ts` — the sign-in/sign-out `effect` now also calls `load()`/`clear()` on the three services (same lifecycle as `AccountService.loadAll()`).
- The 3 service `.spec.ts` files rewritten for DB-backed behavior with `HttpTestingController`.

## Important nuance: SubscriptionService is a HYBRID
The **read path is DB-backed** (`load()` → `GET /api/account/subscription`). The **write path is still a client-side mock** — there is intentionally NO server endpoint to set your own tier / append a charge (0006 is read-only for clients). `recordPurchase`/`cancel`/`resume` mutate local signals + a localStorage overlay so the checkout demo works. Real writes must come from a payment processor (Stripe) via a **server webhook** that updates `subscriptions.tier`. `load()` prefers a real (non-`free`) server sub over the local mock; a default `free`+empty server response does NOT clobber a local mock.

## Suggested next steps (in order)
1. ✅ Apply migrations 0004–0008; smoke-test the new endpoints (curl with a real Bearer JWT) to confirm they return data.
2. ✅ Fix the Gemini key/quota; confirm Aura streams again.
3. ✅ Run the Karma suite (`CHROME_BIN=… ng test --watch=false --browsers=ChromeHeadless`); fix any runtime spec failures the typecheck didn't catch. → 269 passing, 0 failing.
4. ✅ Verify the tester caps: 4th vehicle → 403, 16th Aura message/day → 429. Verified directly against the live API (see Progress update above). A browser click-through would be belt-and-suspenders, but the server boundary — the real enforcement — is confirmed.
5. Optionally: seed a few `notifications`/`maintenance_intervals` rows for a test user so the inbox/maintenance UIs show real data (the old seed content is gone from the client now).
6. Later / separate pass: real billing (Stripe checkout + webhook → server writes tier), then flip `config/access.ts` to honor per-tier limits. ✅ SMS sending is now wired (Twilio + `requireAuth` + delivery-logging — see the 2026-07-15 progress update; blocked only on a Twilio trial upgrade). Still TODO: **email** sending (SendGrid/Nodemailer).

## Files touched (for review)
New: 5 migrations, `server/src/config/access.ts`, 5 `*.store.ts`.
Modified: `account.route.ts`, `account.store.ts`, `assistant.route.ts`, `notify.route.ts`, 3 client services + 3 client specs, `account-menu.component.ts`.
Committed on branch `feat/db-backing-pass` (off `main`), not pushed — two commits:
- `8e4df70` — DB-backing pass (26 files, 269 client tests).
- `a3b5ab8` — Twilio SMS wiring: `notify.route.ts` + `parts-locator.component.{ts,spec.ts}` + this doc (271 client tests).

---

# What's left to be PRODUCTION-READY

The DB-backing pass made the app functional and testable end-to-end. Getting it
to production is a separate body of work. Grouped by blocker severity. **Nothing
here is broken — these are deliberately-deferred gaps, each documented in-code.**

## 🔴 Blockers — cannot charge money / send messages safely without these
1. **Real billing (Stripe).** `SubscriptionService` is a HYBRID: read path is
   DB-backed, but the WRITE path (`recordPurchase`/`cancel`/`resume`) is a
   client-side localStorage mock — there is intentionally no endpoint to set your
   own tier (0006 is read-your-own / service-role-write-only). Need: Stripe
   Checkout + a **server webhook** that writes `subscriptions.tier` /
   `billing_history`. Until this lands, a user can "buy" Pro in the UI and it only
   persists locally. See `client/src/app/services/subscription.service.ts` class
   note.
2. **Per-tier limit enforcement.** `config/access.ts` applies FLAT tester caps (15
   Aura/day, 3 vehicles) to *everyone* regardless of `subscriptions.tier`. Once
   billing writes a real tier, flip `limitsForUser()` to resolve per-tier from the
   subscriptions row. Call sites don't change — only that one module. (Do this
   right after #1 or paying users get the same caps as free.)
3. **`notify.route.ts` — SMS wired to Twilio; email still a stub.** ✅ Done
   (2026-07-15): added `requireAuth` (route is no longer an open relay), real
   Twilio `messages.create` for SMS, and `notificationsStore.logDelivery()` on
   every attempt (`sent`/`failed`). Client guests get a "sign in to send" prompt;
   the mobile native-SMS-link path still works signed-out. Verified end-to-end
   against the live server — auth, Twilio call, 502-on-failure, and the `failed`
   audit row all confirmed. **Blocked only on Twilio account state:** the trial
   account returns `572006` on API `messages.create` (console UI can send, REST
   API cannot until the trial is upgraded/credited). No code change needed once
   upgraded. Credentials live in `server/.env` (`TWILIO_ACCOUNT_SID` /
   `_AUTH_TOKEN` / `_FROM`). **Still a stub:** email (SendGrid/Nodemailer — the
   `SMTP_FROM` slot exists but nothing sends yet).

## 🟠 Should-have before a real launch
4. **No server-side tests.** The client suite is solid (269 tests); the server has
   **zero**. The security-critical paths — `requireAuth`, the per-user query
   scoping in every store, the vehicle/Aura caps, input validation — are untested
   in CI. At minimum: integration tests for auth + the two caps (the throwaway-user
   harness in this session's scratchpad is a starting point).
5. **No CI.** No `.github/workflows`. Nothing runs the client suite / `tsc` /
   build on push. Add a pipeline before multiple people touch this.
6. **No lint.** No ESLint wired to `npm run lint` in either workspace (noted in
   CLAUDE.md). Prettier config exists but nothing invokes it.
7. **Migrations are applied by hand.** No runner — each `000N_*.sql` is pasted into
   the Supabase SQL editor in order. Fine for one operator; risky for a team / repeatable
   deploys. Consider a lightweight runner (or Supabase CLI migrations) before prod.
8. **RLS is the second line, not verified here.** The server uses the service-role
   client (bypasses RLS) and scopes every query to `req.userId` manually. The DB's
   own RLS policies (defense-in-depth) should be spot-checked against a real anon
   token before launch — a manual-scoping miss would otherwise be silent.

## 🟡 Known-mocked (fine to ship without; product decisions)
9. **Telemetry / drive sessions are MOCKED** (`TelemetryService`, `SessionService`)
   — the Dashboard + Home hero stats + History drives run on generated data. This
   is intentional: real data needs the AuraLink adapter (on hold) or the desktop
   ELM327 terminal. No `telemetry_sessions` table exists yet by design. Don't ship
   these as "live" without a disclaimer, or gate them until hardware lands.
10. **`TierService` persists tier in localStorage + has a temp header toggle** for
    testing. The toggle must be removed (or dev-gated) before launch — it lets
    anyone flip their own tier client-side (harmless once #2 makes the server the
    real boundary, but confusing UX to ship).
11. **OpenStreetMap route is an empty stub** (`open-street-map.route.ts`, 0 lines,
    unregistered). Groundwork for a possible Google-Maps alternative. No action
    needed unless you want to reduce Maps API cost.

## ✅ Already production-shaped (no action)
- Secrets: `server/.env` is gitignored and untracked; `.env.example` present.
- Security posture: helmet, two-tier rate limiting (global + expensive), input
  validation, HTML-escaped model output, server-verified JWT, per-user scoping.
- `/health` endpoint exists (note: at `/health`, not `/api/health`) for
  load-balancer checks.
- CORS is env-driven (`CLIENT_ORIGIN`, comma-separated) — just set the prod origin.
- `environment.ts` infers the API host from the browser host, so one client build
  works local + prod (Cloudflare Tunnel) without a rebuild.
