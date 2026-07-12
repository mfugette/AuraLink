import { TestBed, ComponentFixture } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { CodeResultsComponent } from './code-results.component';

describe('CodeResultsComponent', () => {
  let fixture: ComponentFixture<CodeResultsComponent>;
  let component: CodeResultsComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CodeResultsComponent] });
    fixture = TestBed.createComponent(CodeResultsComponent);
    component = fixture.componentInstance;
  });

  function setCodes(codes: string[]) {
    const prev = component.codes;
    component.codes = codes;
    component.ngOnChanges({ codes: new SimpleChange(prev, codes, prev.length === 0) });
  }

  it('resolves known codes and flags unknown ones', () => {
    setCodes(['P0420', 'P9999']);
    expect(component.results().map(r => r.code)).toEqual(['P0420']);
    expect(component.unknownCodes()).toEqual(['P9999']);
  });

  it('togglePart selects/deselects and emits the selection', () => {
    const emissions: string[][] = [];
    component.selectedPartsChanged.subscribe(p => emissions.push(p));
    component.togglePart('Oxygen Sensor');
    expect(emissions.pop()).toEqual(['Oxygen Sensor']);
    component.togglePart('Oxygen Sensor');
    expect(emissions.pop()).toEqual([]);
  });

  it('expansion state is tracked per code', () => {
    setCodes(['P0420']);
    expect(component.isExpanded('P0420')).toBeFalse();
    component.toggleExpanded('P0420');
    expect(component.isExpanded('P0420')).toBeTrue();
    component.toggleExpanded('P0420');
    expect(component.isExpanded('P0420')).toBeFalse();
  });

  it('severityIcon maps every severity to a registered icon name', () => {
    for (const sev of ['low', 'moderate', 'high', 'critical'] as const) {
      expect(component.severityIcon(sev)).toBeTruthy();
    }
  });
});
