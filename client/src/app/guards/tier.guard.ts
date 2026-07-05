import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TierService } from '../services/tier.service';
import { Feature } from '../models/tier.model';

// Gate a route behind a tier feature. If the current tier doesn't unlock it,
// redirect to the Plan page with `?locked=<feature>` so it can show a
// contextual "upgrade to unlock X" prompt. Runs after authGuard (these routes
// are signed-in only), so we can assume an authenticated user here.
//
// Like authGuard, this is UX/navigation enforcement, not a security boundary —
// tier-restricted data/actions must also be enforced server-side once billing
// and the real subscription record exist.
export function requireTier(feature: Feature): CanActivateFn {
  return () => {
    const tier = inject(TierService);
    const router = inject(Router);
    if (tier.can(feature)) return true;
    return router.createUrlTree(['/plan'], { queryParams: { locked: feature } });
  };
}
