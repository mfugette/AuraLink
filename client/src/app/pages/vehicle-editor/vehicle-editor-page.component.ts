import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AccountService } from '../../services/account.service';
import { NewSavedVehicle, SavedVehicle } from '../../models/account.model';
import { VehicleSelectorComponent } from '../../components/vehicle-selector/vehicle-selector.component';
import { Vehicle } from '../../models/vehicle.model';

// Dedicated add/edit page for a garage vehicle, reached from a My Vehicles grid
// cell (empty cell → add, filled cell → edit). Reuses the rich
// VehicleSelectorComponent; on save/cancel it navigates back to /my-vehicles.
@Component({
  selector: 'app-vehicle-editor-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, VehicleSelectorComponent],
  templateUrl: './vehicle-editor-page.component.html',
  styleUrl: './vehicle-editor-page.component.scss',
})
export class VehicleEditorPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly accountService = inject(AccountService);

  // The vehicle id from the route, or null when adding.
  private readonly editId = signal<string | null>(null);
  readonly isEditing = computed(() => this.editId() !== null);

  saving = signal(false);
  saveError = signal<string | null>(null);

  nickname = signal<string>('');
  makePrimary = signal(false);
  editSeed = signal<Vehicle | null>(null);

  // Latest value emitted by the selector.
  private current: Vehicle | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.editId.set(id);

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

  private applySeed(v: SavedVehicle): void {
    this.nickname.set(v.nickname ?? '');
    this.makePrimary.set(v.isPrimary);
    const vehicle = this.toVehicle(v);
    this.editSeed.set(vehicle);
    this.current = vehicle;
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
