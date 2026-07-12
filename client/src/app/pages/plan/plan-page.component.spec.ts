import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { PlanPageComponent } from './plan-page.component';
import { CheckoutService } from '../../services/checkout.service';
import { clearAppStorage } from '../../../testing/test-utils';

describe('PlanPageComponent', () => {
  let fixture: ComponentFixture<PlanPageComponent>;
  let component: PlanPageComponent;

  function create(locked: string | null = null) {
    const params = convertToParamMap(locked ? { locked } : {});
    TestBed.configureTestingModule({
      imports: [PlanPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap: of(params), snapshot: { queryParamMap: params } } },
      ],
    });
    fixture = TestBed.createComponent(PlanPageComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => clearAppStorage());
  afterEach(() => clearAppStorage());

  it('defaults to monthly billing', () => {
    create();
    expect(component.interval()).toBe('monthly');
  });

  it('annual interval discounts the monthly price', () => {
    create();
    component.interval.set('annual');
    expect(component.annualPerMonth(10)).toBeLessThan(10);
    expect(component.price(10)).toBeGreaterThan(0);
  });

  it('selectPlan stages a checkout order and navigates', () => {
    create();
    const router = TestBed.inject(Router);
    const nav = spyOn(router, 'navigate').and.resolveTo(true);
    const checkout = TestBed.inject(CheckoutService);

    component.selectPlan('pro');
    const order = checkout.order();
    expect(order?.kind).toBe('plan');
    expect(order?.tier).toBe('pro');
    expect(nav).toHaveBeenCalledWith(['/checkout']);
  });

  it('buyAdapter stages a hardware order (bundle carries a tier)', () => {
    create();
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const checkout = TestBed.inject(CheckoutService);
    component.buyAdapter(true);
    expect(checkout.order()?.adapterPrice).toBeGreaterThan(0);
  });

  it('?locked=<feature> surfaces the contextual upgrade prompt', () => {
    create('dashboard');
    expect(component.lockedInfo()).toBeTruthy();
  });
});
