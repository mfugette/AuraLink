import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ServicesService } from './services.service';
import { environment } from '../../environments/environment';

describe('ServicesService', () => {
  let service: ServicesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ServicesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('searchByCoords passes category + coordinates to the places proxy', () => {
    service.searchByCoords('mechanic', 40.7, -74.0).subscribe();
    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/api/places/search`);
    expect(req.request.params.get('category')).toBe('mechanic');
    expect(req.request.params.get('lat')).toBe('40.7');
    expect(req.request.params.get('lng')).toBe('-74');
    req.flush({ results: [] });
  });

  it('searchByZip passes category + zip', () => {
    service.searchByZip('tow', '10001').subscribe();
    const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/api/places/search`);
    expect(req.request.params.get('category')).toBe('tow');
    expect(req.request.params.get('zip')).toBe('10001');
    req.flush({ results: [] });
  });

  it('getCurrentPosition rejects when geolocation is unavailable', async () => {
    const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'geolocation');
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
    try {
      await expectAsync(service.getCurrentPosition()).toBeRejected();
    } finally {
      if (original) Object.defineProperty(Navigator.prototype, 'geolocation', original);
      else delete (navigator as unknown as Record<string, unknown>)['geolocation'];
    }
  });

  it('getCurrentPosition resolves with lat/lng from the browser', async () => {
    const fake = {
      getCurrentPosition: (ok: (p: GeolocationPosition) => void) =>
        ok({ coords: { latitude: 1.5, longitude: 2.5 } } as GeolocationPosition),
    };
    Object.defineProperty(navigator, 'geolocation', { value: fake, configurable: true });
    try {
      await expectAsync(service.getCurrentPosition()).toBeResolvedTo({ lat: 1.5, lng: 2.5 });
    } finally {
      delete (navigator as unknown as Record<string, unknown>)['geolocation'];
    }
  });
});
