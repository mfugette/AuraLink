# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## The Project
**AuraLink** — a vehicle diagnostics and management app (domain `auralink.vin`). Angular 21 client + Express API server, two separate npm workspaces (`client/`, `server/`) with no shared package, run together from the repo root. Supabase (Postgres + Auth) is the backend datastore; Google Gemini powers the "Aura" AI assistant; Google Maps Platform powers nearby-services search (an empty `server/src/routes/open-street-map.route.ts` stub exists as groundwork for a possible OpenStreetMap alternative — not registered or implemented yet).

**Product direction:** AuraLink is an all-encompassing vehicle management service, not just a DTC lookup. Two hardware-facing tracks exist: (1) a proprietary Bluetooth "AuraLink Adapter" — **on hold** pending a physical prototype; don't build new adapter-dependent work without confirming. (2) A **standalone desktop terminal** product (Electron, lives in its own repo outside this one) that talks to stock ELM327 adapters and reuses this server's `/api/assistant/chat` endpoint — keep that endpoint's contract (stateless, plain-text streaming, Bearer JWT) stable, as an external client depends on it.

## Response Style & Conciseness
- **Brevity First:** Keep all responses as concise and to the point as possible. Avoid unnecessary verbosity, lengthy introductions, filler words, or repetitive summaries.
- **Minimal Thinking/Chain-of-Thought:** Do not write out your thoughts, internal monologues, or step-by-step reasoning every time you perform an action, unless explicitly asked to think out loud. Get straight to the answer or action.
- **Direct Delivery:** Provide the solution, code, or answer immediately without fluff. If a brief explanation is necessary, keep it to a few bullet points or short sentences.

## Commands
Run from the repo root unless noted.
```bash
npm run dev              # starts server (nodemon+ts-node) + client (ng serve) together
npm run install:all      # installs root, server, and client deps in one shot
```
Client (`client/`):
```bash
npm start       # ng serve — dev server only
npm run build   # ng build
npm run watch   # ng build --watch --configuration development
npm test        # ng test (Karma/Jasmine). Real suite exists (~262 tests, 47 spec files) covering services, guards, interceptors, pipes, components, and pages. Headless needs CHROME_BIN set to a Chrome/Brave path: `CHROME_BIN=... ng test --watch=false --browsers=ChromeHeadless`. Shared test helpers: `client/src/testing/test-utils.ts` (createMockAuth, provideMockAuth, clearAppStorage).
```
Server (`server/`):
```bash
npm run dev    # nodemon --watch src --ext ts --exec ts-node src/index.ts
npm run build  # tsc
npm start      # node dist/index.js (run build first)
```

There is no lint script configured in either package — no ESLint config is wired to `npm run lint`. `client/package.json` has a `prettier` block (100-char width, single quotes, angular parser for `.html`) but nothing invokes it automatically.

## Environment setup
Both `server/.env` and `client/src/environments/environment.ts` need real keys before most features work. See `docs/AUTH_SETUP.md` (Supabase) and `docs/MAPS_SETUP.md` (Google Maps) for full one-time setup instructions, including exact env var names and where each key goes. In short:
- **Supabase**: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `server/.env` (service role — never client-side); `supabaseUrl` + `supabaseAnonKey` in the client environment files (anon key is safe to ship, RLS-limited).
- **Google Maps**: a server-restricted key (`GOOGLE_MAPS_API_KEY` in `server/.env`, Places + Geocoding APIs) and a separate browser-restricted key (`googleMapsBrowserKey` in the client environment, Maps JavaScript API, HTTP-referrer restricted).
- **Gemini**: `GEMINI_API_KEY` in `server/.env` for the Aura assistant (`server/src/routes/assistant.route.ts`, model `gemini-3.1-flash-lite`). Note: a depleted-quota 429 from Gemini surfaces to users as "Aura is unavailable right now" — check the server console for `Assistant chat error:` and the key's billing in AI Studio before debugging code.
- **CORS**: `CLIENT_ORIGIN` in `server/.env` — comma-separated list of allowed origins. Defaults to `http://localhost:4200` only; a tunnel/prod origin (e.g. `https://auralink.vin`) must be added explicitly or every cross-origin request fails.
DB schema lives in `server/db/migrations/*.sql`, applied manually via the Supabase SQL editor (no migration runner). Apply in numeric order. **Symptom of a skipped migration:** an insert/update 500s with `{"error":"Internal server error."}` and the server console logs `Unhandled error: … column "…" does not exist` — the code references a column a later migration adds. Run the missing migration.

