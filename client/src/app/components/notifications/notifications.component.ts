import {
  Component, ElementRef, OnDestroy, computed, effect, HostListener, inject, signal, viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { InboxService } from '../../services/inbox.service';
import { TierService } from '../../services/tier.service';
import {
  AppNotification, CATEGORY_META, NotificationCategory,
} from '../../models/notification.model';

type PaneTab = 'all' | 'unread' | 'settings';

interface NotifVm extends AppNotification {
  icon: string;
  categoryLabel: string;
  timeAgo: string;
  smsOn: boolean;   // texted, i.e. category SMS pref is on for this notification
}

// Notifications bell (header) + right-side slide-in pane. Shows maintenance /
// health / billing / Aura notifications with an All/Unread split and a settings
// view for per-category SMS opt-in. SMS is a Pro feature (locked otherwise).
// Data is mocked via NotificationService.
@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnDestroy {
  private readonly inbox = inject(InboxService);
  private readonly tier = inject(TierService);

  // The scrim/pane element (only present while open). Relocated to <body> so the
  // header's backdrop-filter doesn't trap this fixed overlay (see account-menu
  // for the same fix). Cleaned up in ngOnDestroy.
  private readonly paneEl = viewChild<ElementRef<HTMLElement>>('paneEl');
  private movedEl: HTMLElement | null = null;

  readonly open = signal(false);
  readonly tab = signal<PaneTab>('all');

  readonly unreadCount = this.inbox.unreadCount;
  readonly smsPrefs = this.inbox.smsPrefs;

  // SMS escalation is a Pro capability. Free/Plus see the toggles locked.
  readonly isPro = computed(() => this.tier.tier() === 'pro');

  constructor() {
    // When the pane renders, move its root element to <body> so it escapes the
    // header's backdrop-filter containing block and covers the full viewport.
    // Angular still owns create/destroy via @if — it removes the node (wherever
    // it now lives) when open() flips false, so we only ever move it on appear.
    effect(() => {
      const el = this.paneEl()?.nativeElement;
      if (this.open() && el && el.parentElement !== document.body) {
        document.body.appendChild(el);
        this.movedEl = el;
      }
      if (!this.open()) this.movedEl = null;
    });
  }

  ngOnDestroy(): void {
    // Safety net: if the component is torn down while open, drop the moved node.
    this.movedEl?.remove();
    this.movedEl = null;
  }

  // The category rows for the settings view, in display order.
  readonly categories: NotificationCategory[] = ['health', 'maintenance', 'aura', 'billing'];
  readonly meta = CATEGORY_META;

  // Notifications shaped for the template, filtered by the active tab.
  readonly items = computed<NotifVm[]>(() => {
    const all = this.inbox.notifications();
    const rows = this.tab() === 'unread' ? all.filter(n => !n.read) : all;
    const prefs = this.smsPrefs();
    return rows.map(n => ({
      ...n,
      icon: CATEGORY_META[n.category].icon,
      categoryLabel: CATEGORY_META[n.category].label,
      timeAgo: this.timeAgo(n.createdAt),
      smsOn: (n.category === 'health' || n.category === 'maintenance') && prefs[n.category] && this.isPro(),
    }));
  });

  toggle(): void {
    this.open.update(v => !v);
    if (this.open()) this.tab.set('all');
  }
  close(): void { this.open.set(false); }

  setTab(t: PaneTab): void { this.tab.set(t); }

  markRead(n: AppNotification): void { this.inbox.markRead(n.id); }
  markAllRead(): void { this.inbox.markAllRead(); }

  setSms(category: NotificationCategory, event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    this.inbox.setSmsPref(category, on);
  }

  @HostListener('document:keydown.escape')
  onEsc(): void { if (this.open()) this.close(); }

  private timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return 'now';
    if (min < 60) return `${min}m`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h`;
    const d = Math.round(hr / 24);
    return `${d}d`;
  }

  trackId = (_: number, n: AppNotification) => n.id;
}
