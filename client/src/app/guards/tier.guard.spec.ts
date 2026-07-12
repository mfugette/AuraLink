import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import { requireTier } from './tier.guard';
import { TierService } from '../services/tier.service';
import { clearAppStorage } from '../../testing/test-utils';

describe('requireTier', () => {
  let tier: TierService;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    tier = TestBed.inject(TierService);
  });

  afterEach(() => clearAppStorage());

  function run(feature: Parameters<typeof requireTier>[0]) {
    return TestBed.runInInjectionContext(() =>
      requireTier(feature)({} as never, {} as never),
    ) as boolean | UrlTree;
  }

  it('allows a feature the tier unlocks', () => {
    tier.set('pro');
    const anyProFeature = tier.def().unlocks[0];
    expect(run(anyProFeature)).toBeTrue();
  });

  it('redirects to /plan?locked=<feature> when the tier lacks it', () => {
    tier.set('free');
    const locked = ['dashboard', 'nearby'].find(f => !tier.can(f as never));
    if (!locked) {
      pending('free tier unexpectedly unlocks everything');
      return;
    }
    const result = run(locked as never);
    expect(result instanceof UrlTree).toBeTrue();
    expect(result.toString()).toBe(`/plan?locked=${locked}`);
  });
});
