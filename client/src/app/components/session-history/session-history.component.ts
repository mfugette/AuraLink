import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SessionService } from '../../services/session.service';
import { TelemetryService } from '../../services/telemetry.service';
import { CustomSelectComponent, SelectOption } from '../shared/custom-select/custom-select.component';
import { DriveSession } from '../../models/session.model';
import { MetricDef, MetricKey } from '../../models/telemetry.model';
import { MatIconModule } from '@angular/material/icon';

type SortKey = 'date' | 'duration' | 'distance' | 'rpm' | 'coolant';

// A small SVG line-chart view-model for the drill-in dialog.
interface DrillChart {
  def: MetricDef;
  peak: number;
  linePath: string;
  areaPath: string;
  min: number;
  max: number;
}

interface SummaryTile {
  label: string;
  value: string;
  warn: boolean;
}

// Past AuraLink sessions (drives): a searchable, sortable table (card fallback on
// mobile) below the live dashboard. Clicking a row opens a centered dialog with
// that drive's summary + downsampled metric charts. Data is mocked via
// SessionService (adapter on hold). Metric definitions/colors come from
// TelemetryService so the charts match the live dashboard.
@Component({
  selector: 'app-session-history',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, CustomSelectComponent],
  templateUrl: './session-history.component.html',
  styleUrl: './session-history.component.scss',
})
export class SessionHistoryComponent {
  private readonly sessionService = inject(SessionService);
  private readonly telemetry = inject(TelemetryService);

  private readonly W = 320;
  private readonly H = 96;
  private readonly PAD = 6;

  // Metrics shown in the drill-in, in order (the "vitals").
  private readonly drillKeys: MetricKey[] = ['speed', 'rpm', 'coolant', 'battery'];

  // ── Filter + sort state ──────────────────────────────────────────────────────
  readonly query = signal('');
  readonly vehicleFilter = signal<string | null>(null);   // null = all
  readonly warnOnly = signal(false);
  readonly sortKey = signal<SortKey>('date');
  readonly sortDir = signal<1 | -1>(-1);          // newest first by default

  // Distinct vehicles for the filter dropdown (app-standard custom-select).
  readonly vehicleOptions = computed<SelectOption[]>(() => {
    const seen = new Map<string, string>();
    for (const s of this.sessionService.sessions()) seen.set(s.vehicleId, s.vehicleLabel);
    return [
      { value: null, label: 'All vehicles' },
      ...[...seen.entries()].map(([id, label]) => ({ value: id, label })),
    ];
  });

