import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { App } from './app';
import { provideMockAuth, clearAppStorage } from '../testing/test-utils';

describe('App (shell)', () => {
  let httpMock: HttpTestingController;

  function create(signedIn: boolean) {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideMockAuth({ signedIn })],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => clearAppStorage());
  afterEach(() => {
    httpMock.match(() => true); // drain account/theme fetches
    clearAppStorage();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders the block-figlet AURALINK wordmark', () => {
    const el: HTMLElement = create(true).nativeElement;
    expect(el.querySelector('.logo-figlet-aura')).toBeTruthy();
    expect(el.querySelector('.logo-figlet-link')).toBeTruthy();
    // The figlet uses the half-block vocabulary from the Aura terminal banner.
    expect(el.querySelector('.logo-figlet-aura')!.textContent).toContain('█');
  });

  it('signed-in: shows sidebar, AI search, notifications', () => {
    const el: HTMLElement = create(true).nativeElement;
    expect(el.querySelector('app-sidebar')).toBeTruthy();
    expect(el.querySelector('app-ai-search')).toBeTruthy();
    expect(el.querySelector('app-notifications')).toBeTruthy();
  });

  it('guest: hides the signed-in chrome', () => {
    const el: HTMLElement = create(false).nativeElement;
    expect(el.querySelector('app-sidebar')).toBeNull();
    expect(el.querySelector('app-ai-search')).toBeNull();
  });

  it('exposes the current year for the footer', () => {
    const fixture = create(true);
    expect(fixture.componentInstance.currentYear).toBe(new Date().getFullYear());
  });
});
