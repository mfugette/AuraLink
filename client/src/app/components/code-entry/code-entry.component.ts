import {
  Component, EventEmitter, OnInit, Output, signal, computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { DtcService } from '../../services/dtc.service';
import { DtcCode } from '../../models/dtc-code.model';

@Component({
  selector: 'app-code-entry',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatChipsModule, MatAutocompleteModule, MatFormFieldModule,
    MatInputModule, MatIconModule, MatButtonModule, MatTooltipModule,
  ],
  templateUrl: './code-entry.component.html',
  styleUrl: './code-entry.component.scss',
})
export class CodeEntryComponent implements OnInit {
  @Output() codesChanged = new EventEmitter<string[]>();

  readonly separatorKeys = [ENTER, COMMA];
  inputValue = '';
  selectedCodes = signal<string[]>([]);
  suggestions = signal<DtcCode[]>([]);

  readonly hasCode = computed(() => this.selectedCodes().length > 0);

  constructor(private dtcService: DtcService) {}

  ngOnInit(): void {}

  onInputChange(value: string): void {
    this.inputValue = value;
    this.suggestions.set(this.dtcService.search(value));
  }

  addCode(event: MatChipInputEvent): void {
    const value = (event.value ?? '').trim().toUpperCase();
    if (value && this.isValidCode(value) && !this.selectedCodes().includes(value)) {
      this.selectedCodes.update(codes => [...codes, value]);
      this.codesChanged.emit(this.selectedCodes());
    }
    event.chipInput?.clear();
    this.inputValue = '';
    this.suggestions.set([]);
  }

  onAutocompleteSelected(event: MatAutocompleteSelectedEvent): void {
    const code = event.option.value as string;
    if (!this.selectedCodes().includes(code)) {
      this.selectedCodes.update(codes => [...codes, code]);
      this.codesChanged.emit(this.selectedCodes());
    }
    this.inputValue = '';
    this.suggestions.set([]);
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