  readonly visible = computed<DriveSession[]>(() => {
    const q = this.query().trim().toLowerCase();
    const veh = this.vehicleFilter();
    const warn = this.warnOnly();
    const key = this.sortKey();
    const dir = this.sortDir();

    const rows = this.sessionService.sessions().filter(s => {
      if (veh && s.vehicleId !== veh) return false;
      if (warn && !s.warnLabel) return false;
      if (q) {
        const hay = `${s.vehicleLabel} ${this.title(s)} ${s.startedAt}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...rows].sort((a, b) => (this.sortVal(a, key) - this.sortVal(b, key)) * dir);
  });

  // Dialog state.
  readonly openSession = signal<DriveSession | null>(null);

  // ── Row helpers ──────────────────────────────────────────────────────────────
  title(s: DriveSession): string {
    // A friendly label from the start hour (mock has no explicit title).
    const h = new Date(s.startedAt).getHours();
    if (h < 11) return 'Morning drive';
    if (h < 15) return 'Midday drive';
    if (h < 19) return 'Evening drive';
    return 'Night drive';
  }

  dateLabel(s: DriveSession): string {
    return new Date(s.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  timeLabel(s: DriveSession): string {
    return new Date(s.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  maxRpm(s: DriveSession): number { return s.summary.rpm?.max ?? 0; }
  peakCoolant(s: DriveSession): number { return s.summary.coolant?.max ?? 0; }
  coolantWarn(s: DriveSession): boolean { return !!s.summary.coolant?.warn; }

  private sortVal(s: DriveSession, key: SortKey): number {
    switch (key) {
      case 'date': return new Date(s.startedAt).getTime();
      case 'duration': return s.durationMin;
      case 'distance': return s.distanceMi;
      case 'rpm': return this.maxRpm(s);
      case 'coolant': return this.peakCoolant(s);
    }
  }

  // ── Filter/sort actions ──────────────────────────────────────────────────────
  toggleWarn(): void { this.warnOnly.update(v => !v); }

  sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update(d => (d === 1 ? -1 : 1));
    } else {
      this.sortKey.set(key);
      this.sortDir.set(key === 'date' ? -1 : 1);
    }
  }
  arrow(key: SortKey): string {
    if (this.sortKey() !== key) return '';
    return this.sortDir() === 1 ? 'arrow_upward' : 'arrow_downward';
  }

  // ── Dialog ───────────────────────────────────────────────────────────────────
  open(s: DriveSession): void { this.openSession.set(s); }
  close(): void { this.openSession.set(null); }

  private metricDef(key: MetricKey): MetricDef {
    return this.telemetry.metrics.find(m => m.key === key)!;
  }

  format(v: number, def: MetricDef): string {
    return v.toLocaleString(undefined, { minimumFractionDigits: def.decimals, maximumFractionDigits: def.decimals });
  }

  // Summary tiles for the open session.
  readonly tiles = computed<SummaryTile[]>(() => {
    const s = this.openSession();
    if (!s) return [];
    const rpm = s.summary.rpm, sp = s.summary.speed, co = s.summary.coolant, ba = s.summary.battery;
    const t: SummaryTile[] = [
      { label: 'Distance', value: `${s.distanceMi.toFixed(1)} mi`, warn: false },
      { label: 'Duration', value: `${s.durationMin} min`, warn: false },
    ];
    if (co) t.push({ label: 'Peak coolant', value: `${co.max.toFixed(0)}°F`, warn: !!co.warn });
    if (rpm) t.push({ label: 'Max RPM', value: rpm.max.toLocaleString(), warn: false });
    if (sp) t.push({ label: 'Peak speed', value: `${sp.max.toFixed(0)} mph`, warn: false });
    if (ba) t.push({ label: 'Battery', value: `${ba.min.toFixed(1)}–${ba.max.toFixed(1)}V`, warn: !!ba.warn });
    return t;
  });

  // Drill-in charts for the open session (one per vitals metric that has data).
  readonly drillCharts = computed<DrillChart[]>(() => {
    const s = this.openSession();
    if (!s) return [];
    return this.drillKeys
      .filter(k => s.series[k]?.length)
      .map(k => this.buildDrill(this.metricDef(k), s.series[k]!, s.summary[k]?.max ?? 0));
  });

  private buildDrill(def: MetricDef, values: number[], peak: number): DrillChart {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = (max - min) || 1;
    const n = values.length;
    const innerW = this.W - this.PAD * 2;
    const innerH = this.H - this.PAD * 2;
    const x = (i: number) => this.PAD + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
    const y = (v: number) => this.PAD + innerH - ((v - min) / range) * innerH;

    let linePath = '';
    for (let i = 0; i < n; i++) {
      linePath += `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(values[i]).toFixed(1)} `;
    }
    const areaPath =
      linePath +
      `L${x(n - 1).toFixed(1)},${(this.H - this.PAD).toFixed(1)} ` +
      `L${x(0).toFixed(1)},${(this.H - this.PAD).toFixed(1)} Z`;

    return { def, peak, linePath: linePath.trim(), areaPath: areaPath.trim(), min, max };
  }

  get count(): number { return this.sessionService.sessions().length; }

  trackById = (_: number, s: DriveSession) => s.id;
  trackDrill = (_: number, c: DrillChart) => c.def.key;
}
