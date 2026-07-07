import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { supabase } from '../../services/supabase-client';

// Landing page for email links (signup confirmation, magic links). Supabase's
// client parses the token from the URL and establishes a session; we wait for it
// and route into the app. If no session appears, the link was invalid/expired.
@Component({
  selector: 'app-auth-callback-page',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './auth-callback-page.component.html',
  styleUrl: './auth-callback-page.component.scss',
})
export class AuthCallbackPageComponent {
  private readonly router = inject(Router);

  readonly state = signal<'working' | 'ok' | 'error'>('working');

  constructor() {
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) this.succeed();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        this.succeed();
      } else {
        // Allow the URL-hash parse to complete before declaring failure.
        setTimeout(() => {
          if (this.state() === 'working') this.state.set('error');
        }, 2000);
      }
    });
  }

  private succeed(): void {
    if (this.state() === 'ok') return;
    this.state.set('ok');
    setTimeout(() => this.router.navigateByUrl('/home'), 1400);
  }
}
