import { Component, Input, OnChanges, SimpleChanges, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';
import { PartsService } from '../../services/parts.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { PartCondition, PartSearchResult } from '../../models/part.model';
import { Vehicle } from '../../models/vehicle.model';
import { IconComponent } from '../shared/icon/icon.component';

@Component({
  selector: 'app-parts-locator',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IconComponent,
    MatProgressSpinnerModule, MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './parts-locator.component.html',
  styleUrl: './parts-locator.component.scss',
})
export class PartsLocatorComponent implements OnChanges {
  @Input() partNames: string[] = [];
  @Input() vehicle: Vehicle = { year: null, make: null, model: null, subModel: null, engine: null, driveType: null, transmission: null, fuelType: null, bodyStyle: null, mileage: null, vin: null };

  searching = signal(false);
  searchError = signal<string | null>(null);
  results = signal<PartSearchResult[]>([]);

  notifyMethod: 'sms' | 'email' = 'sms';
  notifyRecipient = '';
  sendingNotification = signal(false);
  isMobile = signal(false);

  // ── Filters ────────────────────────────────────────────────────────────────
  readonly conditionOptions: PartCondition[] = ['New', 'Used', 'Refurbished'];
  readonly ratingOptions = [
    { label: 'Any rating', value: 0 },
    { label: '95%+', value: 95 },
    { label: '98%+', value: 98 },
    { label: '99%+', value: 99 },
  ];

  filterConditions = signal<Set<PartCondition>>(new Set());
  filterMinRating = signal(0);
  filterFreeShippingOnly = signal(false);
  filterBestOfferOnly = signal(false);
  filterMinPrice = signal<number | null>(null);
  filterMaxPrice = signal<number | null>(null);

  readonly hasActiveFilters = computed(() =>
    this.filterConditions().size > 0 ||
    this.filterMinRating() > 0 ||
    this.filterFreeShippingOnly() ||
    this.filterBestOfferOnly() ||
    this.filterMinPrice() !== null ||
    this.filterMaxPrice() !== null
  );

  readonly filteredResults = computed(() => {
    const conditions = this.filterConditions();
    const minRating = this.filterMinRating();
    const freeShippingOnly = this.filterFreeShippingOnly();
    const bestOfferOnly = this.filterBestOfferOnly();
    const minPrice = this.filterMinPrice();
    const maxPrice = this.filterMaxPrice();

    return this.results().filter(item => {
      const p = item.part;
      if (conditions.size > 0 && (!p.condition || !conditions.has(p.condition))) return false;
      if (minRating > 0 && (p.sellerRating ?? 0) < minRating) return false;
      if (freeShippingOnly && !p.freeShipping) return false;
      if (bestOfferOnly && !p.bestOffer) return false;
      if (minPrice !== null && p.price < minPrice) return false;
      if (maxPrice !== null && p.price > maxPrice) return false;
      return true;
    });
  });

  constructor(
    private partsService: PartsService,
    private notificationService: NotificationService,
    private snackBar: MatSnackBar,
    private auth: AuthService,
  ) {
    this.isMobile.set('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['partNames'] && this.partNames.length > 0) {
      this.searchParts();
    }
  }

  searchParts(): void {
    if (this.partNames.length === 0) return;
    this.searching.set(true);
    this.searchError.set(null);
    this.results.set([]);
    this.clearFilters();

    const requests = this.partNames.map(p =>
      this.partsService.searchParts(p, this.vehicle)
    );

    forkJoin(requests).subscribe({
      next: resultArrays => {
        const all: PartSearchResult[] = resultArrays.flat().map(part => ({ part, selected: false }));
        this.results.set(all);
        this.searching.set(false);
      },
      error: (err) => {
        this.searching.set(false);
        this.searchError.set(err?.error?.error ?? 'Could not load results. Check that the server is running.');
      },
    });
  }

  toggleSelection(item: PartSearchResult): void {
    this.results.update(list =>
      list.map(i => i === item ? { ...i, selected: !i.selected } : i)
    );
  }

  toggleCondition(condition: PartCondition): void {
    this.filterConditions.update(set => {
      const next = new Set(set);
      if (next.has(condition)) next.delete(condition); else next.add(condition);
      return next;
    });
  }

  setMinRating(value: number): void {
    this.filterMinRating.set(value);
  }

  toggleFreeShippingOnly(): void {
    this.filterFreeShippingOnly.update(v => !v);
  }

  toggleBestOfferOnly(): void {
    this.filterBestOfferOnly.update(v => !v);
  }

  onMinPriceInput(value: string): void {
    this.filterMinPrice.set(value === '' ? null : Number(value));
  }

  onMaxPriceInput(value: string): void {
    this.filterMaxPrice.set(value === '' ? null : Number(value));
  }

  clearFilters(): void {
    this.filterConditions.set(new Set());
    this.filterMinRating.set(0);
    this.filterFreeShippingOnly.set(false);
    this.filterBestOfferOnly.set(false);
    this.filterMinPrice.set(null);
    this.filterMaxPrice.set(null);
  }

  nextImage(item: PartSearchResult, event: Event): void {
    event.stopPropagation();
    const count = item.part.images?.length ?? 0;
    if (count < 2) return;
    this.results.update(list =>
      list.map(i => i === item ? { ...i, imageIndex: ((i.imageIndex ?? 0) + 1) % count } : i)
    );
  }

  prevImage(item: PartSearchResult, event: Event): void {
    event.stopPropagation();
    const count = item.part.images?.length ?? 0;
    if (count < 2) return;
    this.results.update(list =>
      list.map(i => i === item ? { ...i, imageIndex: ((i.imageIndex ?? 0) - 1 + count) % count } : i)
    );
  }

  setImage(item: PartSearchResult, index: number, event: Event): void {
    event.stopPropagation();
    this.results.update(list =>
      list.map(i => i === item ? { ...i, imageIndex: index } : i)
    );
  }

  get selectedCount(): number {
    return this.results().filter(i => i.selected).length;
  }

  get selectedTotal(): number {
    return this.results().filter(i => i.selected).reduce((s, i) => s + i.part.price, 0);
  }

  async sendList(): Promise<void> {
    const selected = this.results().filter(i => i.selected);
    if (!selected.length) return;

    const listText = this.notificationService.buildShoppingList(this.results());

    if (this.notifyMethod === 'sms' && this.isMobile()) {
      this.notificationService.openSmsLink(this.notifyRecipient || '', listText);
      return;
    }

    // Server-side send now requires a signed-in user (see notify.route.ts). The
    // native SMS-link path above needs no server, so guests can still use that.
    if (!this.auth.isSignedIn()) {
      this.snackBar.open('Sign in to text or email your parts list.', 'Dismiss', { duration: 4000 });
      return;
    }

    this.sendingNotification.set(true);
    this.notificationService
      .send({ recipient: this.notifyRecipient, type: this.notifyMethod, items: this.results() })
      .subscribe({
        next: () => {
          this.sendingNotification.set(false);
          this.snackBar.open('Parts list sent!', 'Done', { duration: 3000 });
        },
        error: () => {
          this.sendingNotification.set(false);
          this.snackBar.open('Could not send — check server connection.', 'Dismiss', { duration: 4000 });
        },
      });
  }

  async copyList(): Promise<void> {
    const listText = this.notificationService.buildShoppingList(this.results());
    await this.notificationService.copyToClipboard(listText);
    this.snackBar.open('Parts list copied to clipboard!', 'Done', { duration: 2500 });
  }

  get groupedResults(): { partName: string; items: PartSearchResult[] }[] {
    const map = new Map<string, PartSearchResult[]>();
    for (const item of this.filteredResults()) {
      if (!map.has(item.part.name)) map.set(item.part.name, []);
      map.get(item.part.name)!.push(item);
    }
    return Array.from(map.entries()).map(([partName, items]) => ({ partName, items }));
  }

}
