import { TestBed } from '@angular/core/testing';
import { DtcService } from './dtc.service';

describe('DtcService', () => {
  let service: DtcService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DtcService);
  });

  it('looks up a known code case-insensitively', () => {
    const upper = service.lookup('P0420');
    const lower = service.lookup('p0420');
    expect(upper).toBeDefined();
    expect(lower).toEqual(upper);
    expect(upper!.code).toBe('P0420');
  });

  it('returns undefined for an unknown code', () => {
    expect(service.lookup('P9999X')).toBeUndefined();
  });

  it('search returns prefix matches capped at 10', () => {
    const results = service.search('P0');
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(10);
    for (const r of results) expect(r.code.startsWith('P0')).toBeTrue();
  });

  it('search is case-insensitive and trims whitespace', () => {
    expect(service.search(' p04 ')).toEqual(service.search('P04'));
  });

  it('search returns [] for an empty query', () => {
    expect(service.search('')).toEqual([]);
    expect(service.search('   ')).toEqual([]);
  });

  it('lookupMany drops unknown codes and preserves order', () => {
    const results = service.lookupMany(['P0420', 'NOPE99', 'P0171']);
    expect(results.map(r => r.code)).toEqual(['P0420', 'P0171']);
  });
});
