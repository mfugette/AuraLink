import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { provideMockAuth } from '../../testing/test-utils';
import { environment } from '../../environments/environment';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  function setup(signedIn: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideMockAuth({ signedIn }),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => httpMock.verify());

  it('attaches Bearer token + credentials to our API calls', () => {
    setup(true);
    http.get(`${environment.apiUrl}/api/account/me`).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/api/account/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({});
  });

  it('still opts in to credentials without a token (Cloudflare Access cookie)', () => {
    setup(false);
    http.get(`${environment.apiUrl}/api/health`).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/api/health`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.withCredentials).toBeTrue();
    req.flush({});
  });

  it('never leaks the token to third-party hosts', () => {
    setup(true);
    http.get('https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car').subscribe();
    const req = httpMock.expectOne(r => r.url.includes('nhtsa.dot.gov'));
    expect(req.request.headers.has('Authorization')).toBeFalse();
    expect(req.request.withCredentials).toBeFalse();
    req.flush({});
  });
});
