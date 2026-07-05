import { Injectable, signal, OnDestroy } from '@angular/core';
import { MetricDef, MetricKey, MetricSeries, Sample } from '../models/telemetry.model';

// Mock live + historical vehicle telemetry. Stands in for the future AuraLink
// Bluetooth adapter stream: seeds ~5 minutes of plausible history per metric,
// then ticks a smooth random-walk on an interval so the dashboard animates like
// a real feed. Swap generateTick()/seedHistory() for the real adapter later;
// the signal-based shape the dashboard consumes stays the same.
@Injectable({ providedIn: 'root' })
export class TelemetryService implements OnDestroy {
  // The metrics we surface, in display order. Colors reference existing --obd-*
  // tokens so gauges/lines stay theme- and light/dark-coherent. The `pid` field
  // documents the real OBD2 source for when the mock is swapped for the adapter:
  //   • Most are standard SAE J1979 Mode 01 PIDs — before querying, the adapter
  //     should read the PID-support bitmasks (PIDs 0x00/0x20/0x40) since some of
  //     these (fuel level, intake/ambient temp) aren't reported by every ECU.
  //   • Battery voltage has NO standard Mode 01 PID: read it from the adapter
  //     itself (ELM327 `AT RV`, measured at the connector) rather than the ECU.
  //     PID 0x42 "Control Module Voltage" is the closest ECU-reported value.
  readonly metrics: MetricDef[] = [
    { key: 'speed',    pid: '0x0D',      label: 'Speed',          unit: 'mph',   icon: 'speed',                 colorVar: '--obd-blue',   min: 0,   max: 120,  decimals: 0 },
    { key: 'rpm',      pid: '0x0C',      label: 'Engine RPM',     unit: 'rpm',   icon: 'settings',              colorVar: '--obd-purple', min: 0,   max: 7000, warnAbove: 6000, decimals: 0 },
    { key: 'battery',  pid: 'AT RV',     label: 'Battery',        unit: 'V',     icon: 'battery_charging_full', colorVar: '--obd-green',  min: 11,  max: 15,   warnBelow: 12.2, warnAbove: 14.8, decimals: 1 },
    { key: 'coolant',  pid: '0x05',      label: 'Coolant Temp',   unit: '°F',    icon: 'thermostat',            colorVar: '--obd-orange', min: 120, max: 260,  warnAbove: 230, decimals: 0 },
    { key: 'load',     pid: '0x04',      label: 'Engine Load',    unit: '%',     icon: 'donut_large',           colorVar: '--obd-red',    min: 0,   max: 100,  warnAbove: 92, decimals: 0 },
    { key: 'throttle', pid: '0x11',      label: 'Throttle',       unit: '%',     icon: 'linear_scale',          colorVar: '--obd-blue-2', min: 0,   max: 100,  decimals: 0 },
    { key: 'maf',      pid: '0x10',      label: 'Mass Air Flow',  unit: 'g/s',   icon: 'air',                   colorVar: '--obd-teal',   min: 0,   max: 120,  decimals: 1 },
    { key: 'fuelTrim', pid: '0x06/0x07', label: 'Fuel Trim (ST)', unit: '%',     icon: 'tune',                  colorVar: '--obd-purple', min: -15, max: 15,   warnBelow: -10, warnAbove: 10, decimals: 1 },
    { key: 'fuelRate', pid: '0x5E',      label: 'Fuel Rate',      unit: 'gal/h', icon: 'local_gas_station',     colorVar: '--obd-orange', min: 0,   max: 8,    decimals: 1 },
    { key: 'fuel',     pid: '0x2F',      label: 'Fuel Level',     unit: '%',     icon: 'ev_station',            colorVar: '--obd-yellow', min: 0,   max: 100,  warnBelow: 12, decimals: 0 },
    { key: 'intake',   pid: '0x0F',      label: 'Intake Air',     unit: '°F',    icon: 'thermostat_auto',       colorVar: '--obd-green',  min: 40,  max: 150,  decimals: 0 },
    { key: 'ambient',  pid: '0x46',      label: 'Ambient Air',    unit: '°F',    icon: 'device_thermostat',     colorVar: '--obd-blue',   min: 0,   max: 120,  decimals: 0 },
  ];

  // How much history to keep on screen, and how often the mock ticks.
  private readonly HISTORY_MS = 5 * 60 * 1000; // 5 minutes
  private readonly TICK_MS = 1000;

  // One signal holding every metric's current value + rolling history. The
  // dashboard reads this reactively; each tick replaces it (new reference) so
  // Angular re-renders the gauges and charts.
  readonly series = signal<Record<MetricKey, MetricSeries>>(this.seedAll());

  // "Connected" state — mocked as always connected for now. The real adapter
  // flow will drive this from the BLE connection.
  readonly connected = signal(true);

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.start();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.TICK_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private metricDef(key: MetricKey): MetricDef {
    return this.metrics.find(m => m.key === key)!;
  }

  // ── Seeding ────────────────────────────────────────────────────────────────
  private seedAll(): Record<MetricKey, MetricSeries> {
    const out = {} as Record<MetricKey, MetricSeries>;
    for (const def of this.metrics) {
      out[def.key] = this.seedSeries(def);
    }
    return out;
  }

  private seedSeries(def: MetricDef): MetricSeries {
    const now = Date.now();
    const points = Math.floor(this.HISTORY_MS / this.TICK_MS);
    const history: Sample[] = [];
    // Start near the middle of the range and random-walk backward in time.
    let v = this.baseline(def.key);
    for (let i = points; i >= 0; i--) {
      v = this.step(def, v);
      history.push({ t: now - i * this.TICK_MS, value: v });
    }
    return { key: def.key, current: history[history.length - 1].value, history };
  }

  // A plausible resting value for each metric (cruising / warmed-up engine).
  private baseline(key: MetricKey): number {
    switch (key) {
      case 'speed':    return 34;
      case 'rpm':      return 1800;
      case 'battery':  return 14.1;
      case 'coolant':  return 196;
      case 'fuel':     return 63;
      case 'intake':   return 88;
      case 'load':     return 38;
      case 'throttle': return 22;
      case 'maf':      return 18;
      case 'fuelTrim': return 1.5;
      case 'fuelRate': return 1.2;
      case 'ambient':  return 72;
    }
  }

  // ── Live tick ────────────────────────────────────────────────────────────────
  private tick(): void {
    const now = Date.now();
    const cutoff = now - this.HISTORY_MS;

    this.series.update(prev => {
      const next = {} as Record<MetricKey, MetricSeries>;
      for (const def of this.metrics) {
        const s = prev[def.key];
        const value = this.step(def, s.current);
        // Append and drop anything older than the window.
        const history = [...s.history, { t: now, value }].filter(p => p.t >= cutoff);
        next[def.key] = { key: def.key, current: value, history };
      }
      return next;
    });
  }

  // Smooth, bounded random-walk with a gentle pull toward the baseline so values
  // wander realistically instead of drifting to the rails.
  private step(def: MetricDef, current: number): number {
    const range = def.max - def.min;
    const volatility = range * 0.02;
    const pull = (this.baseline(def.key) - current) * 0.03;
    const noise = (Math.random() - 0.5) * 2 * volatility;
    let next = current + pull + noise;
    next = Math.max(def.min, Math.min(def.max, next));
    // Round to the metric's precision so the number doesn't jitter absurdly.
    const factor = Math.pow(10, def.decimals);
    return Math.round(next * factor) / factor;
  }
}
