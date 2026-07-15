-- ============================================================================
-- AuraLink — 0007_maintenance
--
-- Routine maintenance checks, driven by REPAIR-LOG MILEAGE (not adapter/live
-- telemetry — that path is deferred until the hardware exists). A maintenance
-- interval says "service X is due every N miles (and/or every M months)". The
-- "is it due?" computation is derived at READ time by the API from:
--   • the vehicle's current mileage (vehicles.mileage), and
--   • the mileage/date of the most recent matching repair (repairs, 0005).
-- so nothing here needs live PID data. When the adapter lands it can supplement
-- the current-mileage source without a schema change.
--
-- The interval's `category` maps to a repair_category (0005) so "last done" can
-- be found by matching the repair log. Run after 0006.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── maintenance_intervals ───────────────────────────────────────────────────
-- Per-user, optionally per-vehicle service intervals. vehicle_id NULL = a
-- default that applies to all the user's vehicles (e.g. "oil every 5k"); a
-- per-vehicle row overrides the default for that vehicle. At least one of
-- interval_miles / interval_months should be set (enforced by a check).
--
-- `category` reuses repair_category so the API can find the last time this
-- service was done by matching repairs.category. last_done_* are optional manual
-- overrides for when the user knows the last service but hasn't logged a repair.
create table if not exists public.maintenance_intervals (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  vehicle_id       uuid references public.vehicles (id) on delete cascade,
  category         repair_category not null,
  label            text not null default '',
  interval_miles   int,
  interval_months  int,
  last_done_miles  int,
  last_done_date   date,
  enabled          boolean not null default true,
  created_at       timestamptz not null default now(),
  -- Must specify at least one cadence.
  constraint maintenance_intervals_has_cadence
    check (interval_miles is not null or interval_months is not null)
);

create index if not exists maintenance_intervals_user_id_idx
  on public.maintenance_intervals (user_id);
create index if not exists maintenance_intervals_vehicle_id_idx
  on public.maintenance_intervals (vehicle_id);

-- One row per (user, vehicle, category): a user shouldn't have two "oil" rules
-- for the same vehicle. Because vehicle_id is nullable and NULLs are distinct in
-- a normal unique index, use COALESCE so the per-user default (NULL vehicle) is
-- also uniquely constrained per category.
create unique index if not exists maintenance_intervals_uniq
  on public.maintenance_intervals (user_id, coalesce(vehicle_id, '00000000-0000-0000-0000-000000000000'::uuid), category);

alter table public.maintenance_intervals enable row level security;

drop policy if exists maintenance_intervals_all_own on public.maintenance_intervals;
create policy maintenance_intervals_all_own on public.maintenance_intervals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
