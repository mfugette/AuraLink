import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MyVehiclesPageComponent } from './my-vehicles-page.component';
import { AccountService } from '../../services/account.service';
import { SavedVehicle } from '../../models/account.model';

function vehicle(id: string): SavedVehicle {
  return { id, accountId: 'u1', nickname: null, year: 2019, make: 'Honda', model: 'Civic',
    subModel: null, engine: null, driveType: null, transmission: null, fuelType: null,
    bodyStyle: null, mileage: null, vin: null, isPrimary: false, createdAt: '' };
}

describe('MyVehiclesPageComponent', () => {
  let fixture: ComponentFixture<MyVehiclesPageComponent>;
  let account: AccountService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MyVehiclesPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(MyVehiclesPageComponent);
    account = TestBed.inject(AccountService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.match(() => true));

  it('always renders a full 12-slot garage grid', () => {
    account.vehicles.set([vehicle('a'), vehicle('b')]);
    const slots = fixture.componentInstance.slots();
    expect(slots.length).toBe(12);
    expect(slots.filter(Boolean).length).toBe(2);
  });

  it('grows to the next full row of 4 beyond 12 vehicles', () => {
    account.vehicles.set(Array.from({ length: 13 }, (_, i) => vehicle(`v${i}`)));
    const slots = fixture.componentInstance.slots();
    expect(slots.length).toBe(16);
    expect(slots.filter(Boolean).length).toBe(13);
  });

  it('fetches vehicles on init', () => {
    fixture.detectChanges();
    expect(httpMock.match(r => r.url.includes('/api/account/vehicles')).length).toBe(1);
  });
});
