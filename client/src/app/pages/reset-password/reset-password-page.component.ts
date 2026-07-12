import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { supabase } from '../../services/supabase-client';
import { IconComponent } from '../../components/shared/icon/icon.component';

// Landing page for the password-reset email link. Supabase's client (with
// detectSessionInUrl) parses the recovery token from the URL and fires a
// PASSWORD_RECOVERY auth event, which puts the user in a temporary session that
// can set a new password. We show a new-password form and call updateUser.
@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './reset-password-page.component.html',
  styleUrl: './reset-password-page.component.scss',
})
export class ResetPasswordPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly password = signal('');
  readonly confirm = signal('');
  readonly loading = signal(false);
  readonly done = signal(false);
  readonly error = signal<string | null>(null);
  // True once we've confirmed a recovery session exists (link was valid).
  readonly ready = signal(false);
  readonly linkInvalid = signal(false);

  private readonly MIN_LEN = 8;

  constructor() {
    // The recovery link establishes a session asynchronously. Listen for the
    // PASSWORD_RECOVERY event (or an already-present session) to enable the form;
    // if neither appears, the link was missing/expired.
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        this.ready.set(true);
        this.linkInvalid.set(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        this.ready.set(true);
      } else {
        // Give the URL-hash parse a beat; if still no session, the link is bad.
        setTimeout(() => {
          if (!this.ready()) this.linkInvalid.set(true);
        }, 1200);
      }
    });
  }

  async submit(): Promise<void> {
    if (this.loading()) return;
    const pw = this.password();
    if (pw.length < this.MIN_LEN) {
      this.error.set(`Password must be at least ${this.MIN_LEN} characters.`);
      return;
    }
    if (pw !== this.confirm()) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { error } = await this.auth.updatePassword(pw);
    this.loading.set(false);

    if (error) {
      this.error.set(error);
      return;
    }
    this.done.set(true);
    // Signed in via the recovery session — send them into the app shortly.
    setTimeout(() => this.router.navigateByUrl('/home'), 1800);
  }
}
