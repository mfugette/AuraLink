import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AccountService } from '../../services/account.service';
import { SavedVehicle } from '../../models/account.model';
import { MatIconModule } from '@angular/material/icon';
import { PixelTitleComponent } from '../../components/shared/pixel-title/pixel-title.component';

// The garage: a fixed console grid of vehicle slots (like the dashboard's gauge
// grid). Add/edit happens on a dedicated page (/my-vehicles/add and
// /my-vehicles/:id/edit) reached by clicking a slot — this page is grid-only.
@Component({
  selector: 'app-my-vehicles-page',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, PixelTitleComponent],
  templateUrl: './my-vehicles-page.component.html',
  styleUrl: './my-vehicles-page.component.scss',
})
export class MyVehiclesPageComponent implements OnInit {
  protected readonly accountService = inject(AccountService);

  // Garage slots: a fixed 4×3 console grid, exactly like the dashboard's fixed
  // gauge grid — always 12 slots so the grid fills the page height identically.
  // Filled slots hold a saved vehicle; the rest are empty "add" tiles. If a user
  // ever exceeds 12 vehicles, the grid grows to the next full row of 4.
  private readonly GRID_SLOTS = 12;
  readonly slots = computed<(SavedVehicle | null)[]>(() => {
    const vehicles = this.accountService.vehicles();
    const target = Math.max(this.GRID_SLOTS, Math.ceil(vehicles.length / 4) * 4);
    const empties = target - vehicles.length;
    return [...vehicles, ...Array(empties).fill(null)];
  });

  ngOnInit(): void {
    this.accountService.fetchVehicles().subscribe();
  }

  // Placeholder for future bulk-import logic (CSV/VIN batch, fleet import, …).
  bulkAdd(): void {
    // TODO: bulk add flow not built yet.
  }
}
