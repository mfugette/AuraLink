import { Injectable, computed, inject, signal } from '@angular/core';
import { BillingInterval, Tier } from '../models/tier.model';
import { CheckoutOrder } from './checkout.service';
import { TierService } from './tier.service';

// A completed purchase — a row in the billing history / order list. Covers both
// recurring plan charges and one-time adapter/hardware orders.
export interface BillingRecord {
  id: string;
  date: string;              // ISO timestamp of the charge
  label: string;             // e.g. "Pro plan (annual)", "AuraLink Adapter"
  amount: number;            // charged this transaction
  kind: 'plan' | 'adapter' | 'bundle';
  // Fulfillment status — plans are 'active' immediately; hardware ships.
  status: 'active' | 'processing' | 'shipped' | 'delivered' | 'refunded';
  cardLast4: string;         // masked card, for the receipt line
}

// Current subscription state (separate from the raw tier, which TierService
// owns for feature-gating). Tracks how the user is billed and whether they've
// canceled (kept until the period ends).
export interface Subscription {
  tier: Tier;
  interval: BillingInterval;
  startedAt: string;         // ISO
  renewsAt: string;          // ISO — next charge / period end
  canceled: boolean;         // canceled but active until renewsAt
}

// Owns subscription + billing history. Persisted to localStorage for now (no
// backend billing yet) — the checkout flow records purchases here, and the My
// Plan page reads them. When real billing lands, back these with the account's
// subscription + invoices; the signals/shape stay the same.
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private static readonly SUB_KEY = 'auralink-subscription';
  private static readonly HIST_KEY = 'auralink-billing-history';

  private readonly tierService = inject(TierService);

  readonly subscription = signal<Subscription | null>(this.readSub());
  readonly history = signal<BillingRecord[]>(this.readHistory());

  // Whether there's a paid, non-canceled subscription.
  readonly isActive = computed(() => {
    const s = this.subscription();
    return !!s && s.tier !== 'free' && !s.canceled;
  });

  // Record a completed checkout: update the subscription (for plans/bundles)
  // and append billing-history rows. `cardLast4` comes from the payment form.
  recordPurchase(order: CheckoutOrder, cardLast4: string): void {
    const now = new Date();
    const records: BillingRecord[] = [];

    // Plan / bundle → (re)start the subscription and log the recurring charge.
    if (order.tier && order.planPrice > 0) {
      const interval = order.interval ?? 'monthly';
      this.subscription.set({
        tier: order.tier,
        interval,
        startedAt: now.toISOString(),
        renewsAt: this.addPeriod(now, interval).toISOString(),
        canceled: false,
      });
      records.push({
        id: this.id(),
        date: now.toISOString(),
        label: `${this.tierName(order.tier)} plan (${interval})`,
        amount: order.planPrice,
        kind: 'plan',
        status: 'active',
        cardLast4,
      });
    }

    // Adapter (standalone or bundled) → a one-time hardware order.
    if (order.adapterPrice > 0) {
      records.push({
        id: this.id(),
        date: now.toISOString(),
        label: 'AuraLink Adapter',
        amount: order.adapterPrice,
        kind: order.kind === 'bundle' ? 'bundle' : 'adapter',
        status: 'processing',
        cardLast4,
      });
    }

    if (records.length) {
      this.history.update(h => [...records, ...h]);
      this.writeHistory();
    }
    this.writeSub();
  }

  // Cancel the subscription — stays active until the period ends, then reverts
  // to Free. (No proration/refund in this mock.)
  cancel(): void {
    const s = this.subscription();
    if (!s || s.tier === 'free') return;
    this.subscription.set({ ...s, canceled: true });
    this.writeSub();
  }

  // Undo a pending cancellation (resume before the period ends).
  resume(): void {
    const s = this.subscription();
    if (!s || !s.canceled) return;
    this.subscription.set({ ...s, canceled: false });
    this.writeSub();
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  private addPeriod(from: Date, interval: BillingInterval): Date {
    const d = new Date(from);
    if (interval === 'annual') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d;
  }

  private tierName(tier: Tier): string {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  }

  private id(): string {
    return 'ord_' + Math.random().toString(36).slice(2, 10);
  }

  private readSub(): Subscription | null {
    try {
      const raw = localStorage.getItem(SubscriptionService.SUB_KEY);
      return raw ? (JSON.parse(raw) as Subscription) : null;
    } catch {
      return null;
    }
  }

  private writeSub(): void {
    try {
      const s = this.subscription();
      if (s) localStorage.setItem(SubscriptionService.SUB_KEY, JSON.stringify(s));
      else localStorage.removeItem(SubscriptionService.SUB_KEY);
    } catch {
      // Ignore storage errors.
    }
  }

  private readHistory(): BillingRecord[] {
    try {
      const raw = localStorage.getItem(SubscriptionService.HIST_KEY);
      return raw ? (JSON.parse(raw) as BillingRecord[]) : [];
    } catch {
      return [];
    }
  }

  private writeHistory(): void {
    try {
      localStorage.setItem(SubscriptionService.HIST_KEY, JSON.stringify(this.history()));
    } catch {
      // Ignore storage errors.
    }
  }
}
