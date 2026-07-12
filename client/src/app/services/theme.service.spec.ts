import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ThemeService } from './theme.service';
import { AccountService } from './account.service';
import { clearAppStorage } from '../../testing/test-utils';

describe('ThemeService', () => {
  let httpMock: HttpTestingController;

  function setup(): ThemeService {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.inject(ThemeService);
  }

  beforeEach(() => clearAppStorage());
  afterEach(() => {
    clearAppStorage();
    document.documentElement.removeAttribute('data-theme');
  });

  it('restores the persisted theme from localStorage', () => {
    localStorage.setItem('obd-theme', 'light');
    const service = setup();
    expect(service.theme()).toBe('light');
    expect(service.isLight()).toBeTrue();
  });

  it('toggle flips the theme, stamps the DOM synchronously, and persists', () => {
    localStorage.setItem('obd-theme', 'dark');
    const service = setup();
    service.toggle();
    expect(service.theme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('obd-theme')).toBe('light');
  });

  it('set() is a no-op when the theme is unchanged', () => {
    localStorage.setItem('obd-theme', 'dark');
    const service = setup();
    document.documentElement.setAttribute('data-theme', 'sentinel');
    service.set('dark');
    // No re-stamp happened because nothing changed.
    expect(document.documentElement.getAttribute('data-theme')).toBe('sentinel');
  });

  it('adopts the account-saved theme when settings load', () => {
    localStorage.setItem('obd-theme', 'dark');
    const service = setup();
    const account = TestBed.inject(AccountService);
    account.settings.set({ accountId: 'u1', notifyEmail: true, notifySms: false, preferredUnits: 'imperial', theme: 'light' });
    TestBed.tick(); // flush the sync effect
    expect(service.theme()).toBe('light');
    expect(localStorage.getItem('obd-theme')).toBe('light');
  });
});
