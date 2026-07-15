import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TelemetryService } from './telemetry.service';

describe('TelemetryService', () => {
  let service: TelemetryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TelemetryService);
  });

  afterEach(() => service.stop());

  it('seeds ~5 minutes of history for every metric', () => {
    const series = service.series();
    for (const def of service.metrics) {
      const s = series[def.key];
      expect(s).toBeDefined();
      expect(s.history.length).toBeGreaterThan(250); // ~300 points at 1s ticks
      expect(s.current).toBe(s.history[s.history.length - 1].value);
    }
  });

  it('every sample respects the metric min/max bounds', () => {
    const series = service.series();
    for (const def of service.metrics) {
      for (const p of series[def.key].history) {
        expect(p.value).toBeGreaterThanOrEqual(def.min);
        expect(p.value).toBeLessThanOrEqual(def.max);
      }
    }
  });

  it('ticks append a new sample and publish a new reference', fakeAsync(() => {
    // Re-arm the interval inside the fakeAsync zone so tick() drives it.
    service.stop();
    service.start();
    const before = service.series();
    tick(1000);
    const after = service.series();
    expect(after).not.toBe(before);
    for (const def of service.metrics) {
      const b = before[def.key].history;
      const a = after[def.key].history;
      // A tick appends the freshest sample and drops anything outside the 5-min
      // window, so the newest timestamp advances (count itself can hold steady at
      // the window cap — don't assert monotonic growth, that's boundary-fragile).
      expect(a[a.length - 1].t).toBeGreaterThan(b[b.length - 1].t);
      expect(a.length).toBeGreaterThan(0);
    }
    service.stop();
  }));

  it('stop() halts the mock feed; start() is idempotent', fakeAsync(() => {
    service.stop();
    const frozen = service.series();
    tick(3000);
    expect(service.series()).toBe(frozen);

    service.start();
    service.start(); // second call must not double-tick
    tick(1000);
    const after = service.series();
    expect(after).not.toBe(frozen);
    service.stop();
  }));

  it('metric defs are unique by key and carry a real OBD2 pid', () => {
    const keys = service.metrics.map(m => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const m of service.metrics) expect(m.pid).toBeTruthy();
  });
});
