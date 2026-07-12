import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PartsLocatorComponent } from './parts-locator.component';
import { PartSearchResult } from '../../models/part.model';

function fakeResult(price: number, opts: Partial<{ condition: string; sellerRating: number; freeShipping: boolean; selected: boolean }> = {}): PartSearchResult {
  return {
    part: {
      name: 'Part', partNumber: 'PN', price,
      condition: opts.condition ?? 'new',
      sellerRating: opts.sellerRating ?? 4.5,
      freeShipping: opts.freeShipping ?? false,
      store: { name: 'Store', address: 'Addr' },
      images: [],
    },
    selected: opts.selected ?? false,
  } as unknown as PartSearchResult;
}

describe('PartsLocatorComponent', () => {
  let fixture: ComponentFixture<PartsLocatorComponent>;
  let component: PartsLocatorComponent;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PartsLocatorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(PartsLocatorComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.match(() => true)); // drain any stray requests

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('price filters narrow the result list', () => {
    component.results.set([fakeResult(10), fakeResult(50), fakeResult(90)]);
    component.onMinPriceInput('20');
    component.onMaxPriceInput('80');
    expect(component.filteredResults().map(r => r.part.price)).toEqual([50]);
    expect(component.hasActiveFilters()).toBeTrue();
  });

  it('clearFilters restores the full list', () => {
    component.results.set([fakeResult(10), fakeResult(90)]);
    component.onMinPriceInput('50');
    component.clearFilters();
    expect(component.filteredResults().length).toBe(2);
    expect(component.hasActiveFilters()).toBeFalse();
  });

  it('toggleSelection flips an item immutably', () => {
    const item = fakeResult(25);
    component.results.set([item]);
    component.toggleSelection(item);
    expect(component.results()[0].selected).toBeTrue();
    component.toggleSelection(component.results()[0]);
    expect(component.results()[0].selected).toBeFalse();
  });

  it('minimum seller-rating filter drops lower-rated parts', () => {
    component.results.set([fakeResult(10, { sellerRating: 3 }), fakeResult(20, { sellerRating: 5 })]);
    component.setMinRating(4);
    expect(component.filteredResults().length).toBe(1);
    expect(component.filteredResults()[0].part.price).toBe(20);
  });
});
