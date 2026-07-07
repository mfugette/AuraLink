import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { accountStore } from '../data/account.store';
import { requireAuth } from '../middleware/auth';
import { verifyPassword } from '../data/supabase';

// Tight limiter for the account-deletion endpoint specifically: it re-checks a
// password, so it's a credential-guessing vector. The rest of the account router
// stays on the global limit (it's called several times on normal page loads).
const deleteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a moment.' },
});

export const accountRouter = Router();

// Every account route requires a valid Supabase session. requireAuth sets
// req.userId (guaranteed non-null past this point).
accountRouter.use(requireAuth);

// Wrap an async handler so thrown errors reach Express' error path instead of
// crashing / hanging the request.
function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => fn(req, res).catch(next);
}

// ── Profile ──────────────────────────────────────────────────────────────────
accountRouter.get('/me', asyncHandler(async (req, res) => {
  const account = await accountStore.getAccount(req.userId!);
  if (!account) {
    res.status(404).json({ error: 'Account not found.' });
    return;
  }
  res.json({ account });
}));

accountRouter.patch('/me', asyncHandler(async (req, res) => {
  const { displayName, email } = req.body as { displayName?: string; email?: string };
  const account = await accountStore.updateAccount(req.userId!, { displayName, email });
  if (!account) {
    res.status(404).json({ error: 'Account not found.' });
    return;
  }
  res.json({ account });
}));

// ── Data export / account deletion (GDPR/CCPA) ───────────────────────────────
// Right of access: stream the user's full data as a JSON download.
accountRouter.get('/export', asyncHandler(async (req, res) => {
  const data = await accountStore.exportData(req.userId!);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="auralink-data-export.json"');
  res.send(JSON.stringify(data, null, 2));
}));

// Right to erasure: permanently delete the account and all associated data
// (cascade). Destructive + irreversible, so we require the password again here
// and re-verify it server-side — a valid session token alone is not enough.
accountRouter.delete('/', deleteLimiter, asyncHandler(async (req, res) => {
  const { password } = req.body as { password?: unknown };
  if (typeof password !== 'string' || !password) {
    res.status(400).json({ error: 'Password is required to delete your account.' });
    return;
  }

  const account = await accountStore.getAccount(req.userId!);
  if (!account) {
    res.status(404).json({ error: 'Account not found.' });
    return;
  }

  const ok = await verifyPassword(account.email, password);
  if (!ok) {
    res.status(403).json({ error: 'Incorrect password.' });
    return;
  }

  await accountStore.deleteAccount(req.userId!);
  res.status(204).send();
}));

// ── My Vehicles ──────────────────────────────────────────────────────────────
accountRouter.get('/vehicles', asyncHandler(async (req, res) => {
  const vehicles = await accountStore.listVehicles(req.userId!);
  res.json({ vehicles });
}));

accountRouter.post('/vehicles', asyncHandler(async (req, res) => {
  const {
    nickname, year, make, model, subModel, engine,
    driveType, transmission, fuelType, bodyStyle, mileage,
    vin, isPrimary,
  } = req.body as Record<string, unknown>;

  if (!year || !make || !model) {
    res.status(400).json({ error: 'year, make, and model are required.' });
    return;
  }

  const vehicle = await accountStore.addVehicle(req.userId!, {
    nickname: (nickname as string) ?? null,
    year: year as number,
    make: make as string,
    model: model as string,
    subModel: (subModel as string) ?? null,
    engine: (engine as string) ?? null,
    driveType: (driveType as string) ?? null,
    transmission: (transmission as string) ?? null,
    fuelType: (fuelType as string) ?? null,
    bodyStyle: (bodyStyle as string) ?? null,
    mileage: (mileage as number) ?? null,
    vin: (vin as string) ?? null,
    isPrimary: Boolean(isPrimary),
  });
  res.status(201).json({ vehicle });
}));

accountRouter.patch('/vehicles/:id', asyncHandler(async (req, res) => {
  const vehicle = await accountStore.updateVehicle(req.userId!, req.params['id'] as string, req.body);
  if (!vehicle) {
    res.status(404).json({ error: 'Vehicle not found.' });
    return;
  }
  res.json({ vehicle });
}));

accountRouter.delete('/vehicles/:id', asyncHandler(async (req, res) => {
  const removed = await accountStore.removeVehicle(req.userId!, req.params['id'] as string);
  if (!removed) {
    res.status(404).json({ error: 'Vehicle not found.' });
    return;
  }
  res.status(204).send();
}));

// ── Settings ─────────────────────────────────────────────────────────────────
accountRouter.get('/settings', asyncHandler(async (req, res) => {
  const settings = await accountStore.getSettings(req.userId!);
  if (!settings) {
    res.status(404).json({ error: 'Settings not found.' });
    return;
  }
  res.json({ settings });
}));

accountRouter.patch('/settings', asyncHandler(async (req, res) => {
  const { notifyEmail, notifySms, preferredUnits, theme } = req.body as Record<string, unknown>;
  const settings = await accountStore.updateSettings(req.userId!, {
    notifyEmail: notifyEmail as boolean | undefined,
    notifySms: notifySms as boolean | undefined,
    preferredUnits: preferredUnits as 'imperial' | 'metric' | undefined,
    theme: theme as 'dark' | 'light' | undefined,
  });
  if (!settings) {
    res.status(404).json({ error: 'Settings not found.' });
    return;
  }
  res.json({ settings });
}));
