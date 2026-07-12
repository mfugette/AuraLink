import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FaqPageComponent } from './faq-page.component';

describe('FaqPageComponent', () => {
  let fixture: ComponentFixture<FaqPageComponent>;
  let component: FaqPageComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FaqPageComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(FaqPageComponent);
    component = fixture.componentInstance;
  });

  it('shows all sections with no query', () => {
    expect(component.filtered().length).toBeGreaterThan(0);
    expect(component.noResults()).toBeFalse();
  });

  it('query filters questions and flags empty results', () => {
    component.query.set('zzz-never-in-faq');
    expect(component.noResults()).toBeTrue();
  });

  it('toggle expands and collapses a question key', () => {
    const key = `${component.filtered()[0].title}-0`;
    expect(component.isOpen(key)).toBeFalse();
    component.toggle(key);
    expect(component.isOpen(key)).toBeTrue();
    component.toggle(key);
    expect(component.isOpen(key)).toBeFalse();
  });
});
