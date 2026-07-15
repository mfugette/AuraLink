import {
  Component, ElementRef, ViewChild, effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ServicesService } from '../../services/services.service';
import { GoogleMapsLoader } from '../../services/google-maps-loader';
import { ServiceCategory, ServicePlace } from '../../models/service-place.model';
import { PixelTitleComponent } from '../../components/shared/pixel-title/pixel-title.component';
import { MatIconModule } from '@angular/material/icon';

interface CategoryTab {
  key: ServiceCategory;
  label: string;
  icon: string;
}

// Find nearby automotive help: mechanics, tow services, tire shops, auto parts
// stores. The user shares location via GPS or a typed zip/address; results show
// as distance-sorted cards plus pins on an embedded Google map.
@Component({
  selector: 'app-nearby-services-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, PixelTitleComponent],
  templateUrl: './nearby-services-page.component.html',
  styleUrl: './nearby-services-page.component.scss',
})
export class NearbyServicesPageComponent {
  private readonly services = inject(ServicesService);
  private readonly mapsLoader = inject(GoogleMapsLoader);

  @ViewChild('mapEl') private mapRef?: ElementRef<HTMLDivElement>;

  readonly categories: CategoryTab[] = [
    { key: 'mechanic', label: 'Mechanics',    icon: 'build' },
    { key: 'tow',      label: 'Tow services', icon: 'local_shipping' },
    { key: 'tire',     label: 'Tire shops',   icon: 'trip_origin' },
    { key: 'parts',    label: 'Auto parts',   icon: 'store' },
  ];

  category = signal<ServiceCategory>('mechanic');
  zip = signal('');

  loading = signal(false);
  locating = signal(false);
  error = signal<string | null>(null);
  results = signal<ServicePlace[]>([]);
  resolvedLocation = signal<string | null>(null);
  hasSearched = signal(false);

  // The origin used for the last successful search (for re-querying on tab change).
  private origin: { lat: number; lng: number } | null = null;

  // Map state.
  private map: google.maps.Map | null = null;
  private markers: google.maps.Marker[] = [];
  private mapReady = signal(false);

  // Phones skip the embedded map entirely — no Maps JS script is injected and
  // no Maps API call is made at all, saving a billed request for the large
  // share of users who are mobile-only. Each result card's "Open in Maps"
  // action (directionsUrl()) covers the same need without the embed.
  private readonly mobileBreakpoint = 520;
  readonly isMobile = signal(window.innerWidth <= this.mobileBreakpoint);

  constructor() {
    // Re-render markers whenever results change and the map exists.
    effect(() => {
      const places = this.results();
      if (this.mapReady()) this.renderMarkers(places);
    });
  }

  // Only injects the Maps script and constructs the map on the FIRST successful
  // search — not on page load. Before that, no request to Google is made at
  // all (no script tag, no billed call) and the placeholder message alone
  // occupies the box. Safe to call repeatedly; only builds the map once.
  private async ensureMap(origin: { lat: number; lng: number }): Promise<void> {
    if (this.isMobile()) return;
    if (this.map) return;
    try {
      const maps = await this.mapsLoader.load();
      if (!this.mapRef) return;
      this.map = new maps.Map(this.mapRef.nativeElement, {
        center: { lat: origin.lat, lng: origin.lng },
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
      });
      this.mapReady.set(true);
    } catch (e) {
      // Map is a nice-to-have; the list still works without it.
      console.warn('Map unavailable:', e);
    }
  }

  selectCategory(cat: ServiceCategory): void {
    if (cat === this.category()) return;
    this.category.set(cat);
    // Re-run against the same origin if we already have one.
    if (this.origin) this.runSearch();
  }

  async useMyLocation(): Promise<void> {
    this.locating.set(true);
    this.error.set(null);
    try {
      const pos = await this.services.getCurrentPosition();
      this.origin = pos;
      this.resolvedLocation.set('Your current location');
      this.runSearch();
    } catch {
      this.error.set('Could not get your location. Enter a zip code instead.');
    } finally {
      this.locating.set(false);
    }
  }

  searchZip(): void {
    const zip = this.zip().trim();
    if (!zip) {
      this.error.set('Enter a zip code or address.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.hasSearched.set(true);
    this.services.searchByZip(this.category(), zip).subscribe({
      next: async res => {
        this.origin = res.origin;
        this.resolvedLocation.set(res.resolvedLocation);
        this.results.set(res.places);
        await this.ensureMap(res.origin);
        this.recenter(res.origin);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not search that location. Check the zip and try again.');
        this.loading.set(false);
      },
    });
  }

  // Coords-based search (from GPS or a category change with a known origin).
  private runSearch(): void {
    if (!this.origin) return;
    this.loading.set(true);
    this.error.set(null);
    this.hasSearched.set(true);
    this.services.searchByCoords(this.category(), this.origin.lat, this.origin.lng).subscribe({
      next: async res => {
        this.results.set(res.places);
        await this.ensureMap(res.origin);
        this.recenter(res.origin);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Search failed. Please try again.');
        this.loading.set(false);
      },
    });
  }

  private recenter(origin: { lat: number; lng: number }): void {
    if (this.map) {
      this.map.setCenter({ lat: origin.lat, lng: origin.lng });
      this.map.setZoom(12);
    }
  }

  private renderMarkers(places: ServicePlace[]): void {
    if (!this.map) return;
    // Clear old markers.
    for (const m of this.markers) m.setMap(null);
    this.markers = [];

    const maps = google.maps;
    const bounds = new maps.LatLngBounds();

    // Origin marker (distinct).
    if (this.origin) {
      const o = new maps.Marker({
        position: { lat: this.origin.lat, lng: this.origin.lng },
        map: this.map,
        title: 'You',
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#2563eb',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
      this.markers.push(o);
      bounds.extend({ lat: this.origin.lat, lng: this.origin.lng });
    }

    for (const p of places) {
      const marker = new maps.Marker({
        position: { lat: p.latitude, lng: p.longitude },
        map: this.map,
        title: p.name,
      });
      this.markers.push(marker);
      bounds.extend({ lat: p.latitude, lng: p.longitude });
    }

    if (places.length && !bounds.isEmpty()) {
      this.map.fitBounds(bounds, 48);
    }
  }

  directionsUrl(p: ServicePlace): string {
    return p.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;
  }

  callUrl(p: ServicePlace): string {
    return `tel:${(p.phone ?? '').replace(/[^\d+]/g, '')}`;
  }

  stars(rating: number | null): string {
    if (rating == null) return '';
    return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
  }
}
