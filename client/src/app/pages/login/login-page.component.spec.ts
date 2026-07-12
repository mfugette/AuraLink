import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { LoginPageComponent } from './login-page.component';
import { AuthService } from '../../services/auth.service';
import { createMockAuth } from '../../../testing/test-utils';

describe('LoginPageComponent', () => {
  let fixture: ComponentFixture<LoginPageComponent>;
  let component: LoginPageComponent;
  let auth: ReturnType<typeof createMockAuth>;

  function create(mode: string | null = null) {
    auth = createMockAuth({ signedIn: false });
    TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: new Map(mode ? [['mode', mode]] : []) } } },
      ],
    });
    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
  }

  it('defaults to sign-in mode', () => {
    create();
    expect(component.mode()).toBe('signin');
  });

  it('?mode=signup opens in signup mode', () => {
    create('signup');
    expect(component.mode()).toBe('signup');
  });

  it('toggleMode flips between signin and signup and clears errors', () => {
    create();
    component.error.set('old error');
    component.toggleMode();
    expect(component.mode()).toBe('signup');
  });

  it('reset-request mode is reachable and reversible', () => {
    create();
    component.showResetRequest();
    expect(component.mode()).toBe('reset-request');
    component.backToSignIn();
    expect(component.mode()).toBe('signin');
  });
});
