import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TelemetryService } from '../../services/telemetry.service';
import { MetricDef, MetricKey, Sample } from '../../models/telemetry.model';
import { IconComponent } from '../../components/shared/icon/icon.component';
type DashView = 'gauges' | 'charts';

// A horizontal gridline with its value, drawn as a dotted rule + axis label.
interface GridTick {
  y: number;      // viewBox y position
  label: string;  // formatted value
}

// Health classification for a live reading, driving the gauge color + badge.
// 'good' = inside the healthy band; 'warn' = nearing a threshold; 'critical' =
// past a threshold. Metrics with no thresholds are always 'good'.
type Health = 'good' | 'warn' | 'critical';

// Badge copy + tone (a --obd-* color token) for each health tier.
const HEALTH_LABEL: Record<Health, string> = { good: 'Good', warn: 'Watch', critical: 'Alert' };
const HEALTH_COLOR: Record<Health, string> = {
  good: '--obd-green',
  warn: '--obd-yellow',
  critical: '--obd-red',
};

// Shape the SVG line chart needs: a precomputed path + fill area + axis labels.
interface ChartVm {
  def: MetricDef;
  current: number;
  isWarn: boolean;          // true when status is 'critical' (past a threshold)
  health: Health;
  healthLabel: string;      // badge text ('Good' / 'Watch' / 'Alert')
  healthColorVar: string;   // CSS var name for the status tone
  linePath: string;
  areaPath: string;
  // For the gauge arc (0..1 of the metric's range).
  gaugeFrac: number;
  // Y-axis tick lines (evenly spaced, with labels) + the last-point marker.
  ticks: GridTick[];
  yMin: number;
  yMax: number;
  lastX: number;
  lastY: number;
}

// Live vehicle telemetry dashboard. Premium feature (needs the AuraLink adapter);
// data is MOCKED for now via TelemetryService. Shows a row of live gauges up top
// and a grid of historical time-series charts below, all hand-rolled SVG so they
// track the --obd-* theme in both light and dark mode.
@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, IconComponent, MatTooltipModule],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
})
export class DashboardPageComponent {
  protected readonly telemetry = inject(TelemetryService);

  // Chart drawing geometry (viewBox units). Kept square-ish; the SVG scales to
  // its container via width/height 100% + preserveAspectRatio.
  private readonly W = 320;
  private readonly H = 120;
  private readonly PAD = 6;

  // Which live view is shown: circular gauges (default) or line charts. The
  // "History" section (past sessions) is separate and always shown below.
  readonly view = signal<DashView>('gauges');
  setView(v: DashView): void { this.view.set(v); }

  // One view-model per metric, recomputed whenever the telemetry signal ticks.
  readonly charts = computed<ChartVm[]>(() => {
    const series = this.telemetry.series();
    return this.telemetry.metrics.map(def => this.buildVm(def, series[def.key].history, series[def.key].current));
  });

  private buildVm(def: MetricDef, history: Sample[], current: number): ChartVm {
    // Auto-scale the y-axis to the data's actual span (with a little headroom),
    // clamped to the metric's defined range, so the line uses the vertical space.
    const values = history.map(s => s.value);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const span = Math.max(dataMax - dataMin, def.max === def.min ? 1 : (def.max - def.min) * 0.1);
    const yMin = Math.max(def.min, dataMin - span * 0.15);
    const yMax = Math.min(def.max, dataMax + span * 0.15);
    const yRange = yMax - yMin || 1;

    const n = history.length;
    const innerW = this.W - this.PAD * 2;
    const innerH = this.H - this.PAD * 2;

    const x = (i: number) => this.PAD + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
    const y = (v: number) => this.PAD + innerH - ((v - yMin) / yRange) * innerH;

    let linePath = '';
    for (let i = 0; i < n; i++) {
      linePath += `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(history[i].value).toFixed(2)} `;
    }
    // Close the area down to the baseline for a soft gradient fill.
    const areaPath =
      linePath +
      `L${x(n - 1).toFixed(2)},${(this.H - this.PAD).toFixed(2)} ` +
      `L${x(0).toFixed(2)},${(this.H - this.PAD).toFixed(2)} Z`;

    const health = this.classify(def, current);

    // Evenly spaced y-axis gridlines (top → bottom), each with its value label,
    // so the plot reads as a measured grid like an instrument readout.
    const TICKS = 4;
    const ticks: GridTick[] = [];
    for (let t = 0; t <= TICKS; t++) {
      const v = yMax - (yRange * t) / TICKS;
      ticks.push({ y: y(v), label: this.format(v, def) });
    }

    return {
      def,
      current,
      isWarn: health === 'critical',
      health,
      healthLabel: HEALTH_LABEL[health],
      healthColorVar: HEALTH_COLOR[health],
      linePath: linePath.trim(),
      areaPath: areaPath.trim(),
      gaugeFrac: Math.max(0, Math.min(1, (current - def.min) / (def.max - def.min || 1))),
      ticks,
      yMin,
      yMax,
      lastX: x(n - 1),
      lastY: y(current),
    };
  }

  // Classify a reading into a health tier. Past a warn threshold → 'critical';
  // within a caution margin (the outer ~12% of the healthy span before a
  // threshold) → 'warn'; otherwise (or when the metric has no thresholds) →
  // 'good'.
  private classify(def: MetricDef, v: number): Health {
    const { warnBelow, warnAbove } = def;
    if ((warnAbove !== undefined && v > warnAbove) ||
        (warnBelow !== undefined && v < warnBelow)) {
      return 'critical';
    }
    const span = def.max - def.min || 1;
    const margin = span * 0.12;
    if ((warnAbove !== undefined && v > warnAbove - margin) ||
        (warnBelow !== undefined && v < warnBelow + margin)) {
      return 'warn';
    }
    return 'good';
  }

  // Gauge arc: a 180° semicircle sweeping left→right across the top. Returns the
  // SVG path for a given fraction (0..1). viewBox is 100×58; the arc's center is
  // at the bottom (50,50) so the semicircle fills the box.
  gaugeArc(frac: number, radius = 42): string {
    // Sweep from the left end (180°) up and over to the right end (0°), i.e.
    // decreasing angle traces the top semicircle. viewBox y grows downward, so
    // subtract sin to rise upward.
    const startAngle = 180;
    const sweep = 180 * Math.max(0, Math.min(1, frac));
    const cx = 50, cy = 50;
    const toXY = (angleDeg: number) => {
      const a = (angleDeg * Math.PI) / 180;
      return [cx + radius * Math.cos(a), cy - radius * Math.sin(a)];
    };
    const [x0, y0] = toXY(startAngle);
    const [x1, y1] = toXY(startAngle - sweep);
    const largeArc = 0;                     // never exceeds 180°
    // sweep-flag 1 = clockwise in SVG's y-down space, which draws the top arc.
    return `M${x0.toFixed(2)},${y0.toFixed(2)} A${radius},${radius} 0 ${largeArc} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }

  // The full 180° track (background arc) — a fixed path.
  readonly gaugeTrackPath = this.gaugeArc(1);

  format(v: number, def: MetricDef): string {
    return v.toLocaleString(undefined, { minimumFractionDigits: def.decimals, maximumFractionDigits: def.decimals });
  }

  trackByKey = (_: number, c: ChartVm): MetricKey => c.def.key;
}
