-- ============================================================================
-- AuraLink — 0008_aura_usage
--
-- Per-user, per-day Aura message counter. Aura is stateless (no message history
-- is persisted, by design) — but enforcing a daily cap ("15 messages/day" during
-- the testing phase) needs a count. This is that count and nothing more: one row
-- per (user, day), incremented on each accepted chat request.
--
-- Kept deliberately minimal so it never becomes a message store: no content, no
-- prompts, just a tally. The API increments via the service role; the row's
-- `usage_date` is a plain date so "today" is a single-row upsert. Run after 0007.
-- ============================================================================

create table if not exists public.aura_usage (
  user_id    uuid not null references auth.users (id) on delete cascade,
  usage_date date not null default current_date,
  count      int  not null default 0,
  primary key (user_id, usage_date)
);

-- RLS: a user may read their own tally (to show "N of 15 left"); only the service
-- role writes it (bypasses RLS). No anon insert/update policy on purpose.
alter table public.aura_usage enable row level security;

drop policy if exists aura_usage_select_own on public.aura_usage;
create policy aura_usage_select_own on public.aura_usage
  for select using (user_id = auth.uid());

-- ── Atomic increment ─────────────────────────────────────────────────────────
-- Bump today's count for a user by 1 and return the NEW value, in a single
-- statement. Used by the API to enforce the daily cap without a read-then-write
-- race (two concurrent chats could otherwise both read N and write N+1). The
-- upsert either inserts (count=1) or adds 1 to the existing row for today.
-- SECURITY DEFINER so it runs with the owner's rights; only the service role
-- calls it (via supabaseAdmin.rpc), never the anon client.
create or replace function public.increment_aura_usage(p_user_id uuid)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  new_count int;
begin
  insert into public.aura_usage (user_id, usage_date, count)
    values (p_user_id, current_date, 1)
  on conflict (user_id, usage_date)
    do update set count = public.aura_usage.count + 1
  returning count into new_count;
  return new_count;
end $$;
