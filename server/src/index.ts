import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load env before importing modules that read process.env at import time
// (e.g. the Supabase client). Otherwise those vars would be undefined.
dotenv.config();

import { notifyRouter } from './routes/notify.route';
import { partsRouter } from './routes/parts.route';
import { vehicleRouter } from './routes/vehicle.route';
import { accountRouter } from './routes/account.route';
import { placesRouter } from './routes/places.route';
import { assistantRouter } from './routes/assistant.route';

const app = express();
const PORT = process.env['PORT'] ?? 3000;

// Behind Cloudflare Tunnel / a reverse proxy, the real client IP is in
// X-Forwarded-For. Trust one hop so rate limiting keys on the actual client,
// not the proxy. (Not `true` — that would let clients spoof the header.)
app.set('trust proxy', 1);

// Security headers (CSP, HSTS, X-Frame-Options, no-sniff, etc.). This is a JSON
// API with no server-rendered HTML, so the defaults are appropriate.
app.use(helmet());

// Allow one or more client origins (comma-separated in CLIENT_ORIGIN) — lets the
// same server accept both local dev (localhost:4200) and a tunnel/prod origin
// (e.g. https://auralink.vin) at once. No CLIENT_ORIGIN → localhost only.
const allowedOrigins = (process.env['CLIENT_ORIGIN'] ?? 'http://localhost:4200')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    // Non-browser requests (curl, same-origin) have no Origin header — allow.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  // The app (auralink.vin) and API (api.auralink.vin) are different origins,
  // both gated by the same Cloudflare Access app. Access's session cookie is
  // per-subdomain and won't be sent cross-origin unless the browser is told
  // this is an intentional credentialed request — which requires the server
  // to explicitly opt in too (a wildcard/reflected origin without this is
  // rejected by browsers for credentialed requests regardless).
  credentials: true,
}));

// Cap request bodies — no endpoint needs a large payload, and an explicit limit
// blunts memory-exhaustion DoS via giant JSON.
app.use(express.json({ limit: '64kb' }));

// Baseline rate limit on every API route — a safety net against floods.
const globalLimiter = rateLimit({
  windowMs: 60_000,           // 1 minute
  limit: 120,                 // 120 req/min/IP across the API
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});
app.use('/api', globalLimiter);

// Tighter limit for routes that cost money per call (third-party APIs, the LLM)
// or send messages — the abuse-sensitive endpoints.
const expensiveLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,                  // 20 req/min/IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests to this endpoint. Please wait a moment.' },
});

app.use('/api/notify', expensiveLimiter, notifyRouter);
app.use('/api/parts', expensiveLimiter, partsRouter);
app.use('/api/vehicle', expensiveLimiter, vehicleRouter);
app.use('/api/account', accountRouter);
app.use('/api/places', expensiveLimiter, placesRouter);
app.use('/api/assistant', expensiveLimiter, assistantRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Central error handler — async route handlers forward thrown errors here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`AuraLink server running on http://localhost:${PORT}`);
});
