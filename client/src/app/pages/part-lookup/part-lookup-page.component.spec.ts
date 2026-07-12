import { TestBed, ComponentFixture } from '@angular/core/testing';
import { PartLookupPageComponent } from './part-lookup-page.component';

describe('PartLookupPageComponent', () => {
  let fixture: ComponentFixture<PartLookupPageComponent>;
  let component: PartLookupPageComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PartLookupPageComponent] });
    fixture = TestBed.createComponent(PartLookupPageComponent);
    component = fixture.componentInstance;
  });

  it('shows the full catalog with no filters', () => {
    expect(component.results().length).toBeGreaterThan(0);
    expect(component.hasActiveFilter()).toBeFalse();
  });

  it('query filters the catalog', () => {
    const first = component.results()[0];
    component.onQueryInput(first.name.slice(0, 6));
    expect(component.results().length).toBeGreaterThan(0);
    expect(component.hasActiveFilter()).toBeTrue();
    component.onQueryInput('zzz-no-part-matches');
    expect(component.results().length).toBe(0);
  });

  it('category tabs filter and clearFilters resets everything', () => {
    const all = component.results().length;
    component.setCategory(component.categories[0]);
    expect(component.results().length).toBeLessThanOrEqual(all);
    component.clearFilters();
    expect(component.results().length).toBe(all);
    expect(component.hasActiveFilter()).toBeFalse();
  });

  it('slots pad the grid to full rows', () => {
    const slots = component.slots();
    expect(slots.length % 4).toBe(0);
    expect(slots.length).toBeGreaterThanOrEqual(component.results().length);
  });
});
