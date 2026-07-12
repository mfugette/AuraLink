import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionHistoryComponent } from '../../components/session-history/session-history.component';
import { RepairLogComponent } from '../../components/repair-log/repair-log.component';
import { IssueHistoryPageComponent } from '../issue-history/issue-history-page.component';
import { IconComponent } from '../../components/shared/icon/icon.component';

type HistoryTab = 'drives' | 'issues' | 'repairs' | 'chats' | 'vehicle';

interface TabDef {
  key: HistoryTab;
  label: string;
  icon: string;
  soon?: boolean;   // not built yet — shows a "coming soon" panel
}

// Consolidated History hub: one page with tabs for each kind of history —
// drive sessions, diagnostic issues, repair/service records, Aura chats, and a
// VIN-based vehicle report. Drives/Issues/Repairs are live (reusing existing
// components); Chats and Vehicle report are placeholders for future work.
@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [
    CommonModule, IconComponent,
    SessionHistoryComponent, RepairLogComponent, IssueHistoryPageComponent,
  ],
  templateUrl: './history-page.component.html',
  styleUrl: './history-page.component.scss',
})
export class HistoryPageComponent {
  readonly tabs: TabDef[] = [
    { key: 'drives',  label: 'Drives',         icon: 'route' },
    { key: 'issues',  label: 'Issues',         icon: 'report_problem' },
    { key: 'repairs', label: 'Repairs',        icon: 'build' },
    { key: 'chats',   label: 'Aura chats',     icon: 'auto_awesome', soon: true },
    { key: 'vehicle', label: 'Vehicle report', icon: 'fact_check',   soon: true },
  ];

  readonly active = signal<HistoryTab>('drives');
  setTab(t: HistoryTab): void { this.active.set(t); }

  soonMessage(tab: HistoryTab): { title: string; body: string } {
    if (tab === 'chats') {
      return {
        title: 'Aura chat history is coming',
        body: 'Soon your conversations with Aura will be saved here so you can revisit past diagnoses and advice.',
      };
    }
    return {
      title: 'Vehicle report is coming',
      body: "We'll pull your vehicle's history from its VIN — recalls, specs, and records — into one report here.",
    };
  }
}
