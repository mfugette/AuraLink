# Handoff — Part Lookup as the live parts-search surface (2026-07-16)

State of the "make Part Lookup the real parts page + route the DTC flow to it"
work, for the next session's agent. Read this first.

## What changed & why
The DTC "Find Parts" step used to render live eBay listings **inline** at the
bottom of the Home code-lookup flow (Step 4). Part Lookup (`/part-lookup`) was a
separate page that only browsed a **static local catalog** with no images, no
vehicle scoping, and no live listings. The two never met.

This pass unifies them:
- **Part Lookup is now the single live parts-search surface.** It searches eBay
  by part name, scopes results to a vehicle (saved-vehicle picker **or** manual
  year/make/model), and shows images + the full listing filters.
- **The DTC flow routes into it instead of showing listings inline.** Home Step 4
  is now a **"Find these parts →"** button that navigates to `/part-lookup`
  carrying the selected part names + current vehicle; the page pre-runs the search
  on arrival.
- **The static catalog is gone.** Product decision (locked with the user): the
  page must *never* show generic catalog cards — only real listings for a real
  part, from a direct search or a DTC hand-off.

## Product decisions locked this pass (context)
- **No generic/catalog cards, ever.** `client/src/app/data/parts-catalog.ts` was
  deleted (it had no other importers). If you want a "browse common parts" mode
  later, it must resolve to real listings, not a seed list.
- **DTC hand-off carries the full selected-parts list + the vehicle** (not just
  the first part).
- **Vehicle scoping = saved-vehicle picker + manual entry.** Primary saved
  vehicle is available in the picker; manual is a year/make/model row.
- **`/part-lookup` stays behind `authGuard`** (unchanged). A signed-out guest who
  selects parts in the Home DTC flow and clicks "Find these parts" is redirected
  to `/home` by the guard. See the open UX item below.

## What was built

### Client — modified
- **`pages/part-lookup/part-lookup-page.component.ts`** — rewritten. Was a
  `PARTS_CATALOG` filter/grid; now:
  - `query` (search input) → `submitSearch()` comma-splits into `partNames`.
  - Vehicle scope: `savedVehicles` (from `AccountService.vehicles`),
    `selectedVehicleId`, `manualMode` + `manualYear/Make/Model`. The `vehicle`
    computed resolves to the picked saved vehicle, else the manual fields, else
    empty. `SavedVehicle`→`Vehicle` via `toVehicle()`.
  - `ngOnInit` reads the DTC hand-off from
    `router.getCurrentNavigation()?.extras.state ?? window.history.state`
    (`{ partNames, vehicle }`), pre-fills the query, and `adoptVehicle()` matches
    the handed-off vehicle to a saved one (highlights that chip) or drops it into
    the manual fields.
  - Renders `<app-parts-locator [partNames] [vehicle]>` — **all** the eBay search,
    filters, image carousel, and send-list logic is **reused** from the existing
    locator component, not duplicated.
  - Re-scoping trick: changing the vehicle re-emits `partNames` via
    `this.partNames.set([...this.partNames()])` so the locator's `ngOnChanges`
    fires a fresh search.
- **`pages/part-lookup/part-lookup-page.component.html`** — keeps the `PARTS`
  pixel-title header + console toolbar shell (the look the user wanted preserved).
  Toolbar = `parts$` terminal search + a vehicle-scope chip row (saved vehicles +
  "Manual" toggle + clear). A manual year/make/model bar appears below the toolbar
  when Manual is active. Body = `<app-parts-locator>` when a search is active,
  else an empty prompt.
- **`pages/part-lookup/part-lookup-page.component.scss`** — kept the header +
  terminal-search styling; added vehicle-scope chips, manual bar, and a body
  container; **removed** the old catalog `.part-cell`/grid styles (the locator
  brings its own result styling).
- **`pages/home/home-page.component.html`** — Step 4 is now a `.find-parts-handoff`
  block (selected-parts chips + a **"Find these parts →"** `.find-parts-btn`)
  instead of the inline `<app-parts-locator>`.
