// Subscription tiers for AuraLink. Billing isn't wired yet — TierService tracks
// the current tier locally (with a temporary header toggle for testing). When
// real billing lands, the tier will come from the account/subscription record.

export type Tier = 'free' | 'plus' | 'pro';

// Billing cadence. Annual = 10× the monthly price (2 months free, ~17% off).
export type BillingInterval = 'monthly' | 'annual';

// Months paid per year on an annual plan — the effective discount. 10 => pay
// for 10 months, get 12 (2 free).
export const ANNUAL_MONTHS_PAID = 10;

// The annual price for a tier at its monthly rate (rounded to a cent).
export function annualPrice(priceMonthly: number): number {
  return Math.round(priceMonthly * ANNUAL_MONTHS_PAID * 100) / 100;
}

// Features that can be gated by tier. Used by TierService.can() and tierGuard.
export type Feature =
  | 'dashboard'      // live telemetry dashboard (Pro — needs the adapter)
  | 'issue-history'  // logged issue history
  | 'obd-scan'       // live OBD2 scan via any Bluetooth adapter
  | 'nearby';        // Find Help Nearby (Google Maps — real per-call cost)

export interface TierDef {
  tier: Tier;
  name: string;
  priceMonthly: number;       // USD; 0 for free
  tagline: string;
  // Marketing feature lines shown on the plan card. `included` drives the
  // check/cross icon; `note` is optional fine print (e.g. "needs adapter").
  features: { label: string; included: boolean; note?: string }[];
  // Hard limits enforced elsewhere (vehicles, AI messages/day).
  maxVehicles: number;        // Infinity for unlimited
  aiMessagesPerDay: number;   // Infinity for unlimited
  // Which gated Features this tier unlocks.
  unlocks: Feature[];
  highlight?: boolean;        // visually featured card (Pro)
}

export const TIERS: TierDef[] = [
  {
    tier: 'free',
    name: 'Free',
    priceMonthly: 0,
    tagline: 'Diagnose any car, no strings attached.',
    maxVehicles: 1,
    aiMessagesPerDay: 5,
    unlocks: [],
    features: [
      { label: 'DTC code lookup & explanations', included: true },
      { label: 'Vehicle-specific parts finder', included: true },
      { label: 'Ask Aura — 5 messages/day', included: true },
      { label: '1 saved vehicle', included: true },
      { label: 'Issue history', included: false },
      { label: 'OBD2 live scan', included: false },
      { label: 'Find Help Nearby', included: false },
      { label: 'Live dashboard', included: false },
    ],
  },
  {
    tier: 'plus',
    name: 'Plus',
    priceMonthly: 0.99,
    tagline: 'For the hands-on owner who scans their own car.',
    maxVehicles: 3,
    aiMessagesPerDay: 50,
    unlocks: ['issue-history', 'obd-scan', 'nearby'],
    features: [
      { label: 'Everything in Free', included: true },
      { label: 'Ask Aura — 50 messages/day', included: true },
      { label: 'Up to 3 saved vehicles', included: true },
      { label: 'Full issue history & tracking', included: true },
      { label: 'OBD2 live scan (any Bluetooth adapter)', included: true },
      { label: 'Find Help Nearby', included: true },
      { label: 'Live dashboard', included: false },
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    priceMonthly: 4.99,
    tagline: 'The full AuraLink experience, built for the adapter.',
    highlight: true,
    maxVehicles: Infinity,
    aiMessagesPerDay: Infinity,
    unlocks: ['issue-history', 'obd-scan', 'nearby', 'dashboard'],
    features: [
      { label: 'Everything in Plus', included: true },
      { label: 'Unlimited Aura messages', included: true },
      { label: 'Unlimited saved vehicles', included: true },
      { label: 'Live dashboard', included: true, note: 'requires AuraLink adapter' },
      { label: 'Priority support', included: true },
      { label: 'Discounted AuraLink adapter bundle', included: true },
    ],
  },
];

export function tierDef(tier: Tier): TierDef {
  return TIERS.find(t => t.tier === tier)!;
}

// The AuraLink Bluetooth OBD2 adapter (future hardware). Standalone price plus a
// discounted bundle offered with the Pro plan.
export const ADAPTER = {
  name: 'AuraLink Adapter',
  price: 79,
  bundlePrice: 59,            // when bought with Pro
  blurb: 'Our proprietary Bluetooth OBD2 adapter — plug it in for real-time streaming telemetry on the live dashboard.',
};
