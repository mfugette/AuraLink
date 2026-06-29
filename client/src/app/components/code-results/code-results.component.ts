import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
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

  results = signal<DtcCode[]>([]);
  unknownCodes = signal<string[]>([]);

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
    }
  }

  severityIcon(severity: Severity): string {
    return { low: 'check_circle', moderate: 'warning', high: 'error', critical: 'dangerous' }[severity];
  }

  allRelatedParts(): string[] {
    const parts = new Set<string>();
    for (const r of this.results()) {
      r.relatedParts.forEach(p => parts.add(p));
    }
    return [...parts];
  }
}
