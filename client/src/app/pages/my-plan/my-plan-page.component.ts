import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TierService } from '../../services/tier.service';
import { SubscriptionService } from '../../services/subscription.service';
import { AuthService } from '../../services/auth.service';
import { tierDef } from '../../models/tier.model';
import { IconComponent } from '../../components/shared/icon/icon.component';

// My Plan — the account's subscription hub: current plan + usage, billing
// history, hardware order status, and cancellation. Reads SubscriptionService
// (localStorage-backed for now). Signed-in only (authGuard on the route).
@Component({
  selector: 'app-my-plan-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent],
  templateUrl: './my-plan-page.component.html',
  styleUrl: './my-plan-page.component.scss',
})
export class MyPlanPageComponent {
  protected readonly tier = inject(TierService);
  protected readonly subs = inject(SubscriptionService);
  private readonly auth = inject(AuthService);

  // Exposed for template comparisons (Infinity isn't reachable in templates).
  protected readonly Infinity = Infinity;

  readonly def = computed(() => tierDef(this.tier.tier()));
  readonly sub = this.subs.subscription;
  readonly history = this.subs.history;

  // Cancel dialog state: modal open, password entry, verifying, and error.
  readonly cancelDialogOpen = signal(false);
  readonly cancelPassword = signal('');
  readonly cancelling = signal(false);
  readonly cancelError = signal<string | null>(null);

  // AI usage today (from the tier's daily quota).
  readonly aiRemaining = computed(() => this.tier.aiMessagesRemaining());
  readonly aiCap = computed(() => this.def().aiMessagesPerDay);

  openCancelDialog(): void {
    this.cancelPassword.set('');
    this.cancelError.set(null);
    this.cancelling.set(false);
    this.cancelDialogOpen.set(true);
  }

  closeCancelDialog(): void {
    if (this.cancelling()) return;
    this.cancelDialogOpen.set(false);
  }

  async confirmCancel(): Promise<void> {
    if (this.cancelling()) return;
    const password = this.cancelPassword();
    if (!password) {
      this.cancelError.set('Enter your password to confirm.');
      return;
    }
    this.cancelling.set(true);
    this.cancelError.set(null);

    // Re-authenticate before this sensitive action.
    const ok = await this.auth.verifyPassword(password);
    if (!ok) {
      this.cancelError.set('Incorrect password. Please try again.');
      this.cancelling.set(false);
      return;
    }

    this.subs.cancel();
    this.cancelling.set(false);
    this.cancelDialogOpen.set(false);
  }

  resume(): void {
    this.subs.resume();
  }
}
