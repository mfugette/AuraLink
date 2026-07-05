import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { Account, AccountSettings, NewSavedVehicle, SavedVehicle } from '../models/account.model';
import { environment } from '../../environments/environment';

// TODO(auth): this service assumes a single logged-in account and carries no
// token/session handling. Once real auth exists, HttpClient calls here should
// attach the session (e.g. an auth interceptor) and `account`/`isSignedIn`
// should reset to null/false on sign-out instead of always being populated.
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly base = environment.apiUrl;

  readonly account = signal<Account | null>(null);
  readonly vehicles = signal<SavedVehicle[]>([]);
  readonly settings = signal<AccountSettings | null>(null);

  constructor(private http: HttpClient) {}

  loadAll(): void {
    this.fetchMe().subscribe();
    this.fetchVehicles().subscribe();
    this.fetchSettings().subscribe();
  }

  // Reset all account state — called on sign-out.
  clear(): void {
    this.account.set(null);
    this.vehicles.set([]);
    this.settings.set(null);
  }

  fetchMe(): Observable<Account> {
    return this.http
      .get<{ account: Account }>(`${this.base}/api/account/me`)
      .pipe(
        map(r => r.account),
        tap(account => this.account.set(account))
      );
  }

  updateProfile(patch: Partial<Pick<Account, 'displayName' | 'email'>>): Observable<Account> {
    return this.http
      .patch<{ account: Account }>(`${this.base}/api/account/me`, patch)
      .pipe(
        map(r => r.account),
        tap(account => this.account.set(account))
      );
  }

  fetchVehicles(): Observable<SavedVehicle[]> {
    return this.http
      .get<{ vehicles: SavedVehicle[] }>(`${this.base}/api/account/vehicles`)
      .pipe(
        map(r => r.vehicles),
        tap(vehicles => this.vehicles.set(vehicles))
      );
  }

  addVehicle(vehicle: NewSavedVehicle): Observable<SavedVehicle> {
    return this.http
      .post<{ vehicle: SavedVehicle }>(`${this.base}/api/account/vehicles`, vehicle)
      .pipe(
        map(r => r.vehicle),
        tap(() => this.fetchVehicles().subscribe())
      );
  }

  updateVehicle(id: string, patch: Partial<SavedVehicle>): Observable<SavedVehicle> {
    return this.http
      .patch<{ vehicle: SavedVehicle }>(`${this.base}/api/account/vehicles/${id}`, patch)
      .pipe(
        map(r => r.vehicle),
        tap(() => this.fetchVehicles().subscribe())
      );
  }

  removeVehicle(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.base}/api/account/vehicles/${id}`)
      .pipe(tap(() => this.vehicles.update(list => list.filter(v => v.id !== id))));
  }

  fetchSettings(): Observable<AccountSettings> {
    return this.http
      .get<{ settings: AccountSettings }>(`${this.base}/api/account/settings`)
      .pipe(
        map(r => r.settings),
        tap(settings => this.settings.set(settings))
      );
  }

  updateSettings(patch: Partial<Omit<AccountSettings, 'accountId'>>): Observable<AccountSettings> {
    return this.http
      .patch<{ settings: AccountSettings }>(`${this.base}/api/account/settings`, patch)
      .pipe(
        map(r => r.settings),
        tap(settings => this.settings.set(settings))
      );
  }
}
