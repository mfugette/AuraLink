export const environment = {
  production: true,
  apiUrl: 'https://your-api-domain.com',
  // From Supabase Dashboard → Project Settings → API. The anon key is safe to
  // ship in the client — it only grants access allowed by Row Level Security.
  supabaseUrl: 'https://your-project-ref.supabase.co',
  supabaseAnonKey: 'your-anon-public-key',
  // Browser key for the Maps JavaScript SDK (embedded map). Restrict by HTTP
  // referrer in Google Cloud Console. Separate from the server key.
  googleMapsBrowserKey: 'your-google-maps-browser-key',
};
