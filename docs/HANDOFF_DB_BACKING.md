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

Remaining: step 5 (optional test-row seeding) and step 6 (real billing + wire `notify` sending). Nothing committed yet — all changes still in the working tree.

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
6. Later / separate pass: real billing (Stripe checkout + webhook → server writes tier), then flip `config/access.ts` to honor per-tier limits; wire `notify.route.ts` real sending (add `requireAuth` first).

## Files touched (for review)
New: 5 migrations, `server/src/config/access.ts`, 5 `*.store.ts`.
Modified: `account.route.ts`, `account.store.ts`, `assistant.route.ts`, `notify.route.ts`, 3 client services + 3 client specs, `account-menu.component.ts`.
Nothing committed — all changes are in the working tree.
