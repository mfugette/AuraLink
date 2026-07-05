import { Injectable, signal } from '@angular/core';
import { BillingInterval, Tier } from '../models/tier.model';

// A pending purchase moving through the checkout pipeline. Either a plan
// subscription, the adapter on its own, or the Pro+adapter bundle.
export interface CheckoutOrder {
  kind: 'plan' | 'adapter' | 'bundle';
  tier?: Tier;               // for 'plan' and 'bundle'
  interval?: BillingInterval; // for plans/bundles: 'monthly' | 'annual'
  planPrice: number;         // the recurring charge for `interval` (0 if none)
  adapterPrice: number;      // one-time, 0 if none
  label: string;             // human summary, e.g. "Pro plan" / "AuraLink Adapter"
}

// Holds the order being checked out. The Plan page stages an order here then
// navigates to /checkout, which reads it. Kept in a service (not query params)
// so the order survives the navigation without serializing pricing into the URL.
//
// Payment is MOCKED — no real processor yet. The checkout page validates a card
// form and simulates processing, then applies the tier via TierService. Swap
// the mock in CheckoutPageComponent.pay() for a real gateway (Stripe etc.).
@Injectable({ providedIn: 'root' })
export class CheckoutService {
  readonly order = signal<CheckoutOrder | null>(null);

  stage(order: CheckoutOrder): void {
    this.order.set(order);
  }

  clear(): void {
    this.order.set(null);
  }
}
