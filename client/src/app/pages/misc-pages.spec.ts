import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { TermsPageComponent } from './legal/terms-page.component';
import { PrivacyPageComponent } from './legal/privacy-page.component';
import { AuthCallbackPageComponent } from './auth-callback/auth-callback-page.component';
import { ResetPasswordPageComponent } from './reset-password/reset-password-page.component';
import { provideMockAuth } from '../../testing/test-utils';

// Smoke coverage for the static/flow pages with no page-specific logic beyond
// what their services already cover.
describe('Static & auth-flow pages', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideMockAuth({ signedIn: false }),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: new Map() } } },
      ],
    });
  });

  it('TermsPageComponent renders its legal copy', () => {
    const fixture = TestBed.createComponent(TermsPageComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Terms');
  });

  it('PrivacyPageComponent renders its legal copy', () => {
    const fixture = TestBed.createComponent(PrivacyPageComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Privacy');
  });

  it('AuthCallbackPageComponent creates', () => {
    const fixture = TestBed.createComponent(AuthCallbackPageComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('ResetPasswordPageComponent creates', () => {
    const fixture = TestBed.createComponent(ResetPasswordPageComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
