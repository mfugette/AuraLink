import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CodeEntryComponent } from '../../components/code-entry/code-entry.component';
import { VehicleSelectorComponent } from '../../components/vehicle-selector/vehicle-selector.component';
import { CodeResultsComponent } from '../../components/code-results/code-results.component';
import { PartsLocatorComponent } from '../../components/parts-locator/parts-locator.component';
import { LiveDtcComponent } from '../../components/live-dtc/live-dtc.component';
import { Vehicle } from '../../models/vehicle.model';
import { AuthService } from '../../services/auth.service';
import { AccountService } from '../../services/account.service';
import { SessionService } from '../../services/session.service';
import { VehicleCloudComponent } from '../../components/shared/vehicle-cloud/vehicle-cloud.component';
import { PixelTitleComponent } from '../../components/shared/pixel-title/pixel-title.component';
import { MatIconModule } from '@angular/material/icon';

// One cell of the hero's "Performance Overview" instrument grid.
interface HeroStat {
  icon: string;
  label: string;
  sub: string;
  value: string;
  delta?: string;       // e.g. "+34%" / "−2°" — optional trend chip
  deltaWarn?: boolean;  // red chip instead of green
  warn?: boolean;       // value itself reads as a warning
}

// A single readout in the vehicle-cloud panel's left "metrics" column.
interface CloudMetric {
  label: string;
  value: string;
}

// A routine-maintenance line in the vehicle-cloud panel's right column.
type MaintStatus = 'ok' | 'soon' | 'due';
interface MaintItem {
  icon: string;
  label: string;
  detail: string;       // e.g. "in 1,200 mi" / "overdue" / "3 mo ago"
  status: MaintStatus;
}

