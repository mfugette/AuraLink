import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ProfilePanelComponent } from './profile-panel/profile-panel.component';
import { SettingsPanelComponent } from './settings-panel/settings-panel.component';
import { VehiclesPanelComponent } from './vehicles-panel/vehicles-panel.component';
import { clearAppStorage } from '../../../testing/test-utils';

// The three slide-in account panels share the same shell contract: they render
// against AccountService state and emit `closed`. Smoke-level coverage here;
// the underlying data behavior is covered by account.service.spec.ts.
describe('Account panels', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    clearAppStorage();
    TestBed.configureTestingModule({
      imports: [ProfilePanelComponent, SettingsPanelComponent, VehiclesPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.match(() => true);
    clearAppStorage();
    document.documentElement.removeAttribute('data-theme');
  });

  for (const [name, type] of [
    ['ProfilePanelComponent', ProfilePanelComponent],
    ['SettingsPanelComponent', SettingsPanelComponent],
    ['VehiclesPanelComponent', VehiclesPanelComponent],
  ] as const) {
    it(`${name} creates and emits closed`, () => {
      const fixture = TestBed.createComponent(type as never);
      const component = fixture.componentInstance as { closed: { subscribe: (fn: () => void) => void; emit: () => void } };
      fixture.detectChanges();
      let closed = false;
      component.closed.subscribe(() => (closed = true));
      component.closed.emit();
      expect(closed).toBeTrue();
    });
  }
});
