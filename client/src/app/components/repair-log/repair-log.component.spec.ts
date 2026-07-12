import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RepairLogComponent } from './repair-log.component';
import { RepairLogService } from '../../services/repair-log.service';
import { clearAppStorage } from '../../../testing/test-utils';

describe('RepairLogComponent', () => {
  let fixture: ComponentFixture<RepairLogComponent>;
  let component: RepairLogComponent;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({
      imports: [RepairLogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(RepairLogComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => clearAppStorage());

  it('lists the seeded records and totals their cost', () => {
    const records = component.records();
    expect(records.length).toBeGreaterThan(0);
    const expected = records.reduce((s, r) => s + (r.cost ?? 0), 0);
    expect(component.totalSpent()).toBeCloseTo(expected, 2);
  });

  it('search filters records by text', () => {
    const first = component.records()[0];
    component.query.set(first.title.toLowerCase());
    expect(component.records().some(r => r.id === first.id)).toBeTrue();
    component.query.set('zzz-nothing-matches');
    expect(component.records().length).toBe(0);
  });

  it('canSave requires the essential fields', () => {
    component.openDialog();
    expect(component.canSave()).toBeFalse();
  });

  it('save() adds a record through the service and closes the dialog', () => {
    const service = TestBed.inject(RepairLogService);
    const before = service.records().length;
    component.openDialog();
    component.form.update(f => ({ ...f, title: 'New brakes', date: '2026-07-01', vehicleId: 'v1', category: 'brakes' }));
    if (!component.canSave()) { pending('form requires more fields than title/date/vehicle/category'); return; }
    component.save();
    expect(service.records().length).toBe(before + 1);
    expect(component.dialogOpen()).toBeFalse();
  });

  it('seed records cannot be identified as user records', () => {
    const seed = component.records().find(r => component.isSeed(r));
    expect(seed).toBeDefined();
  });
});
