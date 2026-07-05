export type Severity = 'low' | 'moderate' | 'high' | 'critical';

export const SEVERITY_RANK: Record<Severity, number> = { low: 0, moderate: 1, high: 2, critical: 3 };

export interface DtcCode {
  code: string;
  name: string;
  description: string;
  severity: Severity;
  symptoms: string[];
  possibleCauses: string[];
  relatedParts: string[];
}
