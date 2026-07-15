-- ============================================================================
-- AuraLink — 0004_notifications
--
-- Backs the in-app notifications inbox (client InboxService, today a mocked
-- seed list in localStorage) and the per-category "also text me" SMS prefs.
-- Also adds a delivery log so notify.route.ts (SMS/email send, still a stub)
-- has somewhere to record what it (eventually) sends.
--
-- Follows the 0001 conventions: per-user tables, RLS keyed on auth.uid(), ON
-- DELETE CASCADE from auth.users so account deletion wipes these too. Run in
-- the Supabase SQL editor after 0003.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Enums ───────────────────────────────────────────────────────────────────
-- Mirrors NotificationCategory in client/src/app/models/notification.model.ts.
do $$ begin
  create type notification_category as enum ('maintenance', 'health', 'billing', 'aura');
exception when duplicate_object then null; end $$;

-- How a delivery attempt (SMS/email) resolved. 'stub' = recorded while the real
-- Twilio/SendGrid wiring is still a no-op (notify.route.ts).
do $$ begin
  create type delivery_channel as enum ('sms', 'email');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_status as enum ('stub', 'sent', 'failed');
exception when duplicate_object then null; end $$;

-- ── notifications ───────────────────────────────────────────────────────────
-- One row per in-app notification. Mirrors AppNotification. cta_label/cta_route
-- are the optional deep-link CTA. `read` tracks the unread badge.
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  category   notification_category not null,
  title      text not null,
  body       text not null default '',
  read       boolean not null default false,
  cta_label  text,
  cta_route  text,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);
-- The inbox lists newest-first and counts unread; index both access paths.
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where not read;

-- ── notification_sms_prefs ──────────────────────────────────────────────────
-- Per-user, per-category SMS opt-in (SmsPrefs). In-app delivery is always on;
-- these only govern SMS escalation. One row per user; columns = the 4 categories
-- so a single upsert covers a full prefs object (matches the client's shape).
create table if not exists public.notification_sms_prefs (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  maintenance boolean not null default true,
  health      boolean not null default true,
  billing     boolean not null default false,
  aura        boolean not null default false
);

-- ── notification_deliveries ─────────────────────────────────────────────────
-- Audit log of outbound SMS/email sends (parts lists today; category alerts
-- later). notify.route.ts writes a 'stub' row until Twilio/SendGrid is wired.
-- recipient is stored as given (phone or email); body is the rendered message.
create table if not exists public.notification_deliveries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  channel    delivery_channel not null,
  recipient  text not null,
  body       text not null default '',
  status     delivery_status not null default 'stub',
  created_at timestamptz not null default now()
);

create index if not exists notification_deliveries_user_id_idx
  on public.notification_deliveries (user_id);

-- ============================================================================
-- Row Level Security — per-user, mirrors 0001. service_role bypasses these;
-- they guard against direct anon-key access.
-- ============================================================================
alter table public.notifications           enable row level security;
alter table public.notification_sms_prefs  enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists notifications_all_own on public.notifications;
create policy notifications_all_own on public.notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notification_sms_prefs_all_own on public.notification_sms_prefs;
create policy notification_sms_prefs_all_own on public.notification_sms_prefs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Deliveries are an audit trail: the user may read their own, but only the
-- service role (which bypasses RLS) writes them. No insert/update policy for
-- the anon path on purpose.
drop policy if exists notification_deliveries_select_own on public.notification_deliveries;
create policy notification_deliveries_select_own on public.notification_deliveries
  for select using (user_id = auth.uid());

-- ============================================================================
-- Bootstrap: give every new user a default SMS-prefs row (matches the client's
-- fallback: health+maintenance on, billing+aura off). Extends handle_new_user
-- from 0001 rather than adding a second trigger.
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

  insert into public.notification_sms_prefs (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

  return new;
end $$;

-- Backfill a prefs row for any existing users created before this migration.
insert into public.notification_sms_prefs (user_id)
  select id from auth.users
  on conflict (user_id) do nothing;
