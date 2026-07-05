import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

// Browser Supabase client using the anon public key. Safe to ship — access is
// governed by Row Level Security. Used for auth only (sign in/up/out, session);
// app data still flows through the Express API, not directly to Postgres.
export const supabase: SupabaseClient = createClient(
  environment.supabaseUrl,
  environment.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
