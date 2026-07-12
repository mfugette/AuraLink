import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { supabase } from './supabase-client';

// AuthService wraps the module-level Supabase client. We spy on the client's
// auth methods (no network involved) to verify the service's contract.
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('starts signed out with a null token', () => {
    expect(service.isSignedIn()).toBeFalse();
    expect(service.user()).toBeNull();
    expect(service.accessToken).toBeNull();
  });

  it('signIn returns null error on success and the message on failure', async () => {
    const spy = spyOn(supabase.auth, 'signInWithPassword')
      .and.resolveTo({ data: {}, error: null } as never);
    expect(await service.signIn('a@b.c', 'pw')).toEqual({ error: null });

    spy.and.resolveTo({ data: {}, error: { message: 'Invalid login credentials' } } as never);
    expect(await service.signIn('a@b.c', 'wrong')).toEqual({ error: 'Invalid login credentials' });
  });

  it('signUp forwards the display name as user metadata', async () => {
    const spy = spyOn(supabase.auth, 'signUp').and.resolveTo({ data: {}, error: null } as never);
    await service.signUp('a@b.c', 'pw', 'Max');
    expect(spy).toHaveBeenCalledWith(jasmine.objectContaining({
      email: 'a@b.c',
      options: { data: { display_name: 'Max' } },
    }));
  });

  it('sendPasswordReset targets the local /reset-password route', async () => {
    const spy = spyOn(supabase.auth, 'resetPasswordForEmail').and.resolveTo({ data: {}, error: null } as never);
    await service.sendPasswordReset('a@b.c');
    expect(spy).toHaveBeenCalledWith('a@b.c', {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  });

  it('verifyPassword returns false without an email or password', async () => {
    expect(await service.verifyPassword('pw')).toBeFalse(); // signed out → no email
    expect(await service.verifyPassword('')).toBeFalse();
  });

  it('signOut delegates to supabase', async () => {
    const spy = spyOn(supabase.auth, 'signOut').and.resolveTo({ error: null } as never);
    await service.signOut();
    expect(spy).toHaveBeenCalled();
  });
});
