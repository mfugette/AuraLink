import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap } from 'rxjs';
import { AppNotification, NotificationCategory, SmsPrefs } from '../models/notification.model';
import { environment } from '../../environments/environment';

// In-app notifications inbox, backed by the Express API (was mocked seed +
// localStorage). Exposes the same signals/methods it always did so consumers
// (NotificationsComponent) don't change — the methods now hit the API and update
// the signal optimistically. load() is called on sign-in and clear() on sign-out
// (mirrors AccountService). (Named InboxService to avoid colliding with the parts
// NotificationService, which handles the parts-list SMS/email send.)
//
// SMS prefs are a Pro feature; wiring the actual Twilio send must stay
// authenticated + capped (see notify.route.ts security note).
@Injectable({ providedIn: 'root' })
export class InboxService {
  private readonly base = environment.apiUrl;
  private readonly http = inject(HttpClient);

  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadCount = computed(() => this.notifications().filter(n => !n.read).length);

  // Per-category "also text me" preferences (Pro). In-app is always on. Falls
  // back to the client default until the API responds.
  readonly smsPrefs = signal<SmsPrefs>({ health: true, maintenance: true, billing: false, aura: false });

  // Fetch inbox + SMS prefs. Called on sign-in. Errors are swallowed so a failed
  // load leaves the empty defaults rather than throwing into the UI.
  load(): void {
    this.http
      .get<{ notifications: AppNotification[] }>(`${this.base}/api/account/notifications`)
      .pipe(map(r => r.notifications))
      .subscribe({ next: n => this.notifications.set(n), error: () => {} });

    this.http
      .get<{ smsPrefs: SmsPrefs }>(`${this.base}/api/account/notifications/sms-prefs`)
      .pipe(map(r => r.smsPrefs))
      .subscribe({ next: p => this.smsPrefs.set(p), error: () => {} });
  }

  // Reset on sign-out.
  clear(): void {
    this.notifications.set([]);
    this.smsPrefs.set({ health: true, maintenance: true, billing: false, aura: false });
  }

  markRead(id: string): void {
    // Optimistic: flip locally, then persist. On error, reload to resync.
    this.notifications.update(list => list.map(n => (n.id === id ? { ...n, read: true } : n)));
    this.http
      .post<void>(`${this.base}/api/account/notifications/${id}/read`, {})
      .subscribe({ error: () => this.load() });
  }

  markAllRead(): void {
    this.notifications.update(list => list.map(n => ({ ...n, read: true })));
    this.http
      .post<void>(`${this.base}/api/account/notifications/read-all`, {})
      .subscribe({ error: () => this.load() });
  }

  setSmsPref(category: NotificationCategory, on: boolean): void {
    const prev = this.smsPrefs();
    this.smsPrefs.set({ ...prev, [category]: on });
    this.http
      .patch<{ smsPrefs: SmsPrefs }>(`${this.base}/api/account/notifications/sms-prefs`, { category, on })
      .pipe(map(r => r.smsPrefs))
      .subscribe({
        next: p => this.smsPrefs.set(p),
        error: () => this.smsPrefs.set(prev), // roll back on failure
      });
  }
}
