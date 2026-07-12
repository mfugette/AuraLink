import { TestBed } from '@angular/core/testing';
import { SessionService } from './session.service';
import { MetricKey } from '../models/telemetry.model';

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionService);
  });

  it('seeds a non-empty list of drive sessions', () => {
    expect(service.sessions().length).toBeGreaterThan(0);
  });

  it('every session carries the fields the UI depends on', () => {
    for (const s of service.sessions()) {
      expect(s.id).toBeTruthy();
      expect(s.vehicleLabel).toBeTruthy();
      expect(new Date(s.startedAt).getTime()).not.toBeNaN();
      expect(s.durationMin).toBeGreaterThan(0);
      expect(s.distanceMi).toBeGreaterThan(0);
    }
  });

  it('attaches a downsampled series for every summarized metric', () => {
    for (const s of service.sessions()) {
      for (const key of Object.keys(s.summary) as MetricKey[]) {
        const curve = s.series[key];
        expect(curve).toBeDefined();
        expect(curve!.length).toBeGreaterThan(1);
      }
    }
  });

  it('series values stay inside the summary min/max envelope', () => {
    for (const s of service.sessions()) {
      for (const key of Object.keys(s.summary) as MetricKey[]) {
        const { min, max } = s.summary[key]!;
        for (const v of s.series[key]!) {
          expect(v).toBeGreaterThanOrEqual(min);
          expect(v).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  it('session ids are unique', () => {
    const ids = service.sessions().map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
