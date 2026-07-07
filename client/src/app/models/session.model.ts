import { MetricKey } from './telemetry.model';

// A recorded AuraLink session (one drive). Mirrors the planned storage model:
// each session is ONE row with a compact `summary` (aggregates for the list) plus
// a DOWNSAMPLED `series` (a short array of samples per metric for the drill-in
// charts). We never store the raw ~1-sample/sec stream. See project-dashboard
// memory + telemetry_sessions table plan. Mocked for now (SessionService).

export interface MetricSummary {
  avg: number;
  min: number;
  max: number;
  // True if this metric breached its healthy band during the drive.
  warn?: boolean;
}

export interface DriveSession {
  id: string;
  vehicleId: string;
  vehicleLabel: string;      // denormalized so it survives a vehicle deletion
  startedAt: string;         // ISO
  durationMin: number;
  distanceMi: number;
  // A single headline warning for the list row, if any (e.g. "High coolant").
  warnLabel?: string;
  // Per-metric aggregates powering the list columns + drill-in summary tiles.
  summary: Partial<Record<MetricKey, MetricSummary>>;
  // Downsampled curves for the drill-in charts: ~1 point / 10–15s. Small enough
  // (<1KB/metric) to store on the row and redraw with the existing chart code.
  series: Partial<Record<MetricKey, number[]>>;
}
