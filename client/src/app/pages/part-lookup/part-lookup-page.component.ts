import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PixelTitleComponent } from '../../components/shared/pixel-title/pixel-title.component';
import { PartsLocatorComponent } from '../../components/parts-locator/parts-locator.component';
import { AccountService } from '../../services/account.service';
import { SavedVehicle } from '../../models/account.model';
import { Vehicle } from '../../models/vehicle.model';

const EMPTY_VEHICLE: Vehicle = {
  year: null, make: null, model: null, subModel: null, engine: null,
  driveType: null, transmission: null, fuelType: null, bodyStyle: null,
  mileage: null, vin: null,
};

// The part-name + vehicle hand-off the Home DTC flow pushes via router state.
interface PartLookupNavState {
  partNames?: string[];
  vehicle?: Vehicle;
}

// Live parts search page. Two ways in: a direct search on this page, or a
// hand-off from the Home DTC flow (selected parts + vehicle, via router state).
// It scopes the search to a saved vehicle (picker) or manually-entered
// year/make/model, then delegates the eBay search + filters + image carousel +
// send-list to <app-parts-locator>. There is intentionally no generic catalog
// grid — the page only ever shows real listings for a real part.
@Component({
  selector: 'app-part-lookup-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, PixelTitleComponent, PartsLocatorComponent],
  templateUrl: './part-lookup-page.component.html',
  styleUrl: './part-lookup-page.component.scss',
})
export class PartLookupPageComponent implements OnInit {
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);

  // The part-name search input (comma-separates into partNames for the locator).
  query = signal('');
  // Parts currently being searched — drives the locator. Set from the query on
  // submit or from the DTC hand-off on arrival.
  partNames = signal<string[]>([]);

  // Vehicle scoping. `manualVehicle` holds the year/make/model the user typed;
  // `selectedVehicleId` points at a saved vehicle (or null = manual/none).
  readonly savedVehicles = this.account.vehicles;
  selectedVehicleId = signal<string | null>(null);
  manualMode = signal(false);
  manualYear = signal<string>('');
  manualMake = signal<string>('');
  manualModel = signal<string>('');

  // The effective vehicle passed to the locator's eBay search.
  readonly vehicle = computed<Vehicle>(() => {
    const id = this.selectedVehicleId();
    if (id) {
      const v = this.savedVehicles().find(sv => sv.id === id);
      if (v) return this.toVehicle(v);
    }
    if (this.manualMode()) {
      const year = this.manualYear().trim();
      return {
        ...EMPTY_VEHICLE,
        year: year ? Number(year) : null,
        make: this.manualMake().trim() || null,
        model: this.manualModel().trim() || null,
      };
    }
    return EMPTY_VEHICLE;
  });

  // A short label for the active vehicle scope (shown in the toolbar summary).
  readonly vehicleLabel = computed(() => {
    const v = this.vehicle();
    const parts = [v.year, v.make, v.model].filter(Boolean);
    return parts.length ? parts.join(' ') : '';
  });

  readonly hasSearch = computed(() => this.partNames().length > 0);

  ngOnInit(): void {
    // Pull the saved-vehicle list so the picker is populated (no-op for guests).
    this.account.fetchVehicles().subscribe({ error: () => {} });

    // DTC hand-off: Home routes here with { partNames, vehicle } in router state.
    const state = (this.router.getCurrentNavigation()?.extras.state
      ?? window.history.state) as PartLookupNavState | undefined;

    if (state?.partNames?.length) {
      this.partNames.set(state.partNames);
      this.query.set(state.partNames.join(', '));
    }
    if (state?.vehicle) {
      this.adoptVehicle(state.vehicle);
    }
  }

  // ── Search ──────────────────────────────────────────────────────────────────
  onQueryInput(value: string): void {
    this.query.set(value);
  }

  submitSearch(): void {
    const names = this.query()
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    this.partNames.set(names);
  }

  clearSearch(): void {
    this.query.set('');
    this.partNames.set([]);
  }

  // ── Vehicle scope ─────────────────────────────────────────────────────────────
  selectVehicle(id: string | null): void {
    this.selectedVehicleId.set(id);
    if (id) this.manualMode.set(false);
    // Re-run the active search so results re-scope to the new vehicle.
    if (this.hasSearch()) this.partNames.set([...this.partNames()]);
  }

  enterManual(): void {
    this.selectedVehicleId.set(null);
    this.manualMode.set(true);
  }

  clearVehicle(): void {
    this.selectedVehicleId.set(null);
    this.manualMode.set(false);
    this.manualYear.set('');
    this.manualMake.set('');
    this.manualModel.set('');
    if (this.hasSearch()) this.partNames.set([...this.partNames()]);
  }

  applyManual(): void {
    // Committing the manual fields re-scopes an active search.
    if (this.hasSearch()) this.partNames.set([...this.partNames()]);
  }

  // Adopt a vehicle handed off from the DTC flow: match it to a saved vehicle if
  // one lines up (so the picker reflects it), else drop it into the manual fields.
  private adoptVehicle(v: Vehicle): void {
    const match = this.savedVehicles().find(
      sv => sv.year === v.year && sv.make === v.make && sv.model === v.model,
    );
    if (match) {
      this.selectedVehicleId.set(match.id);
      return;
    }
    if (v.year || v.make || v.model) {
      this.manualMode.set(true);
      this.manualYear.set(v.year ? String(v.year) : '');
      this.manualMake.set(v.make ?? '');
      this.manualModel.set(v.model ?? '');
    }
  }

  private toVehicle(v: SavedVehicle): Vehicle {
    return {
      year: v.year, make: v.make, model: v.model, subModel: v.subModel,
      engine: v.engine, driveType: v.driveType, transmission: v.transmission,
      fuelType: v.fuelType, bodyStyle: v.bodyStyle, mileage: v.mileage, vin: v.vin,
    };
  }

  vehicleName(v: SavedVehicle): string {
    return v.nickname || [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle';
  }
}
