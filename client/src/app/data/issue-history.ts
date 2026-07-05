// Sample issue-history records for the Issue History page. Local seed data for
// now — the `vehicleId` values line up with the seeded saved vehicles from the
// account store (veh-1 = "My Daily"). Later this can move behind an
// /api/account/issues endpoint without changing the IssueRecord shape.

export type IssueStatus = 'open' | 'in-progress' | 'resolved';
export type IssueSeverity = 'low' | 'moderate' | 'high' | 'critical';

export interface IssueRecord {
  id: string;
  vehicleId: string;
  vehicleLabel: string;   // denormalized for display / when a vehicle is deleted
  code: string;
  title: string;
  date: string;           // ISO date the issue was logged
  status: IssueStatus;
  severity: IssueSeverity;
  notes: string;
  partsUsed: string[];
}

export const ISSUE_HISTORY: IssueRecord[] = [
  {
    id: 'iss-1',
    vehicleId: 'veh-1',
    vehicleLabel: '2018 Honda Civic',
    code: 'P0420',
    title: 'Catalyst System Efficiency Below Threshold (Bank 1)',
    date: '2026-05-14',
    status: 'resolved',
    severity: 'moderate',
    notes: 'Rear O2 sensor reading lazy; replaced downstream sensor and cleared code. No recurrence after 300 mi.',
    partsUsed: ['Oxygen Sensor (Downstream)'],
  },
  {
    id: 'iss-2',
    vehicleId: 'veh-1',
    vehicleLabel: '2018 Honda Civic',
    code: 'P0301',
    title: 'Cylinder 1 Misfire Detected',
    date: '2026-06-02',
    status: 'resolved',
    severity: 'high',
    notes: 'Rough idle at cold start. Coil pack on cylinder 1 failed under load — replaced coil and plug.',
    partsUsed: ['Ignition Coil Pack', 'Spark Plug Set (Iridium)'],
  },
  {
    id: 'iss-3',
    vehicleId: 'veh-1',
    vehicleLabel: '2018 Honda Civic',
    code: 'P0171',
    title: 'System Too Lean (Bank 1)',
    date: '2026-06-21',
    status: 'in-progress',
    severity: 'moderate',
    notes: 'Long-term fuel trim climbing. Smoke-tested for vacuum leaks — suspect dirty MAF. Cleaned MAF; monitoring.',
    partsUsed: ['Engine Air Filter'],
  },
  {
    id: 'iss-4',
    vehicleId: 'veh-2',
    vehicleLabel: '2015 Mazda MX-5',
    code: 'P0455',
    title: 'EVAP System Leak Detected (Large)',
    date: '2026-06-28',
    status: 'open',
    severity: 'low',
    notes: 'Check engine light after fuel-up. Likely loose/failed gas cap — cap on order, not yet replaced.',
    partsUsed: [],
  },
  {
    id: 'iss-5',
    vehicleId: 'veh-2',
    vehicleLabel: '2015 Mazda MX-5',
    code: 'P0128',
    title: 'Coolant Thermostat Below Regulating Temperature',
    date: '2026-04-09',
    status: 'resolved',
    severity: 'low',
    notes: 'Engine slow to reach temp in cold weather. Thermostat stuck open — replaced thermostat and housing.',
    partsUsed: ['Thermostat & Housing'],
  },
];
