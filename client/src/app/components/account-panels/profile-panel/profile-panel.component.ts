import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';import { AccountService } from '../../../services/account.service';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-profile-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './profile-panel.component.html',
  styleUrl: './profile-panel.component.scss',
})
export class ProfilePanelComponent {
  @Output() closed = new EventEmitter<void>();

  displayName = '';
  email = '';
  saving = signal(false);
  saved = signal(false);

  constructor(protected accountService: AccountService) {
    const account = this.accountService.account();
    this.displayName = account?.displayName ?? '';
    this.email = account?.email ?? '';
  }

  save(): void {
    this.saving.set(true);
    this.saved.set(false);
    this.accountService.updateProfile({ displayName: this.displayName, email: this.email }).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
      },
      error: () => this.saving.set(false),
    });
  }

  close(): void {
    this.closed.emit();
  }
}
