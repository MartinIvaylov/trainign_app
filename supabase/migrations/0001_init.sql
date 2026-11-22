-- =============================================================================
-- HYBRID Performance Platform — Supabase / PostgreSQL schema (initial migration)
-- =============================================================================
--
-- This migration is the SOURCE OF TRUTH for the production database on Supabase
-- Postgres. It mirrors the Prisma schema (see `prisma/schema.prisma`) model
-- for model, but in raw SQL with PostgreSQL idioms:
--
--   * UUID primary keys via `gen_random_uuid()` (pgcrypto)
--   * `timestamptz` for every timestamp
--   * snake_case identifiers (PostgreSQL convention)
--   * Foreign keys with `on delete cascade` where the Prisma schema uses
--     `onDelete: Cascade`, and `on delete set null` where it uses `SetNull`
--   * Indexes matching the Prisma `@@index` directives
--   * Row Level Security (RLS) enabled on every sensitive table, with
--     policies that gate access on `auth.uid()` — Supabase's built-in
--     request-scoped JWT claim.
--
-- Dev workflow
-- -------------
-- Local development uses Prisma + SQLite (`db/custom.db`). The Prisma schema
-- uses camelCase and `cuid()` ids for portability; in production the columns
-- are snake_case and ids are UUIDs. To run Prisma against Supabase Postgres
-- in production, generate a separate `prisma/schema.prod.prisma` (or use the
-- `@map` / `@@map` attributes) so Prisma knows the snake_case column names
-- and UUID id strategy. Then:
--
--     bun run prisma migrate deploy        # applies existing migrations
--     # or:
--     supabase db push                     # applies this file directly
--
-- Prisma + SQLite is used in dev; Prisma + Supabase Postgres in production.
-- =============================================================================

-- Required extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1. Identity & profile
-- ---------------------------------------------------------------------------

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text,
  name          text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_users_email on users(email);

create table if not exists athlete_profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references users(id) on delete cascade,
  display_name text not null,
  bio          text,
  avatar_url   text,
  date_of_birth timestamptz,
  age          int,
  height_cm    double precision,
  weight_kg    double precision,
  sex          text,
  training_age text,
  background   text not null default 'general',
  location     text,
  primary_goal text,
  onboarded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_athlete_profiles_user_id on athlete_profiles(user_id);

