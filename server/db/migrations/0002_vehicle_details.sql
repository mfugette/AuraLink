-- ============================================================================
-- AuraLink — 0002_vehicle_details
--
-- The rich vehicle selector (VIN decode + CarAPI autocompletes) captures more
-- spec than the original saved-vehicle model stored. Add columns so My Vehicles
-- can persist and display the full spec. All nullable — existing rows and
-- partially-specified vehicles remain valid.
-- ============================================================================

alter table public.vehicles
  add column if not exists drive_type   text,
  add column if not exists transmission text,
  add column if not exists fuel_type    text,
  add column if not exists body_style   text,
  add column if not exists mileage      int;
