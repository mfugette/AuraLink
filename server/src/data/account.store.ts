// DB-backed account repository (Supabase Postgres). Replaces the former
// in-memory Maps. The public method surface is unchanged so the route layer
// stays thin; each method is scoped to an authenticated userId (auth.uid()).
//
// Identity is owned by Supabase Auth: `Account` is assembled from the `profiles`
// row plus the user's email from auth.users. All queries run through the
// service-role admin client (bypasses RLS); scoping to userId is the API's job.

import { supabaseAdmin } from './supabase';

export interface Account {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface SavedVehicle {
  id: string;
  accountId: string;
  nickname: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  subModel: string | null;
  engine: string | null;
  driveType: string | null;
  transmission: string | null;
  fuelType: string | null;
  bodyStyle: string | null;
  mileage: number | null;
  vin: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export interface AccountSettings {
  accountId: string;
  notifyEmail: boolean;
  notifySms: boolean;
  preferredUnits: 'imperial' | 'metric';
  theme: 'dark' | 'light';
}

// ── Row shapes (snake_case as stored) ───────────────────────────────────────
interface VehicleRow {
  id: string;
  user_id: string;
  nickname: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  sub_model: string | null;
  engine: string | null;
  drive_type: string | null;
  transmission: string | null;
  fuel_type: string | null;
  body_style: string | null;
  mileage: number | null;
  vin: string | null;
  is_primary: boolean;
  created_at: string;
}

interface SettingsRow {
  user_id: string;
  notify_email: boolean;
  notify_sms: boolean;
  preferred_units: 'imperial' | 'metric';
  theme: 'dark' | 'light';
}

function toVehicle(r: VehicleRow): SavedVehicle {
  return {
    id: r.id,
    accountId: r.user_id,
    nickname: r.nickname,
    year: r.year,
    make: r.make,
    model: r.model,
    subModel: r.sub_model,
    engine: r.engine,
    driveType: r.drive_type,
    transmission: r.transmission,
    fuelType: r.fuel_type,
    bodyStyle: r.body_style,
    mileage: r.mileage,
    vin: r.vin,
    isPrimary: r.is_primary,
    createdAt: r.created_at,
  };
}

function toSettings(r: SettingsRow): AccountSettings {
  return {
    accountId: r.user_id,
    notifyEmail: r.notify_email,
    notifySms: r.notify_sms,
    preferredUnits: r.preferred_units,
    theme: r.theme,
  };
}

// Strip undefined so a partial patch never overwrites a column with undefined.
function withoutUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

export const accountStore = {
  // ── Profile / account ──────────────────────────────────────────────────────
  async getAccount(userId: string): Promise<Account | null> {
    const [{ data: profile }, { data: userData }] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, display_name, created_at').eq('id', userId).maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(userId),
    ]);
    if (!profile) return null;
    return {
      id: profile.id,
      email: userData.user?.email ?? '',
      displayName: profile.display_name,
      createdAt: profile.created_at,
    };
  },

  async updateAccount(
    userId: string,
    patch: Partial<Pick<Account, 'displayName' | 'email'>>,
  ): Promise<Account | null> {
    // display_name lives on profiles; email lives on auth.users.
    if (patch.displayName !== undefined) {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ display_name: patch.displayName })
        .eq('id', userId);
      if (error) throw error;
    }
    if (patch.email !== undefined) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: patch.email });
      if (error) throw error;
    }
    return this.getAccount(userId);
  },

  // ── Vehicles ─────────────────────────────────────────────────────────────────
  async listVehicles(userId: string): Promise<SavedVehicle[]> {
    const { data, error } = await supabaseAdmin
      .from('vehicles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as VehicleRow[]).map(toVehicle);
  },

  async addVehicle(
    userId: string,
    input: Omit<SavedVehicle, 'id' | 'accountId' | 'createdAt'>,
  ): Promise<SavedVehicle> {
    // Only one primary per user — demote existing primary before inserting one.
    if (input.isPrimary) {
      await supabaseAdmin.from('vehicles').update({ is_primary: false }).eq('user_id', userId).eq('is_primary', true);
    }
    const { data, error } = await supabaseAdmin
      .from('vehicles')
      .insert({
        user_id: userId,
        nickname: input.nickname,
        year: input.year,
        make: input.make,
        model: input.model,
        sub_model: input.subModel,
        engine: input.engine,
        drive_type: input.driveType,
        transmission: input.transmission,
        fuel_type: input.fuelType,
        body_style: input.bodyStyle,
        mileage: input.mileage,
        vin: input.vin,
        is_primary: input.isPrimary,
      })
      .select('*')
      .single();
    if (error) throw error;
    return toVehicle(data as VehicleRow);
  },

  async updateVehicle(
    userId: string,
    vehicleId: string,
    patch: Partial<SavedVehicle>,
  ): Promise<SavedVehicle | null> {
    // Demote other primaries first if this update sets primary.
    if (patch.isPrimary) {
      await supabaseAdmin.from('vehicles').update({ is_primary: false }).eq('user_id', userId).eq('is_primary', true);
    }

    // Map camelCase patch → snake_case columns, dropping undefined.
    const row = withoutUndefined({
      nickname: patch.nickname,
      year: patch.year,
      make: patch.make,
      model: patch.model,
      sub_model: patch.subModel,
      engine: patch.engine,
      drive_type: patch.driveType,
      transmission: patch.transmission,
      fuel_type: patch.fuelType,
      body_style: patch.bodyStyle,
      mileage: patch.mileage,
      vin: patch.vin,
      is_primary: patch.isPrimary,
    });

    const { data, error } = await supabaseAdmin
      .from('vehicles')
      .update(row)
      .eq('id', vehicleId)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? toVehicle(data as VehicleRow) : null;
  },

  async removeVehicle(userId: string, vehicleId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .from('vehicles')
      .delete()
      .eq('id', vehicleId)
      .eq('user_id', userId)
      .select('id');
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  },

  // ── Settings ─────────────────────────────────────────────────────────────────
  async getSettings(userId: string): Promise<AccountSettings | null> {
    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ? toSettings(data as SettingsRow) : null;
  },

  async updateSettings(
    userId: string,
    patch: Partial<Omit<AccountSettings, 'accountId'>>,
  ): Promise<AccountSettings | null> {
    const row = withoutUndefined({
      notify_email: patch.notifyEmail,
      notify_sms: patch.notifySms,
      preferred_units: patch.preferredUnits,
      theme: patch.theme,
    });

    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .update(row)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? toSettings(data as SettingsRow) : null;
  },
};
