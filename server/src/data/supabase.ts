import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-side Supabase client using the service_role key. This BYPASSES Row
// Level Security — it's a trusted server. The key must only ever live in
// server/.env; never ship it to the client. All DB access from the API goes
// through this admin client, and the API is responsible for scoping every query
// to the authenticated user's id (see auth middleware + account.store).

const url = process.env['SUPABASE_URL'];
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!url || !serviceRoleKey) {
  // Fail fast with a clear message rather than a cryptic runtime error later.
  throw new Error(
    'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
      'in server/.env (see server/.env.example).'
  );
}

export const supabaseAdmin: SupabaseClient = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Verify a user access token (JWT) and return the user id it belongs to, or
 * null if the token is missing/invalid/expired. Uses the admin client's auth
 * endpoint, which validates the token against Supabase Auth.
 */
export async function getUserIdFromToken(token: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

/**
 * Re-verify a user's password server-side (for destructive actions like account
 * deletion). Uses a SEPARATE short-lived client (its own auth storage) so the
 * sign-in attempt never mutates the shared admin client's state. signInWithPassword
 * is a public auth endpoint, so the service-role key is fine here — we're only
 * checking the credential, not using elevated access. Returns true only if the
 * email + password authenticate.
 *
 * We re-check on the server (not just the client) so a valid-but-stolen session
 * token can't by itself delete an account — the caller must prove the password.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  if (!email || !password) return false;

  const client = createClient(url as string, serviceRoleKey as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  // Clean up the throwaway session created by a successful sign-in.
  if (data.session) await client.auth.signOut();
  return !error && !!data.user;
}
