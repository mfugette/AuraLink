# Nearby Services / Google Maps Setup

The **Find Help Nearby** page (`/nearby`) locates mechanics, tow services, tire
shops, and auto parts stores. It uses Google Maps Platform. You need **two keys**
(server + browser) and **three APIs enabled**.

## 1. Enable APIs (Google Cloud Console → APIs & Services → Library)

| API | Used for |
|-----|----------|
| **Places API (New)** | Nearby search (server-side) |
| **Geocoding API** | Turning a typed zip/address into coordinates (server-side) |
| **Maps JavaScript API** | The embedded map with pins (browser-side) |

> Billing must be enabled on the project. Google gives a recurring **$200/mo
> free credit**, which covers roughly a few thousand searches/month.

## 2. Create two keys (APIs & Services → Credentials)

**Server key** — restrict to *Places API (New)* + *Geocoding API*. No referrer
restriction (it's called from your backend). Put in `server/.env`:
```
GOOGLE_MAPS_API_KEY=your-server-key
```

**Browser key** — restrict to *Maps JavaScript API*, and add an **HTTP referrer**
restriction (e.g. `http://localhost:4200/*` for dev, plus your prod domain). This
key ships in the client, so the referrer restriction is what protects it. Put in
`client/src/environments/environment.ts` (and `environment.prod.ts`):
```ts
googleMapsBrowserKey: 'your-browser-key',
```

## 3. How it works

- **Location**: the user clicks **Use my location** (browser geolocation) or
  types a **zip/address**. Coordinates go straight to the search; a zip is
  geocoded to coordinates by the server first.
- **Search**: the client calls `GET /api/places/search?category=…&lat=…&lng=…`
  (or `&zip=…`). The Express route (`server/src/routes/places.route.ts`) calls
  Google Places with the **server key**, computes distance, sorts nearest-first,
  and returns a clean list. The Google key never reaches the browser.
- **Categories** map to Places types: `mechanic→car_repair`, `tow→towing_service`,
  `tire→tire_shop`, `parts→auto_parts_store`.
- **Map**: `GoogleMapsLoader` lazily injects the Maps JS SDK (browser key) only on
  this page; pins are dropped for each result plus a distinct marker for the
  user's location. The list works even if the map fails to load.

## 4. Test

1. Add both keys (step 2), restart `npm run dev`.
2. Open **Find Help** in the sidebar.
3. Enter a zip (e.g. `90210`) and press search, or click **Use my location**.
4. You should get distance-sorted cards (name, rating, distance, phone,
   Directions) and pins on the map. Switch category tabs to re-search.

## Notes / future

- **AI hook (later)**: the eventual AI assistant can deep-link here when a
  diagnosis needs a professional (e.g. "this needs a mechanic → Find Help").
- **Deploy**: set the browser key's referrer restriction to your production
  domain, and set `environment.prod.ts` `apiUrl` + `googleMapsBrowserKey`.
- **Tow uses text search, not type search.** Google Places has no dedicated
  "towing" place type — real tow companies come back typed as the generic
  `service`, too broad to filter on `searchNearby`. The `tow` category instead
  calls `searchText` with a location bias (query: "tow truck towing service").
  Verified live: 20 real results near a test zip. Mechanic/tire/parts still use
  type-based `searchNearby` (`car_repair` / `tire_shop` / `auto_parts_store`).
- **Bare zip codes need the `postal_code:` component filter.** Google's
  Geocoding API returns `ZERO_RESULTS` for a bare 5-digit zip passed as a plain
  `address` string (it wants fuller addresses). The route detects a bare zip
  (`/^\d{5}(-\d{4})?$/`) and geocodes it via `components=postal_code:<zip>`
  instead, which resolves reliably. Full addresses still use plain `address=`.
