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
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-parts-locator',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule],
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

  // ── Pagination ───────────────────────────────────────────────────────────────
  // The grid pages through the filtered list so the scroll region stays short and
  // the pager sits in the fixed footer bar. `page` is clamped via `currentPage`
  // so a shrinking filtered set (new filter) never leaves us past the last page.
  readonly pageSize = 12;
  private page = signal(1);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredResults().length / this.pageSize))
  );

  readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));

  readonly pagedResults = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredResults().slice(start, start + this.pageSize);
  });

  readonly pageStart = computed(() =>
    this.filteredResults().length === 0 ? 0 : (this.currentPage() - 1) * this.pageSize + 1
  );
  readonly pageEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize, this.filteredResults().length)
  );

  // Compact page list with gaps: 1 … c-1 c c+1 … N. `-1` marks an ellipsis.
  readonly pageNumbers = computed<number[]>(() => {
    const total = this.totalPages();
    const cur = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const nums = new Set<number>([1, total, cur, cur - 1, cur + 1]);
    const sorted = [...nums].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
    const out: number[] = [];
    let prev = 0;
    for (const n of sorted) {
      if (n - prev > 1) out.push(-1); // ellipsis
      out.push(n);
      prev = n;
    }
    return out;
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

  // Any filter change re-scopes the list, so jump back to the first page.
  private resetPage(): void {
    this.page.set(1);
  }

  toggleCondition(condition: PartCondition): void {
    this.filterConditions.update(set => {
      const next = new Set(set);
      if (next.has(condition)) next.delete(condition); else next.add(condition);
      return next;
    });
    this.resetPage();
  }

  setMinRating(value: number): void {
    this.filterMinRating.set(value);
    this.resetPage();
  }

  toggleFreeShippingOnly(): void {
    this.filterFreeShippingOnly.update(v => !v);
    this.resetPage();
  }

  toggleBestOfferOnly(): void {
    this.filterBestOfferOnly.update(v => !v);
    this.resetPage();
  }

  onMinPriceInput(value: string): void {
    this.filterMinPrice.set(value === '' ? null : Number(value));
    this.resetPage();
  }

  onMaxPriceInput(value: string): void {
    this.filterMaxPrice.set(value === '' ? null : Number(value));
    this.resetPage();
  }

  clearFilters(): void {
    this.filterConditions.set(new Set());
    this.filterMinRating.set(0);
    this.filterFreeShippingOnly.set(false);
    this.filterBestOfferOnly.set(false);
    this.filterMinPrice.set(null);
    this.filterMaxPrice.set(null);
    this.resetPage();
  }

  // ── Pager controls ───────────────────────────────────────────────────────────
  goToPage(n: number): void {
    this.page.set(Math.min(Math.max(1, n), this.totalPages()));
  }
  nextPage(): void { this.goToPage(this.currentPage() + 1); }
  prevPage(): void { this.goToPage(this.currentPage() - 1); }

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

}
