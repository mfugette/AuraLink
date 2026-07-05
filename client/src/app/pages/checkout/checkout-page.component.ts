import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CheckoutService } from '../../services/checkout.service';
import { TierService } from '../../services/tier.service';
import { SubscriptionService } from '../../services/subscription.service';
import { AccountService } from '../../services/account.service';
import { ADAPTER } from '../../models/tier.model';

type Stage = 'form' | 'processing' | 'done';

// Checkout page. Reads the staged order from CheckoutService, collects card
// details (validated but NOT charged — payment is simulated), then applies the
// purchase (flips the tier) and shows a confirmation. If no order is staged
// (e.g. direct navigation), it prompts the user back to /plan.
//
// The `pay()` mock is the seam for a real gateway (Stripe Elements etc.) later.
@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  templateUrl: './checkout-page.component.html',
  styleUrl: './checkout-page.component.scss',
})
export class CheckoutPageComponent {
  private readonly router = inject(Router);
  private readonly checkoutService = inject(CheckoutService);
  private readonly tier = inject(TierService);
  private readonly subscription = inject(SubscriptionService);
  private readonly account = inject(AccountService);

  readonly order = this.checkoutService.order;
  readonly stage = signal<Stage>('form');
  readonly error = signal<string | null>(null);

  constructor() {
    // Prefill the contact email from the signed-in account (SaaS nicety).
    const acc = this.account.account();
    if (acc?.email) this.email.set(acc.email);
  }

  // Contact + card + billing address fields.
  email = signal('');
  name = signal('');
  card = signal('');
  expiry = signal('');
  cvc = signal('');
  address = signal('');
  city = signal('');
  state = signal('');
  zip = signal('');
  country = signal('United States');

  readonly countries = [
    'United States', 'Canada', 'United Kingdom', 'Australia',
    'Germany', 'France', 'Japan', 'Mexico', 'Other',
  ];

  readonly adapter = ADAPTER;

  // Adapter upsell: offered when checking out a plan that doesn't already
  // include the adapter. Pro gets the discounted bundle price; Plus (and any
  // other plan) gets the standalone price. Whether it's currently added lives
  // on the order itself (adapterPrice > 0), so the summary + total stay in sync.
  readonly adapterOffer = computed(() => {
    const o = this.order();
    if (!o || o.kind !== 'plan') return null;
    const isPro = o.tier === 'pro';
    return {
      price: isPro ? this.adapter.bundlePrice : this.adapter.price,
      isBundle: isPro,
      // Pro's bundle shows the strike-through savings; Plus is a plain add-on.
      wasPrice: isPro ? this.adapter.price : null,
    };
  });

  readonly adapterAdded = computed(() => (this.order()?.adapterPrice ?? 0) > 0);

  toggleAdapter(): void {
    const o = this.order();
    const offer = this.adapterOffer();
    if (!o || !offer || this.stage() !== 'form') return;
    this.checkoutService.stage({
      ...o,
      adapterPrice: this.adapterAdded() ? 0 : offer.price,
    });
  }

  // Billing-interval display helpers (annual plans show /yr + first-year copy).
  readonly isAnnual = computed(() => this.order()?.interval === 'annual');
  readonly perLabel = computed(() => (this.isAnnual() ? '/yr' : '/mo'));
  readonly firstPeriodLabel = computed(() => (this.isAnnual() ? 'first year' : 'first month'));
  readonly renewLabel = computed(() => (this.isAnnual() ? 'year' : 'month'));

  // Total charged today: adapter (one-time) + first period of the plan.
  readonly dueToday = computed(() => {
    const o = this.order();
    if (!o) return 0;
    return o.adapterPrice + o.planPrice;
  });

  // ── Input formatting ──────────────────────────────────────────────────────
  onCard(v: string): void {
    // Digits only, grouped in 4s, max 16 digits (19 chars with spaces).
    const digits = v.replace(/\D/g, '').slice(0, 16);
    this.card.set(digits.replace(/(.{4})/g, '$1 ').trim());
  }

  onExpiry(v: string): void {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    this.expiry.set(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
  }

  onCvc(v: string): void {
    this.cvc.set(v.replace(/\D/g, '').slice(0, 4));
  }

  // ── Validation ────────────────────────────────────────────────────────────
  private validate(): string | null {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim())) return 'Enter a valid email address.';
    if (this.name().trim().length < 2) return 'Enter the name on the card.';
    if (this.card().replace(/\s/g, '').length !== 16) return 'Enter a valid 16-digit card number.';
    const exp = this.expiry();
    const m = exp.match(/^(\d{2})\/(\d{2})$/);
    if (!m) return 'Enter the expiry as MM/YY.';
    const month = Number(m[1]);
    if (month < 1 || month > 12) return 'Expiry month must be 01–12.';
    // Not expired (compare against current year/month).
    const now = new Date();
    const expYear = 2000 + Number(m[2]);
    if (expYear < now.getFullYear() || (expYear === now.getFullYear() && month < now.getMonth() + 1)) {
      return 'That card has expired.';
    }
    if (this.cvc().length < 3) return 'Enter a valid CVC.';
    if (this.address().trim().length < 3) return 'Enter your billing address.';
    if (this.city().trim().length < 2) return 'Enter your city.';
    if (this.country() === 'United States' && this.state().trim().length < 2) return 'Enter your state.';
    if (this.zip().trim().length < 3) return 'Enter your billing ZIP / postal code.';
    return null;
  }

  pay(): void {
    const o = this.order();
    if (!o || this.stage() !== 'form') return;

    const err = this.validate();
    if (err) { this.error.set(err); return; }
    this.error.set(null);

    // MOCK: simulate a payment gateway round-trip. Replace with a real charge.
    this.stage.set('processing');
    const last4 = this.card().replace(/\s/g, '').slice(-4);
    setTimeout(() => {
      // Apply what was purchased: flip the tier, record the subscription +
      // billing history (for the My Plan page).
      if (o.tier) this.tier.set(o.tier);
      this.subscription.recordPurchase(o, last4);
      this.stage.set('done');
      this.checkoutService.clear();
    }, 1600);
  }

  cancel(): void {
    this.checkoutService.clear();
    this.router.navigate(['/plan']);
  }
}
