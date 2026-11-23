-- =============================================================================
-- HYBRID Performance Platform — Migration 0003
-- Harden Row Level Security (security audit C6)
-- =============================================================================
--
-- Fixes in 0001/0002 policies that let a signed-in client (anon/authenticated
-- key + user JWT) escalate privileges directly against PostgREST:
--
--   1. subscriptions: was `for all` → a user could UPDATE their own row and
--      set tier = 'gym' without paying. Now SELECT-only; every write goes
--      through the service role (verified Stripe webhook).
--   2. users: was `for all` with no column restrictions → a user could
--      change their own email (which keys state_snapshots and Stripe lookups)
--      or password_hash, or delete their row. Now: SELECT own row, UPDATE only
--      `name` / `avatar_url` (column privileges), no client INSERT/DELETE.
--   3. ai_messages / notifications / activity_feed_items /
--      challenge_participants: `for all` let clients forge assistant
--      messages, system notifications or challenge progress. Clients may now
--      read their own rows; only narrowly safe writes remain (marking a
--      notification read, posting their own activity).
--   4. Every UPDATE policy now has an explicit WITH CHECK so a row can't be
--      re-pointed at another user.
--
-- The service role bypasses RLS, so server-side route handlers are
-- unaffected.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. subscriptions — read-only for clients
-- ---------------------------------------------------------------------------
drop policy if exists "Users see own subscription" on subscriptions;
create policy "Users read own subscription"
  on subscriptions for select
  using (auth.uid() = user_id);

revoke insert, update, delete on subscriptions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. users — read own row, update only profile columns
-- ---------------------------------------------------------------------------
drop policy if exists "Users manage own row" on users;

create policy "Users read own row"
  on users for select
  using (auth.uid() = id);

create policy "Users update own profile columns"
  on users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke insert, delete on users from anon, authenticated;
revoke update on users from anon, authenticated;
grant update (name, avatar_url) on users to authenticated;
-- Never expose password hashes to clients, even for the owner's own row.
-- (A column-level REVOKE is ignored while a table-level grant exists, so
-- replace the table grant with an explicit column allow-list.)
revoke select on users from anon, authenticated;
grant select (id, email, name, avatar_url, created_at, updated_at) on users to authenticated;

-- ---------------------------------------------------------------------------
-- 3. athlete_profiles — add WITH CHECK to the update policy
-- ---------------------------------------------------------------------------
drop policy if exists "Athletes update own profile" on athlete_profiles;
create policy "Athletes update own profile"
  on athlete_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. ai_messages — clients read; the AI route (service role) writes
-- ---------------------------------------------------------------------------
drop policy if exists "Users see own ai messages" on ai_messages;
create policy "Users read own ai messages"
  on ai_messages for select
  using (auth.uid() = user_id);
revoke insert, update, delete on ai_messages from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. notifications — read own, may only flip `read`
-- ---------------------------------------------------------------------------
drop policy if exists "Users see own notifications" on notifications;
create policy "Users read own notifications"
  on notifications for select
  using (auth.uid() = user_id);
create policy "Users mark own notifications read"
  on notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
revoke insert, delete on notifications from anon, authenticated;
revoke update on notifications from anon, authenticated;
grant update (read) on notifications to authenticated;

-- ---------------------------------------------------------------------------
-- 6. activity_feed_items — owner manages own rows (explicit WITH CHECK)
-- ---------------------------------------------------------------------------
drop policy if exists "Users see own activity feed items" on activity_feed_items;
create policy "Users manage own activity feed items"
  on activity_feed_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7. challenge_participants — read own; progress is computed server-side
-- ---------------------------------------------------------------------------
drop policy if exists "Participants see their own challenge rows" on challenge_participants;
create policy "Participants read own challenge rows"
  on challenge_participants for select
  using (auth.uid() = user_id);
create policy "Participants join challenges"
  on challenge_participants for insert
  with check (auth.uid() = user_id and progress = 0 and completed_at is null);
create policy "Participants leave challenges"
  on challenge_participants for delete
  using (auth.uid() = user_id);
revoke update on challenge_participants from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Athlete-owned tables — explicit WITH CHECK on the `for all` policies
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  p text;
begin
  for t, p in
    select * from (values
      ('athlete_preferences', 'Athletes manage own preferences'),
      ('workout_logs',        'Athletes see own logs'),
      ('benchmark_results',   'Athletes see own benchmark results'),
      ('personal_records',    'Athletes see own personal records'),
      ('race_results',        'Athletes see own race results'),
      ('race_splits',         'Athletes see own race splits'),
      ('athlete_metrics',     'Athletes see own metrics'),
      ('recovery_logs',       'Athletes see own recovery logs')
    ) as v(tbl, pol)
  loop
    execute format('drop policy if exists %I on %I', p, t);
    execute format(
      'create policy %I on %I for all
         using (auth.uid() = (select user_id from athlete_profiles where id = athlete_id))
         with check (auth.uid() = (select user_id from athlete_profiles where id = athlete_id))',
      p, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 9. state_snapshots / webhook_events — server-only writes (explicit)
-- ---------------------------------------------------------------------------
revoke insert, update, delete on state_snapshots from anon, authenticated;
revoke all on webhook_events from anon, authenticated;

-- =============================================================================
-- End of migration 0003_harden_rls.sql
-- =============================================================================
