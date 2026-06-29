import { Injectable } from '@angular/core';
import { DtcCode } from '../models/dtc-code.model';
import dtcData from '../data/dtc-codes.json';

@Injectable({ providedIn: 'root' })
export class DtcService {
  private readonly codes: DtcCode[] = dtcData as DtcCode[];

  lookup(code: string): DtcCode | undefined {
    return this.codes.find(c => c.code.toUpperCase() === code.toUpperCase());
  }

  search(query: string): DtcCode[] {
    const q = query.toUpperCase().trim();
    if (!q) return [];
    return this.codes.filter(c => c.code.startsWith(q)).slice(0, 10);
  }

  lookupMany(codes: string[]): DtcCode[] {
    return codes.map(c => this.lookup(c)).filter((c): c is DtcCode => c !== undefined);
  }
}
