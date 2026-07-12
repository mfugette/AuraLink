import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PartsService } from './parts.service';
import { Vehicle } from '../models/vehicle.model';
import { environment } from '../../environments/environment';

const VEHICLE: Vehicle = {
  year: 2019, make: 'Honda', model: 'Civic', subModel: null, engine: null,
  driveType: null, transmission: null, fuelType: null, bodyStyle: null, mileage: null, vin: null,
};

describe('PartsService', () => {
  let service: PartsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PartsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('searchParts sends part + vehicle as query params', () => {
    service.searchParts('oxygen sensor', VEHICLE).subscribe();
    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/api/parts/search`);
    expect(req.request.params.get('part')).toBe('oxygen sensor');
    expect(req.request.params.get('year')).toBe('2019');
    expect(req.request.params.get('make')).toBe('Honda');
    expect(req.request.params.get('model')).toBe('Civic');
    req.flush({ results: [] });
  });

  it('sends empty strings for missing vehicle fields', () => {
    service.searchParts('brake pads', { ...VEHICLE, year: null, make: null, model: null }).subscribe();
    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/api/parts/search`);
    expect(req.request.params.get('year')).toBe('');
    expect(req.request.params.get('make')).toBe('');
    req.flush({ results: [] });
  });

  it('maps a missing results field to an empty array', (done) => {
    service.searchParts('filter', VEHICLE).subscribe(parts => {
      expect(parts).toEqual([]);
      done();
    });
    httpMock.expectOne(r => r.url === `${environment.apiUrl}/api/parts/search`).flush({});
  });
});
