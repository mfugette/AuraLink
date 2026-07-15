import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { RepairRecord } from '../models/repair.model';
import { environment } from '../../environments/environment';

// The user's repair / service log, backed by the Express API (was seed data +
// localStorage). Same `records` signal + add/remove methods as before so
// RepairLogComponent doesn't change; the methods now persist via
// /api/account/repairs and update the signal optimistically. load() on sign-in,
// clear() on sign-out (mirrors AccountService).
@Injectable({ providedIn: 'root' })
export class RepairLogService {
  private readonly base = environment.apiUrl;
  private readonly http = inject(HttpClient);

  readonly records = signal<RepairRecord[]>([]);

  // Fetch the log. Called on sign-in. Errors leave the list empty rather than
  // throwing into the UI.
  load(): void {
    this.http
      .get<{ repairs: RepairRecord[] }>(`${this.base}/api/account/repairs`)
      .pipe(map(r => r.repairs))
      .subscribe({ next: rs => this.records.set(rs), error: () => {} });
  }

  clear(): void {
    this.records.set([]);
  }

  add(record: Omit<RepairRecord, 'id'>): void {
    this.http
      .post<{ repair: RepairRecord }>(`${this.base}/api/account/repairs`, record)
      .pipe(map(r => r.repair))
      .subscribe({
        // Prepend the server-created record (has the real id + normalized fields).
        next: rep => this.records.update(list => [rep, ...list]),
        error: () => {},
      });
  }

  remove(id: string): void {
    // Optimistic removal; reload to resync if the delete fails.
    const prev = this.records();
    this.records.update(list => list.filter(r => r.id !== id));
    this.http
      .delete<void>(`${this.base}/api/account/repairs/${id}`)
      .subscribe({ error: () => this.records.set(prev) });
  }
}
