import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MyPlanPageComponent } from './my-plan-page.component';
import { TierService } from '../../services/tier.service';
import { SubscriptionService } from '../../services/subscription.service';
import { provideMockAuth, clearAppStorage } from '../../../testing/test-utils';

describe('MyPlanPageComponent', () => {
  let fixture: ComponentFixture<MyPlanPageComponent>;
  let component: MyPlanPageComponent;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({
      imports: [MyPlanPageComponent],
      providers: [provideRouter([]), provideMockAuth()],
    });
    fixture = TestBed.createComponent(MyPlanPageComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => clearAppStorage());

  it('reflects the active tier definition', () => {
    TestBed.inject(TierService).set('plus');
    expect(component.def().name.toLowerCase()).toContain('plus');
  });

  it('AI quota readout follows the tier', () => {
    TestBed.inject(TierService).set('free');
    expect(component.aiRemaining()).toBe(component.aiCap());
  });

  it('cancel dialog opens with clean state', () => {
    component.cancelPassword.set('stale');
    component.cancelError.set('stale');
    component.openCancelDialog();
    expect(component.cancelDialogOpen()).toBeTrue();
    expect(component.cancelPassword()).toBe('');
    expect(component.cancelError()).toBeNull();
    component.closeCancelDialog();
    expect(component.cancelDialogOpen()).toBeFalse();
  });

  it('resume() un-cancels an active subscription', () => {
    const subs = TestBed.inject(SubscriptionService);
    subs.recordPurchase({ kind: 'plan', tier: 'pro', interval: 'monthly', planPrice: 9.99, adapterPrice: 0, label: 'Pro' }, '4242');
    subs.cancel();
    component.resume();
    expect(subs.subscription()?.canceled).toBeFalse();
  });
});
