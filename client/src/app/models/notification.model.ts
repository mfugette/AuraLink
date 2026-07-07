// In-app notifications. Categories map to how the notification is generated and
// drive both the icon and the per-category SMS opt-in. Maintenance & health
// notifications come from adapter telemetry (Pro; adapter on hold) — billing and
// Aura insights don't need hardware.
export type NotificationCategory = 'maintenance' | 'health' | 'billing' | 'aura';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  createdAt: string;    // ISO
  read: boolean;
  // Optional call-to-action: a label + an in-app route to deep-link to.
  ctaLabel?: string;
  ctaRoute?: string;
}

// Per-category "also text me" preferences (Pro feature). In-app delivery is
// always on; these only govern SMS escalation.
export type SmsPrefs = Record<NotificationCategory, boolean>;

export const CATEGORY_META: Record<NotificationCategory, { label: string; icon: string; hint: string }> = {
  health:      { label: 'Health alerts',    icon: 'favorite',        hint: 'Coolant, battery, new fault codes' },
  maintenance: { label: 'Maintenance due',  icon: 'build',           hint: 'Oil, tires, brakes, registration' },
  aura:        { label: 'Aura insights',    icon: 'auto_awesome',    hint: 'Proactive tips about your car' },
  billing:     { label: 'Account & billing', icon: 'receipt_long',   hint: 'Receipts, plan changes' },
};
