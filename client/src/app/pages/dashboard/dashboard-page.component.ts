import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TelemetryService } from '../../services/telemetry.service';
import { MetricDef, MetricKey, Sample } from '../../models/telemetry.model';

// Shape the SVG line chart needs: a precomputed path + fill area + axis labels.
interface ChartVm {
  def: MetricDef;
  current: number;
  isWarn: boolean;
  linePath: string;
  areaPath: string;
  // For the gauge arc (0..1 of the metric's range).
  gaugeFrac: number;
  // Y-axis tick labels (min / mid / max) and the last-point marker position.
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
  imports: [CommonModule, MatIconModule, MatTooltipModule],
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

  readonly connected = this.telemetry.connected;

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

    const isWarn =
      (def.warnAbove !== undefined && current > def.warnAbove) ||
      (def.warnBelow !== undefined && current < def.warnBelow);

    return {
      def,
      current,
      isWarn,
      linePath: linePath.trim(),
      areaPath: areaPath.trim(),
      gaugeFrac: Math.max(0, Math.min(1, (current - def.min) / (def.max - def.min || 1))),
      yMin,
      yMax,
      lastX: x(n - 1),
      lastY: y(current),
    };
  }

  // Gauge arc: a 270° sweep. Returns the SVG path for a given fraction (0..1).
  gaugeArc(frac: number, radius = 42): string {
    const startAngle = 135;                       // bottom-left
    const sweep = 270 * Math.max(0, Math.min(1, frac));
    const cx = 50, cy = 50;
    const toXY = (angleDeg: number) => {
      const a = (angleDeg * Math.PI) / 180;
      return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
    };
    const [x0, y0] = toXY(startAngle);
    const [x1, y1] = toXY(startAngle + sweep);
    const largeArc = sweep > 180 ? 1 : 0;
    return `M${x0.toFixed(2)},${y0.toFixed(2)} A${radius},${radius} 0 ${largeArc} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }

  // The full 270° track (background arc) — a fixed path.
  readonly gaugeTrackPath = this.gaugeArc(1);

  format(v: number, def: MetricDef): string {
    return v.toLocaleString(undefined, { minimumFractionDigits: def.decimals, maximumFractionDigits: def.decimals });
  }

  trackByKey = (_: number, c: ChartVm): MetricKey => c.def.key;
}
