import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';

// Nearby automotive-services finder. Proxies Google Maps Platform so the API key
// stays server-side (like the eBay/CarAPI keys). Two capabilities:
//   • geocode a zip/address → { lat, lng }  (Geocoding API)
//   • find nearby places of a category      (Places API New: searchNearby)
//
// The client sends either coordinates (from browser geolocation) or a zip; this
// route resolves a zip to coordinates first, then runs the nearby search.
//
// Find Help is a signed-in-only page, so this route requires auth — both to
// mirror that gating on the server (the real security boundary, unlike the
// client route guard) and to keep the billed Google Maps quota from being hit
// by unauthenticated callers.

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

// Our service categories → Google Places primary types (used with searchNearby).
// https://developers.google.com/maps/documentation/places/web-service/place-types
//
// Google applies primary types loosely for automotive businesses: tire shops,
// parts retailers, and quick-lube chains commonly carry `car_repair` in
// addition to their own type, and `auto_parts_store` picks up tire shops the
// same way. Verified live: `car_repair` and `auto_parts_store` both returned
// mixed results (AutoZone/Discount Tire under "mechanic"; Firestone/tire shops
// under "parts"). Only `tire_shop` came back clean. So mechanic/tow/parts use
// keyword search (searchText) instead of type filtering; tire stays type-based.
const CATEGORY_TYPES: Record<string, string[]> = {
  tire: ['tire_shop'],
};

const CATEGORY_TEXT_QUERY: Record<string, string> = {
  mechanic: 'auto repair mechanic',
  tow: 'tow truck towing service',
  parts: 'auto parts store',
};

interface GeocodeResponse {
  status: string;
  results: Array<{ geometry: { location: { lat: number; lng: number } }; formatted_address: string }>;
}

interface PlacesNearbyResponse {
  places?: Array<{
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    rating?: number;
    userRatingCount?: number;
    nationalPhoneNumber?: string;
    currentOpeningHours?: { openNow?: boolean };
    googleMapsUri?: string;
  }>;
}

function apiKey(): string {
  const key = process.env['GOOGLE_MAPS_API_KEY'];
  if (!key) throw new Error('GOOGLE_MAPS_API_KEY must be set in .env');
  return key;
}

async function geocode(query: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
  // Google's Geocoding API often returns ZERO_RESULTS for a bare 5-digit zip
  // passed as a free-text `address` (it prefers fuller addresses). The fix is
  // to pass it via the structured `components=postal_code:` filter instead,
  // which resolves reliably. Fall back to free-text address search otherwise.
  const isBareZip = /^\d{5}(-\d{4})?$/.test(query.trim());
  const params = isBareZip
    ? new URLSearchParams({ components: `postal_code:${query.trim()}`, key: apiKey() })
    : new URLSearchParams({ address: query, key: apiKey() });

  const resp = await fetch(`${GEOCODE_URL}?${params}`);
  if (!resp.ok) throw new Error(`Geocoding failed (${resp.status})`);
  const data = (await resp.json()) as GeocodeResponse;
  if (data.status !== 'OK' || !data.results.length) return null;
  const r = data.results[0];
  return { lat: r.geometry.location.lat, lng: r.geometry.location.lng, formatted: r.formatted_address };
}

function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8; // earth radius, miles
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const placesRouter = Router();

// Every places route is signed-in only.
placesRouter.use(requireAuth);

// GET /api/places/search?category=mechanic&lat=..&lng=..   (coords)
//     /api/places/search?category=mechanic&zip=90210        (zip/address)
placesRouter.get('/search', async (req: Request, res: Response) => {
  const { category, lat, lng, zip, radius } = req.query as Record<string, string>;

  const types = CATEGORY_TYPES[category ?? ''];
  const textQuery = CATEGORY_TEXT_QUERY[category ?? ''];
  if (!types && !textQuery) {
    const known = [...Object.keys(CATEGORY_TYPES), ...Object.keys(CATEGORY_TEXT_QUERY)];
    res.status(400).json({ error: `Unknown category. Use one of: ${known.join(', ')}`, places: [] });
    return;
  }

  try {
    // Resolve an origin: prefer explicit coords, else geocode the zip/address.
    let origin: { lat: number; lng: number } | null = null;
    let resolvedLocation: string | null = null;

    if (lat && lng) {
      const latN = parseFloat(lat);
      const lngN = parseFloat(lng);
      // Reject non-numeric or out-of-range coordinates before hitting Google.
      if (!Number.isFinite(latN) || !Number.isFinite(lngN) ||
          latN < -90 || latN > 90 || lngN < -180 || lngN > 180) {
        res.status(400).json({ error: 'Invalid coordinates.', places: [] });
        return;
      }
      origin = { lat: latN, lng: lngN };
    } else if (zip) {
      const geo = await geocode(zip);
      if (!geo) {
        res.status(404).json({ error: 'Could not find that location.', places: [] });
        return;
      }
      origin = { lat: geo.lat, lng: geo.lng };
      resolvedLocation = geo.formatted;
    } else {
      res.status(400).json({ error: 'Provide either lat/lng or a zip.', places: [] });
      return;
    }

    const radiusMeters = Math.min(Math.max(parseInt(radius ?? '16000', 10) || 16000, 1000), 50000);
    const fieldMask =
      'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.currentOpeningHours.openNow,places.googleMapsUri';

    // Type-based categories use searchNearby; categories with no reliable Places
    // type (currently just "tow") use searchText with a location bias instead.
    const resp = types
      ? await fetch(NEARBY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey(),
            'X-Goog-FieldMask': fieldMask, // keeps the response (and billing SKU) lean
          },
          body: JSON.stringify({
            includedPrimaryTypes: types,
            maxResultCount: 20,
            locationRestriction: {
              circle: { center: { latitude: origin.lat, longitude: origin.lng }, radius: radiusMeters },
            },
          }),
        })
      : await fetch(TEXT_SEARCH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey(),
            'X-Goog-FieldMask': fieldMask,
          },
          body: JSON.stringify({
            textQuery,
            maxResultCount: 20,
            locationBias: {
              circle: { center: { latitude: origin.lat, longitude: origin.lng }, radius: radiusMeters },
            },
          }),
        });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[Places] Nearby failed (${resp.status}):`, body);
      res.status(502).json({ error: 'Nearby search failed.', places: [] });
      return;
    }

    const data = (await resp.json()) as PlacesNearbyResponse;
    const places = (data.places ?? []).map(p => {
      const plat = p.location?.latitude ?? origin!.lat;
      const plng = p.location?.longitude ?? origin!.lng;
      return {
        id: p.id,
        name: p.displayName?.text ?? 'Unknown',
        address: p.formattedAddress ?? '',
        latitude: plat,
        longitude: plng,
        distanceMiles: Math.round(haversineMiles(origin!.lat, origin!.lng, plat, plng) * 10) / 10,
        rating: p.rating ?? null,
        ratingCount: p.userRatingCount ?? 0,
        phone: p.nationalPhoneNumber ?? null,
        openNow: p.currentOpeningHours?.openNow ?? null,
        mapsUrl: p.googleMapsUri ?? null,
      };
    });

    // Nearest first.
    places.sort((a, b) => a.distanceMiles - b.distanceMiles);

    res.json({ origin, resolvedLocation, places });
  } catch (err: unknown) {
    // Log detail server-side; return a generic message (don't leak internals).
    console.error('[Places]', err instanceof Error ? err.message : String(err));
    res.status(500).json({ error: 'Nearby search failed.', places: [] });
  }
});
