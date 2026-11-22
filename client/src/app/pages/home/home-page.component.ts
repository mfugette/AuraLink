import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CodeEntryComponent } from '../../components/code-entry/code-entry.component';
import { VehicleSelectorComponent } from '../../components/vehicle-selector/vehicle-selector.component';
import { CodeResultsComponent } from '../../components/code-results/code-results.component';
import { LiveDtcComponent } from '../../components/live-dtc/live-dtc.component';
import { Vehicle } from '../../models/vehicle.model';
import { AuthService } from '../../services/auth.service';
import { AccountService } from '../../services/account.service';
import { SessionService } from '../../services/session.service';
import { AssistantService } from '../../services/assistant.service';
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
  key: string;
  icon: string;
  label: string;
  detail: string;       // e.g. "in 1,200 mi" / "overdue" / "3 mo ago"
  status: MaintStatus;
  done: boolean;
}

// The original single-page hero → DTC entry → vehicle → results → parts flow,
// now living behind the /home route inside the app shell. Behavior is unchanged
// from when this was app.ts — only the surrounding chrome (sidebar, top bar)
// moved out to AppComponent.
@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, CodeEntryComponent, VehicleSelectorComponent, CodeResultsComponent, LiveDtcComponent, VehicleCloudComponent, PixelTitleComponent],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  // Once the hero has slid away and the form/results are shown, the host stops
  // stretching to the viewport (flex:1) and instead sizes to its content, so the
  // app footer flows below the results instead of overlapping them.
  host: { '[class.host--flow]': 'heroHidden()' },
})
export class HomePageComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);
  private readonly sessions = inject(SessionService);
  private readonly assistant = inject(AssistantService);
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

  // Which maintenance items the user has ticked off, persisted per-vehicle in
  // localStorage (shared with the vehicle-editor checklist storage convention).
  private readonly doneKeys = signal<Set<string>>(new Set());
  // Working copy of the checkboxes — toggling only edits this; it's committed to
  // `doneKeys` (and persisted) when the user hits [save]. Seeded from `doneKeys`.
  private readonly pendingKeys = signal<Set<string>>(new Set());

  // True when the working copy diverges from what's saved — drives the [save]
  // button. Equal sets (nothing ticked, or everything already saved) → false.
  readonly maintDirty = computed<boolean>(() => {
    const saved = this.doneKeys();
    const pending = this.pendingKeys();
    if (saved.size !== pending.size) return true;
    for (const k of pending) if (!saved.has(k)) return true;
    return false;
  });

  readonly maintenanceItems = computed<MaintItem[]>(() => {
    const odo = this.primaryVehicle()?.mileage ?? null;
    const done = this.pendingKeys();

    // Standard mileage-based service intervals. Without a real odometer we still
    // show the schedule with an "unknown" (soon) posture rather than nothing.
    const schedule: { key: string; icon: string; label: string; interval: number }[] = [
      { key: 'oil',      icon: 'local_gas_station', label: 'Oil change',         interval: 5000 },
      { key: 'tires',    icon: 'sync',              label: 'Tire rotation',      interval: 7500 },
      { key: 'brakes',   icon: 'warning',           label: 'Brake inspection',   interval: 20000 },
      { key: 'air',      icon: 'air',               label: 'Air filter',         interval: 15000 },
      { key: 'battery',  icon: 'bolt',              label: 'Battery check',      interval: 30000 },
      { key: 'coolant',  icon: 'device_thermostat', label: 'Coolant flush',      interval: 30000 },
      { key: 'cabin',    icon: 'ac_unit',           label: 'Cabin air filter',   interval: 15000 },
      { key: 'wipers',   icon: 'water_drop',        label: 'Wiper blades',       interval: 12000 },
      { key: 'brakeflu', icon: 'water_drop',        label: 'Brake fluid',        interval: 45000 },
      { key: 'trans',    icon: 'settings',          label: 'Transmission fluid', interval: 60000 },
      { key: 'spark',    icon: 'bolt',              label: 'Spark plugs',        interval: 60000 },
      { key: 'align',    icon: 'build',             label: 'Wheel alignment',    interval: 20000 },
    ];

    const items = schedule.map<MaintItem>(s => {
      if (odo == null) {
        return { key: s.key, icon: s.icon, label: s.label, detail: 'sync odometer', status: 'soon', done: done.has(s.key) };
      }
      // Miles until the next interval boundary.
      const into = odo % s.interval;
      const remaining = s.interval - into;
      let status: MaintStatus = 'ok';
      if (remaining <= s.interval * 0.05) status = 'due';
      else if (remaining <= s.interval * 0.2) status = 'soon';
      const detail =
        status === 'due' ? 'due now' : `in ${remaining.toLocaleString()} mi`;
      return { key: s.key, icon: s.icon, label: s.label, detail, status, done: done.has(s.key) };
    });

    // Order by importance: due first, then soon, then not-yet-needed; completed
    // items sink to the bottom regardless of status.
    const rank: Record<MaintStatus, number> = { due: 0, soon: 1, ok: 2 };
    return items.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return rank[a.status] - rank[b.status];
    });
  });

  toggleMaint(key: string): void {
    const next = new Set(this.pendingKeys());
    next.has(key) ? next.delete(key) : next.add(key);
    this.pendingKeys.set(next);
  }

  // Commit the working copy: it becomes the saved state and is persisted. The
  // sets are now equal, so `maintDirty` flips false and the [save] button hides.
  saveMaint(): void {
    this.doneKeys.set(new Set(this.pendingKeys()));
    this.persistDone();
  }

  private maintStorageKey(): string {
    return `auralink.maint.${this.primaryVehicle()?.id ?? 'primary'}`;
  }
  private loadDoneMaint(): void {
    try {
      const raw = localStorage.getItem(this.maintStorageKey());
      const saved = raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>();
      this.doneKeys.set(saved);
      this.pendingKeys.set(new Set(saved));
    } catch { /* ignore malformed storage */ }
  }
  private persistDone(): void {
    try {
      localStorage.setItem(this.maintStorageKey(), JSON.stringify([...this.doneKeys()]));
    } catch { /* storage full / unavailable — non-fatal */ }
  }

  codes = signal<string[]>([]);
  vehicle = signal<Vehicle>({ year: null, make: null, model: null, subModel: null, engine: null, driveType: null, transmission: null, fuelType: null, bodyStyle: null, mileage: null, vin: null });
  // When true the editable vehicle form is shown; when false a compact summary of
  // the auto-filled primary vehicle is shown instead (with an "enter manually"
  // button to reveal the form). Defaults true (guests / no saved vehicle get the
  // form directly); flipped to false once a saved vehicle auto-fills (see below).
  manualVehicle = signal(true);
  showResults = signal(false);
  heroHidden = signal(false);
  formSliding = signal(false);
  liveMode = signal(false);
  selectedParts = signal<string[]>([]);

  readonly canLookup = computed(() => this.codes().length > 0);

  // Compact read-only summary of the auto-filled vehicle, shown in place of the
  // form when a saved vehicle is used (manualVehicle() === false).
  readonly vehicleSummary = computed(() => {
    const v = this.vehicle();
    const name = [v.year, v.make, v.model].filter(Boolean).join(' ').trim();
    return {
      name: name || 'Saved vehicle',
      trim: v.subModel || null,
      engine: v.engine || null,
      vin: v.vin || null,
    };
  });

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
    // Signed-in hero surfaces the primary vehicle; make sure the list is loaded,
    // then auto-fill the vehicle form from the primary (or first) saved vehicle
    // and collapse the form to a summary (user can still "enter manually").
    if (this.auth.isSignedIn()) {
      this.account.fetchVehicles().subscribe(() => {
        this.autofillPrimaryVehicle();
        this.loadDoneMaint();
      });
    }
    this.loadDoneMaint();
  }

  // Pre-fill the vehicle form from the user's primary (or first) saved vehicle and
  // hide the editable form behind a summary. No-op (form stays visible) when the
  // user has no saved vehicles or has already chosen to edit manually.
  private autofillPrimaryVehicle(): void {
    if (this.manualVehicleTouched) return;   // don't clobber a manual choice
    const saved = this.account.vehicles();
    const primary = saved.find(v => v.isPrimary) ?? saved[0];
    if (!primary) return;
    this.vehicle.set({
      year: primary.year, make: primary.make, model: primary.model,
      subModel: primary.subModel, engine: primary.engine, driveType: primary.driveType,
      transmission: primary.transmission, fuelType: primary.fuelType,
      bodyStyle: primary.bodyStyle, mileage: primary.mileage, vin: primary.vin,
    });
    this.manualVehicle.set(false);
  }

  // Reveal the editable form (from the summary) and remember the user's choice so
  // a late vehicles fetch doesn't collapse it back to the summary.
  private manualVehicleTouched = false;
  enterManualVehicle(): void {
    this.manualVehicleTouched = true;
    this.manualVehicle.set(true);
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

  // Hand the selected parts + current vehicle to the Part Lookup page, which runs
  // the live search there (the inline eBay locator was retired from this flow).
  goToPartLookup(): void {
    this.router.navigate(['/part-lookup'], {
      state: { partNames: this.selectedParts(), vehicle: this.vehicle() },
    });
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

  // "[ get report ]" on the Aura status box: hand Aura the raw status facts
  // (drive/mileage totals + any flagged warnings) and ask it to elaborate, then
  // open the assistant terminal (which auto-sends the queued query on load —
  // same path as the top-bar entry). We build the details from the drive data
  // directly rather than reusing the box's display strings, so UI-only phrasing
  // like "ask aura for next steps" never leaks into the prompt.
  getReport(): void {
    const vehicle = this.heroVehicle();
    const drives = this.recentDrives();
    const totalMi = drives.reduce((s, d) => s + d.distanceMi, 0);
    const warnLabels = [...new Set(drives.map(d => d.warnLabel).filter(Boolean))] as string[];

    const details = [`${drives.length} recent drives, ${totalMi.toFixed(0)} mi logged.`];
    if (warnLabels.length > 0) {
      details.push(`Flagged warnings: ${warnLabels.join(', ').toLowerCase()}.`);
    } else if (drives.length > 0) {
      details.push('No warnings on recent drives.');
    }

    const prompt =
      `Here's my current vehicle status${vehicle ? ` for my ${vehicle}` : ''}:\n` +
      details.map(d => `- ${d}`).join('\n') +
      `\n\nElaborate on this: what's likely going on, how urgent is each item, and what should I do next?`;

    this.assistant.queue(prompt);
    this.router.navigate(['/assistant']);
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
