import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HttpContext } from '@angular/common/http';
import { Observable, firstValueFrom, map, tap } from 'rxjs';
import { Account, AccountSettings, NewSavedVehicle, SavedVehicle } from '../models/account.model';
import { environment } from '../../environments/environment';
import { SKIP_ERROR_TOAST } from '../interceptors/error.interceptor';

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

  // Tracks whether the initial fetchMe() is in flight vs. has failed, so the
  // UI can tell "still loading" apart from "the request died" instead of
  // showing a permanent fake "Loading…" when the network/API call fails
  // silently (subscribe() with no error handler used to just swallow it).
  readonly accountLoading = signal(false);
  readonly accountLoadError = signal(false);

  constructor(private http: HttpClient) {}

  loadAll(): void {
    this.accountLoading.set(true);
    this.accountLoadError.set(false);
    this.fetchMe().subscribe({
      next: () => this.accountLoading.set(false),
      error: () => {
        this.accountLoading.set(false);
        this.accountLoadError.set(true);
      },
    });
    this.fetchVehicles().subscribe({ error: () => {} });
    this.fetchSettings().subscribe({ error: () => {} });
  }

  // Reset all account state — called on sign-out.
  clear(): void {
    this.account.set(null);
    this.vehicles.set([]);
    this.settings.set(null);
    this.accountLoading.set(false);
    this.accountLoadError.set(false);
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

  // ── Data export / account deletion (GDPR/CCPA) ───────────────────────────────
  /** Download the user's full data export as a JSON file. Resolves when saved. */
  async exportData(): Promise<void> {
    const blob = await firstValueFrom(
      this.http.get(`${this.base}/api/account/export`, { responseType: 'blob' })
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'auralink-data-export.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * Permanently delete the account. The server re-verifies the password before
   * deleting, so we pass it through. On success the caller should sign out.
   */
  deleteAccount(password: string): Observable<void> {
    // Skip the global error toast — the delete dialog shows errors inline
    // (e.g. "Incorrect password").
    return this.http.request<void>('delete', `${this.base}/api/account`, {
      body: { password },
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }
}
