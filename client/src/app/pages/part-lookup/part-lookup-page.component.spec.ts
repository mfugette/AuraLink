import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { PartLookupPageComponent } from './part-lookup-page.component';
import { AccountService } from '../../services/account.service';
import { SavedVehicle } from '../../models/account.model';
import { provideMockAuth } from '../../../testing/test-utils';

function savedVehicle(over: Partial<SavedVehicle> = {}): SavedVehicle {
  return {
    id: 'v1', accountId: 'a1', nickname: null, year: 2015, make: 'Subaru', model: 'WRX',
    subModel: null, engine: null, driveType: null, transmission: null, fuelType: null,
    bodyStyle: null, mileage: null, vin: null, isPrimary: false, createdAt: '',
    ...over,
  };
}

describe('PartLookupPageComponent', () => {
  let fixture: ComponentFixture<PartLookupPageComponent>;
  let component: PartLookupPageComponent;
  let httpMock: HttpTestingController;
  let account: AccountService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PartLookupPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideMockAuth()],
    });
    fixture = TestBed.createComponent(PartLookupPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    account = TestBed.inject(AccountService);
    // ngOnInit fetches the saved-vehicle list; the locator may also fire eBay
    // searches. Both are drained per-test — this suite tests page state, not HTTP.
  });

  afterEach(() => httpMock.match(() => true)); // drain any stray requests

  it('creates and starts with no active search', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component.hasSearch()).toBeFalse();
    expect(component.partNames()).toEqual([]);
  });

  it('submitSearch comma-splits the query into part names', () => {
    fixture.detectChanges();
    component.onQueryInput('oxygen sensor, brake pads ,  ');
    component.submitSearch();
    expect(component.partNames()).toEqual(['oxygen sensor', 'brake pads']);
    expect(component.hasSearch()).toBeTrue();
  });

  it('clearSearch resets query and part names', () => {
    fixture.detectChanges();
    component.onQueryInput('rotor');
    component.submitSearch();
    component.clearSearch();
    expect(component.query()).toBe('');
    expect(component.partNames()).toEqual([]);
  });

  it('selecting a saved vehicle scopes the search vehicle', () => {
    account.vehicles.set([savedVehicle()]);
    fixture.detectChanges();
    component.selectVehicle('v1');
    const v = component.vehicle();
    expect(v.make).toBe('Subaru');
    expect(v.model).toBe('WRX');
    expect(v.year).toBe(2015);
    expect(component.vehicleLabel()).toBe('2015 Subaru WRX');
  });

  it('manual mode builds a vehicle from the typed fields', () => {
    fixture.detectChanges();
    component.enterManual();
    component.manualYear.set('2018');
    component.manualMake.set('Honda');
    component.manualModel.set('Civic');
    const v = component.vehicle();
    expect(v.year).toBe(2018);
    expect(v.make).toBe('Honda');
    expect(v.model).toBe('Civic');
  });

  it('clearVehicle drops the scope back to empty', () => {
    account.vehicles.set([savedVehicle()]);
    fixture.detectChanges();
    component.selectVehicle('v1');
    component.clearVehicle();
    expect(component.selectedVehicleId()).toBeNull();
    expect(component.manualMode()).toBeFalse();
    expect(component.vehicleLabel()).toBe('');
  });

  it('selecting a saved vehicle exits manual mode', () => {
    account.vehicles.set([savedVehicle()]);
    fixture.detectChanges();
    component.enterManual();
    expect(component.manualMode()).toBeTrue();
    component.selectVehicle('v1');
    expect(component.manualMode()).toBeFalse();
    expect(component.selectedVehicleId()).toBe('v1');
  });

  it('vehicleName prefers nickname, else year/make/model', () => {
    fixture.detectChanges();
    expect(component.vehicleName(savedVehicle({ nickname: 'Rally Car' }))).toBe('Rally Car');
    expect(component.vehicleName(savedVehicle({ nickname: null }))).toBe('2015 Subaru WRX');
  });
});
