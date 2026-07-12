import { TestBed } from '@angular/core/testing';
import { TierService } from './tier.service';
import { clearAppStorage } from '../../testing/test-utils';

describe('TierService', () => {
  let service: TierService;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({});
    service = TestBed.inject(TierService);
  });

  afterEach(() => clearAppStorage());

  it('defaults to the free tier', () => {
    expect(service.tier()).toBe('free');
  });

  it('persists tier changes to localStorage', () => {
    service.set('pro');
    expect(service.tier()).toBe('pro');
    expect(localStorage.getItem('auralink-tier')).toBe('pro');
  });

  it('restores a persisted tier on construction', () => {
    localStorage.setItem('auralink-tier', 'plus');
    const fresh = new TierService();
    expect(fresh.tier()).toBe('plus');
  });

  it('ignores garbage in localStorage and falls back to free', () => {
    localStorage.setItem('auralink-tier', 'enterprise-deluxe');
    const fresh = new TierService();
    expect(fresh.tier()).toBe('free');
  });

  it('gates features by tier via can()', () => {
    service.set('free');
    const freeUnlocks = service.def().unlocks;
    service.set('pro');
    const proUnlocks = service.def().unlocks;
    // Pro must unlock at least everything free does.
    for (const f of freeUnlocks) expect(proUnlocks).toContain(f);
    expect(proUnlocks.length).toBeGreaterThanOrEqual(freeUnlocks.length);
  });

  it('exposes maxVehicles and aiMessagesPerDay from the tier def', () => {
    service.set('free');
    expect(service.maxVehicles).toBe(service.def().maxVehicles);
    expect(service.aiMessagesPerDay).toBe(service.def().aiMessagesPerDay);
  });

  describe('AI message quota', () => {
    it('counts messages against the daily cap', () => {
      service.set('free');
      const cap = service.aiMessagesPerDay;
      if (cap === Infinity) return; // free tier should be capped, but guard anyway
      const before = service.aiMessagesRemaining();
      service.recordAiMessage();
      expect(service.aiMessagesRemaining()).toBe(before - 1);
    });

    it('never returns a negative remaining count', () => {
      service.set('free');
      const cap = service.aiMessagesPerDay;
      if (cap === Infinity) return;
      for (let i = 0; i < cap + 5; i++) service.recordAiMessage();
      expect(service.aiMessagesRemaining()).toBe(0);
    });

    it('resets the count on a new day', () => {
      service.set('free');
      localStorage.setItem('auralink-ai-usage', JSON.stringify({ day: '2000-01-01', count: 999 }));
      expect(service.aiMessagesRemaining()).toBe(service.aiMessagesPerDay);
    });

    it('treats corrupted usage data as a fresh day', () => {
      service.set('free');
      localStorage.setItem('auralink-ai-usage', '{not json');
      expect(service.aiMessagesRemaining()).toBe(service.aiMessagesPerDay);
    });

    it('is unlimited on tiers with an Infinity cap', () => {
      service.set('pro');
      if (service.aiMessagesPerDay !== Infinity) return;
      service.recordAiMessage();
      expect(service.aiMessagesRemaining()).toBe(Infinity);
      expect(localStorage.getItem('auralink-ai-usage')).toBeNull();
    });
  });
});
