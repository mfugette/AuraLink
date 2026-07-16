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

## Files touched (for review) — landed in `e1cede1`
Modified: `pages/home/home-page.component.{html,ts,scss}`,
`pages/part-lookup/part-lookup-page.component.{ts,html,scss,spec.ts}`.
Deleted: `data/parts-catalog.ts`.
(`app.routes.ts` was touched only by the temporary verify alias, which is reverted
— it shows no diff.)

These sit on `feat/db-backing-pass` alongside the earlier DB-backing + UI passes
(see `HANDOFF_DB_BACKING.md`); this parts work is a separate, self-contained change.

---

## UI polish pass — Part Lookup on the console layout (2026-07-16, session 2)
A follow-up **UI-only** pass on the same branch. No server / DB / API-contract
changes; only the `parts-locator` component (now the single surface using it) and
the Part Lookup page host were touched. The functional behaviour (eBay search,
vehicle scope, DTC hand-off, send-list) is unchanged.

### What changed & why
The locator had been dropped onto Part Lookup as-is (rounded shadowed SaaS cards,
whole-page scroll, filters stacked above a gappy grid) and didn't match the app's
instrument-console / terminal design language. This pass conforms it:

- **Only the parts grid scrolls.** The locator is now a flex column filling its
  host: a **fixed control strip** (`.results-bar` — listing count · selected
  total · filters) stays put, the grid scrolls inside `.results-scroll`, and the
  send-list panel is a **fixed footer** below the scroll region. The page host
  (`.parts-body`) no longer owns scroll — it's a viewport-locked flex host.
- **Filters moved to the far right of the control strip** (`margin-left:auto`),
  restyled as compact 26px squared mono chips with tinted-active states. The
  strip's bottom hairline is **full-bleed** (pulled to both gutters) so it spans
  the width and reads as the grid's top seam.
- **Blocky hairline grid packed edge-to-edge.** `grid-template-columns:
  repeat(auto-fill, minmax(220px, 1fr))`, `grid-auto-rows: minmax(300px, 1fr)`,
  `flex:1` so rows **share the height and grow to reach the pager** (no dead
  band) — same idea as the metric grids. Square cards, no shadow, no hover-lift
  (hover just tints; selected = inset blue ring so geometry never shifts).
- **Per-part group headings removed** — a single flat grid over the paginated
  list, so cards sit directly beneath the filter row. (The `groupedResults`
  getter was deleted; multi-part DTC hand-offs now interleave by page.)
- **Pagination** — `pageSize = 12`; a **fixed 48px `.pager-bar`** above the footer
  shows `start–end of N` + `‹ 1 2 … N ›` (mono, tinted active page, disabled
  ends). Page resets to 1 on any filter change / new search; `currentPage` is
  clamped so a shrinking filtered set never strands you past the last page.
- **Uniform card heights.** `.part-info` is a fixed **112px** block: the title
  always reserves **2 lines** (`height: calc(0.78rem*1.4*2)`), badges are a
  **single clipped line** (`flex-wrap:nowrap`, 18px). The image
  (`.part-image-wrap`) flexes to absorb the row's extra height (min 180px), so a
  short result set grows **bigger images**, not emptier cards. `.part-info` is
  `flex:0 0 auto`; the image track/placeholder use `position:absolute; inset:0`.
- **Empty area matches the "no search" ground.** Hairlines are drawn on the
  **cards** (`border-right`/`border-bottom`), not via a background-bleed, and the
  grid/scroll background is `--obd-bg` — so an incomplete last row or between-page
  space reads as the plain app background (`#0b0d11`), not grey seams.

### Files touched (this pass) — committed this session
Modified: `components/parts-locator/parts-locator.component.{ts,html,scss,spec.ts}`,
`pages/part-lookup/part-lookup-page.component.scss`.
Added 4 pagination unit tests (pageSize/window, clamp, filter-resets-page,
shrink-below-current-page).

### Verification
- `ng build --configuration development` clean.
- `parts-locator` spec **11/11**, `part-lookup` spec green (19/19 across both).
- **Not runtime-driven in a browser this pass** — `/part-lookup` is auth-gated and
  no Playwright/browser-driver was available in the session; confirmation rests on
  the compile + test pass and the user's live `ng serve` view (iterated against
  screenshots). If revisiting, drive it via a temporary unguarded alias (added +
  reverted) as the original pass did, or while signed in.

### Open items / next steps
1. **Card proportions are a visual judgment.** With 12 items over ~2 rows in a tall
   viewport the images get large; if that reads sparse, either raise the row floor
   cap or bump `pageSize`. Left at `minmax(300px,1fr)` / `pageSize=12`.
2. The fixed **112px** `.part-info` height is a best-fit estimate — watch for a
   clipped badge line / title at unusual font scales.
