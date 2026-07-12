import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogPart, PARTS_CATALOG, PART_CATEGORIES } from '../../data/parts-catalog';
import { IconComponent } from '../../components/shared/icon/icon.component';

// Dedicated parts-catalog search page. Backed by the local seed catalog for
// now (see data/parts-catalog.ts) — the search/filter logic is source-agnostic
// so a CarAPI-backed catalog can replace the seed later.
@Component({
  selector: 'app-part-lookup-page',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './part-lookup-page.component.html',
  styleUrl: './part-lookup-page.component.scss',
})
export class PartLookupPageComponent {
  readonly categories = PART_CATEGORIES;

  query = signal('');
  activeCategory = signal<string | null>(null);

  readonly results = computed<CatalogPart[]>(() => {
    const q = this.query().trim().toLowerCase();
    const cat = this.activeCategory();

    return PARTS_CATALOG.filter(part => {
      if (cat && part.category !== cat) return false;
      if (!q) return true;
      return (
        part.name.toLowerCase().includes(q) ||
        part.brand.toLowerCase().includes(q) ||
        part.category.toLowerCase().includes(q) ||
        part.partNumber.toLowerCase().includes(q) ||
        part.description.toLowerCase().includes(q) ||
        part.relatedCodes.some(c => c.toLowerCase().includes(q))
      );
    });
  });

  readonly hasActiveFilter = computed(() => this.query().trim().length > 0 || this.activeCategory() !== null);

  // Console grid slots: pad results to at least 12 (a full 4×3, matching the
  // gauges/garage grids) and always to a full row of 4, with blank filler cells.
  // More than 12 results scroll within the grid frame.
  private readonly GRID_SLOTS = 12;
  readonly slots = computed<(CatalogPart | null)[]>(() => {
    const parts = this.results();
    const target = Math.max(this.GRID_SLOTS, Math.ceil(parts.length / 4) * 4);
    return [...parts, ...Array(target - parts.length).fill(null)];
  });

  onQueryInput(value: string): void {
    this.query.set(value);
  }

  setCategory(cat: string | null): void {
    this.activeCategory.update(current => (current === cat ? null : cat));
  }

  clearFilters(): void {
    this.query.set('');
    this.activeCategory.set(null);
  }
}