Reference docs in `docs/`: `AUTH_SETUP.md`, `MAPS_SETUP.md`, `ICON_MAPPING.md` (Material→pixelarticons icon map), `CLIENT_AUDIT.md` (test/security/SOLID review), `ARCHITECTURE_UML.md` (client + server class diagrams).

## Architecture

### Two-server split, one API surface
The client never talks to Supabase for app data directly except **auth** (Supabase Auth runs entirely client-side via `@supabase/supabase-js`, see `client/src/app/services/auth.service.ts`, wrapped in Angular signals). All other data flows through the Express API:
- Client → `POST/GET /api/*` (see `client/src/app/services/*.service.ts`, each mirroring one `server/src/routes/*.route.ts`)
- Server verifies the Supabase JWT itself (`server/src/middleware/auth.ts: requireAuth`, expects `Authorization: Bearer <jwt>`, resolves `req.userId` via `getUserIdFromToken`)
- Server queries Postgres with the **service-role** client (`server/src/data/supabase.ts`), which bypasses RLS — every query is manually scoped to `req.userId`. RLS in the DB is a second line of defense, not the only one.
- `client/src/app/interceptors/auth.interceptor.ts` attaches the bearer token to every request whose URL starts with `environment.apiUrl`; `error.interceptor.ts` turns failed calls into toasts and force-signs-out on a 401 from our own API.
`environment.ts`'s `resolveApiUrl()` infers the API host from the current browser host (localhost → `localhost:3000`; anything else → `api.<same-root-domain>`), so the same build works locally and through a Cloudflare Tunnel without a rebuild.

### Auth & route guards are UX only, not the security boundary
`client/src/app/guards/auth.guard.ts` and `guards/tier.guard.ts` gate Angular routes, but both guards' own comments are explicit: this only prevents unwanted navigation in the UI. **The client bundle and its routes are fully visible to anyone** — real enforcement is `requireAuth` server-side plus RLS. Only `/home` (guest DTC pipeline) and `/login` are reachable signed-out; everything else requires `authGuard`, and several routes additionally require `requireTier(feature)`. Routes are declared flat in `client/src/app/app.routes.ts` (no lazy-loaded feature modules); guards compose per-route as `canActivate: [authGuard, requireTier('feature-name')]`.

### Subscription tiers are fully client-side (billing not built yet)
`client/src/app/services/tier.service.ts` stores the active tier (`free`/`plus`/`pro`) in `localStorage` and exposes `can(feature)` / `maxVehicles` / `aiMessagesPerDay`. There's a temporary UI toggle to flip tiers for testing (no real billing/payment flow exists). `tier.guard.ts`'s `requireTier(feature)` redirects to `/plan?locked=<feature>` when the tier doesn't unlock a route. When real billing lands, only `TierService`'s persistence needs to change — the `tier` signal and `can()` API are meant to stay stable so guards/templates don't need touching.

### Aura (AI assistant)
Server-side only, Gemini-backed, **stateless** — the client resends full message history each turn (capped, see `MAX_HISTORY`/`MAX_INPUT_CHARS`/`MAX_CONTEXT_CHARS` in `assistant.route.ts`), nothing is persisted server-side. Streams plain-text chunks over a chunked HTTP response (not real SSE). Signed-in only, rate-limited via the "expensive" limiter in `server/src/index.ts`. The `/assistant` page renders Aura as a **terminal** (shell prompt, console output) — replies are formatted by `client/src/app/pipes/aura-terminal.pipe.ts` (escapes HTML first, then transforms only `**bold**` and a leading `[ safety ]` tag; the system prompt in `assistant.route.ts` curates terminal-style output with `▸`/`→` markers). Aura is also reachable from the `app-ai-search` header dropdown (`client/src/app/components/ai-search/`) — the two surfaces must stay in sync. The external desktop terminal product consumes this same endpoint (see Product direction above).

