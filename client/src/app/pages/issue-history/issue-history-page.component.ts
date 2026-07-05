import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AccountService } from '../../services/account.service';
import { ISSUE_HISTORY, IssueRecord } from '../../data/issue-history';

// Complete history of issues logged against the user's vehicles, filterable by
// vehicle. Uses local seed data (data/issue-history.ts) whose vehicleIds match
// the saved-vehicle seeds; the vehicle filter is populated from AccountService.
@Component({
  selector: 'app-issue-history-page',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './issue-history-page.component.html',
  styleUrl: './issue-history-page.component.scss',
})
export class IssueHistoryPageComponent implements OnInit {
  private readonly allIssues = signal<IssueRecord[]>(ISSUE_HISTORY);
  activeVehicleId = signal<string | null>(null);

  constructor(protected accountService: AccountService) {}

  ngOnInit(): void {
    this.accountService.fetchVehicles().subscribe();
  }

  readonly filtered = computed<IssueRecord[]>(() => {
    const vid = this.activeVehicleId();
    const list = vid ? this.allIssues().filter(i => i.vehicleId === vid) : this.allIssues();
    // Most recent first.
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  });

  readonly resolvedCount = computed(() => this.filtered().filter(i => i.status === 'resolved').length);
  readonly openCount = computed(() => this.filtered().filter(i => i.status !== 'resolved').length);

  setVehicle(id: string | null): void {
    this.activeVehicleId.set(id);
  }

  vehicleLabel(id: string): string {
    const v = this.accountService.vehicles().find(x => x.id === id);
    if (!v) return 'All vehicles';
    return v.nickname || `${v.year} ${v.make} ${v.model}`;
  }
}
