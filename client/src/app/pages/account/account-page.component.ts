import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AccountService } from '../../services/account.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

// Account settings page: profile (display name + email), a link into plan/billing,
// and a Danger Zone with data export (GDPR right of access) and account deletion
// (right to erasure). Deletion reuses the app's password-confirm dialog pattern
// and is re-verified server-side. Signed-in only (authGuard on the route).
@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule],
  templateUrl: './account-page.component.html',
  styleUrl: './account-page.component.scss',
})
export class AccountPageComponent {
  private readonly accountService = inject(AccountService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly account = this.accountService.account;

  // Editable display name.
  readonly displayName = signal('');
  readonly savingName = signal(false);
  readonly nameSaved = signal(false);
  readonly nameError = signal<string | null>(null);

  // Export state.
  readonly exporting = signal(false);

  // Delete dialog state (mirrors the cancel-plan dialog).
  readonly deleteDialogOpen = signal(false);
  readonly deletePassword = signal('');
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  readonly initial = computed(() => {
    const n = this.account()?.displayName?.trim() || this.account()?.email || '?';
    return n.charAt(0).toUpperCase();
  });

  constructor() {
    // Seed the editable field when the account loads (loadAll populates it after
    // sign-in, which may be after this component is constructed). Only seed while
    // the user hasn't started editing, so we don't clobber in-progress input.
    effect(() => {
      const name = this.account()?.displayName ?? '';
      if (!this.savingName() && this.displayName() === '') {
        this.displayName.set(name);
      }
    });
  }

  saveName(): void {
    const name = this.displayName().trim();
    if (!name || this.savingName()) return;
    if (name === this.account()?.displayName) return;

    this.savingName.set(true);
    this.nameError.set(null);
    this.nameSaved.set(false);
    this.accountService.updateProfile({ displayName: name }).subscribe({
      next: () => {
        this.savingName.set(false);
        this.nameSaved.set(true);
        setTimeout(() => this.nameSaved.set(false), 2500);
      },
      error: () => {
        this.savingName.set(false);
        this.nameError.set("Couldn't save your name. Please try again.");
      },
    });
  }

  async exportData(): Promise<void> {
    if (this.exporting()) return;
    this.exporting.set(true);
    try {
      await this.accountService.exportData();
      this.toast.success('Your data export has downloaded.');
    } catch {
      // The global error interceptor already surfaces a toast for the failed
      // request; nothing more to do here.
    } finally {
      this.exporting.set(false);
    }
  }

  // ── Delete flow ────────────────────────────────────────────────────────────
  openDeleteDialog(): void {
    this.deletePassword.set('');
    this.deleteError.set(null);
    this.deleting.set(false);
    this.deleteDialogOpen.set(true);
  }

  closeDeleteDialog(): void {
    if (this.deleting()) return;
    this.deleteDialogOpen.set(false);
  }

  confirmDelete(): void {
    if (this.deleting()) return;
    const password = this.deletePassword();
    if (!password) {
      this.deleteError.set('Enter your password to confirm.');
      return;
    }
    this.deleting.set(true);
    this.deleteError.set(null);

    this.accountService.deleteAccount(password).subscribe({
      next: async () => {
        // Account is gone — clear state, sign out, and land on Home.
        this.accountService.clear();
        await this.auth.signOut();
        this.deleting.set(false);
        this.deleteDialogOpen.set(false);
        this.router.navigateByUrl('/home');
      },
      error: (err) => {
        this.deleting.set(false);
        const status = err?.status;
        this.deleteError.set(
          status === 403 ? 'Incorrect password. Please try again.'
          : status === 429 ? 'Too many attempts. Please wait a moment.'
          : "Couldn't delete your account. Please try again."
        );
      },
    });
  }
}
