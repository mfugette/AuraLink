# AuraLink — Architecture UML

_Mermaid class diagrams. Render in any Mermaid-aware viewer (GitHub, VS Code)._
_Generated 2026-07-12 from the current source; regenerate when the shape changes._

## Client (Angular 21)

```mermaid
classDiagram
direction LR

%% ── Shell ────────────────────────────────────────────────
class App {
  +sidebarCollapsed: signal
  +mobileDrawerOpen: signal
  +logoAura / logoLink (block figlet)
}
class SidebarComponent { +items: NavItem[] +locked(item) }
class AiSearchComponent { +activate() +send() }
class AccountMenuComponent
class NotificationsComponent { +items() +markAllRead() }
class ToastHostComponent

App --> SidebarComponent
App --> AiSearchComponent
App --> AccountMenuComponent
App --> NotificationsComponent
App --> ToastHostComponent

%% ── Cross-cutting ───────────────────────────────────────
class AuthService {
  +user / isSignedIn / initializing: signal
  +accessToken: string?
  +signIn() signUp() signOut()
  +verifyPassword()
}
class authInterceptor {
  attaches Bearer to apiUrl only
  withCredentials for CF Access
}
class errorInterceptor {
  toast on API errors
  401 → forced signOut
  SKIP_ERROR_TOAST context
}
class authGuard { waits initializing → allow | /home }
class requireTier { feature gate → /plan?locked=f }

AuthService <.. authInterceptor
AuthService <.. errorInterceptor
AuthService <.. authGuard
TierService <.. requireTier

%% ── Domain services (signal state) ──────────────────────
class AccountService {
  +account / vehicles / settings: signal
  +loadAll() clear()
  +fetch/add/update/removeVehicle()
  +exportData() deleteAccount()
}
class TierService {
  +tier: signal<free|plus|pro>
  +can(feature) maxVehicles
  +aiMessagesRemaining() recordAiMessage()
}
class SubscriptionService {
  +subscription / history: signal
  +recordPurchase() cancel() resume()
}
class CheckoutService { +order: signal +stage() clear() }
class AssistantService {
  +messages / thinking: signal
  +queue() takePending() send() [streams fetch]
  -buildContext()
}
class SessionService { +sessions: signal<DriveSession[]> (mock) }
class TelemetryService { +metrics: MetricDef[] +series: signal +start() stop() (mock feed) }
class DtcService { +lookup() search() lookupMany() }
class InboxService { +notifications / smsPrefs: signal +markRead() }
class ToastService { +toasts / offline: signal +show() dismiss() }
class ThemeService { +theme: signal +toggle() [syncs account settings] }
class VehicleService { +decodeVin() getMakes/Models/Trims() }
class PartsService { +searchParts() }
class ServicesService { +searchByCoords/Zip() +getCurrentPosition() }
class NotificationService { +send() buildShoppingList() }
class RepairLogService { +records: signal +add() remove() }
class GoogleMapsLoader { +load() [lazy SDK] }

AssistantService --> AuthService
AssistantService --> AccountService
AssistantService --> TierService
SubscriptionService --> TierService
ThemeService --> AccountService

%% ── Pages (selected) ────────────────────────────────────
class HomePageComponent { +heroStats() auraSummary() heroVehicle() -lockPageScroll() }
class AssistantPageComponent { +promptPath() send() [terminal UI] }
class DashboardPageComponent
class HistoryPageComponent { +tabs +setTab() }
class MyVehiclesPageComponent { +slots() [4×3 grid] }
class VehicleEditorPageComponent { +save() [add/edit] }
class PlanPageComponent { +selectPlan() buyAdapter() }
class CheckoutPageComponent { +pay() [mock] }
class NearbyServicesPageComponent

HomePageComponent --> SessionService
HomePageComponent --> AccountService
AssistantPageComponent --> AssistantService
DashboardPageComponent --> TelemetryService
HistoryPageComponent --> SessionService : via SessionHistory
HistoryPageComponent --> RepairLogService : via RepairLog
MyVehiclesPageComponent --> AccountService
VehicleEditorPageComponent --> AccountService
PlanPageComponent --> CheckoutService
CheckoutPageComponent --> SubscriptionService
NearbyServicesPageComponent --> ServicesService
NearbyServicesPageComponent --> GoogleMapsLoader

%% ── Shared UI ───────────────────────────────────────────
class IconComponent { +name +size [pixelarticons registry] }
class CustomSelectComponent { ControlValueAccessor }
class VehicleSelectorComponent { VIN scan + NHTSA cascade }
class AuraTerminalPipe { escapes HTML → terminal markup (XSS boundary) }

VehicleSelectorComponent --> VehicleService
AssistantPageComponent --> AuraTerminalPipe
```

## Server (Express)

```mermaid
classDiagram
direction TB

class index_ts {
  helmet + cors(CLIENT_ORIGIN)
  json limit 64kb
  globalLimiter 120/min
  expensiveLimiter 20/min
  central error handler → 500
}

class requireAuth {
  <<middleware>>
  Bearer JWT → req.userId
  401 on missing/invalid
}

class accountRouter {
  GET/PATCH /me
  GET/POST /vehicles
  PATCH/DELETE /vehicles/:id
  GET/PATCH /settings
  GET /export · DELETE / (password re-check + deleteLimiter)
}
class assistantRouter {
  POST /chat → Gemini stream
  stateless · plain-text chunks
  MAX_HISTORY/INPUT/CONTEXT caps
}
class vehicleRouter { GET /trims → CarAPI (JWT cache) }
class partsRouter { GET /search → eBay/parts lookup }
class placesRouter { GET /search → Google Places proxy }
class notifyRouter { POST / → SMS/email send }

class accountStore {
  <<data>>
  getAccount() updateAccount()
  listVehicles() addVehicle() updateVehicle() removeVehicle()
  getSettings() updateSettings()
  exportData() deleteAccount()
  camelCase ↔ snake_case mapping
}
class supabaseAdmin {
  <<client>>
  service-role key · BYPASSES RLS
  every query manually scoped to userId
}
class Postgres {
  <<Supabase>>
  profiles · vehicles · user_settings · issues
  RLS second line of defense
  migrations applied manually (0001-0003)
}

index_ts --> accountRouter : /api/account (global limiter)
index_ts --> assistantRouter : /api/assistant (expensive)
index_ts --> vehicleRouter : /api/vehicle (expensive)
index_ts --> partsRouter : /api/parts (expensive)
index_ts --> placesRouter : /api/places (expensive)
index_ts --> notifyRouter : /api/notify (expensive)

accountRouter --> requireAuth
assistantRouter --> requireAuth
accountRouter --> accountStore
accountStore --> supabaseAdmin
supabaseAdmin --> Postgres

class Gemini { <<external>> gemini-3.1-flash-lite }
class CarAPI { <<external>> trims/engines }
class GooglePlaces { <<external>> nearby services }
assistantRouter --> Gemini
vehicleRouter --> CarAPI
placesRouter --> GooglePlaces
```

## Data flow (one line)

`Angular (signals) → authInterceptor (Bearer, apiUrl-only) → Express (helmet/CORS/rate limits) → requireAuth (JWT → userId) → accountStore (userId-scoped) → supabaseAdmin (service role) → Postgres (RLS backstop)` — auth itself is the exception: the client talks to Supabase Auth directly (`supabase-client.ts`), and Aura streams over raw `fetch` instead of HttpClient.
