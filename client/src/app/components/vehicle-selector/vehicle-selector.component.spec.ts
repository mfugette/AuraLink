import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { VehicleSelectorComponent } from './vehicle-selector.component';
import { Vehicle } from '../../models/vehicle.model';

const VEHICLE: Vehicle = {
  year: 2019, make: 'Honda', model: 'Civic', subModel: 'EX', engine: '1.5L I4',
  driveType: 'FWD', transmission: 'CVT', fuelType: 'Gasoline', bodyStyle: 'Sedan',
  mileage: 42000, vin: '2HGFC2F59KH123456',
};

describe('VehicleSelectorComponent', () => {
  let fixture: ComponentFixture<VehicleSelectorComponent>;
  let component: VehicleSelectorComponent;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [VehicleSelectorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(VehicleSelectorComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.match(() => true)); // NHTSA lookups fire on init/selection

  it('creates', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('seeding via initialVehicle emits the detail fields', () => {
    const emitted: Vehicle[] = [];
    component.vehicleChanged.subscribe(v => emitted.push(v));
    component.initialVehicle = VEHICLE;
    fixture.detectChanges(); // ngOnInit seeds the form
    expect(emitted.length).toBeGreaterThan(0);
    // Cascade fields (year/make/model) fill silently via timers + NHTSA calls;
    // the synchronous emissions carry the instance details along the way.
    expect(emitted.some(v => v.vin === VEHICLE.vin)).toBeTrue();
    expect(emitted.some(v => v.driveType === 'FWD')).toBeTrue();
    expect(emitted.some(v => v.mileage === 42000)).toBeTrue();
  });
});
