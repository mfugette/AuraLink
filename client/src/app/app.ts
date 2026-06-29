import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core'; // computed kept for canLookup
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CodeEntryComponent } from './components/code-entry/code-entry.component';
import { VehicleSelectorComponent } from './components/vehicle-selector/vehicle-selector.component';
import { CodeResultsComponent } from './components/code-results/code-results.component';
import { PartsLocatorComponent } from './components/parts-locator/parts-locator.component';
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
export class App implements OnInit, OnDestroy {
  codes = signal<string[]>([]);
  vehicle = signal<Vehicle>({ year: null, make: null, model: null, subModel: null, engine: null, driveType: null, transmission: null, fuelType: null, bodyStyle: null, mileage: null, vin: null });
  showResults = signal(false);
  heroHidden = signal(false);
  selectedParts = signal<string[]>([]);

  readonly canLookup = computed(() => this.codes().length > 0);
  readonly currentYear = new Date().getFullYear();

  constructor() {}

  ngOnInit(): void {
    document.documentElement.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    document.documentElement.style.overflow = '';
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
    document.documentElement.style.overflow = '';
    document.getElementById('main-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Guard against both scrollend and the fallback timeout firing
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      this.heroHidden.set(true);
      // Double rAF: first frame lets Angular remove the hero from the DOM,
      // second frame lets the browser paint it, then we snap scroll to top.
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          window.scrollTo({ top: 0, behavior: 'instant' })
        )
      );
    };

    // Primary: fires exactly when smooth scroll ends
    window.addEventListener('scrollend', finish, { once: true });

    // Fallback for browsers that don't support scrollend
    setTimeout(finish, 1500);
  }

  reset(): void {
    this.codes.set([]);
    this.showResults.set(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
