import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CodeEntryComponent } from './components/code-entry/code-entry.component';
import { VehicleSelectorComponent } from './components/vehicle-selector/vehicle-selector.component';
import { CodeResultsComponent } from './components/code-results/code-results.component';
import { PartsLocatorComponent } from './components/parts-locator/parts-locator.component';
import { DtcService } from './services/dtc.service';
import { Vehicle } from './models/vehicle.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule, MatIconModule, MatDividerModule, MatTooltipModule,
    CodeEntryComponent,
    VehicleSelectorComponent,
    CodeResultsComponent,
    PartsLocatorComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  codes = signal<string[]>([]);
  vehicle = signal<Vehicle>({ year: null, make: null, model: null, subModel: null, mileage: null, vin: null });
  showResults = signal(false);

  readonly relatedParts = computed(() => {
    const parts = new Set<string>();
    for (const code of this.codes()) {
      const result = this.dtcService.lookup(code);
      result?.relatedParts.forEach(p => parts.add(p));
    }
    return [...parts];
  });

  readonly canLookup = computed(() => this.codes().length > 0);

  readonly currentYear = new Date().getFullYear();

  constructor(private dtcService: DtcService) {}

  onCodesChanged(codes: string[]): void {
    this.codes.set(codes);
    if (codes.length === 0) this.showResults.set(false);
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

  reset(): void {
    this.codes.set([]);
    this.showResults.set(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
