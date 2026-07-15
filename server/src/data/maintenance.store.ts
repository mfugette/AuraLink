// Routine maintenance checks, driven by repair-log mileage (NOT live telemetry —
// that path is deferred until the adapter exists). A maintenance_interval is a
// rule ("oil every N miles / M months"); "is it due?" is derived here from the
// vehicle's current mileage and the last matching repair.
//
// Same conventions as account.store.ts. The `due` computation is intentionally
// in the API (not the DB) so the rule can evolve without a migration.

import { supabaseAdmin } from './supabase';
import type { RepairCategory } from './repairs.store';

export interface MaintenanceInterval {
  id: string;
  vehicleId: string | null;      // null = applies to all the user's vehicles
  category: RepairCategory;
  label: string;
  intervalMiles: number | null;
  intervalMonths: number | null;
  lastDoneMiles: number | null;
  lastDoneDate: string | null;
  enabled: boolean;
}

// A computed check result for one interval against one vehicle.
export interface MaintenanceCheck extends MaintenanceInterval {
  vehicleLabel: string;
  currentMileage: number | null;
  // Miles/days remaining until due (negative = overdue); null if not computable.
  milesRemaining: number | null;
  daysRemaining: number | null;
  due: boolean;                  // true if overdue on either axis
}

interface IntervalRow {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  category: RepairCategory;
  label: string;
  interval_miles: number | null;
  interval_months: number | null;
  last_done_miles: number | null;
  last_done_date: string | null;
  enabled: boolean;
  created_at: string;
}

function toInterval(r: IntervalRow): MaintenanceInterval {
  return {
    id: r.id,
    vehicleId: r.vehicle_id,
    category: r.category,
    label: r.label,
    intervalMiles: r.interval_miles,
    intervalMonths: r.interval_months,
    lastDoneMiles: r.last_done_miles,
    lastDoneDate: r.last_done_date,
    enabled: r.enabled,
  };
}

function monthsBetween(fromISO: string, to: Date): number {
  const from = new Date(fromISO);
  const ms = to.getTime() - from.getTime();
  return ms / (1000 * 60 * 60 * 24 * 30.44); // avg month length
}

export const maintenanceStore = {
  async listIntervals(userId: string): Promise<MaintenanceInterval[]> {
    const { data, error } = await supabaseAdmin
      .from('maintenance_intervals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as IntervalRow[]).map(toInterval);
  },

  async addInterval(
    userId: string,
    input: Omit<MaintenanceInterval, 'id'>,
  ): Promise<MaintenanceInterval> {
    const { data, error } = await supabaseAdmin
      .from('maintenance_intervals')
      .insert({
        user_id: userId,
        vehicle_id: input.vehicleId,
        category: input.category,
        label: input.label,
        interval_miles: input.intervalMiles,
        interval_months: input.intervalMonths,
        last_done_miles: input.lastDoneMiles,
        last_done_date: input.lastDoneDate,
        enabled: input.enabled,
      })
      .select('*')
      .single();
    if (error) throw error;
    return toInterval(data as IntervalRow);
  },

  async removeInterval(userId: string, id: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('maintenance_intervals')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id');
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  },

  // Compute due/remaining for every enabled interval, per applicable vehicle,
  // using the vehicle's current mileage and the most recent matching repair.
  async checks(userId: string): Promise<MaintenanceCheck[]> {
    const now = new Date();

    const [intervalsRes, vehiclesRes, repairsRes] = await Promise.all([
      supabaseAdmin.from('maintenance_intervals').select('*').eq('user_id', userId).eq('enabled', true),
      supabaseAdmin.from('vehicles').select('id, nickname, year, make, model, mileage').eq('user_id', userId),
      supabaseAdmin
        .from('repairs')
        .select('vehicle_id, category, mileage, service_date')
        .eq('user_id', userId)
        .order('service_date', { ascending: false }),
    ]);
    if (intervalsRes.error) throw intervalsRes.error;
    if (vehiclesRes.error) throw vehiclesRes.error;
    if (repairsRes.error) throw repairsRes.error;

    const intervals = (intervalsRes.data as IntervalRow[]).map(toInterval);
    const vehicles = (vehiclesRes.data ?? []) as Array<{
      id: string; nickname: string | null; year: number | null;
      make: string | null; model: string | null; mileage: number | null;
    }>;
    const repairs = (repairsRes.data ?? []) as Array<{
      vehicle_id: string | null; category: RepairCategory;
      mileage: number | null; service_date: string;
    }>;

    const label = (v: (typeof vehicles)[number]): string =>
      v.nickname?.trim() || [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle';

    // Most recent repair (by service_date, already sorted desc) for a
    // (vehicle, category) pair — used as the "last done" baseline.
    const lastRepair = (vehicleId: string, category: RepairCategory) =>
      repairs.find(r => r.vehicle_id === vehicleId && r.category === category) ?? null;

    const out: MaintenanceCheck[] = [];

    for (const iv of intervals) {
      // An interval with a vehicle applies to that vehicle only; a null-vehicle
      // interval is a default that applies to every vehicle the user owns.
      const targets = iv.vehicleId ? vehicles.filter(v => v.id === iv.vehicleId) : vehicles;

      for (const v of targets) {
        const last = lastRepair(v.id, iv.category);
        // Baseline mileage/date the service was last done: prefer a logged repair,
        // fall back to the interval's manual last_done_* override.
        const baseMiles = last?.mileage ?? iv.lastDoneMiles ?? null;
        const baseDate = last?.service_date ?? iv.lastDoneDate ?? null;

        let milesRemaining: number | null = null;
        if (iv.intervalMiles != null && baseMiles != null && v.mileage != null) {
          milesRemaining = baseMiles + iv.intervalMiles - v.mileage;
        }

        let daysRemaining: number | null = null;
        if (iv.intervalMonths != null && baseDate != null) {
          const elapsedMonths = monthsBetween(baseDate, now);
          const remMonths = iv.intervalMonths - elapsedMonths;
          daysRemaining = Math.round(remMonths * 30.44);
        }

        const due =
          (milesRemaining != null && milesRemaining <= 0) ||
          (daysRemaining != null && daysRemaining <= 0);

        out.push({
          ...iv,
          vehicleLabel: label(v),
          currentMileage: v.mileage,
          milesRemaining,
          daysRemaining,
          due,
        });
      }
    }

    return out;
  },
};