// The original single-page hero → DTC entry → vehicle → results → parts flow,
// now living behind the /home route inside the app shell. Behavior is unchanged
// from when this was app.ts — only the surrounding chrome (sidebar, top bar)
// moved out to AppComponent.
@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, CodeEntryComponent, VehicleSelectorComponent, CodeResultsComponent, PartsLocatorComponent, LiveDtcComponent, VehicleCloudComponent, PixelTitleComponent],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);
  private readonly sessions = inject(SessionService);
  private readonly router = inject(Router);

  // First name for the "Welcome back" greeting. Falls back to the display name,
  // then a generic greeting, so the hero never shows an empty/awkward name while
  // account data is still loading or if displayName is blank.
  readonly firstName = computed(() => {
    const name = this.account.account()?.displayName?.trim() ?? '';
    return name ? name.split(/\s+/)[0] : '';
  });

  // ── Hero "Performance Overview" ───────────────────────────────────────────────
  // Real-shaped stats derived from the (currently mocked) SessionService + the
  // user's saved vehicles. When the adapter lands and sessions become live, this
  // grid updates with no template change (same DriveSession shape).

  // Newest drive first (sessions are seeded newest-first, but sort defensively).
  private readonly recentDrives = computed(() =>
    [...this.sessions.sessions()].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    ),
  );

  // The vehicle to headline: the user's primary saved vehicle, else the one from
  // the most recent drive.
  readonly heroVehicle = computed(() => {
    const primary = this.account.vehicles().find(v => v.isPrimary);
    if (primary) return primary.nickname || `${primary.year} ${primary.make} ${primary.model}`;
    return this.recentDrives()[0]?.vehicleLabel ?? null;
  });

  readonly heroStats = computed<HeroStat[]>(() => {
    const drives = this.recentDrives();
    const last = drives[0];
    if (!last) return [];

    // Totals across the recent window.
    const totalMi = drives.reduce((s, d) => s + d.distanceMi, 0);
    const totalMin = drives.reduce((s, d) => s + d.durationMin, 0);
    const avgSpeed = totalMin > 0 ? (totalMi / (totalMin / 60)) : 0;
    const peakCoolant = Math.max(...drives.map(d => d.summary.coolant?.max ?? 0));
    const coolantWarn = drives.some(d => d.summary.coolant?.warn);
    const openWarns = drives.filter(d => d.warnLabel).length;
    const avgDriveMin = drives.length > 0 ? totalMin / drives.length : 0;

    return [
      {
        icon: 'route', label: 'Last drive', sub: last.vehicleLabel,
        value: `${last.distanceMi.toFixed(1)} mi`,
        delta: `${last.durationMin} min`,
      },
      {
        icon: 'speed', label: 'Avg speed', sub: `across ${drives.length} recent drives`,
        value: `${avgSpeed.toFixed(0)} mph`,
      },
      {
        icon: 'local_gas_station', label: 'Distance logged', sub: 'recent session total',
        value: `${totalMi.toFixed(0)} mi`,
        delta: `${(totalMin / 60).toFixed(1)} hrs`,
      },
      {
        icon: 'device_thermostat', label: 'Peak coolant', sub: coolantWarn ? 'exceeded healthy band' : 'within healthy band',
        value: `${peakCoolant.toFixed(0)}°F`,
        warn: coolantWarn,
        delta: coolantWarn ? 'high' : 'nominal', deltaWarn: coolantWarn,
      },
      {
        icon: openWarns > 0 ? 'warning' : 'check_circle', label: 'Open issues',
        sub: openWarns > 0 ? 'flagged on recent drives' : 'no active warnings',
        value: `${openWarns}`,
        warn: openWarns > 0,
        delta: `${avgDriveMin.toFixed(0)} min avg`,
      },
    ];
  });

  // Terminal-style status summary printed in the Aura box (replaces the example's
  // "Download Report"). Composed locally from the stats above — no API call.
  readonly auraSummary = computed<string[]>(() => {
    const drives = this.recentDrives();
    if (drives.length === 0) {
      return ['no drives logged yet — sync an adapter or enter codes to begin.'];
    }
    const warns = drives.filter(d => d.warnLabel);
    const totalMi = drives.reduce((s, d) => s + d.distanceMi, 0);
    const lines: string[] = [];
    lines.push(`${drives.length} recent drives · ${totalMi.toFixed(0)} mi logged.`);
    if (warns.length === 0) {
      lines.push('all systems nominal — no warnings on recent drives.');
    } else {
      const labels = [...new Set(warns.map(w => w.warnLabel!))].join(', ').toLowerCase();
      lines.push(`${warns.length} drive${warns.length === 1 ? '' : 's'} flagged: ${labels}.`);
      lines.push('review issue history or ask aura for next steps.');
    }
    return lines;
  });

  // ── Vehicle-cloud panel data ──────────────────────────────────────────────────
  // Left column: a few compact readouts about the headline vehicle. Right column:
  // routine-maintenance status derived from the primary vehicle's odometer using
  // standard service intervals. Both are computed locally (no API) and update
  // automatically when live vehicle/telemetry data replaces the current mocks.

  private readonly primaryVehicle = computed(() =>
    this.account.vehicles().find(v => v.isPrimary) ?? this.account.vehicles()[0] ?? null,
  );

  // Spec readouts for the cloud stage caption (Year · Make · Model · Trim · Engine).
  readonly cloudSpecs = computed<CloudMetric[]>(() => {
    const v = this.primaryVehicle();
    return [
      { label: 'Year', value: v?.year != null ? `${v.year}` : '—' },
      { label: 'Make', value: v?.make || '—' },
      { label: 'Model', value: v?.model || '—' },
      { label: 'Trim', value: v?.subModel || '—' },
      { label: 'Engine', value: v?.engine || '—' },
    ];
  });

  // VIN shown in the cloud stage's bottom-right corner.
  readonly cloudVin = computed(() => this.primaryVehicle()?.vin || '—');

  readonly cloudMetrics = computed<CloudMetric[]>(() => {
    const v = this.primaryVehicle();
    const drives = this.recentDrives();
    const totalMi = drives.reduce((s, d) => s + d.distanceMi, 0);
    const odo = v?.mileage ?? null;
    return [
      { label: 'Vehicle', value: v ? (v.nickname || `${v.year ?? ''} ${v.make ?? ''} ${v.model ?? ''}`.trim()) : '—' },
      { label: 'Odometer', value: odo != null ? `${odo.toLocaleString()} mi` : '—' },
      { label: 'Recent drives', value: `${drives.length}` },
      { label: 'Logged', value: `${totalMi.toFixed(0)} mi` },
    ];
  });

  readonly maintenanceItems = computed<MaintItem[]>(() => {
    const odo = this.primaryVehicle()?.mileage ?? null;

    // Standard mileage-based service intervals. Without a real odometer we still
    // show the schedule with an "unknown" (soon) posture rather than nothing.
    const schedule: { icon: string; label: string; interval: number }[] = [
      { icon: 'local_gas_station', label: 'Oil change',     interval: 5000 },
      { icon: 'sync',              label: 'Tire rotation',   interval: 7500 },
      { icon: 'warning',          label: 'Brake inspection', interval: 20000 },
      { icon: 'air',               label: 'Air filter',      interval: 15000 },
      { icon: 'bolt',              label: 'Battery check',   interval: 30000 },
    ];

    return schedule.map(s => {
      if (odo == null) {
        return { icon: s.icon, label: s.label, detail: 'sync odometer', status: 'soon' as const };
      }
      // Miles until the next interval boundary.
      const into = odo % s.interval;
      const remaining = s.interval - into;
      let status: MaintStatus = 'ok';
      if (remaining <= s.interval * 0.05) status = 'due';
      else if (remaining <= s.interval * 0.2) status = 'soon';
      const detail =
        status === 'due' ? 'due now' : `in ${remaining.toLocaleString()} mi`;
      return { icon: s.icon, label: s.label, detail, status };
    });
  });

  codes = signal<string[]>([]);
  vehicle = signal<Vehicle>({ year: null, make: null, model: null, subModel: null, engine: null, driveType: null, transmission: null, fuelType: null, bodyStyle: null, mileage: null, vin: null });
  showResults = signal(false);
  heroHidden = signal(false);
  formSliding = signal(false);
  liveMode = signal(false);
  selectedParts = signal<string[]>([]);

  readonly canLookup = computed(() => this.codes().length > 0);

  // The hero's slide-up stage relies on the OUTER document not scrolling, so we
  // lock <html> overflow while it's active. On phones the whole app scrolls
  // normally (the shell releases its viewport lock at 520px — see .app-shell),
  // so this lock must NOT apply there or mobile pages become unscrollable.
  private readonly mobileBreakpoint = 520;
  private lockPageScroll(locked: boolean): void {
    const isMobile = window.matchMedia(`(max-width: ${this.mobileBreakpoint}px)`).matches;
    document.documentElement.style.overflow = locked && !isMobile ? 'hidden' : '';
  }

  ngOnInit(): void {
    this.lockPageScroll(true);
    // Signed-in hero surfaces the primary vehicle; make sure the list is loaded.
    if (this.auth.isSignedIn()) this.account.fetchVehicles().subscribe();
  }

  ngOnDestroy(): void {
    this.lockPageScroll(false);
  }

  onCodesChanged(codes: string[]): void {
    this.codes.set(codes);
    if (codes.length === 0) this.showResults.set(false);
  }

  onSelectedPartsChanged(parts: string[]): void {
    this.selectedParts.set(parts);
  }

  onVehicleChanged(v: Vehicle): void {
    this.vehicle.set(v);
  }

  lookup(): void {
    if (!this.canLookup()) return;
    this.showResults.set(true);
    setTimeout(() => {
      document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  scrollToForm(): void {
    this.formSliding.set(true);
    setTimeout(() => {
      this.heroHidden.set(true);
      this.formSliding.set(false);
      this.lockPageScroll(false);
    }, 560);
  }

  reset(): void {
    this.codes.set([]);
    this.showResults.set(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToHero(): void {
    window.scrollTo({ top: 0, behavior: 'instant' });
    this.heroHidden.set(false);
    this.lockPageScroll(true);
  }

  goToSignup(): void {
    this.router.navigate(['/login'], { queryParams: { mode: 'signup' } });
  }

  // Authenticated-hero quick actions.
  go(route: string): void {
    this.router.navigate([route]);
  }

  // ── Live DTC flow (Bluetooth dongle demo) ──────────────────────────────────
  enterLiveMode(): void {
    window.scrollTo({ top: 0, behavior: 'instant' });
    this.liveMode.set(true);
    this.lockPageScroll(true);
  }

  exitLiveMode(): void {
    this.liveMode.set(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
    this.lockPageScroll(true);
  }

  onLiveStep(step: number): void {
    if (step === 2) {
      this.lockPageScroll(false);
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
      this.lockPageScroll(true);
    }
  }

  onUseDetectedCodes(result: { codes: string[]; vehicle: Vehicle }): void {
    this.codes.set(result.codes);
    // The dongle "read" the vehicle along with the codes — auto-fill the vehicle
    // form instead of leaving it blank (see VehicleSelectorComponent's
    // initialVehicle input, the same mechanism edit-mode/VIN-scan use).
    this.vehicle.set(result.vehicle);
    this.liveMode.set(false);
    this.heroHidden.set(true);
    this.showResults.set(true);
    this.lockPageScroll(false);

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
    );
  }
}
