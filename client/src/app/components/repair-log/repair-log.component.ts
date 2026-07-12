import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';import { RepairLogService } from '../../services/repair-log.service';
import { AccountService } from '../../services/account.service';
import { CustomSelectComponent, SelectOption } from '../shared/custom-select/custom-select.component';
import { IconComponent } from '../shared/icon/icon.component';
import {
  RepairCategory, RepairRecord, REPAIR_CATEGORY_META,
} from '../../models/repair.model';

type SortKey = 'date' | 'mileage' | 'cost';

// The user's repair / service log, shown as a sortable table (matching the Drives
// tab) with a row-click detail dialog and an "Add record" dialog. Card fallback on
// mobile. Data via RepairLogService (seed + localStorage).
@Component({
  selector: 'app-repair-log',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, CustomSelectComponent],
  templateUrl: './repair-log.component.html',
  styleUrl: './repair-log.component.scss',
})
export class RepairLogComponent {
  private readonly repairLog = inject(RepairLogService);
  protected readonly accountService = inject(AccountService);

  readonly meta = REPAIR_CATEGORY_META;
  readonly categories = Object.keys(REPAIR_CATEGORY_META) as RepairCategory[];

  // ── Filter + sort state ──────────────────────────────────────────────────────
  readonly query = signal('');
  readonly vehicleFilter = signal<string | null>(null);   // null = all
  readonly sortKey = signal<SortKey>('date');
  readonly sortDir = signal<1 | -1>(-1);

  // Options for the app-standard dropdowns.
  readonly vehicleOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'All vehicles' },
    ...this.accountService.vehicles().map(v => ({
      value: v.id, label: v.nickname || `${v.year} ${v.make} ${v.model}`,
    })),
  ]);
  readonly categoryOptions: SelectOption[] = this.categories.map(c => ({ value: c, label: this.meta[c].label }));

  readonly records = computed<RepairRecord[]>(() => {
    const vid = this.vehicleFilter();
    const q = this.query().trim().toLowerCase();
    const key = this.sortKey();
    const dir = this.sortDir();

    const rows = this.repairLog.records().filter(r => {
      if (vid && r.vehicleId !== vid) return false;
      if (q) {
        const hay = `${r.title} ${r.shop} ${this.meta[r.category].label} ${r.vehicleLabel} ${r.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...rows].sort((a, b) => (this.sortVal(a, key) - this.sortVal(b, key)) * dir);
  });

  readonly totalSpent = computed(() =>
    this.records().reduce((sum, r) => sum + (r.cost ?? 0), 0),
  );

  private sortVal(r: RepairRecord, key: SortKey): number {
    switch (key) {
      case 'date': return new Date(r.date).getTime();
      case 'mileage': return r.mileage ?? -1;
      case 'cost': return r.cost ?? -1;
    }
  }

  sortBy(key: SortKey): void {
    if (this.sortKey() === key) this.sortDir.update(d => (d === 1 ? -1 : 1));
    else { this.sortKey.set(key); this.sortDir.set(key === 'date' ? -1 : 1); }
  }
  arrow(key: SortKey): string {
    if (this.sortKey() !== key) return '';
    return this.sortDir() === 1 ? 'arrow_upward' : 'arrow_downward';
  }

  // ── Detail dialog (row click) ────────────────────────────────────────────────
  readonly detail = signal<RepairRecord | null>(null);
  openDetail(r: RepairRecord): void { this.detail.set(r); }
  closeDetail(): void { this.detail.set(null); }

  // ── Add-record dialog ────────────────────────────────────────────────────────
  readonly dialogOpen = signal(false);
  readonly form = signal(this.blankForm());

  private blankForm() {
    const firstVehicle = this.accountService.vehicles()[0];
    return {
      vehicleId: firstVehicle?.id ?? '',
      category: 'oil' as RepairCategory,
      title: '',
      date: new Date().toISOString().slice(0, 10),
      mileage: '',
      cost: '',
      shop: '',
      notes: '',
    };
  }

  openDialog(): void { this.form.set(this.blankForm()); this.dialogOpen.set(true); }
  closeDialog(): void { this.dialogOpen.set(false); }

  patch<K extends keyof ReturnType<typeof this.blankForm>>(key: K, value: string): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  readonly canSave = computed(() => {
    const f = this.form();
    return !!f.vehicleId && !!f.title.trim() && !!f.date;
  });

  save(): void {
    const f = this.form();
    if (!this.canSave()) return;
    const vehicle = this.accountService.vehicles().find(v => v.id === f.vehicleId);
    const label = vehicle
      ? (vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`)
      : 'My vehicle';
    this.repairLog.add({
      vehicleId: f.vehicleId,
      vehicleLabel: label,
      category: f.category,
      title: f.title.trim(),
      date: f.date,
      mileage: f.mileage ? Number(f.mileage) : null,
      cost: f.cost ? Number(f.cost) : null,
      shop: f.shop.trim(),
      notes: f.notes.trim(),
    });
    this.dialogOpen.set(false);
  }

  remove(r: RepairRecord): void {
    this.repairLog.remove(r.id);
    if (this.detail()?.id === r.id) this.closeDetail();
  }

  // Date is split into a short primary line + a mono year sub-line so it reads
  // like the Drives tab's date column (Mon DD / sub-line).
  dateLabel(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  yearLabel(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric' });
  }
  isSeed(r: RepairRecord): boolean { return r.id.startsWith('rep-seed-'); }

  trackId = (_: number, r: RepairRecord) => r.id;
}
