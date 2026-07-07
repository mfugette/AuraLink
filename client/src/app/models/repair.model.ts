// A repair / service record — the user's maintenance log (oil changes, brakes,
// tires, etc.). Sibling to IssueRecord (diagnostic issues) but for planned/
// completed service work. Seed data + user-added records for now; later this
// moves behind an /api/account/repairs endpoint without changing the shape.

export type RepairCategory =
  | 'oil'          // oil & filter change
  | 'tires'        // rotation, replacement, alignment
  | 'brakes'       // pads, rotors, fluid
  | 'battery'      // battery replacement / service
  | 'fluids'       // coolant, transmission, etc.
  | 'inspection'   // safety/emissions inspection
  | 'repair'       // general repair
  | 'other';

export interface RepairRecord {
  id: string;
  vehicleId: string;
  vehicleLabel: string;    // denormalized for display / survives vehicle deletion
  category: RepairCategory;
  title: string;
  date: string;            // ISO date the service was performed
  mileage: number | null;  // odometer at service, if known
  cost: number | null;     // total cost, if known
  shop: string;            // where it was done ('DIY' is fine)
  notes: string;
}

export const REPAIR_CATEGORY_META: Record<RepairCategory, { label: string; icon: string }> = {
  oil:        { label: 'Oil & filter',  icon: 'oil_barrel' },
  tires:      { label: 'Tires',         icon: 'trip_origin' },
  brakes:     { label: 'Brakes',        icon: 'disc_full' },
  battery:    { label: 'Battery',       icon: 'battery_full' },
  fluids:     { label: 'Fluids',        icon: 'water_drop' },
  inspection: { label: 'Inspection',    icon: 'verified' },
  repair:     { label: 'Repair',        icon: 'build' },
  other:      { label: 'Other',         icon: 'more_horiz' },
};
