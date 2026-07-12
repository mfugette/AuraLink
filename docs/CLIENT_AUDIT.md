# Client Audit — Tests, Security, Best Practices, SOLID

_Date: 2026-07-12. Scope: `client/` only. No UI changes were made._

## 1. Test suite

**262 tests across 47 spec files — all passing** (`ng test --watch=false --browsers=ChromeHeadless`, requires `CHROME_BIN`).

| Layer | Coverage |
|---|---|
| Services (18 specs) | tier quota/persistence, DTC lookup/search, toast lifecycle, theme precedence + account sync, assistant streaming/quota/XSS-adjacent fetch contract, account HTTP contract + error flags, session/telemetry mock invariants, inbox, checkout, subscription lifecycle, notification list-building, parts params, repair-log persistence, places/geolocation, NHTSA decode + normalizers, auth (spied Supabase) |
| Guards / interceptors / pipes | authGuard wait-and-redirect, requireTier redirect URL, bearer-token scoping (never leaks to third parties), error-toast mapping + 401 force-sign-out + SKIP_ERROR_TOAST, **aura-terminal XSS escaping** |
| Shared components (14 specs) | icon (+ **registry-completeness test** covering every icon name the app uses), custom-select CVA, code-entry validation/keyboard, sidebar tier locks, ai-search handoff, toast-host online/offline, notifications filters, code-results, live-dtc timers, parts-locator filters, session-history sort/filter/drill-in, repair-log, vehicle-selector seeding, account panels |
| Pages (15 specs) | home hero stats/aura summary/scroll-lock gating, assistant terminal + **innerHTML XSS test**, my-vehicles slot math, vehicle-editor validation/navigation, part-lookup/faq/issue-history filtering, history tabs, plan/checkout/my-plan commerce flows, login modes, dashboard, misc smoke |

Shared helpers live in `src/testing/test-utils.ts` (`createMockAuth`, `provideMockAuth`, `clearAppStorage`). The testing dir is excluded from the app build (`tsconfig.app.json`).

## 2. Security review — PASS

| Check | Result |
|---|---|
| `[innerHTML]` sinks | Only 2. Assistant terminal goes through `AuraTerminalPipe`, which **HTML-escapes before transforming** (spec-pinned). FAQ answers are static authored strings and pass through Angular's built-in sanitizer. |
| `bypassSecurityTrustHtml` | 1 use (the pipe above), justified and tested. |
| `eval` / `new Function` / `document.write` | None. |
| Secrets in bundle | Only the Supabase **anon** key and the **browser-restricted** Maps key — both designed to ship. Service-role/Gemini/CarAPI keys are server-side only. |
| Token handling | JWT lives in the Supabase client session; the interceptor attaches it **only to `environment.apiUrl` requests** (spec: never leaks to NHTSA/third parties). `withCredentials` scoped the same way. |
| localStorage | Preferences only (`tier`, `theme`, `sms-prefs`, `repairs`, `ai-usage`) — no tokens, no PII beyond user-authored repair notes. All reads tolerate corrupted values. |
| 401 handling | Force sign-out on our-API 401 so the UI can't sit half-authenticated (spec-pinned). |
| External links | `target="_blank"` carries `rel="noopener noreferrer"`. |
| Password fields | Proper `autocomplete` (`current-password` / `new-password`) everywhere. |
| Guards | Comments + specs are explicit that route guards are **UX, not security**; enforcement is server-side (`requireAuth` + RLS). |

Standing risks (known, by design, documented in code): tier/quota enforcement is client-side until billing exists; the desktop-terminal contract keeps `/api/assistant/chat` stateless with Bearer JWT.

## 3. Frontend best practices

- **Standalone components + signals** throughout; no NgModules; `inject()` over constructor-injection in newer code.
- OnPush-equivalent behavior via signals; hand-rolled SVG charts avoid heavy chart deps.
- HTTP flows through two typed interceptors; services expose signals, components stay thin.
- Fixed in this pass: removed dead `AuraMarkdownPipe`, dead `.logo-text` / `.hero-actions` CSS, stale comments/TODOs, a 31-file stray-`\r` artifact from the icon migration, and **11 icon names used at runtime but missing from the registry** (sort arrows, camera scan, expand_less, my-plan status icons, etc.) — now guarded by a registry-completeness spec.

## 4. SOLID review

**Generally respected.** Services are single-purpose (Tier, Theme, Toast, Dtc, Session, Telemetry…), components depend on service abstractions via DI, and the icon registry is open/closed (add glyphs without touching the component).

Noted deviations — all deliberate, low-risk, documented here rather than refactored (refactors would churn a working app for no behavioral gain):

1. **`TierService`** carries both tier state and the AI-message quota (two reasons to change). Acceptable while both are localStorage stand-ins; split when server-side billing/quota lands.
2. **`AccountService.exportData()`** manipulates the DOM (anchor download) inside a data service — pragmatic for a one-off; extract a download helper if a second exporter appears.
3. **`ThemeService` ↔ `AccountService`** bidirectional-ish coupling (theme reads settings signal, writes settings on change). Contained and spec-pinned.
4. **`VehicleSelectorComponent`** is large (NHTSA cascade + VIN scan + trims). It is the shared seam used by Home and the editor; splitting it risks the two consumers drifting.
5. Legacy constructor-injection remains in a few older services/components — consistent within each file; not worth churn.

## 5. Follow-ups worth considering

- Add a `test` CI step (needs `CHROME_BIN` or a container with Chrome).
- Wire ESLint (`ng lint` has no config today) — the codebase would pass with minor warnings.
- When billing lands: move tier/quota enforcement server-side and split quota out of `TierService` (see §4.1).
