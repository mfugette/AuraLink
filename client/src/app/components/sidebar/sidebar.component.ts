import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TierService } from '../../services/tier.service';
import { Feature } from '../../models/tier.model';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  // If set, this item is gated: shown with a lock hint when the tier lacks it.
  // The route's own requireTier guard handles the redirect-to-/plan on click.
  feature?: Feature;
}

// YouTube-style persistent left rail: always visible as icons when collapsed,
// expands to reveal labels. Collapsed state is owned by AppComponent (the
// hamburger toggle lives in the top bar), passed down via [collapsed].
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  @Input() collapsed = false;
  // Emitted when a nav item is activated — lets the mobile drawer close itself
  // on navigation (a no-op on desktop, where nothing listens).
  @Output() navigate = new EventEmitter<void>();
  // Emitted by the rail's own collapse/expand toggle (top section).
  @Output() toggle = new EventEmitter<void>();

  protected readonly tier = inject(TierService);

  readonly items: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/home' },
    { label: 'Aura', icon: 'auto_awesome', route: '/assistant' },
    { label: 'My Vehicles', icon: 'directions_car', route: '/my-vehicles' },
    { label: 'Metrics', icon: 'bar_chart_4_bars', route: '/dashboard', feature: 'dashboard' },
    { label: 'Part Lookup', icon: 'search', route: '/part-lookup' },
    { label: 'Find Help', icon: 'near_me', route: '/nearby', feature: 'nearby' },
    { label: 'History', icon: 'history', route: '/history' },
  ];

  // A gated item the current tier hasn't unlocked — render a lock hint.
  locked(item: NavItem): boolean {
    return !!item.feature && !this.tier.can(item.feature);
  }
}
