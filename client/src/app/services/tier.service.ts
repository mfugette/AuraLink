import { Injectable, computed, signal } from '@angular/core';
import { Feature, Tier, TierDef, tierDef } from '../models/tier.model';

// Tracks the user's subscription tier and answers feature-access questions.
//
// Billing isn't built yet, so the tier is stored locally (localStorage) and can
// be flipped with the temporary header toggle for testing. When real billing
// lands, replace the persistence in `set()`/the initial read with the account's
// subscription record — the `tier` signal and `can()` API stay the same, so
// guards and templates won't need to change.
@Injectable({ providedIn: 'root' })
export class TierService {
  private static readonly KEY = 'auralink-tier';

  readonly tier = signal<Tier>(this.readInitial());
  readonly def = computed<TierDef>(() => tierDef(this.tier()));

  /** Does the current tier unlock this gated feature? */
  can(feature: Feature): boolean {
    return this.def().unlocks.includes(feature);
  }

  /** Max saved vehicles for the current tier (Infinity = unlimited). */
  get maxVehicles(): number {
    return this.def().maxVehicles;
  }

  /** Aura messages allowed per day for the current tier (Infinity = unlimited). */
  get aiMessagesPerDay(): number {
    return this.def().aiMessagesPerDay;
  }

  // ── Daily AI message quota ──────────────────────────────────────────────────
  // Tracked locally per calendar day. Client-side only for now (a real limit
  // must be enforced server-side once billing exists); this gives the UX and a
  // soft cap. Stored as { day: 'YYYY-MM-DD', count: n }.
  private static readonly AI_KEY = 'auralink-ai-usage';

  /** How many Aura messages remain today (Infinity if unlimited). */
  aiMessagesRemaining(): number {
    const cap = this.aiMessagesPerDay;
    if (cap === Infinity) return Infinity;
    return Math.max(0, cap - this.readAiUsage().count);
  }

  /** Record one Aura message against today's quota. */
  recordAiMessage(): void {
    if (this.aiMessagesPerDay === Infinity) return;
    const u = this.readAiUsage();
    this.writeAiUsage({ day: u.day, count: u.count + 1 });
  }

  private readAiUsage(): { day: string; count: number } {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const raw = localStorage.getItem(TierService.AI_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { day: string; count: number };
        if (parsed.day === today) return parsed;
      }
    } catch {
      // Fall through to a fresh day.
    }
    return { day: today, count: 0 };
  }

  private writeAiUsage(u: { day: string; count: number }): void {
    try {
      localStorage.setItem(TierService.AI_KEY, JSON.stringify(u));
    } catch {
      // Ignore storage errors.
    }
  }

  /** Set the active tier (temporary: local only; real billing swaps this out). */
  set(tier: Tier): void {
    this.tier.set(tier);
    try {
      localStorage.setItem(TierService.KEY, tier);
    } catch {
      // Ignore storage errors (private mode etc.) — in-memory tier still works.
    }
  }

  private readInitial(): Tier {
    try {
      const v = localStorage.getItem(TierService.KEY);
      if (v === 'free' || v === 'plus' || v === 'pro') return v;
    } catch {
      // Fall through to default.
    }
    return 'free';
  }
}
