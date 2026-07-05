import {
  Component, ElementRef, EventEmitter, Input, Output, ViewChild, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DtcService } from '../../services/dtc.service';
import { DtcCode } from '../../models/dtc-code.model';

@Component({
  selector: 'app-code-entry',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatIconModule, MatTooltipModule,
  ],
  templateUrl: './code-entry.component.html',
  styleUrl: './code-entry.component.scss',
})
export class CodeEntryComponent {
  @Output() codesChanged = new EventEmitter<string[]>();
  @ViewChild('codeInput') codeInput?: ElementRef<HTMLInputElement>;

  // Allows external flows (e.g. live DTC scan) to seed the chip list.
  @Input() set initialCodes(codes: string[] | null) {
    if (codes && codes.join(',') !== this.selectedCodes().join(',')) {
      this.selectedCodes.set([...codes]);
    }
  }

  inputValue = '';
  selectedCodes = signal<string[]>([]);
  suggestions = signal<DtcCode[]>([]);
  focused = signal(false);
  showSuggestions = signal(false);
  activeIndex = signal(-1);

  readonly hasCode = computed(() => this.selectedCodes().length > 0);

  constructor(private dtcService: DtcService) {}

  onFocus(): void {
    this.focused.set(true);
    if (this.inputValue) this.refreshSuggestions();
  }

  onBlur(): void {
    this.focused.set(false);
    this.showSuggestions.set(false);
    this.activeIndex.set(-1);
  }

  onInputChange(value: string): void {
    this.inputValue = value;
    this.refreshSuggestions();
  }

  private refreshSuggestions(): void {
    const results = this.dtcService.search(this.inputValue);
    this.suggestions.set(results);
    this.showSuggestions.set(this.inputValue.trim().length > 0 && results.length > 0);
    this.activeIndex.set(-1);
  }

  onKeydown(event: KeyboardEvent): void {
    const list = this.suggestions();

    switch (event.key) {
      case 'ArrowDown':
        if (this.showSuggestions()) {
          event.preventDefault();
          this.activeIndex.set(Math.min(this.activeIndex() + 1, list.length - 1));
        }
        break;
      case 'ArrowUp':
        if (this.showSuggestions()) {
          event.preventDefault();
          this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
        }
        break;
      case 'Enter':
      case ',':
        event.preventDefault();
        if (this.showSuggestions() && this.activeIndex() >= 0) {
          this.selectSuggestion(list[this.activeIndex()].code);
        } else {
          this.commitInput();
        }
        break;
      case 'Escape':
        this.showSuggestions.set(false);
        this.activeIndex.set(-1);
        break;
      case 'Backspace':
        if (!this.inputValue && this.selectedCodes().length > 0) {
          this.removeCode(this.selectedCodes()[this.selectedCodes().length - 1]);
        }
        break;
    }
  }

  private commitInput(): void {
    const value = this.inputValue.trim().toUpperCase();
    if (value && this.isValidCode(value) && !this.selectedCodes().includes(value)) {
      this.selectedCodes.update(codes => [...codes, value]);
      this.codesChanged.emit(this.selectedCodes());
    }
    this.resetInput();
  }

  selectSuggestion(code: string, event?: Event): void {
    // On mousedown we must keep focus on the input, so cancel the default blur.
    event?.preventDefault();
    if (!this.selectedCodes().includes(code)) {
      this.selectedCodes.update(codes => [...codes, code]);
      this.codesChanged.emit(this.selectedCodes());
    }
    this.resetInput();
    this.codeInput?.nativeElement.focus();
  }

  private resetInput(): void {
    this.inputValue = '';
    this.suggestions.set([]);
    this.showSuggestions.set(false);
    this.activeIndex.set(-1);
  }

  removeCode(code: string): void {
    this.selectedCodes.update(codes => codes.filter(c => c !== code));
    this.codesChanged.emit(this.selectedCodes());
  }

  clearAll(): void {
    this.selectedCodes.set([]);
    this.codesChanged.emit([]);
  }

  private isValidCode(code: string): boolean {
    return /^[PBCU][0-9]{4}$/i.test(code);
  }

  severityFor(code: string): string {
    return this.dtcService.lookup(code)?.severity ?? '';
  }
}
