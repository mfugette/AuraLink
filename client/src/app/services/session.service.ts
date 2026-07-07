import { Injectable, signal } from '@angular/core';
import { DriveSession, MetricSummary } from '../models/session.model';
import { MetricKey } from '../models/telemetry.model';

// Past AuraLink sessions (drives) for the dashboard history table. MOCKED for
// now — the AuraLink adapter (which would record real drives) is on hold until a
// prototype exists. When it lands, replace generateMock() with a fetch to the
// telemetry_sessions table; the DriveSession shape the UI consumes stays the same.
@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly sessions = signal<DriveSession[]>(this.generateMock());

  // Downsample a metric's curve for one drive: a short, smooth pseudo-random walk
  // around the summary's average (deterministic per seed so redraws are stable).
  private curve(avg: number, min: number, max: number, seed: number, n = 40): number[] {
    const out: number[] = [];
    let v = avg;
    let s = seed * 9301 + max;
    const range = max - min || 1;
    for (let i = 0; i < n; i++) {
      s = (s * 9301 + 49297) % 233280;
      const rnd = s / 233280;
      v += (avg - v) * 0.08 + (rnd - 0.5) * range * 0.06;
      v = Math.max(min, Math.min(max, v));
      out.push(Math.round(v * 10) / 10);
    }
    return out;
  }

  private sum(avg: number, min: number, max: number, warn = false): MetricSummary {
    return { avg, min, max, warn };
  }

  private generateMock(): DriveSession[] {
    // A handful of plausible recent drives across two vehicles.
    const raw: Array<Omit<DriveSession, 'series'>> = [
      {
        id: 's1', vehicleId: 'v1', vehicleLabel: '2019 Honda Civic',
        startedAt: '2026-07-14T08:04:00', durationMin: 22, distanceMi: 11.4,
        warnLabel: 'High coolant',
        summary: {
          speed: this.sum(31, 0, 58), rpm: this.sum(1900, 700, 4120),
          coolant: this.sum(205, 178, 241, true), battery: this.sum(14.1, 13.8, 14.3),
          fuel: this.sum(65, 63, 68),
        },
      },
      {
        id: 's2', vehicleId: 'v1', vehicleLabel: '2019 Honda Civic',
        startedAt: '2026-07-13T18:12:00', durationMin: 17, distanceMi: 8.9,
        summary: {
          speed: this.sum(34, 0, 64), rpm: this.sum(1820, 720, 3780),
          coolant: this.sum(197, 176, 203), battery: this.sum(14.2, 14.0, 14.4),
          fuel: this.sum(71, 68, 74),
        },
      },
      {
        id: 's3', vehicleId: 'v2', vehicleLabel: '2021 Ford F-150',
        startedAt: '2026-07-13T11:47:00', durationMin: 6, distanceMi: 2.1,
        summary: {
          speed: this.sum(22, 0, 41), rpm: this.sum(1550, 700, 2900),
          coolant: this.sum(182, 168, 189), battery: this.sum(14.3, 14.1, 14.5),
          fuel: this.sum(75, 74, 76),
        },
      },
      {
        id: 's4', vehicleId: 'v2', vehicleLabel: '2021 Ford F-150',
        startedAt: '2026-07-11T14:30:00', durationMin: 54, distanceMi: 47.2,
        warnLabel: 'Low battery',
        summary: {
          speed: this.sum(52, 0, 78), rpm: this.sum(2400, 800, 4510),
          coolant: this.sum(206, 184, 214), battery: this.sum(13.4, 12.0, 14.2, true),
          fuel: this.sum(81, 71, 92),
        },
      },
      {
        id: 's5', vehicleId: 'v1', vehicleLabel: '2019 Honda Civic',
        startedAt: '2026-07-09T08:01:00', durationMin: 24, distanceMi: 12.0,
        summary: {
          speed: this.sum(33, 0, 61), rpm: this.sum(1880, 710, 3950),
          coolant: this.sum(196, 175, 201), battery: this.sum(14.1, 13.9, 14.4),
          fuel: this.sum(52, 49, 55),
        },
      },
    ];

    // Attach downsampled curves for every summarized metric.
    return raw.map((r, ri) => {
      const series: DriveSession['series'] = {};
      (Object.keys(r.summary) as MetricKey[]).forEach((k, ki) => {
        const s = r.summary[k]!;
        series[k] = this.curve(s.avg, s.min, s.max, ri * 7 + ki + 1);
      });
      return { ...r, series };
    });
  }
}
