export type Severity = 'low' | 'moderate' | 'high' | 'critical';

export interface DtcCode {
  code: string;
  name: string;
  description: string;
  severity: Severity;
  symptoms: string[];
  possibleCauses: string[];
  relatedParts: string[];
}
