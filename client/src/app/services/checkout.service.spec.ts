import { TestBed } from '@angular/core/testing';
import { CheckoutService, CheckoutOrder } from './checkout.service';

describe('CheckoutService', () => {
  let service: CheckoutService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CheckoutService);
  });

  it('starts with no staged order', () => {
    expect(service.order()).toBeNull();
  });

  it('stage/clear round-trips an order', () => {
    const order: CheckoutOrder = { kind: 'plan', tier: 'plus', interval: 'monthly', planPrice: 4.99, adapterPrice: 0, label: 'Plus plan' };
    service.stage(order);
    expect(service.order()).toEqual(order);
    service.clear();
    expect(service.order()).toBeNull();
  });
});
