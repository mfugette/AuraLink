import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountService } from '../../services/account.service';
import { NewSavedVehicle, SavedVehicle } from '../../models/account.model';
import { VehicleTerminalComponent } from '../../components/vehicle-terminal/vehicle-terminal.component';
import { Vehicle } from '../../models/vehicle.model';
import { VehicleService } from '../../services/vehicle.service';
import { VehicleCloudComponent } from '../../components/shared/vehicle-cloud/vehicle-cloud.component';
import { SessionService } from '../../services/session.service';
import { DriveSession } from '../../models/session.model';
import { MatIconModule } from '@angular/material/icon';

// A row in this vehicle's drive-history table.
interface HistoryRow {
  dateLabel: string;
  timeLabel: string;
  title: string;
  distance: string;
  duration: string;
  warnLabel?: string;
}

// A tickable routine-maintenance item (status derived from the odometer; "done"
// persisted locally per-vehicle).
type MaintStatus = 'ok' | 'soon' | 'due';
interface MaintItem {
  key: string;
  icon: string;
  label: string;
  detail: string;
  status: MaintStatus;
  done: boolean;
}

// Dedicated add/edit page for a garage vehicle, reached from a My Vehicles grid
// cell (empty cell → add, filled cell → edit). Presented as a "Vehicle Summary":
// the edit fields stack top-left, the spinnable point cloud sits top-right, and
// below sit this vehicle's drive-history table (left) + a maintenance checklist
// (right). Reuses the rich VehicleSelectorComponent; on save/cancel it navigates
// back to /my-vehicles.
@Component({
  selector: 'app-vehicle-editor-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, VehicleTerminalComponent, VehicleCloudComponent],
  templateUrl: './vehicle-editor-page.component.html',
  styleUrl: './vehicle-editor-page.component.scss',
})
export class VehicleEditorPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly accountService = inject(AccountService);
  private readonly sessions = inject(SessionService);
  private readonly vehicleService = inject(VehicleService);

  @ViewChild(VehicleTerminalComponent) private terminal?: VehicleTerminalComponent;

  // True when a DIFFERENT saved vehicle is already the primary — flips the
  // terminal's primary hint to y/N (default no) instead of Y/n.
  readonly otherPrimaryExists = computed(() =>
    this.accountService.vehicles().some(v => v.isPrimary && v.id !== this.editId())
  );

  // The vehicle id from the route, or null when adding.
  private readonly editId = signal<string | null>(null);
  readonly isEditing = computed(() => this.editId() !== null);

  // Drive history for THIS vehicle (mocked via SessionService; filtered by id).
  readonly historyRows = computed<HistoryRow[]>(() => {
    const id = this.editId();
    if (!id) return [];
    return this.sessions.sessions()
      .filter(s => s.vehicleId === id)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .map(s => this.toHistoryRow(s));
  });

  // Which maintenance items the user has ticked off, persisted per-vehicle in
  // localStorage (real service records land later — see repair-log).
  private readonly doneKeys = signal<Set<string>>(new Set());

  readonly maintItems = computed<MaintItem[]>(() => {
    const odo = this.current?.mileage ?? this.editSeed()?.mileage ?? null;
    const done = this.doneKeys();
    const schedule: { key: string; icon: string; label: string; interval: number }[] = [
      { key: 'oil',      icon: 'local_gas_station', label: 'Oil change',           interval: 5000 },
      { key: 'tires',    icon: 'sync',              label: 'Tire rotation',        interval: 7500 },
      { key: 'brakes',   icon: 'warning',           label: 'Brake inspection',     interval: 20000 },
      { key: 'air',      icon: 'air',               label: 'Air filter',           interval: 15000 },
      { key: 'battery',  icon: 'bolt',              label: 'Battery check',        interval: 30000 },
      { key: 'coolant',  icon: 'device_thermostat', label: 'Coolant flush',        interval: 30000 },
      { key: 'cabin',    icon: 'ac_unit',           label: 'Cabin air filter',     interval: 15000 },
      { key: 'wipers',   icon: 'water_drop',        label: 'Wiper blades',         interval: 12000 },
      { key: 'brakeflu', icon: 'water_drop',        label: 'Brake fluid',          interval: 45000 },
      { key: 'trans',    icon: 'settings',          label: 'Transmission fluid',   interval: 60000 },
      { key: 'spark',    icon: 'bolt',              label: 'Spark plugs',          interval: 60000 },
      { key: 'align',    icon: 'build',             label: 'Wheel alignment',      interval: 20000 },
    ];
    return schedule.map(s => {
      let status: MaintStatus = 'ok';
      let detail = 'sync odometer';
      if (odo != null) {
        const remaining = s.interval - (odo % s.interval);
        if (remaining <= s.interval * 0.05) status = 'due';
        else if (remaining <= s.interval * 0.2) status = 'soon';
        detail = status === 'due' ? 'due now' : `in ${remaining.toLocaleString()} mi`;
      }
      return { key: s.key, icon: s.icon, label: s.label, detail, status, done: done.has(s.key) };
    });
  });

  toggleMaint(key: string): void {
    const next = new Set(this.doneKeys());
    next.has(key) ? next.delete(key) : next.add(key);
    this.doneKeys.set(next);
    this.persistDone();
  }

  private maintStorageKey(): string {
    return `auralink.maint.${this.editId() ?? 'new'}`;
  }
  private loadDone(): void {
    try {
      const raw = localStorage.getItem(this.maintStorageKey());
      if (raw) this.doneKeys.set(new Set(JSON.parse(raw) as string[]));
    } catch { /* ignore malformed storage */ }
  }
  private persistDone(): void {
    try {
      localStorage.setItem(this.maintStorageKey(), JSON.stringify([...this.doneKeys()]));
    } catch { /* storage full / unavailable — non-fatal */ }
  }

  private toHistoryRow(s: DriveSession): HistoryRow {
    const d = new Date(s.startedAt);
    return {
      dateLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      timeLabel: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
      title: `${d.getHours() < 12 ? 'Morning' : d.getHours() < 18 ? 'Midday' : 'Evening'} drive`,
      distance: `${s.distanceMi.toFixed(1)} mi`,
      duration: `${s.durationMin} min`,
      warnLabel: s.warnLabel,
    };
  }

  saving = signal(false);
  deleting = signal(false);
  saveError = signal<string | null>(null);

  nickname = signal<string>('');
  makePrimary = signal(false);
  editSeed = signal<Vehicle | null>(null);

  // Latest value emitted by the selector (signal so `dirty` can react to it).
  private readonly currentSig = signal<Vehicle | null>(null);
  private get current(): Vehicle | null { return this.currentSig(); }

  // Snapshot of the saved state (JSON) taken when the vehicle is seeded; `dirty`
  // compares the live form against it so Save/Cancel only appear once something
  // actually changed. On the add flow (no seed) any input makes it dirty.
  private baseline = signal<string>('');
  private snapshot(): string {
    return JSON.stringify({
      nickname: this.nickname().trim(),
      primary: this.makePrimary(),
      v: this.currentSig(),
    });
  }
  readonly dirty = computed(() => this.snapshot() !== this.baseline());

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.editId.set(id);
    this.loadDone();

    // Editing: seed from the already-loaded vehicles list. If a direct load/
    // refresh means the list isn't populated yet, fetch it, then seed.
    if (id) {
      const seed = () => {
        const v = this.accountService.vehicles().find(x => x.id === id);
        if (v) this.applySeed(v);
        else this.router.navigate(['/my-vehicles']); // unknown id → back to grid
      };
      if (this.accountService.vehicles().length === 0) {
        this.accountService.fetchVehicles().subscribe({ next: seed, error: seed });
      } else {
        seed();
      }
    }
  }

  // While seeding, the selector re-emits several times as its async year→make→
  // model→trim cascade resolves. Each emit re-baselines, so the baseline tracks
  // the settling seed rather than a stale early state — until the cascade has
  // reproduced the seeded make+model (its identity), after which further emits
  // are genuine user edits. Timing-independent (survives slow network).
  private seeding = false;
  private seededMake: string | null = null;
  private seededModel: string | null = null;

  private applySeed(v: SavedVehicle): void {
    this.nickname.set(v.nickname ?? '');
    this.makePrimary.set(v.isPrimary);
    const vehicle = this.toVehicle(v);
    this.editSeed.set(vehicle);
    this.currentSig.set(vehicle);
    this.seeding = true;
    this.seededMake = v.make;
    this.seededModel = v.model;
    this.baseline.set(this.snapshot());
  }

  onVehicleChange(v: Vehicle): void {
    this.currentSig.set(v);
    if (this.seeding) {
      // Re-baseline on every settling emit. Consider the seed fully reproduced
      // once make+model match what we seeded (or there was no make/model to
      // seed) — then stop, so the next change is a real edit.
      this.baseline.set(this.snapshot());
      const identityReached =
        (!this.seededMake || v.make === this.seededMake) &&
        (!this.seededModel || v.model === this.seededModel);
      if (identityReached) this.seeding = false;
    }
  }

  // A full 17-char VIN was entered in the terminal — decode it and merge the
  // resolved make/model/engine/etc. back into the form.
  onVinRequested(vin: string): void {
    this.vehicleService.decodeVin(vin).subscribe({
      next: decoded => this.terminal?.applyDecoded(decoded),
      error: () => { /* leave the manually-entered VIN; user can fill the rest */ },
    });
  }

  save(): void {
    const v = this.current;
    if (!v || !v.year || !v.make || !v.model) {
      this.saveError.set('Year, make, and model are required.');
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);

    const payload: NewSavedVehicle = {
      nickname: this.nickname().trim() || null,
      year: v.year,
      make: v.make,
      model: v.model,
      subModel: v.subModel,
      engine: v.engine,
      driveType: v.driveType,
      transmission: v.transmission,
      fuelType: v.fuelType,
      bodyStyle: v.bodyStyle,
      mileage: v.mileage,
      vin: v.vin,
      isPrimary: this.makePrimary(),
    };

    const id = this.editId();
    const request$ = id
      ? this.accountService.updateVehicle(id, payload)
      : this.accountService.addVehicle(payload);

    request$.subscribe({
      next: () => this.router.navigate(['/my-vehicles']),
      error: () => {
        this.saving.set(false);
        this.saveError.set('Could not save vehicle — check your server connection.');
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/my-vehicles']);
  }

  // Delete the vehicle being edited (edit mode only). Confirms first since it's
  // destructive, then returns to the garage.
  remove(): void {
    const id = this.editId();
    if (!id || this.deleting()) return;
    const name = this.nickname().trim() || 'this vehicle';
    if (!confirm(`Delete ${name}? This can't be undone.`)) return;
    this.deleting.set(true);
    this.saveError.set(null);
    this.accountService.removeVehicle(id).subscribe({
      next: () => this.router.navigate(['/my-vehicles']),
      error: () => {
        this.deleting.set(false);
        this.saveError.set('Could not delete vehicle — check your server connection.');
      },
    });
  }

  private toVehicle(v: SavedVehicle): Vehicle {
    return {
      year: v.year,
      make: v.make,
      model: v.model,
      subModel: v.subModel,
      engine: v.engine,
      driveType: v.driveType,
      transmission: v.transmission,
      fuelType: v.fuelType,
      bodyStyle: v.bodyStyle,
      mileage: v.mileage,
      vin: v.vin,
    };
  }
}
