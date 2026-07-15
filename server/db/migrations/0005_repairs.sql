-- ============================================================================
-- AuraLink — 0005_repairs
--
-- Backs the user's repair / service log (client RepairLogService, today seed
-- data + localStorage). Mirrors RepairRecord in
-- client/src/app/models/repair.model.ts. Sibling to `issues` (0001): issues are
-- diagnostic faults, repairs are planned/completed service work.
--
-- vehicle_label is denormalized (survives vehicle deletion, like issues);
-- vehicle_id is SET NULL on delete so the log is retained. mileage/cost are
-- nullable ("if known"). Run after 0004.
-- ============================================================================

create extension if not exists pgcrypto;

-- Mirrors RepairCategory.
do $$ begin
  create type repair_category as enum (
    'oil', 'tires', 'brakes', 'battery', 'fluids', 'inspection', 'repair', 'other'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.repairs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  vehicle_id    uuid references public.vehicles (id) on delete set null,
  vehicle_label text not null default '',
  category      repair_category not null default 'other',
  title         text not null,
  service_date  date not null default current_date,
  mileage       int,
  cost          numeric(10, 2),
  shop          text not null default '',
  notes         text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists repairs_user_id_idx on public.repairs (user_id);
create index if not exists repairs_vehicle_id_idx on public.repairs (vehicle_id);
-- The log lists newest-first by service date; maintenance checks (0007) read the
-- latest mileage per (vehicle, category), which this ordering serves.
create index if not exists repairs_user_date_idx
  on public.repairs (user_id, service_date desc);

alter table public.repairs enable row level security;

drop policy if exists repairs_all_own on public.repairs;
create policy repairs_all_own on public.repairs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
