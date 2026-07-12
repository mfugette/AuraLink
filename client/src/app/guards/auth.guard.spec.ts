import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { createMockAuth } from '../../testing/test-utils';

describe('authGuard', () => {
  function run(mock: ReturnType<typeof createMockAuth>) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: mock }],
    });
    return TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    ) as Promise<boolean | UrlTree>;
  }

  it('allows a signed-in user through', async () => {
    expect(await run(createMockAuth({ signedIn: true }))).toBeTrue();
  });

  it('redirects a signed-out visitor to /home', async () => {
    const result = await run(createMockAuth({ signedIn: false }));
    expect(result instanceof UrlTree).toBeTrue();
    expect(result.toString()).toBe('/home');
  });

  it('waits for the initial session lookup before deciding', async () => {
    const mock = createMockAuth({ signedIn: true });
    mock.initializing.set(true);
    const pending = run(mock);

    // Resolve initialization shortly after — the guard should then allow.
    setTimeout(() => mock.initializing.set(false), 50);
    expect(await pending).toBeTrue();
  });
});
