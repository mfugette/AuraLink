import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AccountService } from '../../services/account.service';
import { TierService } from '../../services/tier.service';
import { NewSavedVehicle, SavedVehicle } from '../../models/account.model';
import { VehicleSelectorComponent } from '../../components/vehicle-selector/vehicle-selector.component';
import { Vehicle } from '../../models/vehicle.model';

// Full-page view of the account's saved vehicles. Add/Edit reuse the rich
// VehicleSelectorComponent (VIN scan + decode + CarAPI autocompletes); the
// selector's Vehicle shape maps 1:1 onto SavedVehicle's spec fields.
@Component({
  selector: 'app-my-vehicles-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, VehicleSelectorComponent],
  templateUrl: './my-vehicles-page.component.html',
  styleUrl: './my-vehicles-page.component.scss',
})
export class MyVehiclesPageComponent implements OnInit {
  // 'add' | editing vehicle id | null (closed)
  editorMode = signal<'add' | string | null>(null);
  saving = signal(false);
  saveError = signal<string | null>(null);

  // Extra bits the selector doesn't own.
  nickname = signal<string>('');
  makePrimary = signal(false);
  // Seed passed to the selector when editing.
  editSeed = signal<Vehicle | null>(null);

  // Latest value emitted by the selector.
  private current: Vehicle | null = null;

  protected readonly tier = inject(TierService);

  // Tier vehicle cap: how many the plan allows, and whether we're at it.
  readonly maxVehicles = computed(() => this.tier.def().maxVehicles);
  readonly atVehicleLimit = computed(() =>
    this.accountService.vehicles().length >= this.maxVehicles(),
  );

  constructor(protected accountService: AccountService) {}

  ngOnInit(): void {
    this.accountService.fetchVehicles().subscribe();
  }

  get isEditing(): boolean {
    const m = this.editorMode();
    return m !== null && m !== 'add';
  }

  openAdd(): void {
    if (this.atVehicleLimit()) return; // guarded in the template too
    this.resetEditor();
    this.editorMode.set('add');
  }

  openEdit(v: SavedVehicle): void {
    this.resetEditor();
    this.nickname.set(v.nickname ?? '');
    this.makePrimary.set(v.isPrimary);
    this.editSeed.set(this.toVehicle(v));
    this.current = this.toVehicle(v);
    this.editorMode.set(v.id);
  }

  cancel(): void {
    this.resetEditor();
  }

  private resetEditor(): void {
    this.editorMode.set(null);
    this.saveError.set(null);
    this.saving.set(false);
    this.nickname.set('');
    this.makePrimary.set(false);
    this.editSeed.set(null);
    this.current = null;
  }

  onVehicleChange(v: Vehicle): void {
    this.current = v;
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

    const mode = this.editorMode();
    const request$ = mode === 'add'
      ? this.accountService.addVehicle(payload)
      : this.accountService.updateVehicle(mode as string, payload);

    request$.subscribe({
      next: () => this.resetEditor(),
      error: () => {
        this.saving.set(false);
        this.saveError.set('Could not save vehicle — check your server connection.');
      },
    });
  }

  setPrimary(id: string): void {
    this.accountService.updateVehicle(id, { isPrimary: true }).subscribe();
  }

  remove(id: string): void {
    this.accountService.removeVehicle(id).subscribe();
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
