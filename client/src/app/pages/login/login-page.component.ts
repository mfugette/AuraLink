import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';

// Email/password sign-in and sign-up. Supabase Auth handles the credentials;
// on success we route to the page the user was headed for (?redirect=) or Home.
@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Defaults to sign-in, but /login?mode=signup (e.g. the Home page's guest
  // CTA) opens straight into account creation instead of making the user
  // toggle manually.
  mode = signal<'signin' | 'signup'>(
    this.route.snapshot.queryParamMap.get('mode') === 'signup' ? 'signup' : 'signin',
  );
  email = signal('');
  password = signal('');
  displayName = signal('');

  loading = signal(false);
  error = signal<string | null>(null);
  notice = signal<string | null>(null);

  toggleMode(): void {
    this.mode.update(m => (m === 'signin' ? 'signup' : 'signin'));
    this.error.set(null);
    this.notice.set(null);
  }

  async submit(): Promise<void> {
    const email = this.email().trim();
    const password = this.password();
    if (!email || !password) {
      this.error.set('Email and password are required.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.notice.set(null);

    try {
      if (this.mode() === 'signin') {
        const { error } = await this.auth.signIn(email, password);
        if (error) { this.error.set(error); return; }
        this.finish();
      } else {
        const { error } = await this.auth.signUp(email, password, this.displayName().trim());
        if (error) { this.error.set(error); return; }
        // If email confirmation is on, there's no session yet — tell the user.
        if (this.auth.isSignedIn()) {
          this.finish();
        } else {
          this.notice.set('Account created. Check your email to confirm, then sign in.');
          this.mode.set('signin');
        }
      }
    } finally {
      this.loading.set(false);
    }
  }

  private finish(): void {
    const redirect = this.route.snapshot.queryParamMap.get('redirect') ?? '/home';
    this.router.navigateByUrl(redirect);
  }
}
