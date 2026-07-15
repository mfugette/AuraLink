-- ============================================================================
-- AuraLink — 0006_subscriptions
--
-- Server-side source of truth for a user's subscription tier + billing history
-- (client SubscriptionService/TierService, today localStorage). This is the
-- table that lets the API ENFORCE tier caps — the client guards are UX only.
--
-- IMPORTANT (testing phase): billing isn't wired. Every user is treated as a
-- single "tester" access level enforced in code (15 Aura messages/day, 3
-- vehicles, Find/nearby allowed). This schema still models the full Free/Plus/
-- Pro tier so it survives when real billing lands — but the *caps applied now*
-- come from the server's tester config, not from per-tier columns here.
--
-- Mirrors Tier / BillingInterval / Subscription / BillingRecord in
-- client/src/app/models/tier.model.ts + services/subscription.service.ts.
-- Run after 0005.
-- ============================================================================

create extension if not exists pgcrypto;

-- Mirrors Tier.
do $$ begin
  create type subscription_tier as enum ('free', 'plus', 'pro');
exception when duplicate_object then null; end $$;

-- Mirrors BillingInterval.
do $$ begin
  create type billing_interval as enum ('monthly', 'annual');
exception when duplicate_object then null; end $$;

-- Mirrors BillingRecord.kind / .status.
do $$ begin
  create type billing_kind as enum ('plan', 'adapter', 'bundle');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fulfillment_status as enum ('active', 'processing', 'shipped', 'delivered', 'refunded');
exception when duplicate_object then null; end $$;

-- ── subscriptions ───────────────────────────────────────────────────────────
-- 1:1 with a user. `tier` is the source of truth for feature-gating once billing
-- exists. During the testing phase the default 'free' row is present but the
-- server ignores per-tier limits in favor of the fixed tester caps. canceled =
-- canceled but active until renews_at.
create table if not exists public.subscriptions (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  tier       subscription_tier not null default 'free',
  interval   billing_interval  not null default 'monthly',
  canceled   boolean not null default false,
  started_at timestamptz not null default now(),
  renews_at  timestamptz,
  created_at timestamptz not null default now()
);

-- ── billing_history ─────────────────────────────────────────────────────────
-- Append-only ledger of completed charges (recurring plan + one-time hardware).
-- Mirrors BillingRecord. card_last4 is the only card data we keep (for receipts);
-- a real processor (Stripe) owns everything else. No raw PAN is ever stored.
create table if not exists public.billing_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  charged_at timestamptz not null default now(),
  label      text not null,
  amount     numeric(10, 2) not null default 0,
  kind       billing_kind not null,
  status     fulfillment_status not null default 'active',
  card_last4 text,
  created_at timestamptz not null default now()
);

create index if not exists billing_history_user_id_idx on public.billing_history (user_id);
create index if not exists billing_history_user_charged_idx
  on public.billing_history (user_id, charged_at desc);

-- ============================================================================
-- Row Level Security
-- Subscriptions/billing are read-your-own for the UI, but WRITES must go through
-- the service role only — a client must never be able to grant itself a tier or
-- forge a charge. No anon insert/update policy on purpose (service_role bypasses
-- RLS; that is the sole write path).
-- ============================================================================
alter table public.subscriptions   enable row level security;
alter table public.billing_history enable row level security;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select using (user_id = auth.uid());

drop policy if exists billing_history_select_own on public.billing_history;
create policy billing_history_select_own on public.billing_history
  for select using (user_id = auth.uid());

-- ============================================================================
-- Bootstrap: every new user gets a default 'free' subscription row so the API
-- never special-cases "no subscription". Extends handle_new_user (from 0001/0004).
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

  insert into public.subscriptions (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

  return new;
end $$;

-- Backfill a free subscription for users created before this migration.
insert into public.subscriptions (user_id)
  select id from auth.users
  on conflict (user_id) do nothing;
