import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';import { AccountService } from '../../../services/account.service';
import { NewSavedVehicle } from '../../../models/account.model';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-vehicles-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './vehicles-panel.component.html',
  styleUrl: './vehicles-panel.component.scss',
})
export class VehiclesPanelComponent {
  @Output() closed = new EventEmitter<void>();

  showAddForm = signal(false);
  adding = signal(false);
  addError = signal<string | null>(null);

  form: NewSavedVehicle = this.blankForm();

  constructor(protected accountService: AccountService) {}

  private blankForm(): NewSavedVehicle {
    return {
      nickname: null, year: null, make: null, model: null,
      subModel: null, engine: null, driveType: null, transmission: null,
      fuelType: null, bodyStyle: null, mileage: null, vin: null, isPrimary: false,
    };
  }

  toggleAddForm(): void {
    this.showAddForm.update(v => !v);
    this.addError.set(null);
    if (this.showAddForm()) this.form = this.blankForm();
  }

  submitAdd(): void {
    if (!this.form.year || !this.form.make || !this.form.model) {
      this.addError.set('Year, make, and model are required.');
      return;
    }
    this.adding.set(true);
    this.addError.set(null);
    this.accountService.addVehicle(this.form).subscribe({
      next: () => {
        this.adding.set(false);
        this.showAddForm.set(false);
      },
      error: () => {
        this.adding.set(false);
        this.addError.set('Could not save vehicle — check your server connection.');
      },
    });
  }

  setPrimary(id: string): void {
    this.accountService.updateVehicle(id, { isPrimary: true }).subscribe();
  }

  remove(id: string): void {
    this.accountService.removeVehicle(id).subscribe();
  }

  close(): void {
    this.closed.emit();
  }
}
