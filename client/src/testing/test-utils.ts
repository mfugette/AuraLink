import { signal, computed } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import { AuthService } from '../app/services/auth.service';

// ── Shared test utilities ─────────────────────────────────────────────────────
// One place for the mocks/providers most specs need, so individual spec files
// stay small and consistent.

export interface MockAuthOptions {
  signedIn?: boolean;
  token?: string | null;
  email?: string;
  displayName?: string;
}

/**
 * A signal-backed stand-in for AuthService. Mirrors the public surface the app
 * actually consumes (user / isSignedIn / initializing / accessToken + the async
 * auth actions as spies), without touching the real Supabase client.
 */
export function createMockAuth(opts: MockAuthOptions = {}) {
  const { signedIn = true, token = signedIn ? 'test-jwt' : null, email = 'test@auralink.vin', displayName = 'Test User' } = opts;

  const session = signal<Session | null>(
    signedIn
      ? ({ access_token: token, user: { id: 'u1', email, user_metadata: { display_name: displayName } } as unknown as User } as Session)
      : null,
  );

  return {
    _session: session,
    user: computed<User | null>(() => session()?.user ?? null),
    isSignedIn: computed(() => session() !== null),
    initializing: signal(false),
    get accessToken(): string | null {
      return session()?.access_token ?? null;
    },
    signIn: jasmine.createSpy('signIn').and.resolveTo({ error: null }),
    signUp: jasmine.createSpy('signUp').and.resolveTo({ error: null }),
    signOut: jasmine.createSpy('signOut').and.resolveTo(undefined),
    sendPasswordReset: jasmine.createSpy('sendPasswordReset').and.resolveTo({ error: null }),
    updatePassword: jasmine.createSpy('updatePassword').and.resolveTo({ error: null }),
    resendConfirmation: jasmine.createSpy('resendConfirmation').and.resolveTo({ error: null }),
    verifyPassword: jasmine.createSpy('verifyPassword').and.resolveTo(true),
  };
}

export type MockAuth = ReturnType<typeof createMockAuth>;

/** Provider shorthand: `providers: [provideMockAuth()]`. */
export function provideMockAuth(opts: MockAuthOptions = {}) {
  return { provide: AuthService, useValue: createMockAuth(opts) };
}

/** Remove every AuraLink localStorage key so state doesn't leak across specs. */
export function clearAppStorage(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith('auralink-') || k.startsWith('obd-'))) keys.push(k);
  }
  keys.forEach(k => localStorage.removeItem(k));
}
