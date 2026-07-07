import { computed, Injectable, signal } from '@angular/core';
import { AppNotification, NotificationCategory, SmsPrefs } from '../models/notification.model';

// In-app notifications inbox: a mocked list + unread tracking + per-category SMS
// opt-in. (Named InboxService to avoid colliding with the parts NotificationService,
// which handles the parts-list SMS/email send.) The maintenance/health items would
// be produced by adapter telemetry (miles driven, engine health) — on hold until
// the adapter prototype exists. Billing and Aura items don't need hardware. SMS
// prefs persist to localStorage; wiring real SMS (Twilio) must be Pro-gated +
// authenticated + capped (see security memo).
@Injectable({ providedIn: 'root' })
export class InboxService {
  private readonly SMS_KEY = 'auralink-sms-prefs';

  readonly notifications = signal<AppNotification[]>(this.seed());

  readonly unreadCount = computed(() => this.notifications().filter(n => !n.read).length);

  // Per-category "also text me" preferences (Pro). In-app is always on.
  readonly smsPrefs = signal<SmsPrefs>(this.loadSmsPrefs());

  markRead(id: string): void {
    this.notifications.update(list => list.map(n => (n.id === id ? { ...n, read: true } : n)));
  }

  markAllRead(): void {
    this.notifications.update(list => list.map(n => ({ ...n, read: true })));
  }

  setSmsPref(category: NotificationCategory, on: boolean): void {
    this.smsPrefs.update(prev => {
      const next = { ...prev, [category]: on };
      try { localStorage.setItem(this.SMS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  private loadSmsPrefs(): SmsPrefs {
    const fallback: SmsPrefs = { health: true, maintenance: true, billing: false, aura: false };
    try {
      const raw = localStorage.getItem(this.SMS_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<SmsPrefs>;
      return { ...fallback, ...parsed };
    } catch {
      return fallback;
    }
  }

  // Mocked notifications. Replace with a fetch once notifications are persisted.
  private seed(): AppNotification[] {
    return [
      {
        id: 'n1', category: 'maintenance', title: 'Oil change due',
        body: "You've driven 4,900 mi since your last oil change on your 2019 Civic. Due within ~100 mi.",
        createdAt: '2026-07-05T09:30:00', read: false,
        ctaLabel: 'Find a mechanic', ctaRoute: '/nearby',
      },
      {
        id: 'n2', category: 'health', title: 'Coolant ran hot',
        body: 'Your morning commute peaked at 241°F — above the healthy range. Worth keeping an eye on.',
        createdAt: '2026-07-05T06:26:00', read: false,
        ctaLabel: 'View dashboard', ctaRoute: '/dashboard',
      },
      {
        id: 'n3', category: 'aura', title: 'Fuel economy dropped',
        body: 'Aura noticed your average MPG is down ~12% this week. It could be tire pressure or a dirty air filter.',
        createdAt: '2026-07-04T20:10:00', read: false,
        ctaLabel: 'Ask Aura', ctaRoute: '/assistant',
      },
      {
        id: 'n4', category: 'maintenance', title: 'Tire rotation coming up',
        body: "Recommended every 6,000 mi — you're at 5,400 since the last one.",
        createdAt: '2026-07-03T12:00:00', read: true,
      },
      {
        id: 'n5', category: 'billing', title: 'Payment received',
        body: 'Your AuraLink Pro plan renewed — $4.99. Receipt saved to My Plan.',
        createdAt: '2026-07-01T08:00:00', read: true,
        ctaLabel: 'View receipt', ctaRoute: '/my-plan',
      },
      {
        id: 'n6', category: 'health', title: 'Battery voltage low',
        body: 'On your highway trip, battery dipped to 12.0V. If it keeps dropping, have it tested.',
        createdAt: '2026-06-30T15:24:00', read: true,
        ctaLabel: 'View dashboard', ctaRoute: '/dashboard',
      },
    ];
  }
}
