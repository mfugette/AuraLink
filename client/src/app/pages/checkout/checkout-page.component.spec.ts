import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { CheckoutPageComponent } from './checkout-page.component';
import { CheckoutService } from '../../services/checkout.service';
import { provideMockAuth, clearAppStorage } from '../../../testing/test-utils';

describe('CheckoutPageComponent', () => {
  let fixture: ComponentFixture<CheckoutPageComponent>;
  let component: CheckoutPageComponent;
  let httpMock: HttpTestingController;

  function create(withOrder = true) {
    TestBed.configureTestingModule({
      imports: [CheckoutPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideMockAuth()],
    });
    if (withOrder) {
      TestBed.inject(CheckoutService).stage({
        kind: 'plan', tier: 'pro', interval: 'monthly', planPrice: 9.99, adapterPrice: 0, label: 'Pro plan',
      });
    }
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CheckoutPageComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => clearAppStorage());
  afterEach(() => {
    httpMock?.match(() => true);
    clearAppStorage();
  });

  it('shows the empty state when no order is staged', () => {
    create(false);
    fixture.detectChanges();
    expect(TestBed.inject(CheckoutService).order()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('plan');
  });

  it('cancel() clears the order and returns to /plan', () => {
    create();
    const router = TestBed.inject(Router);
    const nav = spyOn(router, 'navigate').and.resolveTo(true);
    component.cancel();
    expect(TestBed.inject(CheckoutService).order()).toBeNull();
    expect(nav).toHaveBeenCalledWith(['/plan']);
  });

  it('starts on the form stage with a staged order', () => {
    create();
    expect(component.stage()).toBe('form');
    expect(component.adapterAdded()).toBeFalse();
    expect(component.isAnnual()).toBeFalse();
  });

  it('toggleAdapter adds/removes the hardware upsell on the order', () => {
    create();
    const checkout = TestBed.inject(CheckoutService);
    component.toggleAdapter();
    expect((checkout.order()?.adapterPrice ?? 0)).toBeGreaterThan(0);
    component.toggleAdapter();
    expect(checkout.order()?.adapterPrice).toBe(0);
  });
});
