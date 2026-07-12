import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NearbyServicesPageComponent } from './nearby-services-page.component';
import { GoogleMapsLoader } from '../../services/google-maps-loader';

describe('NearbyServicesPageComponent', () => {
  let fixture: ComponentFixture<NearbyServicesPageComponent>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NearbyServicesPageComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        // Never inject the real Maps SDK in tests — hold the promise forever.
        { provide: GoogleMapsLoader, useValue: { load: () => new Promise(() => {}) } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NearbyServicesPageComponent);
  });

  afterEach(() => httpMock.match(() => true));

  it('creates without touching the Maps SDK', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('searchZip requires a non-empty zip/address', () => {
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.zip.set('   ');
    c.searchZip();
    expect(httpMock.match(r => r.url.includes('/api/places/search')).length).toBe(0);
  });

  it('searchZip queries the places proxy with the typed location', () => {
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.zip.set('10001');
    c.searchZip();
    const reqs = httpMock.match(r => r.url.includes('/api/places/search'));
    expect(reqs.length).toBe(1);
    expect(reqs[0].request.params.get('zip')).toBe('10001');
    reqs[0].flush({ results: [], location: 'New York, NY' });
  });
});
