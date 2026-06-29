import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DtcService } from '../../services/dtc.service';
import { DtcCode, Severity } from '../../models/dtc-code.model';

@Component({
  selector: 'app-code-results',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule, MatIconModule, MatButtonModule,
    MatChipsModule, MatExpansionModule, MatTooltipModule,
  ],
  templateUrl: './code-results.component.html',
  styleUrl: './code-results.component.scss',
})
export class CodeResultsComponent implements OnChanges {
  @Input() codes: string[] = [];
  @Output() selectedPartsChanged = new EventEmitter<string[]>();

  results = signal<DtcCode[]>([]);
  unknownCodes = signal<string[]>([]);
  selectedParts = signal<Set<string>>(new Set());

  constructor(private dtcService: DtcService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['codes']) {
      const found: DtcCode[] = [];
      const unknown: string[] = [];
      for (const code of this.codes) {
        const result = this.dtcService.lookup(code);
        if (result) found.push(result);
        else unknown.push(code);
      }
      this.results.set(found);
      this.unknownCodes.set(unknown);

      // Drop selections for parts no longer present in any result
      const allCurrentParts = new Set(found.flatMap(r => r.relatedParts));
      const filtered = new Set([...this.selectedParts()].filter(p => allCurrentParts.has(p)));
      this.selectedParts.set(filtered);
      this.selectedPartsChanged.emit([...filtered]);
    }
  }

  togglePart(part: string): void {
    const next = new Set(this.selectedParts());
    if (next.has(part)) next.delete(part); else next.add(part);
    this.selectedParts.set(next);
    this.selectedPartsChanged.emit([...next]);
  }

  get selectedPartsArray(): string[] {
    return [...this.selectedParts()];
  }

  severityIcon(severity: Severity): string {
    return { low: 'check_circle', moderate: 'warning', high: 'error', critical: 'dangerous' }[severity];
  }
}
