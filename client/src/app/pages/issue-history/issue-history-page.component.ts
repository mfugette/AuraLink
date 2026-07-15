import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountService } from '../../services/account.service';
import { CustomSelectComponent, SelectOption } from '../../components/shared/custom-select/custom-select.component';
import { ISSUE_HISTORY, IssueRecord } from '../../data/issue-history';
import { MatIconModule } from '@angular/material/icon';

type SortKey = 'date' | 'severity' | 'status';

// Complete history of diagnostic issues logged against the user's vehicles, as a
// sortable table (matching the Drives tab) with a row-click detail dialog and a
// mobile card fallback. Uses local seed data (data/issue-history.ts). When
// `embedded` is set (History hub's Issues tab) the outer page header is dropped.
@Component({
  selector: 'app-issue-history-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, CustomSelectComponent],
  templateUrl: './issue-history-page.component.html',
  styleUrl: './issue-history-page.component.scss',
})
export class IssueHistoryPageComponent implements OnInit {
  @Input() embedded = false;

  protected readonly accountService = inject(AccountService);

  private readonly allIssues = signal<IssueRecord[]>(ISSUE_HISTORY);

  // ── Filter + sort state ──────────────────────────────────────────────────────
  readonly query = signal('');
  readonly vehicleFilter = signal<string | null>(null);
  readonly sortKey = signal<SortKey>('date');
  readonly sortDir = signal<1 | -1>(-1);

  private readonly severityRank: Record<string, number> = { low: 0, moderate: 1, high: 2, critical: 3 };
  private readonly statusRank: Record<string, number> = { resolved: 0, 'in-progress': 1, open: 2 };

  ngOnInit(): void {
    this.accountService.fetchVehicles().subscribe();
  }

  readonly vehicleOptions = computed<SelectOption[]>(() => [
    { value: null, label: 'All vehicles' },
    ...this.accountService.vehicles().map(v => ({
      value: v.id, label: v.nickname || `${v.year} ${v.make} ${v.model}`,
    })),
  ]);

  readonly filtered = computed<IssueRecord[]>(() => {
    const vid = this.vehicleFilter();
    const q = this.query().trim().toLowerCase();
    const key = this.sortKey();
    const dir = this.sortDir();

    const rows = this.allIssues().filter(i => {
      if (vid && i.vehicleId !== vid) return false;
      if (q) {
        const hay = `${i.code} ${i.title} ${i.vehicleLabel} ${i.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...rows].sort((a, b) => (this.sortVal(a, key) - this.sortVal(b, key)) * dir);
  });

  readonly resolvedCount = computed(() => this.filtered().filter(i => i.status === 'resolved').length);
  readonly openCount = computed(() => this.filtered().filter(i => i.status !== 'resolved').length);

  private sortVal(i: IssueRecord, key: SortKey): number {
    switch (key) {
      case 'date': return new Date(i.date).getTime();
      case 'severity': return this.severityRank[i.severity] ?? 0;
      case 'status': return this.statusRank[i.status] ?? 0;
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

  // ── Detail dialog ─────────────────────────────────────────────────────────────
  readonly detail = signal<IssueRecord | null>(null);
  openDetail(i: IssueRecord): void { this.detail.set(i); }
  closeDetail(): void { this.detail.set(null); }

  // ── Display helpers ──────────────────────────────────────────────────────────
  statusLabel(s: string): string {
    return s === 'in-progress' ? 'In Progress' : s === 'open' ? 'Open' : 'Resolved';
  }
  // Chip class: resolved=ok, open=warn, in-progress=progress.
  statusChip(s: string): string {
    return s === 'resolved' ? 'ok' : s === 'open' ? 'warn' : 'progress';
  }
  // Severity is warn-flavored for high/critical.
  severeWarn(i: IssueRecord): boolean { return i.severity === 'high' || i.severity === 'critical'; }
  // Date is split into a short primary line + a mono year sub-line so it reads
  // like the Drives tab's date column (Mon DD / sub-line).
  dateLabel(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  yearLabel(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric' });
  }

  trackId = (_: number, i: IssueRecord) => i.id;
}
