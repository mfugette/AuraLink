import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { errorInterceptor, SKIP_ERROR_TOAST } from './error.interceptor';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { createMockAuth } from '../../testing/test-utils';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let toast: ToastService;
  let auth: ReturnType<typeof createMockAuth>;

  beforeEach(() => {
    auth = createMockAuth({ signedIn: true });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    spyOn(toast, 'error');
  });

  afterEach(() => httpMock.verify());

  function fail(url: string, status: number, body: object = { error: 'nope' }, context?: HttpContext) {
    http.get(url, { context }).subscribe({ error: () => {} });
    httpMock.expectOne(url).flush(body, { status, statusText: 'ERR' });
  }

  it('toasts a friendly message for a 500 from our API', () => {
    fail(`${API}/api/parts/search`, 500);
    expect(toast.error).toHaveBeenCalledWith('Something went wrong on our end. Please try again shortly.');
  });

  it('maps 429 to a slow-down message', () => {
    fail(`${API}/api/assistant/chat`, 429);
    expect(toast.error).toHaveBeenCalledWith(jasmine.stringContaining('a bit too fast'));
  });

  it('prefers a sane server-provided message on unhandled 4xx', () => {
    fail(`${API}/api/account/vehicles`, 422, { error: 'year, make, and model are required.' });
    expect(toast.error).toHaveBeenCalledWith('year, make, and model are required.');
  });

  it('forces a sign-out on a 401 from our API', () => {
    fail(`${API}/api/account/me`, 401);
    expect(auth.signOut).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Your session expired. Please sign in again.');
  });

  it('honors SKIP_ERROR_TOAST but still propagates the error', () => {
    const ctx = new HttpContext().set(SKIP_ERROR_TOAST, true);
    let caught = false;
    http.get(`${API}/api/account`, { context: ctx }).subscribe({ error: () => (caught = true) });
    httpMock.expectOne(`${API}/api/account`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(toast.error).not.toHaveBeenCalled();
    expect(caught).toBeTrue();
  });

  it('leaves third-party failures alone', () => {
    fail('https://vpic.nhtsa.dot.gov/api/whatever', 500);
    expect(toast.error).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
