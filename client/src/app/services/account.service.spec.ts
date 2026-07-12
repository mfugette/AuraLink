import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AccountService } from './account.service';
import { SavedVehicle } from '../models/account.model';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

const VEHICLE: SavedVehicle = {
  id: 'v1', accountId: 'u1', nickname: 'Bessy', year: 2011, make: 'DODGE', model: 'Nitro',
  subModel: null, engine: null, driveType: null, transmission: null, fuelType: null,
  bodyStyle: null, mileage: null, vin: null, isPrimary: true, createdAt: '2026-01-01',
};

describe('AccountService', () => {
  let service: AccountService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('fetchMe GETs /api/account/me and stores the account', () => {
    service.fetchMe().subscribe();
    const req = httpMock.expectOne(`${API}/api/account/me`);
    expect(req.request.method).toBe('GET');
    req.flush({ account: { id: 'u1', email: 'a@b.c', displayName: 'Max', createdAt: '2026-01-01' } });
    expect(service.account()?.displayName).toBe('Max');
  });

  it('fetchVehicles GETs and stores the vehicle list', () => {
    service.fetchVehicles().subscribe();
    const req = httpMock.expectOne(`${API}/api/account/vehicles`);
    expect(req.request.method).toBe('GET');
    req.flush({ vehicles: [VEHICLE] });
    expect(service.vehicles()).toEqual([VEHICLE]);
  });

  it('addVehicle POSTs the payload and refreshes the list', () => {
    const { id, accountId, createdAt, ...payload } = VEHICLE;
    service.addVehicle(payload).subscribe();

    const post = httpMock.expectOne(`${API}/api/account/vehicles`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(payload);
    post.flush({ vehicle: VEHICLE });

    // tap() refetches the list to stay in sync.
    const refresh = httpMock.expectOne(`${API}/api/account/vehicles`);
    refresh.flush({ vehicles: [VEHICLE] });
    expect(service.vehicles().length).toBe(1);
  });

  it('loadAll flags a failed account fetch instead of staying in loading forever', () => {
    service.loadAll();
    expect(service.accountLoading()).toBeTrue();

    httpMock.expectOne(`${API}/api/account/me`).flush({ error: 'boom' }, { status: 500, statusText: 'ISE' });
    httpMock.expectOne(`${API}/api/account/vehicles`).flush({ vehicles: [] });
    httpMock.expectOne(`${API}/api/account/settings`).flush({ settings: null });

    expect(service.accountLoading()).toBeFalse();
    expect(service.accountLoadError()).toBeTrue();
  });

  it('clear() resets all account state', () => {
    service.account.set({ id: 'u1', email: 'a@b.c', displayName: 'Max', createdAt: '' });
    service.vehicles.set([VEHICLE]);
    service.clear();
    expect(service.account()).toBeNull();
    expect(service.vehicles()).toEqual([]);
    expect(service.settings()).toBeNull();
  });
});
