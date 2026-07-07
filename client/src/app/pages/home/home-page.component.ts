import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CodeEntryComponent } from '../../components/code-entry/code-entry.component';
import { VehicleSelectorComponent } from '../../components/vehicle-selector/vehicle-selector.component';
import { CodeResultsComponent } from '../../components/code-results/code-results.component';
import { PartsLocatorComponent } from '../../components/parts-locator/parts-locator.component';
import { LiveDtcComponent } from '../../components/live-dtc/live-dtc.component';
import { Vehicle } from '../../models/vehicle.model';
import { AuthService } from '../../services/auth.service';
import { AccountService } from '../../services/account.service';

// The original single-page hero → DTC entry → vehicle → results → parts flow,
// now living behind the /home route inside the app shell. Behavior is unchanged
// from when this was app.ts — only the surrounding chrome (sidebar, top bar)
// moved out to AppComponent.
@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    CodeEntryComponent,
    VehicleSelectorComponent,
    CodeResultsComponent,
    PartsLocatorComponent,
    LiveDtcComponent,
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);
  private readonly router = inject(Router);

  // First name for the "Welcome back" greeting. Falls back to the display name,
  // then a generic greeting, so the hero never shows an empty/awkward name while
  // account data is still loading or if displayName is blank.
  readonly firstName = computed(() => {
    const name = this.account.account()?.displayName?.trim() ?? '';
    return name ? name.split(/\s+/)[0] : '';
  });

  codes = signal<string[]>([]);
  vehicle = signal<Vehicle>({ year: null, make: null, model: null, subModel: null, engine: null, driveType: null, transmission: null, fuelType: null, bodyStyle: null, mileage: null, vin: null });
  showResults = signal(false);
  heroHidden = signal(false);
  formSliding = signal(false);
  liveMode = signal(false);
  selectedParts = signal<string[]>([]);

  readonly canLookup = computed(() => this.codes().length > 0);

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
    this.formSliding.set(true);
    setTimeout(() => {
      this.heroHidden.set(true);
      this.formSliding.set(false);
      document.documentElement.style.overflow = '';
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
    document.documentElement.style.overflow = 'hidden';
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
    document.documentElement.style.overflow = 'hidden';
  }

  exitLiveMode(): void {
    this.liveMode.set(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.style.overflow = 'hidden';
  }

  onLiveStep(step: number): void {
    if (step === 2) {
      document.documentElement.style.overflow = '';
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.documentElement.style.overflow = 'hidden';
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
    document.documentElement.style.overflow = '';

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
    );
  }
}
