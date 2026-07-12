import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AccountPageComponent } from './account-page.component';
import { provideMockAuth, clearAppStorage } from '../../../testing/test-utils';

describe('AccountPageComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({
      imports: [AccountPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideMockAuth()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.match(() => true);
    clearAppStorage();
  });

  it('creates', () => {
    const fixture = TestBed.createComponent(AccountPageComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
