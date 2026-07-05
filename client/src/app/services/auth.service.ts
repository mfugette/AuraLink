import { Injectable, computed, signal } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase-client';

// Wraps Supabase Auth in Angular signals. Holds the current session/user,
// exposes sign in/up/out, and keeps the access token available for the HTTP
// interceptor to attach to API calls.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _session = signal<Session | null>(null);

  readonly user = computed<User | null>(() => this._session()?.user ?? null);
  readonly isSignedIn = computed(() => this._session() !== null);
  // True until the initial session lookup resolves — lets guards/UI avoid
  // flashing the signed-out state on first load.
  readonly initializing = signal(true);

  constructor() {
    // Supabase's client fires onAuthStateChange with an INITIAL_SESSION event
    // as soon as you subscribe, in addition to getSession() resolving — both
    // report the same session, but as two separate object references. Signals
    // notify on reference change, so without dedup this sets _session twice on
    // every page load, double-firing every effect that reads isSignedIn (e.g.
    // AccountMenuComponent's loadAll(), which then double-fetches account
    // data). Track the initial event explicitly and skip its duplicate.
    let sawInitialEvent = false;

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        sawInitialEvent = true;
      }
      this._session.set(session);
      this.initializing.set(false);
    });

    // Fallback in case onAuthStateChange's INITIAL_SESSION is ever skipped
    // (older SDK behavior) — only applies if we truly haven't heard anything.
    supabase.auth.getSession().then(({ data }) => {
      if (!sawInitialEvent) {
        this._session.set(data.session);
        this.initializing.set(false);
      }
    });
  }

  /** Current access token (JWT) for API requests, or null if signed out. */
  get accessToken(): string | null {
    return this._session()?.access_token ?? null;
  }

  async signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async signUp(email: string, password: string, displayName: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    return { error: error?.message ?? null };
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  /**
   * Re-verify the current user's password (for sensitive actions like canceling
   * a plan). Validates by re-authenticating with the signed-in email; on success
   * Supabase refreshes the existing session (same user), so this is safe to call
   * mid-session. Returns true if the password is correct.
   */
  async verifyPassword(password: string): Promise<boolean> {
    const email = this.user()?.email;
    if (!email || !password) return false;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return !error;
  }
}
