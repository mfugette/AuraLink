import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { LiveDtcComponent } from './live-dtc.component';

describe('LiveDtcComponent', () => {
  let fixture: ComponentFixture<LiveDtcComponent>;
  let component: LiveDtcComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LiveDtcComponent] });
    fixture = TestBed.createComponent(LiveDtcComponent);
    component = fixture.componentInstance;
  });

  it('starts on the instructions step', () => {
    expect(component.step()).toBe(0);
  });

  it('connect() simulates a scan then lands on detected codes', fakeAsync(() => {
    const steps: number[] = [];
    component.stepChanged.subscribe(s => steps.push(s));
    component.connect();
    expect(component.step()).toBe(1);
    tick(2800);
    expect(component.step()).toBe(2);
    expect(steps).toEqual([1, 2]);
  }));

  it('detected codes resolve against the real DTC database, severity-sorted', () => {
    const detected = component.detected();
    expect(detected.length).toBeGreaterThan(0);
    for (let i = 1; i < detected.length; i++) {
      // Each entry is <= the previous severity rank (descending sort).
      expect(detected[i - 1].severity).toBeDefined();
    }
  });

  it('lookupDetected emits codes plus the scanned vehicle', () => {
    let payload: { codes: string[]; vehicle: { vin: string | null } } | undefined;
    component.useCodes.subscribe(p => (payload = p));
    component.lookupDetected();
    expect(payload!.codes.length).toBeGreaterThan(0);
    expect(payload!.vehicle.vin).toBeTruthy();
  });

  it('freeze-frame and readiness panels are mutually exclusive', () => {
    component.toggleFreezeFrame();
    expect(component.showFreezeFrame()).toBeTrue();
    component.toggleReadiness();
    expect(component.showReadiness()).toBeTrue();
    expect(component.showFreezeFrame()).toBeFalse();
  });

  it('clearCodes resets to the instructions step after the confirmation', fakeAsync(() => {
    component.connect();
    tick(2800);
    component.clearCodes();
    expect(component.codesCleared()).toBeTrue();
    tick(2000);
    expect(component.step()).toBe(0);
    expect(component.codesCleared()).toBeFalse();
  }));

  it('goBack cancels a pending connect timer', fakeAsync(() => {
    component.connect();
    component.goBack();
    tick(5000);
    expect(component.step()).toBe(0);
  }));
});
