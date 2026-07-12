import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { VehicleService } from './vehicle.service';
import { environment } from '../../environments/environment';

describe('VehicleService', () => {
  let service: VehicleService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VehicleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getYears descends from next year into the early 1980s', () => {
    const years = service.getYears();
    expect(years[0]).toBe(new Date().getFullYear() + 1);
    expect(years[years.length - 1]).toBe(1981);
    for (let i = 1; i < years.length; i++) expect(years[i]).toBe(years[i - 1] - 1);
  });

  it('getTrims calls our API and returns [] on failure', (done) => {
    service.getTrims(2019, 'Honda', 'Civic').subscribe(trims => {
      expect(trims).toEqual([]);
      done();
    });
    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/api/vehicle/trims`);
    expect(req.request.params.get('year')).toBe('2019');
    req.flush('nope', { status: 502, statusText: 'Bad Gateway' });
  });

  it('getModels dedupes duplicate model names from NHTSA', (done) => {
    service.getModels(2019, 'Honda').subscribe(models => {
      expect(models).toEqual(['Accord', 'Civic']);
      done();
    });
    const req = httpMock.expectOne(r => r.url.includes('GetModelsForMakeYear'));
    req.flush({ Results: [
      { Model_ID: 1, Model_Name: 'Civic' },
      { Model_ID: 2, Model_Name: 'Civic' },
      { Model_ID: 3, Model_Name: 'Accord' },
    ] });
  });

  it('decodeVin maps + normalizes NHTSA fields', (done) => {
    service.decodeVin('2hgfc2f59kh123456').subscribe(v => {
      expect(v.year).toBe(2019);
      expect(v.make).toBe('HONDA');
      expect(v.engine).toBe('1.5L I4');
      expect(v.driveType).toBe('FWD');
      expect(v.transmission).toBe('CVT');
      expect(v.fuelType).toBe('Gasoline');
      expect(v.bodyStyle).toBe('Sedan');
      expect(v.vin).toBe('2HGFC2F59KH123456');
      done();
    });
    const req = httpMock.expectOne(r => r.url.includes('DecodeVin'));
    req.flush({ Results: [
      { Variable: 'Model Year', Value: '2019' },
      { Variable: 'Make', Value: 'HONDA' },
      { Variable: 'Model', Value: 'Civic' },
      { Variable: 'Trim', Value: 'EX' },
      { Variable: 'Displacement (L)', Value: '1.5' },
      { Variable: 'Engine Number of Cylinders', Value: '4' },
      { Variable: 'Engine Configuration', Value: 'Inline' },
      // Real NHTSA vPIC format includes the abbreviation, e.g. "FWD/Front-Wheel Drive".
      { Variable: 'Drive Type', Value: 'FWD/Front-Wheel Drive' },
      { Variable: 'Transmission Style', Value: 'Continuously Variable Transmission (CVT)' },
      { Variable: 'Fuel Type - Primary', Value: 'Gasoline' },
      { Variable: 'Body Class', Value: 'Sedan/Saloon' },
    ] });
  });

  it('decodeVin swallows network errors into an empty partial', (done) => {
    service.decodeVin('BADVIN').subscribe(v => {
      expect(v).toEqual({});
      done();
    });
    httpMock.expectOne(r => r.url.includes('DecodeVin')).error(new ProgressEvent('error'));
  });
});
