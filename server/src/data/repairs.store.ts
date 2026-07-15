// DB-backed repair/service log repository. Backs the client RepairLogService.
// Mirrors RepairRecord (client/src/app/models/repair.model.ts) — note the DB
// column is `service_date` but the API field is `date` (mapped here). Same
// conventions as account.store.ts.

import { supabaseAdmin } from './supabase';

export type RepairCategory =
  | 'oil' | 'tires' | 'brakes' | 'battery' | 'fluids' | 'inspection' | 'repair' | 'other';

export interface RepairRecord {
  id: string;
  vehicleId: string | null;
  vehicleLabel: string;
  category: RepairCategory;
  title: string;
  date: string;            // service date (maps to service_date)
  mileage: number | null;
  cost: number | null;
  shop: string;
  notes: string;
}

interface RepairRow {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  vehicle_label: string;
  category: RepairCategory;
  title: string;
  service_date: string;
  mileage: number | null;
  cost: number | null;
  shop: string;
  notes: string;
  created_at: string;
}

function toRepair(r: RepairRow): RepairRecord {
  return {
    id: r.id,
    vehicleId: r.vehicle_id,
    vehicleLabel: r.vehicle_label,
    category: r.category,
    title: r.title,
    date: r.service_date,
    mileage: r.mileage,
    // numeric comes back as a string from pg — coerce to number (or null).
    cost: r.cost === null ? null : Number(r.cost),
    shop: r.shop,
    notes: r.notes,
  };
}

export const repairsStore = {
  async list(userId: string): Promise<RepairRecord[]> {
    const { data, error } = await supabaseAdmin
      .from('repairs')
      .select('*')
      .eq('user_id', userId)
      .order('service_date', { ascending: false });
    if (error) throw error;
    return (data as RepairRow[]).map(toRepair);
  },

  async add(
    userId: string,
    input: Omit<RepairRecord, 'id'>,
  ): Promise<RepairRecord> {
    const { data, error } = await supabaseAdmin
      .from('repairs')
      .insert({
        user_id: userId,
        vehicle_id: input.vehicleId,
        vehicle_label: input.vehicleLabel,
        category: input.category,
        title: input.title,
        service_date: input.date,
        mileage: input.mileage,
        cost: input.cost,
        shop: input.shop,
        notes: input.notes,
      })
      .select('*')
      .single();
    if (error) throw error;
    return toRepair(data as RepairRow);
  },

  async remove(userId: string, id: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('repairs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id');
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  },
};
