import { Injectable, signal } from '@angular/core';
import { RepairRecord } from '../models/repair.model';

// The user's repair / service log. Seed records + any the user adds, persisted to
// localStorage for now (survives reloads without a backend). Later this moves
// behind /api/account/repairs — the RepairRecord shape stays the same. User-added
// records are kept separate from seeds so we don't duplicate seeds on every load.
@Injectable({ providedIn: 'root' })
export class RepairLogService {
  private readonly KEY = 'auralink-repairs';

  readonly records = signal<RepairRecord[]>(this.load());

  add(record: Omit<RepairRecord, 'id'>): void {
    const full: RepairRecord = { ...record, id: `rep-${Date.now()}` };
    this.records.update(list => {
      const next = [full, ...list];
      this.persistUserRecords(next);
      return next;
    });
  }

  remove(id: string): void {
    this.records.update(list => {
      const next = list.filter(r => r.id !== id);
      this.persistUserRecords(next);
      return next;
    });
  }

  private load(): RepairRecord[] {
    const user = this.loadUserRecords();
    // Merge seeds + user records, newest first.
    return [...user, ...SEED_REPAIRS].sort((a, b) => b.date.localeCompare(a.date));
  }

  private loadUserRecords(): RepairRecord[] {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? (JSON.parse(raw) as RepairRecord[]) : [];
    } catch {
      return [];
    }
  }

  // Persist only the user-added records (those not in the seed set).
  private persistUserRecords(all: RepairRecord[]): void {
    const seedIds = new Set(SEED_REPAIRS.map(r => r.id));
    const user = all.filter(r => !seedIds.has(r.id));
    try { localStorage.setItem(this.KEY, JSON.stringify(user)); } catch { /* ignore */ }
  }
}

// Seed records — vehicleIds match the seeded saved vehicles (veh-1).
const SEED_REPAIRS: RepairRecord[] = [
  {
    id: 'rep-seed-1', vehicleId: 'veh-1', vehicleLabel: '2018 Honda Civic',
    category: 'oil', title: 'Oil & filter change', date: '2026-06-02',
    mileage: 48200, cost: 62.5, shop: 'Jiffy Lube', notes: 'Full synthetic 0W-20.',
  },
  {
    id: 'rep-seed-2', vehicleId: 'veh-1', vehicleLabel: '2018 Honda Civic',
    category: 'brakes', title: 'Front brake pads', date: '2026-04-18',
    mileage: 46100, cost: 210, shop: "Mike's Auto", notes: 'Replaced front pads + resurfaced rotors.',
  },
  {
    id: 'rep-seed-3', vehicleId: 'veh-1', vehicleLabel: '2018 Honda Civic',
    category: 'tires', title: 'Tire rotation', date: '2026-03-05',
    mileage: 44000, cost: 0, shop: 'DIY', notes: 'Rotated front-to-back.',
  },
  {
    id: 'rep-seed-4', vehicleId: 'veh-1', vehicleLabel: '2018 Honda Civic',
    category: 'inspection', title: 'State safety inspection', date: '2026-01-20',
    mileage: 42500, cost: 35, shop: 'County Inspection Station', notes: 'Passed.',
  },
];