### The instrument-console layout system (core UI pattern)
`client/src/app/pages/console-page.scss` is the single source of truth for the app's data-page layout — SCSS mixins (`host`, `page`, `eyebrow`, `head`, `toolbar`, `toolbar-hint`, `grid`) that every "console" page includes: **Dashboard, My Vehicles, Part Lookup, Find Help Nearby, and History**. The contract:
- Viewport-locked shell (no page scroll at desktop; content scrolls inside its cell/panel where needed)
- Header: mono eyebrow (`— Label`) → `.page-title` → `.page-subtitle`, 18px below
- A **fixed 44px full-bleed toolbar** (tabs / filters / actions) whose bottom hairline is the grid's top seam
- A full-bleed 4-across hairline metric grid (`1px` gaps over `--obd-border`, rows share height, `flex: 1` to the footer)

Because header + toolbar heights are identical everywhere, every console page's grid starts at the same y-position. **New data pages should use these mixins, not hand-rolled layout**; page-specific cell/content styles stay local. A change to a shared component or style must be applied at the shared source so all usages update together — never patch one instance.

### Design language
Dark automotive theme via Angular Material's `mat.theme()` mixin plus a large `--obd-*` CSS custom-property system (both at the top of `client/src/styles.scss`). Key conventions:
- **Terminal mono is the app-wide default face** — `--obd-font-mono` / `--obd-font-display` (JetBrains Mono, loaded in `index.html`; Material typography families synced to match). The old Inter body face was retired. Page titles/hero use `--obd-font-display` (weight 500–600); **no icons in page headers**.
- Flat, squared, hairline-ruled surfaces — no rounded SaaS cards, shadows, or pill buttons on console pages. Status chips are squared, mono, tinted (`color-mix` with the status color).
- Buttons are outline+accent-text (`.btn-action` in `styles.scss`), not solid-filled.
- **Search fields are terminal-style** — a green `<context>$` prompt + mono input (e.g. `sessions$`, `issues$`, `parts$`, `notifs$`). Shared mixin: `client/src/app/components/_terminal-search.scss`. The top-bar Aura trigger + its popout also use this terminal aesthetic (`components/ai-search/`).
- `client/src/app/services/theme.service.ts` owns light/dark switching.
- For UI/UX and styling tasks, strictly follow the guidelines in `.claude/frontend-design-SKILL.md`.

### Icons — pixel-art via `<app-icon>` (Material icons retired)
All icons render through the shared `<app-icon name="…" [size]="N">` component (`client/src/app/components/shared/icon/`), which inlines **pixelarticons** SVG path data from `icon-registry.ts` (keyed by the old Material names, so `<app-icon name="directions_car">` == the former `<mat-icon>directions_car</mat-icon>`). `currentColor` + CSS-sized like mat-icon. `@angular/material/icon` and the Material icon webfonts are **gone** — never reintroduce `<mat-icon>`. To add a glyph: copy the `<path d="…">` from `node_modules/pixelarticons/svg/<name>.svg` into the registry (a spec enforces every name the app uses is present). Full Material→pixelarticons map: `docs/ICON_MAPPING.md`.

### My Vehicles / vehicle editing
`/my-vehicles` is a grid-only "garage" (fixed 4×3 slot grid; empty slots are add tiles). Add/edit lives on dedicated routes — `/my-vehicles/add` and `/my-vehicles/:id/edit` (`pages/vehicle-editor/`), which reuse the shared `VehicleSelectorComponent` (VIN scan + NHTSA decode + CarAPI trims). That selector is also used by Home's guest pipeline — changes to it affect both.

### PrimeNG was removed
PrimeNG (`primeng`, `@primeng/themes`, `primeicons`, the `providePrimeNG` wiring, and `primeng-preset.ts`) was **removed entirely** — it was installed-but-dormant and blocked the Angular 21 upgrade (PrimeNG 21 needs Angular 21; removing it kept the upgrade minimal). Don't reach for PrimeNG components; the app is plain Angular + Material (theme/tooltip/overlay only) + the custom `<app-icon>` and shared SCSS mixins. (Older memory files may still reference a "PrimeNG rebuild" — that path is closed.)

### Rate limiting tiers (server)
`server/src/index.ts` applies two `express-rate-limit` tiers: a baseline `globalLimiter` (120 req/min/IP) on all of `/api`, and a tighter `expensiveLimiter` (20 req/min/IP) layered on routes that cost money per call or send messages (`notify`, `parts`, `vehicle`, `places`, `assistant`). New routes that hit a paid third-party API or send a notification should use the expensive limiter too. Security posture is deliberate (helmet, rate limits, input validation, HTML-escaping model output) — make secure decisions by default and preserve these patterns.
