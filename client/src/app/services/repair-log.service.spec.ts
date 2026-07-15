import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RepairLogService } from './repair-log.service';
import { RepairRecord } from '../models/repair.model';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

const REPAIRS: RepairRecord[] = [
  { id: 'r1', vehicleId: 'v1', vehicleLabel: '2018 Civic', category: 'oil', title: 'Oil change', date: '2026-06-02', mileage: 48200, cost: 62.5, shop: 'Jiffy Lube', notes: '' },
  { id: 'r2', vehicleId: 'v1', vehicleLabel: '2018 Civic', category: 'brakes', title: 'Brake pads', date: '2026-04-18', mileage: 46100, cost: 210, shop: "Mike's", notes: '' },
];

describe('RepairLogService', () => {
  let service: RepairLogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RepairLogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('starts empty before load()', () => {
    expect(service.records()).toEqual([]);
  });

  it('load() GETs /api/account/repairs and stores them', () => {
    service.load();
    const req = httpMock.expectOne(`${API}/api/account/repairs`);
    expect(req.request.method).toBe('GET');
    req.flush({ repairs: REPAIRS });
    expect(service.records().length).toBe(2);
  });

  it('add() POSTs the record and prepends the server response', () => {
    service.load();
    httpMock.expectOne(`${API}/api/account/repairs`).flush({ repairs: REPAIRS });

    const payload = {
      vehicleId: 'v1', vehicleLabel: 'Test Car', category: 'other' as const,
      title: 'Test fix', date: '2099-01-01', mileage: 1, cost: 10, shop: 'DIY', notes: '',
    };
    service.add(payload);

    const post = httpMock.expectOne(`${API}/api/account/repairs`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(payload);
    post.flush({ repair: { id: 'r-new', ...payload } });

    expect(service.records()[0].id).toBe('r-new');
    expect(service.records().length).toBe(3);
  });

  it('remove() optimistically drops the row and DELETEs', () => {
    service.load();
    httpMock.expectOne(`${API}/api/account/repairs`).flush({ repairs: REPAIRS });

    service.remove('r1');
    expect(service.records().find(r => r.id === 'r1')).toBeUndefined(); // optimistic

    const del = httpMock.expectOne(`${API}/api/account/repairs/r1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    expect(service.records().length).toBe(1);
  });

  it('remove() restores the row if the DELETE fails', () => {
    service.load();
    httpMock.expectOne(`${API}/api/account/repairs`).flush({ repairs: REPAIRS });

    service.remove('r1');
    const del = httpMock.expectOne(`${API}/api/account/repairs/r1`);
    del.flush({ error: 'nope' }, { status: 500, statusText: 'Server Error' });
    expect(service.records().find(r => r.id === 'r1')).toBeDefined(); // rolled back
  });

  it('clear() empties the list', () => {
    service.load();
    httpMock.expectOne(`${API}/api/account/repairs`).flush({ repairs: REPAIRS });
    service.clear();
    expect(service.records()).toEqual([]);
  });
});
