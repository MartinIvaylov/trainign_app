# Supabase — HYBRID Performance Platform

This folder holds everything that targets the production Supabase Postgres
database: SQL migrations, planned Edge Functions, and planned seed data.

## Layout

```
supabase/
  migrations/          # PostgreSQL migrations applied to Supabase
    0001_init.sql      # Core schema: 32 tables, indexes, RLS policies
    0002_sync_and_webhook_events.sql
                       # webhook_events (idempotency) + state_snapshots
                       # (client write-through cache) + their RLS
  functions/           # (planned) Supabase Edge Functions
  seed/                # (planned) Reference / seed data
```

## `migrations/`

Contains the raw PostgreSQL migrations that define the production schema on
Supabase. The initial migration `0001_init.sql` mirrors the Prisma schema in
`prisma/schema.prisma` (32 models) but in raw SQL with PostgreSQL idioms:
UUID primary keys (`gen_random_uuid()`), `timestamptz`, snake_case
identifiers, foreign keys with `on delete cascade`, indexes, and Row Level
Security policies. `0002_sync_and_webhook_events.sql` adds the
`webhook_events` table (processed-event idempotency for the Stripe webhook
route) and `state_snapshots` (the server-side mirror of the client store used
by `/api/sync`).

### How to apply

Pick one of the following. They are equivalent for first-time setup:

```bash
# Option A — Supabase CLI
supabase db push

# Option B — Run the SQL directly in the Supabase SQL editor
#   Dashboard → SQL Editor → New query → paste 0001_init.sql → Run
```

### Dev vs prod

- **Dev** uses Prisma + SQLite (`db/custom.db`) — see `prisma/schema.prisma`.
  The Prisma schema uses camelCase fields and `cuid()` ids for portability.
- **Prod** uses Prisma + Supabase Postgres. Run `prisma migrate deploy` with
  a schema variant that maps camelCase Prisma fields to the snake_case columns
  above via `@map` / `@@map` (or apply the SQL directly via the Supabase SQL
  editor and let Prisma introspect it).

The migration files in `supabase/migrations/` are the **source of truth for
production**. If you change the Prisma schema in dev, also update the matching
SQL here (or generate a new migration with `prisma migrate dev` against a
shadow Postgres database, then commit the resulting SQL).

## Row Level Security (RLS)

RLS is enabled on every sensitive table in `0001_init.sql`. Default-deny:
with RLS on and no matching policy, all reads and writes return zero rows.
The Supabase service-role key bypasses RLS, so server-side Prisma calls (via
`@/lib/db` using the service role) are unaffected.

Policy summary (see the SQL for the canonical definitions):

| Table                  | Policy                                                        |
| --------------------- | ------------------------------------------------------------- |
| users                 | Users manage own row (all)                                    |
| athlete_profiles      | Athletes see own profile (select) + update own (update)       |
| workout_logs          | Athletes see own logs (all)                                   |
| benchmark_results     | Athletes see own benchmark results (all)                     |
| personal_records     | Athletes see own personal records (all)                       |
| race_results / splits | Athletes see own race data (all)                              |
| athlete_metrics       | Athletes see own metrics (all)                               |
| recovery_logs         | Athletes see own recovery logs (all)                         |
| coach_athletes        | Coaches see linked athletes (select) + athletes see own (select) |
| subscriptions         | Users see own subscription (all)                             |
| notifications         | Users see own notifications (all)                            |
| ai_messages           | Users see own ai messages (all)                              |
| activity_feed_items   | Owner sees own (all) + anyone sees public (select)           |
| coach_profiles        | Anyone sees coach profiles (select) — discovery               |
| challenges            | Anyone sees challenges (select)                              |
| workouts / exercise_library / benchmarks / competitions | Anyone sees (select) — library content |
| webhook_events        | No policies — service role only (default-deny)                 |
| state_snapshots      | Owner `select` only (own email); writes via service role        |

## `functions/` (planned)

Will hold Supabase Edge Functions for:

- **Stripe webhook** — a thin Supabase Edge Function that mirrors
  `src/app/api/webhooks/stripe/route.ts` and writes the `subscriptions` row
  directly with the service role. Useful when you want Stripe webhook
  processing close to the database, independent of the Next.js deployment.
- **IAP receipt validation** — App Store / Play Store receipt verification for
  the Expo mobile app's in-app purchases (Pro / Coach / Gym tiers).

Not yet implemented. When added, each function lives in its own subfolder with
an `index.ts` entry, e.g. `functions/stripe-webhook/index.ts`.

## `seed/` (planned)

Will hold reference / seed data:

- **HYROX stations** — the 8 station definitions (Sled Push, Sled Pull,
  Burpee Broad Jumps, Rowing, Farmers Carry, Sandbag Lunges, Wall Balls,
  SkiErg) with RX loads per division.
- **CrossFit benchmarks** — Fran, Grace, Murph, Cindy, Filthy 50, etc. with
  scoring formats.
- **ATHX disciplines** — the eight ATHX disciplines with measurement units.
- **Sample athletes** — a handful of demo accounts (one per training mode)
  so QA can exercise every surface without manual setup.

Not yet implemented. When added, seed SQL files live here and can be applied
with `supabase db reset` (which replays migrations then seeds) or by running
the seed SQL manually against the database.
