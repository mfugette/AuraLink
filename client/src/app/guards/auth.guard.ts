import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Protects routes that require a signed-in user. Waits for the initial session
// lookup to resolve (so a refresh on a protected page doesn't bounce away),
// then allows through or redirects unauthenticated visitors to Home.
//
// Unauthenticated users are limited to the free DTC pipeline on /home; every
// other page (Assistant, Part Lookup, Find Help, My Vehicles, Issue History)
// is signed-in only. Guarding here also stops guests from reaching those pages
// by typing the URL directly — but note this is UX/navigation enforcement,
// NOT a security boundary. Anything sensitive must be enforced server-side
// (see requireAuth on the protected API routes); the client bundle and its
// routes are fully visible to anyone.
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Wait out the one-time initialization if it's still pending.
  if (auth.initializing()) {
    await new Promise<void>(resolve => {
      const start = Date.now();
      const tick = () => {
        if (!auth.initializing() || Date.now() - start > 5000) resolve();
        else setTimeout(tick, 30);
      };
      tick();
    });
  }

  if (auth.isSignedIn()) return true;

  return router.createUrlTree(['/home']);
};
