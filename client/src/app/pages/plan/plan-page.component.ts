import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';import { TierService } from '../../services/tier.service';
import { CheckoutService } from '../../services/checkout.service';
import { IconComponent } from '../../components/shared/icon/icon.component';
import {
  ADAPTER, BillingInterval, Feature, Tier, TIERS, tierDef, annualPrice, ANNUAL_MONTHS_PAID,
} from '../../models/tier.model';

// Pricing / plans page. Shows the three tiers side by side, the current plan,
// and the AuraLink adapter purchase (with a Pro-bundle discount). A ?locked=
// query param (set by requireTier when a lower tier hits a gated page) shows a
// contextual "upgrade to unlock X" banner at the top.
//
// Billing isn't wired yet — "choose plan" just flips TierService (same as the
// temporary header toggle). Real checkout swaps in behind selectPlan().
@Component({
  selector: 'app-plan-page',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './plan-page.component.html',
  styleUrl: './plan-page.component.scss',
})
export class PlanPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly checkout = inject(CheckoutService);
  protected readonly tierService = inject(TierService);

  readonly tiers = TIERS;
  readonly adapter = ADAPTER;
  readonly current = this.tierService.tier;

  // Monthly vs annual billing (annual = 2 months free). The toggle at the top
  // flips all displayed prices; the chosen interval rides along on the order.
  readonly interval = signal<BillingInterval>('monthly');
  readonly annualMonthsPaid = ANNUAL_MONTHS_PAID;

  // Displayed price for a tier at the current interval (annual shows the /yr
  // total; monthly shows /mo).
  price(priceMonthly: number): number {
    return this.interval() === 'annual' ? annualPrice(priceMonthly) : priceMonthly;
  }

  // The effective per-month cost on annual, for the "$X/mo billed annually" line.
  annualPerMonth(priceMonthly: number): number {
    return Math.round((annualPrice(priceMonthly) / 12) * 100) / 100;
  }

  // Which feature (or pseudo-key like 'vehicles') the user was trying to reach.
  private readonly lockedFeature = toSignal(
    this.route.queryParamMap.pipe(map(p => p.get('locked'))),
    { initialValue: this.route.snapshot.queryParamMap.get('locked') },
  );

  // Friendly copy for the locked banner + which tier unlocks it. Keyed by the
  // gated Features plus the 'vehicles' limit (not a Feature — a per-tier cap).
  readonly lockedInfo = computed(() => {
    const f = this.lockedFeature();
    if (!f) return null;
    const map: Record<Feature | 'vehicles', { label: string; tier: Tier }> = {
      'dashboard':     { label: 'the Live Dashboard', tier: 'pro' },
      'issue-history': { label: 'Issue History', tier: 'plus' },
      'obd-scan':      { label: 'OBD2 live scanning', tier: 'plus' },
      'nearby':        { label: 'Find Help Nearby', tier: 'plus' },
      'vehicles':      { label: 'more saved vehicles', tier: 'plus' },
    };
    return map[f as Feature | 'vehicles'] ?? null;
  });

  selectPlan(tier: Tier): void {
    // Downgrades to Free are immediate (no payment) — just switch.
    if (tier === 'free') {
      this.tierService.set('free');
      return;
    }
    const def = tierDef(tier);
    const interval = this.interval();
    this.checkout.stage({
      kind: 'plan',
      tier,
      interval,
      planPrice: this.price(def.priceMonthly),
      adapterPrice: 0,
      label: `${def.name} plan`,
    });
    this.router.navigate(['/checkout']);
  }

  buyAdapter(bundle: boolean): void {
    if (bundle) {
      const interval = this.interval();
      this.checkout.stage({
        kind: 'bundle',
        tier: 'pro',
        interval,
        planPrice: this.price(tierDef('pro').priceMonthly),
        adapterPrice: this.adapter.bundlePrice,
        label: `${this.adapter.name} + Pro plan bundle`,
      });
    } else {
      this.checkout.stage({
        kind: 'adapter',
        planPrice: 0,
        adapterPrice: this.adapter.price,
        label: this.adapter.name,
      });
    }
    this.router.navigate(['/checkout']);
  }
}
