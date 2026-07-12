import { TestBed } from '@angular/core/testing';
import { RepairLogService } from './repair-log.service';
import { clearAppStorage } from '../../testing/test-utils';

describe('RepairLogService', () => {
  let service: RepairLogService;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({});
    service = TestBed.inject(RepairLogService);
  });

  afterEach(() => clearAppStorage());

  it('seeds records sorted newest first', () => {
    const dates = service.records().map(r => r.date);
    expect(dates.length).toBeGreaterThan(0);
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
  });

  it('add() prepends a record and persists only user records', () => {
    const before = service.records().length;
    service.add({
      date: '2099-01-01', title: 'Test fix', category: 'other',
      vehicleId: 'v1', vehicleLabel: 'Test Car', mileage: 1, cost: 10, shop: 'DIY', notes: '',
    } as never);
    expect(service.records().length).toBe(before + 1);
    expect(service.records()[0].title).toBe('Test fix');

    const persisted = JSON.parse(localStorage.getItem('auralink-repairs')!);
    expect(persisted.length).toBe(1); // seeds are not duplicated into storage
    expect(persisted[0].title).toBe('Test fix');
  });

  it('remove() deletes by id and updates persistence', () => {
    service.add({
      date: '2099-01-01', title: 'Ephemeral', category: 'other',
      vehicleId: 'v1', vehicleLabel: 'Test Car', mileage: null, cost: null, shop: '', notes: '',
    } as never);
    const added = service.records()[0];
    service.remove(added.id);
    expect(service.records().find(r => r.id === added.id)).toBeUndefined();
    expect(JSON.parse(localStorage.getItem('auralink-repairs')!)).toEqual([]);
  });

  it('survives corrupted localStorage by falling back to seeds', () => {
    localStorage.setItem('auralink-repairs', '{nope');
    const fresh = TestBed.runInInjectionContext(() => new RepairLogService());
    expect(fresh.records().length).toBeGreaterThan(0);
  });
});
