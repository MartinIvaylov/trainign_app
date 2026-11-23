-- =============================================================================
-- HYBRID Performance Platform — Migration 0002
-- Webhook event idempotency + client state snapshots (write-through cache)
-- =============================================================================
--
-- Applies on top of 0001_init.sql. Adds two tables:
--
--   * webhook_events   — processed Stripe/App Store/Play Store webhook events.
--                        Providers retry failed deliveries, so the same event
--                        may arrive twice. The unique (provider, external_id)
--                        constraint lets route handlers skip replays.
--   * state_snapshots  — server-side mirror of the client Zustand store. The
--                        web app pushes debounced JSON snapshots after each
--                        mutation (write-through) and pulls the latest
--                        snapshot on login / app start. Last-write-wins by
--                        `revision` (an ISO timestamp).
--
-- Both tables are written exclusively by server-side code running with the
-- service-role key (which bypasses RLS), so RLS is enabled with default-deny
-- and only a read policy for the owning user on state_snapshots.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. webhook_events
-- ---------------------------------------------------------------------------

create table if not exists webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,           -- stripe|app_store|play_store
  external_id  text not null,           -- e.g. Stripe event id "evt_..."
  type         text not null,           -- e.g. "checkout.session.completed"
  processed_at timestamptz not null default now()
);
create unique index if not exists idx_webhook_events_provider_external
  on webhook_events(provider, external_id);
create index if not exists idx_webhook_events_type on webhook_events(type);

alter table webhook_events enable row level security;
-- No policies: only the service role (server-side route handlers) touches
-- this table. Default-deny for anon / authenticated clients.

-- ---------------------------------------------------------------------------
-- 2. state_snapshots
-- ---------------------------------------------------------------------------

create table if not exists state_snapshots (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,      -- user key (matches users.email)
  revision   timestamptz not null,      -- ISO timestamp; last write wins
  data       jsonb not null,            -- persisted store slice as JSON
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_state_snapshots_email on state_snapshots(email);

alter table state_snapshots enable row level security;

-- A signed-in user may read their own snapshot (keyed by the email bound to
-- their auth identity). Writes go through the service-role API route.
create policy "Users read own state snapshot"
  on state_snapshots for select
  using (
    lower(email) = lower(
      coalesce(
        (select email from users where id = auth.uid()),
        ''
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger for state_snapshots
-- ---------------------------------------------------------------------------

drop trigger if exists trg_state_snapshots_set_updated_at on state_snapshots;
create trigger trg_state_snapshots_set_updated_at
  before update on state_snapshots
  for each row execute function hybrid_set_updated_at();

-- =============================================================================
-- End of migration 0002_sync_and_webhook_events.sql
-- =============================================================================
