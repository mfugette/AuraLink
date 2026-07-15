// Per-user, per-day Aura message counter (server/db/migrations/0008_aura_usage.sql).
// Enforces the daily cap (config/access.ts). Aura itself stays stateless — this
// stores only a tally, never message content.

import { supabaseAdmin } from './supabase';

export const auraUsageStore = {
  // Today's count for a user (0 if no row yet).
  async todayCount(userId: string): Promise<number> {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const { data, error } = await supabaseAdmin
      .from('aura_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .maybeSingle();
    if (error) throw error;
    return data?.count ?? 0;
  },

  // Atomically increment today's count and return the NEW value. Uses a SQL
  // function (increment_aura_usage) for atomicity — a read-then-write in JS would
  // race under concurrent requests and let a user exceed the cap. See the
  // migration note below for the function definition.
  async increment(userId: string): Promise<number> {
    const { data, error } = await supabaseAdmin.rpc('increment_aura_usage', {
      p_user_id: userId,
    });
    if (error) throw error;
    return data as number;
  },
};
