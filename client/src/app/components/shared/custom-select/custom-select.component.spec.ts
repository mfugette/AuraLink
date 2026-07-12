import { TestBed } from '@angular/core/testing';
import { CustomSelectComponent, SelectOption } from './custom-select.component';

const OPTIONS: SelectOption[] = [
  { value: null, label: 'All vehicles' },
  { value: 'v1', label: '2019 Honda Civic' },
  { value: 'v2', label: '2021 Ford F-150' },
];

describe('CustomSelectComponent', () => {
  let component: CustomSelectComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CustomSelectComponent] });
    const fixture = TestBed.createComponent(CustomSelectComponent);
    component = fixture.componentInstance;
    component.options = OPTIONS;
  });

  it('selectedLabel reflects the current value', () => {
    component.value = 'v1';
    expect(component.selectedLabel()).toBe('2019 Honda Civic');
    component.value = 'missing';
    expect(component.selectedLabel()).toBeNull();
  });

  it('selectOption emits, updates value, and closes the list', () => {
    const emitted: unknown[] = [];
    component.valueChange.subscribe(v => emitted.push(v));
    component.openList();
    component.selectOption(OPTIONS[2]);
    expect(component.value).toBe('v2');
    expect(emitted).toEqual(['v2']);
    expect(component.open()).toBeFalse();
  });

  it('filters options when searchable', () => {
    component.searchable = true;
    component.onSearchInput('ford');
    expect(component.filteredOptions().map(o => o.label)).toEqual(['2021 Ford F-150']);
    component.onSearchInput('');
    expect(component.filteredOptions().length).toBe(3);
  });

  it('does not filter when not searchable', () => {
    component.searchable = false;
    component.searchText.set('ford');
    expect(component.filteredOptions().length).toBe(3);
  });

  it('honors the disabled state as a ControlValueAccessor', () => {
    component.setDisabledState(true);
    component.toggle();
    expect(component.open()).toBeFalse();
  });

  it('writeValue/registerOnChange integrate with forms', () => {
    let formValue: unknown = null;
    component.registerOnChange(v => (formValue = v));
    component.writeValue('v1');
    expect(component.value).toBe('v1');
    component.selectOption(OPTIONS[2]);
    expect(formValue).toBe('v2');
  });

  it('clearSelection resets to null without opening', () => {
    component.value = 'v1';
    component.clearSelection(new Event('click'));
    expect(component.value).toBeNull();
    expect(component.open()).toBeFalse();
  });
});
