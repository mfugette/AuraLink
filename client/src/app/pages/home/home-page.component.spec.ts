import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { HomePageComponent } from './home-page.component';
import { SessionService } from '../../services/session.service';
import { AccountService } from '../../services/account.service';
import { provideMockAuth, clearAppStorage } from '../../../testing/test-utils';
import { SavedVehicle } from '../../models/account.model';

describe('HomePageComponent', () => {
  let fixture: ComponentFixture<HomePageComponent>;
  let component: HomePageComponent;
  let httpMock: HttpTestingController;

  function create(signedIn = true) {
    TestBed.configureTestingModule({
      imports: [HomePageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), provideMockAuth({ signedIn })],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HomePageComponent);
    component = fixture.componentInstance;
  }

  beforeEach(() => clearAppStorage());
  afterEach(() => {
    httpMock?.match(() => true);
    clearAppStorage();
    document.documentElement.style.overflow = '';
  });

  it('derives hero stats from the recent drives', () => {
    create();
    const stats = component.heroStats();
    expect(stats.length).toBe(4);
    expect(stats.map(s => s.label)).toEqual(['Last drive', 'Avg speed', 'Distance logged', 'Peak coolant']);

    const drives = TestBed.inject(SessionService).sessions();
    const newest = [...drives].sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt))[0];
    expect(stats[0].value).toBe(`${newest.distanceMi.toFixed(1)} mi`);
  });

  it('flags peak coolant when a drive breached the healthy band', () => {
    create();
    const drives = TestBed.inject(SessionService).sessions();
    const anyWarn = drives.some(d => d.summary.coolant?.warn);
    const coolant = component.heroStats().find(s => s.label === 'Peak coolant')!;
    expect(!!coolant.warn).toBe(anyWarn);
  });

  it('aura summary reports drive count, mileage, and warnings', () => {
    create();
    const lines = component.auraSummary();
    const drives = TestBed.inject(SessionService).sessions();
    expect(lines[0]).toContain(`${drives.length} recent drives`);
    const flagged = drives.filter(d => d.warnLabel);
    if (flagged.length) {
      expect(lines.some(l => l.includes('flagged'))).toBeTrue();
    } else {
      expect(lines.some(l => l.includes('nominal'))).toBeTrue();
    }
  });

  it('headlines the primary saved vehicle when one exists', () => {
    create();
    const account = TestBed.inject(AccountService);
    account.vehicles.set([
      { id: 'v9', nickname: 'Bessy', year: 2011, make: 'DODGE', model: 'Nitro', isPrimary: true } as SavedVehicle,
    ]);
    expect(component.heroVehicle()).toBe('Bessy');
  });

  it('falls back to the latest drive vehicle without a primary', () => {
    create();
    TestBed.inject(AccountService).vehicles.set([]);
    expect(component.heroVehicle()).toBeTruthy();
  });

  it('locks page scroll on init for desktop, and releases on destroy', () => {
    create();
    if (window.matchMedia('(max-width: 520px)').matches) {
      pending('mobile viewport: lock intentionally does not apply');
      return;
    }
    fixture.detectChanges(); // ngOnInit
    expect(document.documentElement.style.overflow).toBe('hidden');
    fixture.destroy();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('lookup() requires at least one code', () => {
    create();
    component.lookup();
    expect(component.showResults()).toBeFalse();
    component.codes.set(['P0420']);
    component.lookup();
    expect(component.showResults()).toBeTrue();
  });

  it('onUseDetectedCodes seeds codes + vehicle and shows results', () => {
    create();
    component.onUseDetectedCodes({
      codes: ['P0301'],
      vehicle: { year: 2019, make: 'Honda', model: 'Civic', subModel: null, engine: null, driveType: null, transmission: null, fuelType: null, bodyStyle: null, mileage: null, vin: null },
    });
    expect(component.codes()).toEqual(['P0301']);
    expect(component.vehicle().make).toBe('Honda');
    expect(component.showResults()).toBeTrue();
    expect(component.liveMode()).toBeFalse();
  });
});
