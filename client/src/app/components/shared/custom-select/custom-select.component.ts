import {
  Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, forwardRef, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';
export interface SelectOption {
  value: unknown;
  label: string;
}

// Fully custom dropdown replacing native <select>/<input list>+<datalist> —
// those render OS-drawn popups we can't size, position, or theme (oversized,
// wrong colors on some platforms). This renders its own dark, height-capped
// list styled like the DTC code-entry suggestions, with the same keyboard
// interaction (arrows/Enter/Escape). Implements ControlValueAccessor so it
// drops into formControlName exactly like a native control.
@Component({
  selector: 'app-custom-select',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './custom-select.component.html',
  styleUrl: './custom-select.component.scss',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => CustomSelectComponent),
    multi: true,
  }],
})
export class CustomSelectComponent implements ControlValueAccessor {
  @Input() options: SelectOption[] = [];
  @Input() placeholder = 'Select…';
  @Input() searchPlaceholder = 'Type to search…';
  @Input() searchable = false;
  @Input() icon: string | null = null;
  @Input() loading = false;

  // Plain value/event API for standalone (non-formControlName) usage, e.g.
  // the trim selector which isn't a real form field. ControlValueAccessor
  // (writeValue/onChange) is used instead when bound via formControlName.
  @Input()
  set value(v: unknown) {
    this._value = v;
  }
  get value(): unknown {
    return this._value;
  }
  @Output() valueChange = new EventEmitter<unknown>();
  private _value: unknown = null;

  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('host') hostRef?: ElementRef<HTMLElement>;

  open = signal(false);
  searchText = signal('');
  activeIndex = signal(-1);
  disabled = false;

  private onChange: (v: unknown) => void = () => {};
  private onTouched: () => void = () => {};

  // Plain methods, not computed() — computed() only re-runs when a *signal*
  // read inside it changes, but `options`/`value` are ordinary @Input-backed
  // properties here, so a computed() would capture them once and go stale
  // (this caused selections to display as empty). Template expressions
  // re-evaluate every change-detection pass, so a method works correctly.
  filteredOptions(): SelectOption[] {
    if (!this.searchable) return this.options;
    const q = this.searchText().trim().toLowerCase();
    if (!q) return this.options;
    return this.options.filter(o => o.label.toLowerCase().includes(q));
  }

  selectedLabel(): string | null {
    const match = this.options.find(o => o.value === this.value);
    return match?.label ?? null;
  }

  writeValue(value: unknown): void {
    this._value = value;
  }
  registerOnChange(fn: (v: unknown) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) this.close();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const host = this.hostRef?.nativeElement;
    if (host && !host.contains(event.target as Node)) this.close();
  }

  toggle(): void {
    if (this.disabled) return;
    this.open() ? this.close() : this.openList();
  }

  openList(): void {
    if (this.disabled) return;
    this.open.set(true);
    this.searchText.set('');
    this.activeIndex.set(this.options.findIndex(o => o.value === this.value));
    if (this.searchable) {
      setTimeout(() => this.searchInputRef?.nativeElement.focus());
    }
  }

  close(): void {
    this.open.set(false);
    this.activeIndex.set(-1);
    this.onTouched();
  }

  onSearchInput(text: string): void {
    this.searchText.set(text);
    this.activeIndex.set(0);
  }

  selectOption(opt: SelectOption): void {
    this._value = opt.value;
    this.onChange(opt.value);
    this.valueChange.emit(opt.value);
    this.close();
  }

  clearSelection(event: Event): void {
    event.stopPropagation();
    this._value = null;
    this.onChange(null);
    this.valueChange.emit(null);
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled) return;
    if (!this.open() && (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown')) {
      event.preventDefault();
      this.openList();
      return;
    }
    this.handleListKeydown(event);
  }

  handleListKeydown(event: KeyboardEvent): void {
    if (!this.open()) return;
    const list = this.filteredOptions();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.set(Math.min(this.activeIndex() + 1, list.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
        break;
      case 'Enter': {
        event.preventDefault();
        const idx = this.activeIndex();
        if (idx >= 0 && list[idx]) this.selectOption(list[idx]);
        break;
      }
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case 'Tab':
        this.close();
        break;
    }
  }
}