- **`pages/home/home-page.component.ts`** — added `goToPartLookup()`
  (`router.navigate(['/part-lookup'], { state: { partNames, vehicle } })`); removed
  the now-unused `PartsLocatorComponent` import + `imports[]` entry.
- **`pages/home/home-page.component.scss`** — added `.find-parts-handoff` /
  `.handoff-chip` / `.find-parts-btn` styles.
- **`pages/part-lookup/part-lookup-page.component.spec.ts`** — rewritten for the
  new behavior (search comma-split, vehicle scope select/manual/clear, `vehicle()`
  computed, `vehicleName`). Old catalog-grid tests removed.

### Client — deleted
- **`data/parts-catalog.ts`** — the static seed catalog (`CatalogPart`,
  `PART_CATEGORIES`, `PARTS_CATALOG`). No other importers.

### Unchanged (reused as-is)
- **`components/parts-locator/`** — the eBay searcher (search + condition/rating/
  price/free-shipping/best-offer filters + image carousel + send-list). Zero
  changes; it just moved from "inline on Home" to "hosted by Part Lookup." The
  send-list guest/signed-in handling carries over.
- **`services/parts.service.ts`**, **`server/src/routes/parts.route.ts`** — the
  eBay `/api/parts/search` contract is untouched.

## Verification (done this pass)
- **Full client suite: 267 passing / 0 failing** headless
  (`CHROME_BIN=… ng test --watch=false --browsers=ChromeHeadless`). Chrome at
  `C:\Program Files\Google\Chrome\Application\chrome.exe`.
- **Typecheck clean** (`tsc --noEmit` on `tsconfig.app.json` + `tsconfig.spec.json`).
- **Prod build compiles** (`ng build --configuration development`).
- **Runtime-verified in a real browser** (Playwright + system Chrome, `ng serve`
  :4210):
  - Guest DTC flow → Step 4 shows the "Find these parts" button with the selected
    part chip; clicking it (as a guest) is correctly bounced to `/home` by the
    guard. No page errors.
  - Part Lookup: empty prompt; direct search renders listings **with images** +
    the filter bar; selecting a saved vehicle re-scopes the eBay query
    (`year/make/model` sent); manual entry re-scopes; a condition filter narrows
    results. DTC hand-off state adoption confirmed (part chips + prefilled query +
    vehicle-scoped search).
  - `/part-lookup` is guarded, so it was driven via a **temporary unguarded alias
    route** that was added, driven, and **reverted** — `app.routes.ts` has no diff.

## Open items / next steps
1. **Guest UX dead-end (⚠️ recommended).** A signed-out guest who selects parts in
   the Home DTC flow and clicks "Find these parts" is silently redirected to
   `/home` by `authGuard`. Options: (a) show a "sign in to look up parts" cue on
   the button for guests, or (b) open `/part-lookup` to guests (the send-list
   already handles guest vs. signed-in). Product call — left as-is this pass
   (guard kept).
2. **Multi-part search cost.** A DTC hand-off with N selected parts fires N eBay
   `/api/parts/search` calls (the locator forkJoins them). Fine for a few parts;
   watch the `expensiveLimiter` (20 req/min/IP) if a user selects many.
3. **CarAPI-backed catalog (optional, later).** The old seed catalog is gone. If a
   "browse by category" mode is ever wanted, back it with real listings — do not
   reintroduce a static seed.

## Files touched (for review) — NOT yet committed
Modified: `pages/home/home-page.component.{html,ts,scss}`,
`pages/part-lookup/part-lookup-page.component.{ts,html,scss,spec.ts}`.
Deleted: `data/parts-catalog.ts`.
(`app.routes.ts` was touched only by the temporary verify alias, which is reverted
— it should show no diff.)

These sit on `feat/db-backing-pass` alongside the earlier DB-backing + UI passes
(see `HANDOFF_DB_BACKING.md`); this parts work is a separate, self-contained change.
