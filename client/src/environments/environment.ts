// API base URL, resolved from the current host so the same build works on
// localhost and through a Cloudflare Tunnel without hardcoding a domain:
//   • localhost / 127.0.0.1  → http://localhost:3000 (local dev)
//   • any other host (e.g. auralink.vin) → https://api.<that host>
// Falls back to localhost when there's no window (SSR/tests).
function resolveApiUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3000';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3000';
  // Tunnel/prod: the API lives on the `api.` subdomain of the same root domain.
  const root = host.replace(/^www\./, '');
  return `https://api.${root}`;
}

export const environment = {
  production: false,
  apiUrl: resolveApiUrl(),
  // From Supabase Dashboard → Project Settings → API. The anon key is safe to
  // ship in the client — it only grants access allowed by Row Level Security.
  supabaseUrl: 'https://uemwlnlqbnjstbnawsxf.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlbXdsbmxxYm5qc3RibmF3c3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwOTAxNzcsImV4cCI6MjA5ODY2NjE3N30.aZcmxFTE4ggbdNheIVEtbZn804LfvaWTuPah-lD7PeU',
  // Browser key for the Maps JavaScript SDK (embedded map). Restrict it by
  // HTTP referrer in Google Cloud Console. Separate from the server key.
  googleMapsBrowserKey: 'AIzaSyAkleMw64l1-jouWqYInsaFvOFZRnZ-MfM',
};
