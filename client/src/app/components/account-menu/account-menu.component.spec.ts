import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AccountMenuComponent } from './account-menu.component';
import { provideMockAuth, clearAppStorage } from '../../../testing/test-utils';

describe('AccountMenuComponent', () => {
  let fixture: ComponentFixture<AccountMenuComponent>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({
      imports: [AccountMenuComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideMockAuth()],
    });
    fixture = TestBed.createComponent(AccountMenuComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.match(() => true); // signed-in effect kicks off account fetches
    clearAppStorage();
  });

  it('creates for a signed-in user', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('toggleMenu opens and closes the dropdown', () => {
    const c = fixture.componentInstance;
    c.toggleMenu();
    expect(c.open()).toBeTrue();
    c.toggleMenu();
    expect(c.open()).toBeFalse();
  });

  it('goTo navigates and closes the menu', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const c = fixture.componentInstance;
    c.open.set(true);
    c.goTo('/my-plan');
    expect(router.navigate).toHaveBeenCalledWith(['/my-plan']);
    expect(c.open()).toBeFalse();
  });
});