create table if not exists athlete_preferences (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid not null unique references athlete_profiles(id) on delete cascade,
  days_per_week   int not null default 4,
  session_minutes int not null default 60,
  preferred_days  text not null,
  equipment       text not null,
  location        text not null default 'home_gym',
  injuries        text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_athlete_preferences_athlete_id on athlete_preferences(athlete_id);

-- ---------------------------------------------------------------------------
-- 2. Training modes, goals, competitions
-- ---------------------------------------------------------------------------

create table if not exists athlete_goals (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid not null references athlete_profiles(id) on delete cascade,
  mode           text not null,
  focus          text not null,
  competition_id uuid,
  target_date    timestamptz,
  target_time    int,
  status         text not null default 'active',
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_athlete_goals_athlete_status on athlete_goals(athlete_id, status);

create table if not exists competitions (
  id         uuid primary key default gen_random_uuid(),
  format     text not null,
  name       text not null,
  city       text,
  country    text,
  date       timestamptz not null,
  divisions  text,
  url        text,
  verified   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_competitions_format_date on competitions(format, date);

create table if not exists athlete_competitions (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid not null references athlete_profiles(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade,
  division       text,
  registered_at  timestamptz not null default now(),
  unique (athlete_id, competition_id)
);
create index if not exists idx_athlete_competitions_athlete on athlete_competitions(athlete_id);
create index if not exists idx_athlete_competitions_competition on athlete_competitions(competition_id);

-- ---------------------------------------------------------------------------
-- 3. Training engine: plans, blocks, scheduled workouts
-- ---------------------------------------------------------------------------

create table if not exists training_plans (
  id         uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athlete_profiles(id) on delete cascade,
  name       text not null,
  mode       text not null,
  goal_id    uuid,
  phase      text not null default 'base',
  start_week timestamptz not null,
  end_week   timestamptz not null,
  weeks      int not null default 4,
  status     text not null default 'active',
  source     text not null default 'engine',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_training_plans_athlete_status on training_plans(athlete_id, status);

create table if not exists training_blocks (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references training_plans(id) on delete cascade,
  name       text not null,
  focus      text not null,
  week_index int not null,
  start_date timestamptz not null,
  end_date   timestamptz not null,
  notes      text,
  created_at timestamptz not null default now()
);
create index if not exists idx_training_blocks_plan on training_blocks(plan_id);

create table if not exists scheduled_workouts (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null references training_plans(id) on delete cascade,
  day_of_week    int not null,
  scheduled_date timestamptz not null,
  title          text not null,
  mode           text not null,
  type           text not null,
  duration_min   int,
  intensity      text,
  notes          text,
  workout_id     uuid,
  created_at     timestamptz not null default now()
);
create index if not exists idx_scheduled_workouts_plan_date on scheduled_workouts(plan_id, scheduled_date);

-- ---------------------------------------------------------------------------
-- 4. Workouts, exercises, logs
-- ---------------------------------------------------------------------------

create table if not exists workouts (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique,
  name        text not null,
  mode        text not null,
  type        text not null,
  description text,
  warmup      text,
  cooldown    text,
  scoring     text,
  cap_minutes int,
  notes       text,
  source      text not null default 'library',
  created_at  timestamptz not null default now()
);
create index if not exists idx_workouts_slug on workouts(slug);

create table if not exists exercise_library (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null,
  unit        text not null default 'reps',
  description text,
  tips        text,
  substitutes text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_exercise_library_category on exercise_library(category);

create table if not exists workout_exercises (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references workouts(id) on delete cascade,
  name         text not null,
  order_index  int not null,
  sets         int,
  reps         text,
  duration     int,
  distance     int,
  load_kg      double precision,
  rest_seconds int,
  notes        text,
  rx           text
);
create index if not exists idx_workout_exercises_workout_order on workout_exercises(workout_id, order_index);

create table if not exists workout_logs (
  id             uuid primary key default gen_random_uuid(),
  athlete_id     uuid not null references athlete_profiles(id) on delete cascade,
  workout_id     uuid references workouts(id) on delete set null,
  scheduled_date timestamptz not null,
  completed_at   timestamptz,
  mode           text not null,
  type           text not null,
  title          text not null,
  notes          text,
  rpe            int,
  duration_sec   int,
  result         text,
  rx_scaled      text,
  feeling        text,
  completed      boolean not null default false,
  source         text not null default 'manual',
  created_at     timestamptz not null default now()
);
create index if not exists idx_workout_logs_athlete_date on workout_logs(athlete_id, scheduled_date);

create table if not exists exercise_logs (
  id            uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references workout_logs(id) on delete cascade,
  name          text not null,
  sets          int,
  reps          text,
  weight_kg     double precision,
  duration_sec  int,
  distance_m    int,
  notes         text,
  order_index   int not null default 0
);
create index if not exists idx_exercise_logs_workout_log on exercise_logs(workout_log_id);

-- ---------------------------------------------------------------------------
-- 5. Benchmarks, PRs, race results
-- ---------------------------------------------------------------------------

create table if not exists benchmarks (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  slug            text not null unique,
  mode            text not null,
  category        text not null,
  unit            text not null default 'seconds',
  description     text,
  higher_is_better boolean not null default true
);
create index if not exists idx_benchmarks_slug on benchmarks(slug);

create table if not exists benchmark_results (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references athlete_profiles(id) on delete cascade,
  benchmark_id uuid not null references benchmarks(id) on delete cascade,
  value        double precision not null,
  unit         text not null,
  recorded_at  timestamptz not null default now(),
  notes        text
);
create index if not exists idx_benchmark_results_athlete_benchmark on benchmark_results(athlete_id, benchmark_id);

create table if not exists personal_records (
  id         uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athlete_profiles(id) on delete cascade,
  movement   text not null,
  value      double precision not null,
  unit       text not null,
  context    text,
  recorded_at timestamptz not null default now()
);
create index if not exists idx_personal_records_athlete_movement on personal_records(athlete_id, movement);

create table if not exists race_results (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references athlete_profiles(id) on delete cascade,
  competition   text not null,
  format        text not null,
  division      text,
  finish_sec    int not null,
  rank_overall  int,
  rank_division int,
  location      text,
  date          timestamptz not null,
  notes         text
);
create index if not exists idx_race_results_athlete_date on race_results(athlete_id, date);

create table if not exists race_splits (
  id             uuid primary key default gen_random_uuid(),
  race_result_id uuid references race_results(id) on delete set null,
  athlete_id     uuid not null references athlete_profiles(id) on delete cascade,
  segment        int not null,
  type           text not null,
  station_name   text,
  duration_sec   int not null,
  transition_sec int,
  recorded_at    timestamptz not null default now()
);
create index if not exists idx_race_splits_athlete_segment on race_splits(athlete_id, segment);
create index if not exists idx_race_splits_race_result on race_splits(race_result_id);

-- ---------------------------------------------------------------------------
-- 6. Metrics, recovery, wearables
-- ---------------------------------------------------------------------------

create table if not exists athlete_metrics (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references athlete_profiles(id) on delete cascade,
  date        timestamptz not null,
  weight_kg   double precision,
  resting_hr  int,
  sleep_hours double precision,
  hrv         int,
  fatigue     int,
  readiness   int,
  notes       text
);
create index if not exists idx_athlete_metrics_athlete_date on athlete_metrics(athlete_id, date);

create table if not exists recovery_logs (
  id              uuid primary key default gen_random_uuid(),
  athlete_id      uuid not null references athlete_profiles(id) on delete cascade,
  date            timestamptz not null,
  sleep_hours     double precision,
  muscle_soreness int,
  stress          int,
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_recovery_logs_athlete_date on recovery_logs(athlete_id, date);

create table if not exists wearable_connections (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references athlete_profiles(id) on delete cascade,
  provider    text not null,
  connected_at timestamptz not null default now(),
  status      text not null default 'active',
  last_sync   timestamptz
);
create index if not exists idx_wearable_connections_athlete on wearable_connections(athlete_id);

-- ---------------------------------------------------------------------------
-- 7. Partnerships (ATHX pairs), coaching, gyms
-- ---------------------------------------------------------------------------

create table if not exists partnerships (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references athlete_profiles(id) on delete cascade,
  partner_name  text not null,
  partner_email text,
  status        text not null default 'pending',
  shared_plan_id uuid,
  created_at    timestamptz not null default now()
);
create index if not exists idx_partnerships_athlete on partnerships(athlete_id);

create table if not exists coach_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references users(id) on delete cascade,
  display_name text not null,
  bio         text,
  specialties text,
  verified    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_coach_profiles_user on coach_profiles(user_id);

create table if not exists coach_athletes (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references coach_profiles(id) on delete cascade,
  athlete_id uuid not null references athlete_profiles(id) on delete cascade,
  status     text not null default 'active',
  created_at timestamptz not null default now(),
  unique (coach_id, athlete_id)
);
create index if not exists idx_coach_athletes_coach on coach_athletes(coach_id);
create index if not exists idx_coach_athletes_athlete on coach_athletes(athlete_id);

-- ---------------------------------------------------------------------------
-- 8. Community: challenges, activity, notifications
-- ---------------------------------------------------------------------------

create table if not exists challenges (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  mode        text,
  metric      text not null,
  goal        double precision not null,
  unit        text not null,
  start_week  timestamptz not null default now(),
  weeks       int not null default 4,
  created_at  timestamptz not null default now()
);
create index if not exists idx_challenges_mode on challenges(mode);

create table if not exists challenge_participants (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  athlete_id   uuid references athlete_profiles(id) on delete set null,
  progress     double precision not null default 0,
  completed_at timestamptz,
  joined_at    timestamptz not null default now(),
  unique (challenge_id, user_id)
);
create index if not exists idx_challenge_participants_challenge on challenge_participants(challenge_id);
create index if not exists idx_challenge_participants_user on challenge_participants(user_id);

create table if not exists activity_feed_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  visibility   text not null default 'friends',
  metadata    text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_activity_feed_items_user_created on activity_feed_items(user_id, created_at);

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_read on notifications(user_id, read);

-- ---------------------------------------------------------------------------
-- 9. Subscriptions, entitlements, AI
-- ---------------------------------------------------------------------------

create table if not exists subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references users(id) on delete cascade,
  tier               text not null default 'free',
  status             text not null default 'active',
  provider           text,
  provider_ref       text,
  current_period_end timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_subscriptions_user on subscriptions(user_id);
create index if not exists idx_subscriptions_tier_status on subscriptions(tier, status);

create table if not exists ai_messages (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  role              text not null,
  content           text not null,
  tools_used        text,
  recommendation_id uuid,
  created_at        timestamptz not null default now()
);
create index if not exists idx_ai_messages_user_created on ai_messages(user_id, created_at);

create table if not exists ai_recommendations (
  id         uuid primary key default gen_random_uuid(),
  athlete_id uuid references athlete_profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text not null,
  severity   text not null default 'info',
  evidence   text,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_recommendations_athlete on ai_recommendations(athlete_id);
create index if not exists idx_ai_recommendations_type on ai_recommendations(type);

-- ---------------------------------------------------------------------------
-- 10. updated_at trigger (auto-maintain updated_at on all tables that have it)
-- ---------------------------------------------------------------------------

-- A single trigger function that updates `updated_at` to now() on every row
-- update. Reused by per-table triggers below.
create or replace function hybrid_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Attach the trigger to every table that has an `updated_at` column.
do $$
declare
  t text;
  tables_with_updated_at text[] := array[
    'users',
    'athlete_profiles',
    'athlete_preferences',
    'athlete_goals',
    'training_plans',
    'subscriptions'
  ];
begin
  foreach t in array tables_with_updated_at loop
    execute format(
      'drop trigger if exists trg_%s_set_updated_at on %I;' ||
      'create trigger trg_%s_set_updated_at before update on %I ' ||
      'for each row execute function hybrid_set_updated_at();',
      t, t, t, t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Row Level Security
-- ---------------------------------------------------------------------------
-- Enable RLS on every sensitive table. Default-deny: with RLS on and no
-- matching policy, SELECT/INSERT/UPDATE/DELETE return zero rows / are denied.
-- The service-role key bypasses RLS, so server-side Prisma calls (which use
-- the service role) are unaffected.
-- ---------------------------------------------------------------------------

alter table users                enable row level security;
alter table athlete_profiles    enable row level security;
alter table athlete_preferences enable row level security;
alter table athlete_goals       enable row level security;
alter table competitions         enable row level security;
alter table athlete_competitions enable row level security;
alter table training_plans      enable row level security;
alter table training_blocks     enable row level security;
alter table scheduled_workouts  enable row level security;
alter table workouts            enable row level security;
alter table exercise_library   enable row level security;
alter table workout_exercises   enable row level security;
alter table workout_logs        enable row level security;
alter table exercise_logs       enable row level security;
alter table benchmarks          enable row level security;
alter table benchmark_results  enable row level security;
alter table personal_records    enable row level security;
alter table race_results        enable row level security;
alter table race_splits         enable row level security;
alter table athlete_metrics     enable row level security;
alter table recovery_logs       enable row level security;
alter table wearable_connections enable row level security;
alter table partnerships        enable row level security;
alter table coach_profiles      enable row level security;
alter table coach_athletes      enable row level security;
alter table challenges          enable row level security;
alter table challenge_participants enable row level security;
alter table activity_feed_items enable row level security;
alter table notifications       enable row level security;
alter table subscriptions       enable row level security;
alter table ai_messages         enable row level security;
alter table ai_recommendations  enable row level security;

-- ---------------------------------------------------------------------------
-- 12. RLS policies
-- ---------------------------------------------------------------------------

-- users: a user can read/update only their own row.
create policy "Users manage own row"
  on users for all
  using (auth.uid() = id);

-- athlete_profiles: athletes see and update only their own profile.
create policy "Athletes see own profile"
  on athlete_profiles for select
  using (auth.uid() = user_id);

create policy "Athletes update own profile"
  on athlete_profiles for update
  using (auth.uid() = user_id);

create policy "Athletes insert own profile"
  on athlete_profiles for insert
  with check (auth.uid() = user_id);

-- athlete_preferences: only the owning athlete.
create policy "Athletes manage own preferences"
  on athlete_preferences for all
  using (auth.uid() = (select user_id from athlete_profiles where id = athlete_id));

-- workout_logs: athletes see/modify only their own logs.
create policy "Athletes see own logs"
  on workout_logs for all
  using (auth.uid() = (select user_id from athlete_profiles where id = athlete_id));

-- benchmark_results: same pattern as workout_logs.
create policy "Athletes see own benchmark results"
  on benchmark_results for all
  using (auth.uid() = (select user_id from athlete_profiles where id = athlete_id));

-- personal_records: same pattern.
create policy "Athletes see own personal records"
  on personal_records for all
  using (auth.uid() = (select user_id from athlete_profiles where id = athlete_id));

-- race_results: same pattern.
create policy "Athletes see own race results"
  on race_results for all
  using (auth.uid() = (select user_id from athlete_profiles where id = athlete_id));

-- race_splits: same pattern (splits belong to athlete directly).
create policy "Athletes see own race splits"
  on race_splits for all
  using (auth.uid() = (select user_id from athlete_profiles where id = athlete_id));

-- athlete_metrics: same pattern.
create policy "Athletes see own metrics"
  on athlete_metrics for all
  using (auth.uid() = (select user_id from athlete_profiles where id = athlete_id));

-- recovery_logs: same pattern.
create policy "Athletes see own recovery logs"
  on recovery_logs for all
  using (auth.uid() = (select user_id from athlete_profiles where id = athlete_id));

-- coach_athletes: coaches see athletes linked to them; athletes see their own links.
create policy "Coaches see linked athletes"
  on coach_athletes for select
  using (auth.uid() = (select user_id from coach_profiles where id = coach_id));

create policy "Athletes see own coach links"
  on coach_athletes for select
  using (auth.uid() = (select user_id from athlete_profiles where id = athlete_id));

-- subscriptions: only the owning user.
create policy "Users see own subscription"
  on subscriptions for all
  using (auth.uid() = user_id);

-- notifications: only the owning user.
create policy "Users see own notifications"
  on notifications for all
  using (auth.uid() = user_id);

-- ai_messages: only the owning user.
create policy "Users see own ai messages"
  on ai_messages for all
  using (auth.uid() = user_id);

-- activity_feed_items: owner can see all their own; public items visible to anyone.
create policy "Users see own activity feed items"
  on activity_feed_items for all
  using (auth.uid() = user_id);

create policy "Anyone sees public activity feed items"
  on activity_feed_items for select
  using (visibility = 'public');

-- subscriptions, coach_profiles, challenges: allow public read for plan/
-- coach discovery surfaces; writes are gated by additional per-request checks
-- in API routes (the service role bypasses RLS anyway).
create policy "Anyone sees coach profiles"
  on coach_profiles for select
  using (true);

create policy "Anyone sees challenges"
  on challenges for select
  using (true);

create policy "Participants see their own challenge rows"
  on challenge_participants for all
  using (auth.uid() = user_id);

-- workouts, exercise_library, benchmarks: public read (library content).
create policy "Anyone sees workouts"
  on workouts for select
  using (true);

create policy "Anyone sees exercise library"
  on exercise_library for select
  using (true);

create policy "Anyone sees benchmarks"
  on benchmarks for select
  using (true);

-- competitions: public read.
create policy "Anyone sees competitions"
  on competitions for select
  using (true);

-- =============================================================================
-- End of migration 0001_init.sql
-- =============================================================================
-- This migration is the source of truth for the production database on
-- Supabase Postgres. Local development uses Prisma + SQLite (see
-- `prisma/schema.prisma`); in production, run `prisma migrate deploy` (with a
-- schema variant that maps camelCase Prisma fields to the snake_case columns
-- above via `@map` / `@@map`) or apply this SQL directly via the Supabase SQL
-- editor. RLS is enabled on every sensitive table; the service-role key
-- bypasses RLS for server-side Prisma calls.
-- =============================================================================
