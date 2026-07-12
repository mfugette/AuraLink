import { TestBed } from '@angular/core/testing';
import { SubscriptionService } from './subscription.service';
import { CheckoutOrder } from './checkout.service';
import { clearAppStorage } from '../../testing/test-utils';

const PLAN_ORDER: CheckoutOrder = {
  kind: 'plan', tier: 'pro', interval: 'annual', planPrice: 49.99, adapterPrice: 0, label: 'Pro plan',
};

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SubscriptionService);
  });

  afterEach(() => clearAppStorage());

  it('starts with no subscription and empty history', () => {
    expect(service.subscription()).toBeNull();
    expect(service.history()).toEqual([]);
    expect(service.isActive()).toBeFalse();
  });

  it('recordPurchase starts a subscription and logs the charge', () => {
    service.recordPurchase(PLAN_ORDER, '4242');

    const sub = service.subscription()!;
    expect(sub.tier).toBe('pro');
    expect(sub.interval).toBe('annual');
    expect(sub.canceled).toBeFalse();
    // Annual renews one year out.
    expect(new Date(sub.renewsAt).getFullYear()).toBe(new Date(sub.startedAt).getFullYear() + 1);

    expect(service.history().length).toBe(1);
    expect(service.history()[0]).toEqual(jasmine.objectContaining({
      kind: 'plan', amount: 49.99, status: 'active', cardLast4: '4242',
    }));
    expect(service.isActive()).toBeTrue();
  });

  it('an adapter order logs hardware as processing without touching the subscription', () => {
    service.recordPurchase({ kind: 'adapter', planPrice: 0, adapterPrice: 39.99, label: 'Adapter' }, '1111');
    expect(service.subscription()).toBeNull();
    expect(service.history()[0]).toEqual(jasmine.objectContaining({ kind: 'adapter', status: 'processing' }));
  });

  it('a bundle logs both the plan and the hardware', () => {
    service.recordPurchase({ kind: 'bundle', tier: 'pro', interval: 'monthly', planPrice: 9.99, adapterPrice: 39.99, label: 'Bundle' }, '9999');
    expect(service.history().length).toBe(2);
    expect(service.history().map(r => r.kind).sort()).toEqual(['bundle', 'plan']);
    expect(service.subscription()?.tier).toBe('pro');
  });

  it('cancel keeps the plan until period end; resume undoes it', () => {
    service.recordPurchase(PLAN_ORDER, '4242');
    service.cancel();
    expect(service.subscription()?.canceled).toBeTrue();
    expect(service.isActive()).toBeFalse();
    service.resume();
    expect(service.subscription()?.canceled).toBeFalse();
    expect(service.isActive()).toBeTrue();
  });

  it('persists subscription + history across instances', () => {
    service.recordPurchase(PLAN_ORDER, '4242');
    // A new instance (fresh DI context) must rehydrate from localStorage.
    const fresh = TestBed.runInInjectionContext(() => new SubscriptionService());
    expect(fresh.subscription()?.tier).toBe('pro');
    expect(fresh.history().length).toBe(1);
  });
});
