-- ============================================================================
-- AuraLink — initial schema (0001_init)
--
-- Identity is owned by Supabase Auth (auth.users). This migration adds the
-- user-data tables that today live as in-memory Maps in
-- server/src/data/account.store.ts and TS seed data in client/src/app/data.
--
-- Every table is owned per-user and protected by Row Level Security keyed on
-- auth.uid(). The Express API talks to Postgres with the service_role key,
-- which BYPASSES RLS — so these policies are the safety net for any direct
-- (anon-key) access, not the server's access path.
--
-- Run this in the Supabase SQL editor (or via the CLI). It is idempotent-ish:
-- it uses IF NOT EXISTS / CREATE OR REPLACE where practical.
-- ============================================================================

-- gen_random_uuid() lives in pgcrypto (already enabled on Supabase, but be safe)
create extension if not exists pgcrypto;

-- ── Enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type unit_system as enum ('imperial', 'metric');
exception when duplicate_object then null; end $$;

do $$ begin
  create type issue_status as enum ('open', 'in-progress', 'resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type issue_severity as enum ('low', 'moderate', 'high', 'critical');
exception when duplicate_object then null; end $$;

-- ── profiles ────────────────────────────────────────────────────────────────
-- 1:1 with auth.users. Replaces the standalone `Account` identity table; email
-- now lives in auth.users, so we only keep app-level profile fields here.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at   timestamptz not null default now()
);

-- ── user_settings ───────────────────────────────────────────────────────────
-- 1:1 with a user. Mirrors AccountSettings.
create table if not exists public.user_settings (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  notify_email    boolean not null default true,
  notify_sms      boolean not null default false,
  preferred_units unit_system not null default 'imperial'
);

-- ── vehicles ────────────────────────────────────────────────────────────────
-- Mirrors SavedVehicle. Nullable spec fields match the model (a user may save a
-- partially-specified vehicle).
create table if not exists public.vehicles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  nickname   text,
  year       int,
  make       text,
  model      text,
  sub_model  text,
  engine     text,
  vin        text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists vehicles_user_id_idx on public.vehicles (user_id);

-- Enforce "at most one primary vehicle per user" at the DB level (the in-memory
-- store did this by hand in addVehicle/updateVehicle). A partial unique index
-- only constrains rows where is_primary = true.
create unique index if not exists vehicles_one_primary_per_user
  on public.vehicles (user_id)
  where is_primary;

-- ── issues ──────────────────────────────────────────────────────────────────
-- Mirrors IssueRecord. vehicle_label is denormalized on purpose (survives a
-- vehicle deletion, per the model's comment); vehicle_id is SET NULL on delete
-- so history is retained. parts_used is a text[] snapshot rather than a child
-- table — sufficient for now.
create table if not exists public.issues (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  vehicle_id    uuid references public.vehicles (id) on delete set null,
  vehicle_label text not null default '',
  code          text not null,
  title         text not null,
  logged_on     date not null default current_date,
  status        issue_status not null default 'open',
  severity      issue_severity not null default 'moderate',
  notes         text not null default '',
  parts_used    text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create index if not exists issues_user_id_idx on public.issues (user_id);
create index if not exists issues_vehicle_id_idx on public.issues (vehicle_id);

-- ============================================================================
-- Row Level Security
-- Enable RLS and add per-user policies. auth.uid() is the id of the calling
-- user (from their JWT). The service_role key bypasses all of this.
-- ============================================================================

alter table public.profiles      enable row level security;
alter table public.user_settings enable row level security;
alter table public.vehicles      enable row level security;
alter table public.issues        enable row level security;

-- profiles: a user sees and edits only their own row.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_upsert_own on public.profiles;
create policy profiles_upsert_own on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- user_settings
drop policy if exists user_settings_all_own on public.user_settings;
create policy user_settings_all_own on public.user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- vehicles
drop policy if exists vehicles_all_own on public.vehicles;
create policy vehicles_all_own on public.vehicles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- issues
drop policy if exists issues_all_own on public.issues;
create policy issues_all_own on public.issues
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- New-user bootstrap
-- When a user signs up (row inserted into auth.users), auto-create their
-- profile + settings rows so the app never has to special-case "first login".
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
    on conflict (id) do nothing;

  insert into public.user_settings (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
