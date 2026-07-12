import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccountService } from '../../../services/account.service';
import { ThemeService, Theme } from '../../../services/theme.service';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './settings-panel.component.html',
  styleUrl: './settings-panel.component.scss',
})
export class SettingsPanelComponent {
  @Output() closed = new EventEmitter<void>();

  saved = signal(false);
  protected readonly theme = inject(ThemeService);

  constructor(protected accountService: AccountService) {}

  setTheme(theme: Theme): void {
    // ThemeService applies instantly and persists to the account when signed in.
    this.theme.set(theme);
  }

  toggleNotifyEmail(): void {
    const current = this.accountService.settings();
    if (!current) return;
    this.persist({ notifyEmail: !current.notifyEmail });
  }

  toggleNotifySms(): void {
    const current = this.accountService.settings();
    if (!current) return;
    this.persist({ notifySms: !current.notifySms });
  }

  setUnits(units: 'imperial' | 'metric'): void {
    this.persist({ preferredUnits: units });
  }

  private persist(patch: Parameters<AccountService['updateSettings']>[0]): void {
    this.accountService.updateSettings(patch).subscribe(() => {
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 1600);
    });
  }

  close(): void {
    this.closed.emit();
  }
}
