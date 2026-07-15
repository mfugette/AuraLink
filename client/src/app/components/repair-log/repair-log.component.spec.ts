import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RepairLogComponent } from './repair-log.component';
import { RepairLogService } from '../../services/repair-log.service';
import { AccountService } from '../../services/account.service';
import { RepairRecord } from '../../models/repair.model';
import { SavedVehicle } from '../../models/account.model';
import { environment } from '../../../environments/environment';
import { clearAppStorage } from '../../../testing/test-utils';

const API = environment.apiUrl;

const RECORDS: RepairRecord[] = [
  { id: 'r1', vehicleId: 'v1', vehicleLabel: '2018 Civic', category: 'oil', title: 'Oil change', date: '2026-06-02', mileage: 48200, cost: 62.5, shop: 'Jiffy Lube', notes: '' },
  { id: 'r2', vehicleId: 'v1', vehicleLabel: '2018 Civic', category: 'brakes', title: 'Brake pads', date: '2026-04-18', mileage: 46100, cost: 210, shop: "Mike's", notes: '' },
];

const VEHICLE = { id: 'v1', year: 2018, make: 'Honda', model: 'Civic', nickname: '', vin: '', trim: '', mileage: 48000 } as unknown as SavedVehicle;

describe('RepairLogComponent', () => {
  let fixture: ComponentFixture<RepairLogComponent>;
  let component: RepairLogComponent;
  let httpMock: HttpTestingController;
  let repairLog: RepairLogService;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({
      imports: [RepairLogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(RepairLogComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    repairLog = TestBed.inject(RepairLogService);
    // Seed the account with a vehicle so the add-record form can resolve a label.
    TestBed.inject(AccountService).vehicles.set([VEHICLE]);
  });

  afterEach(() => {
    httpMock.verify();
    clearAppStorage();
  });

  // Drive DB-backed records into the service the way sign-in does.
  function loadRecords(): void {
    repairLog.load();
    httpMock.expectOne(`${API}/api/account/repairs`).flush({ repairs: RECORDS });
  }

  it('starts empty before records are loaded', () => {
    expect(component.records().length).toBe(0);
    expect(component.totalSpent()).toBe(0);
  });

  it('lists the loaded records and totals their cost', () => {
    loadRecords();
    const records = component.records();
    expect(records.length).toBe(2);
    const expected = records.reduce((s, r) => s + (r.cost ?? 0), 0);
    expect(component.totalSpent()).toBeCloseTo(expected, 2);
  });

  it('search filters records by text', () => {
    loadRecords();
    const first = component.records()[0];
    component.query.set(first.title.toLowerCase());
    expect(component.records().some(r => r.id === first.id)).toBeTrue();
    component.query.set('zzz-nothing-matches');
    expect(component.records().length).toBe(0);
  });

  it('canSave requires the essential fields', () => {
    component.openDialog();
    // openDialog seeds vehicleId from the first vehicle but leaves title blank.
    expect(component.canSave()).toBeFalse();
  });

  it('save() adds a record through the service and closes the dialog', () => {
    loadRecords();
    const before = repairLog.records().length;
    component.openDialog();
    component.form.update(f => ({ ...f, title: 'New brakes', date: '2026-07-01', vehicleId: 'v1', category: 'brakes' }));
    expect(component.canSave()).toBeTrue();
    component.save();

    const post = httpMock.expectOne(`${API}/api/account/repairs`);
    expect(post.request.method).toBe('POST');
    post.flush({ repair: { id: 'r-new', ...post.request.body } });

    expect(repairLog.records().length).toBe(before + 1);
    expect(component.dialogOpen()).toBeFalse();
  });
});
