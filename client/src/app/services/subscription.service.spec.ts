import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { SubscriptionService } from './subscription.service';
import { CheckoutOrder } from './checkout.service';
import { clearAppStorage } from '../../testing/test-utils';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

const PLAN_ORDER: CheckoutOrder = {
  kind: 'plan', tier: 'pro', interval: 'annual', planPrice: 49.99, adapterPrice: 0, label: 'Pro plan',
};

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SubscriptionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    clearAppStorage();
  });

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

  it('persists subscription + history across instances via the localStorage overlay', () => {
    service.recordPurchase(PLAN_ORDER, '4242');
    // A new instance (fresh DI context) rehydrates from the localStorage overlay
    // (the mock write path — see the service note). No HTTP until load() is called.
    const fresh = TestBed.runInInjectionContext(() => new SubscriptionService());
    expect(fresh.subscription()?.tier).toBe('pro');
    expect(fresh.history().length).toBe(1);
  });

  it('load() GETs the subscription and prefers a real (non-free) server sub over the local mock', () => {
    service.load();
    const req = httpMock.expectOne(`${API}/api/account/subscription`);
    expect(req.request.method).toBe('GET');
    req.flush({
      subscription: { tier: 'plus', interval: 'monthly', startedAt: '2026-01-01', renewsAt: '2026-02-01', canceled: false },
      billing: [{ id: 'b1', date: '2026-01-01', label: 'Plus plan (monthly)', amount: 0.99, kind: 'plan', status: 'active', cardLast4: '4242' }],
    });
    expect(service.subscription()?.tier).toBe('plus');
    expect(service.history().length).toBe(1);
  });

  it('load() keeps a local mock when the server returns only a default free sub', () => {
    service.recordPurchase(PLAN_ORDER, '4242'); // local mock: pro
    service.load();
    httpMock.expectOne(`${API}/api/account/subscription`).flush({
      subscription: { tier: 'free', interval: 'monthly', startedAt: '2026-01-01', renewsAt: '2026-02-01', canceled: false },
      billing: [],
    });
    // Server 'free' + empty billing must not clobber the local pro mock.
    expect(service.subscription()?.tier).toBe('pro');
    expect(service.history().length).toBe(1);
  });
});
