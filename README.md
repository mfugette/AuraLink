# AuraLink

AuraLink is a vehicle diagnostics and management app I've been building. It started as a way to look up OBD-II trouble codes without wading through forum threads, and it's grown into something closer to a full garage manager: your vehicles, their repair history, maintenance, parts, nearby shops, and an AI assistant (Aura) that you can actually ask questions about your car.

The project will live at [auralink.vin](https://auralink.vin). The repo was originally called OpenOBD, so you might still see that name in a few places.

## Why I'm building it

When the check engine light comes on, most people do the same thing: google the code, get five different answers, and either ignore it or pay a shop to tell them what it means. I wanted one place that tells you what a code means, how serious it is, what parts are usually involved, where to get them, and who nearby can fix it. Once that was working, it made sense to keep the rest of the car's life in the same place too.

## What it does

- **DTC lookup (no account needed).** The home page walks you through entering a trouble code and your vehicle, then shows what the code means, how urgent it is, and links straight into parts search. This is the only feature that works signed out.
- **My Vehicles.** A garage view of your cars. You can add a vehicle by scanning or typing the VIN. It gets decoded through NHTSA, and trims come from CarAPI.
- **Part Lookup.** Live parts search backed by the eBay Browse API, filtered to your vehicle.
- **Find Help Nearby.** Mechanics, tow services, tire shops and parts stores near you, using Google Maps / Places.
- **Aura.** An AI assistant built on Google Gemini. It's styled like a terminal (shell prompt, console-style output) because that fits the look of the rest of the app, and it can take your vehicle and codes as context. It's also reachable from the search bar in the header.
- **Dashboard.** Live and historical telemetry charts. These are hand-rolled SVG, no chart library.
- **History.** Diagnostic sessions, issue history, and a repair log.
- **Notifications.** An in-app inbox, plus email and SMS alerts (SMS goes through Twilio).
- **Plans.** Free / Plus / Pro tiers that gate certain features.
- **Light and dark themes.** Your choice is saved to your account.

### Honest status

Some of this is real and some of it is still a mockup, and I'd rather be upfront about which is which:

- **Billing isn't built.** Tiers are stored client-side and there's a temporary toggle for switching between them while I test. Checkout is a mock flow. No payments are taken.
- **Live telemetry and live code reading are demo data.** The plan was a proprietary Bluetooth "AuraLink Adapter", but that's on hold until I have a physical prototype. In the meantime I'm working on a separate desktop terminal app (in its own repo) that talks to regular ELM327 adapters and uses this server's Aura endpoint.
- **The bundled DTC database is small** (around 70 codes). I'll be swapping it for a much more complete dataset.
- **SMS is wired to real Twilio**, but it won't actually send until the Twilio account is upgraded from trial.

## Tech stack

**Client:** Angular 21 (standalone components, signals), Angular Material for theming, tooltips and icons (Material Symbols), three.js for a 3D point-cloud vehicle model, and ZXing for VIN barcode scanning.

**Server:** Express 5 + TypeScript, with helmet, express-rate-limit, nodemailer and the Twilio SDK.

**Backend services:**
| Service | Used for |
|---|---|
| Supabase (Postgres + Auth) | Accounts and all app data |
| Google Gemini | The Aura assistant |
| Google Maps Platform | Nearby services (Places + Geocoding on the server, Maps JS in the browser) |
| eBay Browse API | Parts search |
| NHTSA vPIC + CarAPI | VIN decoding and trim data |
| Twilio / SMTP | SMS and email notifications |

## How it's put together

There are two separate npm projects, `client/` and `server/`, which run side by side from the repo root. They don't share any code.

```
Browser (Angular)
   │
   ├── Supabase Auth ── sign in / sign up (client-side only)
   │
   └── /api/* ──► Express server ──► Supabase Postgres (service role)
                       │
                       ├──► Gemini (Aura)
                       ├──► Google Places / Geocoding
                       ├──► eBay Browse API
                       ├──► CarAPI
                       └──► Twilio / SMTP
```

A few decisions worth calling out:

- **The client only talks to Supabase for auth.** Everything else goes through the Express API. The client sends its Supabase JWT as a Bearer token, and the server verifies it and resolves the user itself.
- **The server is the security boundary, not the Angular route guards.** The guards only keep you from navigating somewhere you can't use. The server uses the service-role key, so every query is scoped to the signed-in user by hand, and Row Level Security in Postgres is a second layer on top of that.
- **Rate limiting has two tiers.** There's a general limit on all of `/api`, and a tighter one on anything that costs money per call or sends a message (Aura, parts, places, vehicle, notify).
- **Aura is stateless.** The client resends the conversation each turn (capped in size), and nothing is stored server-side. Replies stream back as plain-text chunks. That keeps the endpoint simple enough for the desktop terminal to use as well.
- **Model output gets HTML-escaped** before any formatting is applied, so nothing the model says can inject markup.
- **The API URL is figured out at runtime** from the current hostname (`localhost` → `localhost:3000`, otherwise `api.<domain>`). That way the same build works locally and through a tunnel without rebuilding.

### Design

I wanted it to feel more like an instrument panel than a typical SaaS dashboard: dark by default, everything in JetBrains Mono, flat hairline-ruled grids instead of rounded cards, outline buttons, and terminal-style search fields with a little `parts$` / `issues$` prompt. The main data pages (Dashboard, My Vehicles, Part Lookup, Find Help, History) all share one set of SCSS layout mixins in `client/src/app/pages/console-page.scss`, so they line up exactly with each other.

## Getting started

### Prerequisites

- Node.js 20.19+ or 22.12+ (what Angular 21 requires) and npm
- A Supabase project
- API keys for whichever services you want working (Gemini, Google Maps, eBay, CarAPI). The app runs without them, but those features won't.

### 1. Install

```bash
git clone https://github.com/mfugette/AuraLink.git
cd AuraLink
npm run install:all
```

### 2. Configure the server

Copy the example env file and fill it in:

```bash
cp server/.env.example server/.env
```

| Variable | Notes |
|---|---|
| `SUPABASE_URL` | Your project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. This bypasses RLS, so never put it in the client. |
| `GEMINI_API_KEY` | From Google AI Studio |
| `GOOGLE_MAPS_API_KEY` | Server key restricted to Places API (New) + Geocoding API |
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` | Production keys from the eBay developer portal |
| `CARAPI_TOKEN` / `CARAPI_SECRET` | For trim lookups |
| `CLIENT_ORIGIN` | Comma-separated list of allowed origins. Defaults to `http://localhost:4200`. |
| `PORT` | Defaults to `3000` |
| `TWILIO_*`, `SMTP_FROM` | Optional, only needed for notifications |

### 3. Configure the client

In `client/src/environments/environment.ts` (and `environment.prod.ts`), set:

- `supabaseUrl` and `supabaseAnonKey`. The anon key is safe to ship because RLS limits it.
- `googleMapsBrowserKey`. Use a *separate* key from the server one, restricted to the Maps JavaScript API and your HTTP referrers.

### 4. Set up the database

The schema is in `server/db/migrations/`. There's no migration runner, so I just run each file in the Supabase SQL editor, **in numeric order** (`0001` through `0008`).

If an insert or update fails with a generic 500 and the server logs `column "…" does not exist`, it almost always means a migration got skipped.

### 5. Run it

```bash
npm run dev
```

That starts the API on `http://localhost:3000` and the Angular dev server on `http://localhost:4200` together.

More detailed setup notes are in [`docs/AUTH_SETUP.md`](docs/AUTH_SETUP.md) and [`docs/MAPS_SETUP.md`](docs/MAPS_SETUP.md).

## Scripts

From the repo root:

| Command | What it does |
|---|---|
| `npm run dev` | Runs the server (nodemon + ts-node) and client (ng serve) together |
| `npm run install:all` | Installs root, server and client dependencies |

In `client/`:

| Command | What it does |
|---|---|
| `npm start` | Dev server only |
| `npm run build` | Production build |
| `npm test` | Karma/Jasmine test suite |

In `server/`:

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with reload |
| `npm run build` | Compiles TypeScript to `dist/` |
| `npm start` | Runs the compiled build |

## Tests

The client has a Karma/Jasmine suite covering services, guards, interceptors, pipes, components and pages. To run it headless, point `CHROME_BIN` at a Chrome or Brave install:

```bash
cd client
CHROME_BIN="/path/to/chrome" npx ng test --watch=false --browsers=ChromeHeadless
```

Shared test helpers (mock auth, storage cleanup) are in `client/src/testing/test-utils.ts`.

## Project structure

```
client/
  src/app/
    components/   shared UI (vehicle selector, Aura search, notifications, ...)
    pages/        one folder per route, plus console-page.scss layout mixins
    services/     one service per API area, plus auth, theme, tier
    guards/       auth + tier route guards
    interceptors/ attaches the auth token, turns errors into toasts
    pipes/        Aura terminal formatting
    data/         bundled DTC code data
server/
  src/
    routes/       account, assistant, notify, parts, places, vehicle
    data/         Supabase data stores
    middleware/   requireAuth (JWT verification)
  db/migrations/  SQL schema, applied manually in order
docs/             setup guides, architecture diagrams, audit notes
```

## What's next

- Real billing so the tiers actually mean something
- A complete DTC database
- Finishing the desktop terminal for ELM327 adapters
- The Bluetooth adapter, once there's hardware to build against
- Possibly an OpenStreetMap option for nearby search alongside Google Maps

## License

There's no license on this yet, so all rights are reserved for now.
