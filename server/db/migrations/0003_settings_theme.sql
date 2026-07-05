-- ============================================================================
-- AuraLink — 0003_settings_theme
--
-- Add a per-user UI theme preference. 'dark' is the app's original look and the
-- default; 'light' is the new toggleable theme.
-- ============================================================================

do $$ begin
  create type ui_theme as enum ('dark', 'light');
exception when duplicate_object then null; end $$;

alter table public.user_settings
  add column if not exists theme ui_theme not null default 'dark';
