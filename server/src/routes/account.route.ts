import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { accountStore } from '../data/account.store';
import { repairsStore } from '../data/repairs.store';
import { notificationsStore } from '../data/notifications.store';
import { maintenanceStore } from '../data/maintenance.store';
import { subscriptionsStore } from '../data/subscriptions.store';
import { requireAuth } from '../middleware/auth';
import { limitsForUser } from '../config/access';
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

  // Enforce the saved-vehicle cap server-side (testing-phase tester limit — see
  // config/access.ts). The client guard is UX only; this is the real boundary.
  const maxVehicles = limitsForUser(req.userId!).maxVehicles;
  const existing = await accountStore.listVehicles(req.userId!);
  if (existing.length >= maxVehicles) {
    res.status(403).json({
      error: `You can save up to ${maxVehicles} vehicles on your current plan.`,
    });
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

// ── Repairs / service log ────────────────────────────────────────────────────
accountRouter.get('/repairs', asyncHandler(async (req, res) => {
  const repairs = await repairsStore.list(req.userId!);
  res.json({ repairs });
}));

accountRouter.post('/repairs', asyncHandler(async (req, res) => {
  const {
    vehicleId, vehicleLabel, category, title, date, mileage, cost, shop, notes,
  } = req.body as Record<string, unknown>;

  if (!title || !date) {
    res.status(400).json({ error: 'title and date are required.' });
    return;
  }

  const repair = await repairsStore.add(req.userId!, {
    vehicleId: (vehicleId as string) ?? null,
    vehicleLabel: (vehicleLabel as string) ?? '',
    category: (category as never) ?? 'other',
    title: title as string,
    date: date as string,
    mileage: (mileage as number) ?? null,
    cost: (cost as number) ?? null,
    shop: (shop as string) ?? '',
    notes: (notes as string) ?? '',
  });
  res.status(201).json({ repair });
}));

accountRouter.delete('/repairs/:id', asyncHandler(async (req, res) => {
  const removed = await repairsStore.remove(req.userId!, req.params['id'] as string);
  if (!removed) {
    res.status(404).json({ error: 'Repair not found.' });
    return;
  }
  res.status(204).send();
}));

// ── Notifications inbox ──────────────────────────────────────────────────────
accountRouter.get('/notifications', asyncHandler(async (req, res) => {
  const notifications = await notificationsStore.list(req.userId!);
  res.json({ notifications });
}));

accountRouter.post('/notifications/:id/read', asyncHandler(async (req, res) => {
  const ok = await notificationsStore.markRead(req.userId!, req.params['id'] as string);
  if (!ok) {
    res.status(404).json({ error: 'Notification not found.' });
    return;
  }
  res.status(204).send();
}));

accountRouter.post('/notifications/read-all', asyncHandler(async (req, res) => {
  await notificationsStore.markAllRead(req.userId!);
  res.status(204).send();
}));

// Per-category SMS opt-in prefs.
accountRouter.get('/notifications/sms-prefs', asyncHandler(async (req, res) => {
  const smsPrefs = await notificationsStore.getSmsPrefs(req.userId!);
  if (!smsPrefs) {
    res.status(404).json({ error: 'SMS prefs not found.' });
    return;
  }
  res.json({ smsPrefs });
}));

accountRouter.patch('/notifications/sms-prefs', asyncHandler(async (req, res) => {
  const { category, on } = req.body as { category?: unknown; on?: unknown };
  const valid = ['maintenance', 'health', 'billing', 'aura'];
  if (typeof category !== 'string' || !valid.includes(category) || typeof on !== 'boolean') {
    res.status(400).json({ error: 'category (maintenance|health|billing|aura) and on (boolean) are required.' });
    return;
  }
  const smsPrefs = await notificationsStore.setSmsPref(req.userId!, category as never, on);
  res.json({ smsPrefs });
}));

// ── Maintenance checks ───────────────────────────────────────────────────────
// Computed due/remaining per interval (from repair-log mileage + vehicle mileage).
accountRouter.get('/maintenance/checks', asyncHandler(async (req, res) => {
  const checks = await maintenanceStore.checks(req.userId!);
  res.json({ checks });
}));

accountRouter.get('/maintenance/intervals', asyncHandler(async (req, res) => {
  const intervals = await maintenanceStore.listIntervals(req.userId!);
  res.json({ intervals });
}));

accountRouter.post('/maintenance/intervals', asyncHandler(async (req, res) => {
  const {
    vehicleId, category, label, intervalMiles, intervalMonths, lastDoneMiles, lastDoneDate, enabled,
  } = req.body as Record<string, unknown>;

  if (!category) {
    res.status(400).json({ error: 'category is required.' });
    return;
  }
  if (intervalMiles == null && intervalMonths == null) {
    res.status(400).json({ error: 'At least one of intervalMiles or intervalMonths is required.' });
    return;
  }

  const interval = await maintenanceStore.addInterval(req.userId!, {
    vehicleId: (vehicleId as string) ?? null,
    category: category as never,
    label: (label as string) ?? '',
    intervalMiles: (intervalMiles as number) ?? null,
    intervalMonths: (intervalMonths as number) ?? null,
    lastDoneMiles: (lastDoneMiles as number) ?? null,
    lastDoneDate: (lastDoneDate as string) ?? null,
    enabled: enabled === undefined ? true : Boolean(enabled),
  });
  res.status(201).json({ interval });
}));

accountRouter.delete('/maintenance/intervals/:id', asyncHandler(async (req, res) => {
  const removed = await maintenanceStore.removeInterval(req.userId!, req.params['id'] as string);
  if (!removed) {
    res.status(404).json({ error: 'Interval not found.' });
    return;
  }
  res.status(204).send();
}));

// ── Subscription + billing ───────────────────────────────────────────────────
accountRouter.get('/subscription', asyncHandler(async (req, res) => {
  const [subscription, billing] = await Promise.all([
    subscriptionsStore.get(req.userId!),
    subscriptionsStore.listBilling(req.userId!),
  ]);
  res.json({ subscription, billing });
}));
