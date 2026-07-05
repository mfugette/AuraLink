# Database (Supabase Postgres)

Schema for AuraLink's user data. Identity is owned by **Supabase Auth**
(`auth.users`); these tables hang off it via `user_id`/`id` foreign keys and are
protected by **Row Level Security** keyed on `auth.uid()`.

## Migrations

SQL migrations live in [`migrations/`](./migrations), numbered in order:

| File | What it does |
|------|--------------|
| `0001_init.sql` | Enums, `profiles`, `user_settings`, `vehicles`, `issues`; RLS policies; new-user bootstrap trigger. |

### Applying a migration

Either paste the file into the **Supabase Dashboard → SQL Editor** and run it,
or use the Supabase CLI:

```bash
# one-time link (needs the project ref + db password)
supabase link --project-ref <ref>
supabase db push        # or: psql "$DATABASE_URL" -f db/migrations/0001_init.sql
```

Migrations are written to be safe to re-run (`if not exists`, `drop policy if
exists ... create policy`, `on conflict do nothing`).

## How the app connects

The Express API queries Postgres with the Supabase **`service_role`** key, which
**bypasses RLS** — it's a trusted server. That key must live only in
`server/.env` (git-ignored), never in the Angular client. The RLS policies are
the safety net for any direct anon-key access.

## Table map (from the app's TypeScript types)

| TS type (`account.model.ts` / `issue-history.ts`) | Table |
|---|---|
| Supabase `auth.users` | identity (managed) |
| `Account` | `profiles` |
| `AccountSettings` | `user_settings` |
| `SavedVehicle` | `vehicles` |
| `IssueRecord` | `issues` |

The static parts catalog (`client/src/app/data/parts-catalog.ts`) is **not** in
the DB yet — it's read-only reference data and may be replaced by CarAPI later.
