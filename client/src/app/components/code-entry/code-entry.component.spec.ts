import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CodeEntryComponent } from './code-entry.component';

describe('CodeEntryComponent', () => {
  let fixture: ComponentFixture<CodeEntryComponent>;
  let component: CodeEntryComponent;
  let emitted: string[][];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CodeEntryComponent] });
    fixture = TestBed.createComponent(CodeEntryComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.codesChanged.subscribe(c => emitted.push(c));
    fixture.detectChanges();
  });

  function pressEnter() {
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
  }

  it('adds a valid DTC on Enter (uppercased)', () => {
    component.onInputChange('p0420');
    pressEnter();
    expect(component.selectedCodes()).toEqual(['P0420']);
    expect(emitted.pop()).toEqual(['P0420']);
    expect(component.inputValue).toBe('');
  });

  it('rejects malformed codes', () => {
    for (const bad of ['X0420', 'P042', 'P04201', 'HELLO']) {
      component.onInputChange(bad);
      pressEnter();
    }
    expect(component.selectedCodes()).toEqual([]);
    expect(emitted.length).toBe(0);
  });

  it('ignores duplicates', () => {
    component.onInputChange('P0420');
    pressEnter();
    component.onInputChange('p0420');
    pressEnter();
    expect(component.selectedCodes()).toEqual(['P0420']);
  });

  it('backspace on empty input removes the last chip', () => {
    component.onInputChange('P0420');
    pressEnter();
    component.onInputChange('P0171');
    pressEnter();
    component.inputValue = '';
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(component.selectedCodes()).toEqual(['P0420']);
  });

  it('search input surfaces suggestions from the DTC database', () => {
    component.onFocus();
    component.onInputChange('P042');
    expect(component.suggestions().length).toBeGreaterThan(0);
    expect(component.showSuggestions()).toBeTrue();
  });

  it('selecting a suggestion adds it and clears the input', () => {
    component.onInputChange('P042');
    component.selectSuggestion('P0420');
    expect(component.selectedCodes()).toEqual(['P0420']);
    expect(component.showSuggestions()).toBeFalse();
  });

  it('initialCodes input seeds the chip list (live-scan flow)', () => {
    component.initialCodes = ['P0301', 'P0171'];
    expect(component.selectedCodes()).toEqual(['P0301', 'P0171']);
  });

  it('clearAll wipes the list and emits empty', () => {
    component.onInputChange('P0420');
    pressEnter();
    component.clearAll();
    expect(component.selectedCodes()).toEqual([]);
    expect(emitted.pop()).toEqual([]);
  });
});
