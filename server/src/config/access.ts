// Access limits — the single source of truth for what an authenticated user can
// do server-side. During the TESTING PHASE these are fixed "tester" caps applied
// to every user regardless of their subscriptions.tier (billing isn't wired).
// When real billing lands, resolve these per-tier from the subscriptions row
// (see server/db/migrations/0006_subscriptions.sql) instead of a flat constant —
// the enforcement call sites shouldn't need to change, only this module.
//
// Mirrors the client's tier limits conceptually, but the server is the real
// boundary (client TierService is UX only).

export const TESTER_LIMITS = {
  // Aura chat messages per user per calendar day.
  aiMessagesPerDay: 15,
  // Saved vehicles per user.
  maxVehicles: 3,
} as const;

export type AccessLimits = typeof TESTER_LIMITS;

// Resolve the limits for a user. Today: everyone gets the tester caps. Later:
// look up the user's tier and return per-tier limits.
export function limitsForUser(_userId: string): AccessLimits {
  return TESTER_LIMITS;
}
