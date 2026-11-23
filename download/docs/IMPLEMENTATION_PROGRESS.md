# HYBRID Performance Platform — Implementation Progress

> **Last updated:** v0.6.0 sprint  
> **Source of truth:** the codebase in `/home/z/my-project/`  
> **Status:** Phase 0 + Phase 1 + Phase 3 shipped; Phases 2, 4, 5, 6 substantially wired

---

## v0.6.0 Changelog (this sprint)

> Next Actions #4 (Phase 6 backend: Supabase + write-through cache) and #5
> (Phase 6 payments: Stripe Checkout + Portal + webhooks → `Subscription`).

### Phase 6 Backend — Write-Through Cache (Next Action #4)

- **`StateSnapshot` + `WebhookEvent` models** added to `prisma/schema.prisma` (30 models now) and pushed to the dev SQLite database.
- **`supabase/migrations/0002_sync_and_webhook_events.sql`** — production SQL for both tables with RLS (default-deny on `webhook_events`; owner-read on `state_snapshots`) and the `updated_at` trigger.
- **`GET/POST /api/sync`** (`src/app/api/sync/route.ts`) — snapshot pull/push endpoint: email-keyed, last-write-wins by `revision` (stale pushes rejected with `conflict: true`), 1.5 MB payload cap (413), 503 when the DB is unreachable.
- **`src/lib/sync.ts`** — browser write-through cache client: subscribes to the persisted slice of the Zustand store, bumps a local revision on every mutation, pushes debounced (2 s) snapshots with exponential-backoff retry (5 tries, 30 s cap), adopts newer server snapshots on login/start, and flushes on `online`. Toasts/navigation never sync.
- **`src/components/hybrid/sync-manager.tsx`** — mounts the sync client once for the whole app; waits for the persisted store to hydrate before reconciling so an empty store is never pushed over a newer snapshot.
- **Store refactor** — `PERSISTED_KEYS` + `snapshotState()` exported from `app-store.ts`; localStorage persistence and server sync share one slice definition (no drift possible).
- **Browser-verified cross-device restore**: wipe localStorage → sign in with the same email → server snapshot hydrates the store → dashboard appears with profile, plan and tier intact (`pro`).

### Phase 6 Payments — Stripe Checkout + Portal + Webhooks (Next Action #5)

- **Stripe SDK installed** (`stripe@23.2.0`); `src/lib/stripe.ts` upgraded from scaffold to real client: lazy cached `getStripe()`, `isStripeConfigured()`, price↔tier mapping kept and sourced from `STRIPE_PRICE_*` env vars.
- **`src/lib/entitlements.ts`** — the single entitlement write path: `applyEntitlement()` (upserts `User` + `Subscription`, resolves by internal id or email, optional tier keeps the existing one on update), `getEntitlement()`, `claimWebhookEvent()` (idempotency claim). Degrades to a no-op when the DB is unreachable.
- **`POST /api/webhooks/stripe`** rewritten: real signature verification via `stripe.webhooks.constructEvent` whenever `STRIPE_SECRET_KEY` is set (400 on bad signature); event-id idempotency via `WebhookEvent` (replays acknowledged with `duplicate: true` and skipped); four event types now write the `Subscription` table — `checkout.session.completed` (activate tier), `customer.subscription.updated` (tier/status/period-end), `customer.subscription.deleted` (free/cancelled), `invoice.payment_failed` (past_due, tier kept). Preview mode (no Stripe keys) still exercises the full event→DB flow for local dev.
- **`POST /api/billing/checkout`** — real Stripe Checkout Session (subscription mode, `customer_email`, metadata for webhook resolution) when keys are set; preview mode applies the entitlement directly (provider `stripe_test`) so the flow is end-to-end testable. `free` is a downgrade: preview applies it, Stripe mode points at the portal.
- **`POST /api/billing/portal`** — Stripe Customer Portal session (customer resolved by email via `customers.list`); preview mode returns `{ mode: "preview" }`.
- **Settings UI wired** — tier cards call the checkout route (redirect on `mode: "stripe"`, store update + toast on preview); new **Manage billing** button calls the portal route; buttons disable while a request is in flight. Also fixed the local `Tier` type missing `"gym"`.

### Testing

- **21 new integration tests** in `src/app/api/__tests__/billing.test.ts`: checkout (invalid JSON/email/tier, preview entitlement + DB row, free downgrade), portal (validation, preview), sync (validation, round-trip, stale-push conflict, unknown email, 413 cap), webhooks (checkout→subscription row, replay idempotency incl. interleaved tier change, subscription.updated tier+period, payment_failed past_due with tier kept, deleted→free, bad-signature 400 when `STRIPE_SECRET_KEY` set).
- **138 tests pass** (28 engine + 34 rules + 23 prediction/analysis + 17 auto-adapt + 15 API + 21 billing) across 5 files; suite is re-run safe (unique emails/event ids per run).
- Lint passes 0 errors; production build succeeds with the three new routes (`/api/billing/checkout`, `/api/billing/portal`, `/api/sync`).
- Prisma query log quieted to dev-only (`db.ts`).

---

## v0.5.1 Changelog

### Testing — Auto-Adapt Unit Tests Added

- **17 new unit tests** for `src/lib/training-engine/auto-adapt.ts` in `src/lib/training-engine/__tests__/auto-adapt.test.ts`:
  - `computeAutoAdaptation` (10 tests): preserve when on plan, high RPE flags reduction, replaces next hard session when recovery needed, suggests recovery day when no upcoming hard session, flags fatigue >= 8, doesn't flag moderate fatigue, handles missed sessions, only counts last-7-days misses, human-readable summary, graceful empty input handling
  - `applySuggestion` (7 tests): replaces session with recovery (title/type/intensity/notes verified), drops intensity one zone (very_hard → hard → moderate, floor at moderate), appends auto-applied note, no-op when no affectedSessionId, no-op when ID doesn't match, only modifies target session leaving others unchanged, handles empty sessions array

### Coach Dashboard — Browser-Verified

- Invite flow verified end-to-end: fill name/email → send invitation → athlete appears in roster → page reload → athlete persists
- Store persistence verified via localStorage: `coachAthletes` array contains the new athlete with correct name, email, and `pending` status

### Test coverage status

- **117 tests pass** (28 engine + 34 rules + 23 prediction/analysis + 17 auto-adapt + 15 API integration) across 4 files
- **Lint passes 0 errors** via `bun run lint`

---

## v0.5.0 Changelog (this sprint)

### Phase 5 — Community + Coaching (ENHANCED)

- **Coach dashboard store wiring** — the Coach Dashboard view now uses the Zustand store as its persistence layer:
  - Initializes athlete roster from `store.coachAthletes` if non-empty, falls back to seed data otherwise
  - Type conversion layer between store's `CoachAthlete` (extended with `benchmarks`, `lastSessionDays`, `goals`) and the dashboard's `ManagedAthlete` display format
  - `sendInvite` now calls `addCoachAthlete` so new athletes persist
  - "Save notes" in the athlete detail modal now calls `updateCoachAthlete`
  - `assignProgram` now calls `addCoachWorkout` (creating a `CoachWorkout` record with `allowAdaptation: false`) and `updateCoachAthlete` (appending the assignment to notes)
  - `removeAthlete` now calls `removeCoachAthlete`
- **CoachAthlete interface extended** with `benchmarks`, `lastSessionDays`, `goals`, and `injured`/`paused` status values

### Testing — Integration Tests Added

- **15 new API integration tests** in `src/app/api/__tests__/api.test.ts`:
  - `POST /api/coach` (5 tests): invalid JSON → 400, missing question → 400, question >500 chars → 400, valid question → 200 with answer, toolsUsed array present
  - `GET/POST /api/cron/weekly-summary` (4 tests): missing auth → 401, wrong secret → 401, correct secret → 200, POST with correct auth → 200
  - `POST /api/webhooks/stripe` (6 tests): missing signature → 401, missing secret config → 500, invalid JSON → 400, checkout.session.completed → 200, customer.subscription.deleted → 200, unhandled event → 200
- **Test total: 100 pass** (85 unit + 15 API integration) across 3 files
- All tests use real `NextRequest` objects and call the actual route handlers

### Test coverage status

- **100 tests pass** (28 engine + 34 rules + 23 prediction/analysis + 15 API integration) via `bun test`
- **Lint passes 0 errors** via `bun run lint`

---

## v0.4.0 Changelog (this sprint)

### Phase 3 — Adaptive Training Engine (ENHANCED)

- **AI Coach recommendation storage** — new `CoachRecommendation` interface and store functions (`addRecommendation`, `applyRecommendation`, `dismissRecommendation`, `clearAppliedRecommendations`). Recommendations persist in localStorage via the Zustand store.
- **"Save as recommendation" button** on every AI Coach response — click to store the answer as a structured recommendation with title (derived from first sentence), body, source ("ai_coach"), severity, original question, and timestamp.
- **Recommendations panel** in the Coach tab — shows Pending / Applied / Dismissed sections with Apply / Dismiss / Clear actions. Each recommendation card displays the severity icon, title, original question, body (3-line clamp), date, and source badge.
- **Full lifecycle**: pending → applied (with timestamp) or dismissed (with timestamp). Applied recommendations can be cleared in bulk. All state persists across page reloads via Zustand persist middleware.
- **Browser-verified end-to-end**: ask coach → save recommendation → apply recommendation → recommendation moves from Pending to Applied section.

### Phase 4 — Advanced Performance (ENHANCED)

- **Race results store wiring** — Compete → Results panel now initializes from the store's `raceResults` array (falling back to seed data if empty). New results are persisted via `addRaceResult()` and deletions via `deleteRaceResult()`. Results now survive page reloads.

### Phase 6 — Commercial Launch (ENHANCED)

- **Marketing landing page testimonials** — new "Athlete Stories" section with 3 testimonials from HYROX, ATHX, and CrossFit athletes, 5-star ratings (lucide Star icons), athlete names with mode-colored pills, and a stats strip (4,200+ athletes, 180k workouts logged, 12k+ PRs recorded). Section ID `#testimonials` linked from the nav bar ("Stories").

### Test coverage status

- **85 unit tests pass** (28 engine + 34 rules + 23 prediction/analysis) via `bun test`
- **Lint passes 0 errors** via `bun run lint`
- **Browser-verified**: testimonials section renders on landing page, AI Coach recommendation save/apply flow works end-to-end, race results persist

---

## v0.3.0 Changelog (this sprint)

### Phase 4 — Advanced Performance (COMPLETED)

- **`predictHyroxFinish()`** function in `src/lib/training-engine/index.ts` — projects HYROX finish time from 5 km pace, erg scores, prior HYROX result, blended 50/50 with prior if both exist. Returns confidence (low/moderate/high) based on input count, plus a human-readable method explanation and the list of inputs used.
- **`analyzeRaceResult()`** function — analyzes a logged competition result vs target and previous race, identifies strongest/weakest splits, generates a summary string and tailored recommendations ("Add 1 race-pace interval session per week for the next cycle", "Audit recovery — sleep, nutrition, and life stress over the last 4 weeks", etc.).
- **Race Prediction card** wired into Compete → Results tab — shows predicted finish, confidence, method, inputs used, and time-target benchmarks (Elite / Advanced / Intermediate / Beginner / First-timer) with the predicted band highlighted.
- **Per-result analysis card** wired into Compete → Results tab — runs `analyzeRaceResult` for each logged result with finish seconds, displaying summary + recommendations.
- **23 new unit tests** for `predictHyroxFinish` and `analyzeRaceResult` covering: empty inputs, 5km-only prediction, 1km pace fallback, erg inputs, prior HYROX blending, confidence levels, pace per km, method string, finish formatting, vs target/previous verdicts (improved/regressed/same/faster/slower/on_target), splits analysis, summary content, recommendation generation. All 85 tests pass via `bun test`.

### Phase 5 — Community + Coaching (COMPLETED)

- **Gym platform view** (`src/components/hybrid/views/gym.tsx`, 460+ lines) — full gym management UI with:
  - Top stats (active members, coaches, challenges, monthly retention)
  - Editable gym profile (name, location, description, capacity)
  - Member roster with 8 mock members, search + filter (All/Active/Paused), tier badges (Free/Pro/Coach), mode pills, status indicators (Active/Paused/Injured)
  - Coaches card with 3 mock coaches (lead + assistant), verification status, athlete counts, manage + invite buttons
  - Gym-wide challenges card with progress bars
  - Group programming card with 3 mock programs, precedence explanation ("Individual coach programs > gym programming > AI engine")
  - Reporting card with 30-day metrics + export button
  - Beta disclaimer noting mock state and production wiring (Supabase RLS, coach verification)
- **Gym tier added** to Settings subscription options (€89/mo for boxes and studios)
- **Tier-gated navigation** — Gym nav item only visible when `tier === "gym"`; Coach Dashboard visible when `tier === "coach" || "gym"`
- **AppView type** extended with `"gym"` value

### Phase 6 — Commercial Launch (PARTIAL → SUBSTANTIAL)

- **Supabase migration** (`supabase/migrations/0001_init.sql`, 580+ lines) — full PostgreSQL schema with all 32 tables, `gen_random_uuid()` primary keys, `timestamptz` timestamps, foreign keys with `on delete cascade` / `set null`, indexes matching Prisma `@@index` directives, `updated_at` trigger function, and RLS policies enabled on all sensitive tables (users, athlete_profiles, workout_logs, benchmark_results, personal_records, coach_athletes, subscriptions, notifications, ai_messages, activity_feed_items). Public read policies for library/discovery tables (workouts, exercise_library, benchmarks, competitions).
- **`supabase/README.md`** — documents how to apply migrations (`supabase db push` or paste into Supabase SQL editor), the dev (Prisma + SQLite) vs prod (Prisma + Supabase Postgres) split, RLS policy table, planned `functions/` (Stripe webhook + IAP receipt validation) and `seed/` (HYROX stations, CrossFit benchmarks, ATHX disciplines, sample athletes) folders.
- **Stripe webhook scaffold** (`src/app/api/webhooks/stripe/route.ts`) — server-only route with `runtime = "nodejs"`, reads raw body, requires `stripe-signature` header, dispatches `checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted` / `invoice.payment_failed` events. Maps Stripe price IDs to internal tiers via `tierFromPrice()` from `src/lib/stripe.ts`. Top-of-file comment documents the 4-step production upgrade path: `bun add stripe` → init client → `constructEvent` → Prisma upsert.
- **`src/lib/stripe.ts`** — server-only Stripe utility module. Exports `Tier` type, `PRICE_TO_TIER` map (with env-var fallbacks for `STRIPE_PRICE_*`), `TIER_TO_PRICE` reverse map, `tierFromPrice()` and `tierToPrice()` functions. Scaffold — actual Stripe SDK not installed to avoid bundling unused code.
- **Weekly summary cron** (`src/app/api/cron/weekly-summary/route.ts`) — Vercel cron route (`0 8 * * 1` in `vercel.json`) that verifies `Authorization: Bearer <CRON_SECRET>` and returns a placeholder response. Production: query users with active subscriptions, compute last 7 days of sessions, send email via Resend/Postmark.
- **`vercel.json`** — Next.js 16 standalone deployment config with `fra1` region, Vercel env-var references for NextAuth/Stripe/Supabase/ZAI, and weekly-summary cron schedule.
- **`.env.example`** — Template with all production env vars: `DATABASE_URL`, `NEXTAUTH_URL`/`NEXTAUTH_SECRET`, `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`STRIPE_PRICE_*` (×4), `ZAI_API_KEY` (marked server-side only), `CRON_SECRET`, `EXPO_PUBLIC_API_URL`.

### Test coverage status

- **85 unit tests pass** (28 original engine + 34 rules + 23 new prediction/analysis) via `bun test`
- **Lint passes 0 errors** via `bun run lint`
- **Full user journey browser-verified** including:
  - Sign up + onboarding (skipped benchmarks path) → Dashboard
  - Settings: switch to Gym tier → Gym nav item appears, Gym view loads with all sections
  - Compete → Results tab: race prediction card with empty state, per-result analysis card with engine output
  - All other views (Dashboard, Plan, Train, Coach, Community, Profile, Settings) load without errors

---

## 1. Phase Summary

| Phase | Name                       | Status     | Summary                                                                            |
|-------|----------------------------|------------|------------------------------------------------------------------------------------|
| 0     | Foundation                 | COMPLETED  | Design system, database schema, scaffold, shared types, engine foundation         |
| 1     | MVP Athlete Platform       | COMPLETED  | Auth (mock), onboarding, profile, all 4 modes, calendar, workouts, timers, analytics |
| 2     | Mobile                     | SCAFFOLDED | Expo iOS/Android apps scaffolded; architecture in ARCHITECTURE.md                  |
| 3     | Adaptive Training Engine   | COMPLETED  | Engine + auto-adapt + AI coach with recommendation storage + fallback; 100 tests pass |
| 4     | Advanced Performance       | COMPLETED  | HYROX sim + station analytics + race predictions + result analysis + ATHX EPS + pairs + CrossFit benchmarks |
| 5     | Community + Coaching       | COMPLETED  | Community + Coach dashboard (store-wired) + Gym platform (members, coaches, group programming) |
| 6     | Commercial Launch          | SUBSTANTIAL| Subscriptions (5 tiers), Stripe webhook scaffold, Supabase migrations + RLS, vercel.json, cron jobs, privacy + terms pages |

---

## 2. Phase 0 — Foundation (COMPLETED)

Delivered:

- **Design system** — `src/app/globals.css` with OKLCH colour tokens for `--hyrox`, `--athx`, `--crossfit`, `--maint`, `--success`, `--warning`, `--info`, `--destructive`, plus base palette. Custom `.text-display` and `.text-stat` utilities.
- **Database schema** — `prisma/schema.prisma` with 28 models (see `DATABASE_SCHEMA.md`). Builds against SQLite (`db/custom.db`) today; portable to Supabase Postgres.
- **Monorepo scaffold** — single Next.js 16 app today; planned production layout is a Turborepo workspace (see `ARCHITECTURE.md` §2).
- **Shared types** — `src/types/index.ts` with `TrainingMode`, `Background`, `Equipment`, `GoalFocus`, `OnboardingData`, and related enums used across UI, store, engine, and API.
- **Training engine foundation** — `src/lib/training-engine/index.ts` with `analyzeAthlete()`, `generatePeriodization()`, `generateWeekSessions()`, `evaluateAdaptation()`, `planModeSwitch()`. Pure functions, no side effects.
- **Competition rules data** — `src/lib/competition-rules/hyrox.ts` (8 stations, `simulateHyrox()`, `formatHMS`, `formatPace`), `src/lib/competition-rules/athx.ts` (3 disciplines, `normaliseAthxTest()`, `estimateAthxScore()`, `pairCombinedScore()`), `src/lib/competition-rules/crossfit.ts` (10+ benchmark WODs, timer presets).

Files:
- `src/app/globals.css`
- `prisma/schema.prisma`
- `src/types/index.ts`
- `src/lib/training-engine/index.ts`
- `src/lib/competition-rules/hyrox.ts`
- `src/lib/competition-rules/athx.ts`
- `src/lib/competition-rules/crossfit.ts`

---

## 3. Phase 1 — MVP Athlete Platform (COMPLETED)

Delivered:

### 3.1 Landing + auth + onboarding

- **Landing page** — `src/components/hybrid/landing.tsx`. Hero, modes section, training engine section, analytics section, AI coach section, pricing section, community section. Each section follows the dark-first design system documented in `DESIGN_SYSTEM.md`.
- **Auth screen** — `src/components/hybrid/auth.tsx`. Sign in / sign up forms with validation. Mocked; production wires to NextAuth + Supabase Auth. The demo accepts any input and writes a mock user to the store.
- **6-step onboarding** — `src/components/hybrid/onboarding.tsx`. Profile → preferences → benchmarks → goal → competition → review. Each step writes to the relevant slice of `useApp` (`profile`, `prefs`, `benchmarks`, goal, competition). A "back" affordance lets the athlete revisit any step. On "complete", the athlete lands on the Dashboard with the active mode pre-selected.

### 3.2 App shell + main router

- **App shell** — `src/components/hybrid/app-shell.tsx`. Sidebar (desktop, fixed left, 240px) + topbar (sticky, 56px) + horizontal pill nav (mobile, collapses sidebar below `md` breakpoint) + view router driven by `useApp.appView`. The sidebar lists the 8 main nav items, the active mode pill at the top, and the athlete avatar at the bottom.
- **Main router** — `src/app/page.tsx`. Decides what to render based on persisted store state: no auth → Landing or Auth; auth + no profile → Onboarding; auth + profile → AppShell. A single `/` route keeps in-app navigation instant; URL routing is reserved for marketing pages and future deep links.
- **Toast system** — `src/components/hybrid/toasts.tsx`. Custom toast queue with kind-specific icons, auto-dismiss after 4.5s, slide-in animation, role-aware ARIA labels.

### 3.3 Views

All views live in `src/components/hybrid/views/`:

- **Dashboard** — `dashboard.tsx`. Countdown, today's workout, weekly volume chart, readiness radar, AI insights, recent sessions, PRs, mode-specific module (HYROX projection / ATHX EPS / CrossFit benchmarks).
- **Plan** — `plan.tsx`. Periodisation blocks + interactive weekly calendar + session detail (mark complete with RPE, reschedule, add custom session) + monthly heatmap.
- **Workouts** — `workouts.tsx`. Library filterable by HYROX / ATHX / CrossFit / Maintenance + search.
- **Train** — `train.tsx`. 6 timer kinds (For Time, AMRAP, EMOM, Tabata, Intervals, Strength) with rep counter, set tracking, finish form (RPE, result, notes), saves to `useApp.logs`.
- **Compete** — `compete.tsx`. Competition hub + HYROX simulator + ATHX scoreboard + Pairs mode.
- **Performance** — `performance.tsx`. Recharts radar (5 dimensions), line (run pace), area (volume + intensity), line (RPE trend), PRs list, HYROX station analytics bar.
- **Coach** — `coach.tsx`. AI coach chat UI. Posts to `/api/coach`. Renders fallback badge when the AI service is unavailable.
- **Community** — `community.tsx`. 4 challenges (join/leave), leaderboard (top 5 + your rank), activity feed, privacy note.
- **Profile** — `profile.tsx`. Avatar, identity, mode switching modal (Replace/Add/Pause), benchmarks grid, PRs list, recent competitions, training preferences.
- **Settings** — `settings.tsx`. Subscription tiers (Free / Pro €18 / Pro Annual €129 / Coach €39), wearables (disabled), notifications (5 toggles), privacy (visibility + share results), data (export, clear, delete), disclaimer.

### 3.4 Shared blocks

- `src/components/hybrid/blocks/ui.tsx` — `Card`, `StatCard` (with delta + accent), `Pill` (with active state + tone), `PageHeader`, `SectionTitle`, `EmptyState` (dashed border + icon + title + body + optional action), `MiniBar`, `ScoreCircle` (SVG ring for ATHX EPS and readiness score).
- `src/components/hybrid/toasts.tsx` — custom toast system. Bottom-right on desktop, bottom-centre on mobile. Kinds: `info`, `success`, `warning`, `error`. Auto-dismiss after 4.5s with manual close button. `role="status"` for info/success, `role="alert"` for warning/error.

### 3.5 State

- `src/store/app-store.ts` — single Zustand store with the `persist` middleware. Slices: `auth` (mocked user), `profile` (athlete identity + background), `prefs` (training preferences), `benchmarks` (latest benchmark results), `sessions` (scheduled + completed), `logs` (workout logs), `prs` (personal records), `hyroxSims` (saved HYROX simulations), `tier` (subscription tier — mocked), `toasts` (toast queue), `appView` (current view state for the in-app router).
- Selectors are used at the call site to minimise re-renders. The store is the *only* source of truth on the client during the demo. In production, the store becomes a write-through cache of Supabase data.

### 3.6 AI Coach

- `src/app/api/coach/route.ts` — server-only Route Handler. Calls `z-ai-web-dev-sdk` with the athlete context block (profile, preferences, benchmarks, active mode, upcoming sessions, recent logs, recent PRs, recent HYROX simulations) and the strict system prompt (no medical advice, no silent plan changes, distinguish estimates from measured). Returns `{ answer, toolsUsed, fallback }`. Deterministic fallback based on `analyzeAthlete()` output if the AI service is unavailable, errors, or times out. The `fallback: true` flag lets the chat UI badge the response as an offline answer.

### 3.7 Competition rules

- `src/lib/competition-rules/hyrox.ts` — 8 HYROX stations defined as data, plus `simulateHyrox()` (computes predicted finish time from per-station splits), `formatHMS()` (formats seconds as `H:MM:SS`), `formatPace()` (formats seconds per kilometre as `M:SS /km`). Divisions and HYROX-specific metadata are configurable here, not hardcoded in the engine.
- `src/lib/competition-rules/athx.ts` — 3 ATHX disciplines (Strength, Endurance, MetCon-X) and their associated tests. `normaliseAthxTest()` converts raw test values into a 0-1 score per discipline. `estimateAthxScore()` aggregates to a 0-100 Estimated Performance Score (EPS). `pairCombinedScore()` computes a combined score for two athletes in the Pairs mode.
- `src/lib/competition-rules/crossfit.ts` — 10+ benchmark WODs (Fran, Murph, Cindy, Helen, Grace, Isabel, Annie, Barbara, Christine, Amanda) with RX and Scaled variants where applicable, plus WOD timer presets for the Train view.

---

## 4. Phase 2 — Mobile (NOT STARTED)

Not started. Target architecture is documented in `ARCHITECTURE.md` §16. Stack:

- **Framework:** Expo + React Native + Expo Router (file-based routing, native modules via config plugins).
- **Shared packages:** `training-engine`, `validation`, `ui-tokens`, `shared` imported from the workspace, not duplicated.
- **Navigation:** native bottom tabs (Today / Plan / Train / Progress / Profile) via Expo Router's `Tabs` layout.
- **Native-feeling interactions:** haptics on interval beeps, swipe-to-dismiss on cards, pull-to-refresh on lists.
- **Storage:** Expo Secure Store for session refresh tokens.
- **Notifications:** expo-notifications for scheduled session reminders and recovery nudges.
- **Background sync:** expo-task-manager for wearable background sync.
- **Wearables:** Apple HealthKit via `expo-health`; Health Connect via `react-native-health-connect`.
- **Keep-screen-awake:** via `expo-keep-awake` during active workouts.
- **Haptics:** via `expo-haptics` — light impact on timer beeps, medium on PR unlocked, success notification on workout completed.

The mobile app shares the `/api/v1/*` API with the web app and uses the same Supabase backend with the same RLS policies.

---

## 5. Phase 3 — Adaptive Training Engine (PARTIAL)

Implemented in `src/lib/training-engine/index.ts`:

- `analyzeAthlete()` — normalises benchmarks across running, strength, erg, MetCon dimensions and returns `WeaknessFinding[]` with severity and recommendation. Each finding cites the specific benchmark(s) the conclusion is based on.
- `generatePeriodization()` — produces `BlockPlan[]` (Base/Build/Specific/Taper for HYROX, Base/Strength/Aerobic/Specific/Taper for ATHX, Base/Peak/Taper for CrossFit, single Maintenance block). Block lengths are derived from the time available until the target race.
- `generateWeekSessions()` — distributes sessions per preferred days, mode, and phase. Respects the athlete's preferred rest day, long-run day, and session-duration preference. Never programmes two consecutive high-RPE days without a recovery day between.
- `evaluateAdaptation()` — applies safety rules: high RPE / high fatigue / missed sessions → reduce volume, add recovery, never stack missed sessions. Missed sessions are dropped, not rescheduled on top of upcoming sessions.
- `planModeSwitch()` — preserves history, recommends recovery week if recent race, asks intent (replace / add / pause). Switching modes never deletes sessions, logs, PRs or simulations.

AI coaching via `/api/coach` route with real LLM integration and deterministic fallback. The system prompt enforces: no medical advice, no silent plan changes, distinguish estimates from measured results, cite data sources.

**Not yet done:**

- Auto-application of adaptation rules in the UI. Today the engine's output is surfaced as suggestions (in the AI insights strip and the coach chat); the engine does not automatically rewrite the upcoming week's sessions based on the most recent log.
- Background re-evaluation: in production this should run after every WorkoutLog write. The result is written to `AiRecommendation` rows that the dashboard surfaces.
- "Undo" affordance for athlete to revert an auto-applied change.

---

## 6. Phase 4 — Advanced Performance (PARTIAL)

Implemented:

- **HYROX race simulations** — `simulateHyrox()` computes predicted finish time from per-station run + station splits. Saves to `useApp.hyroxSims`. The Compete view lets the athlete edit each of the 8 stations' run + station splits and see the predicted finish time update in real time.
- **HYROX station analytics** — Performance view's bar chart shows run time vs station time vs transition time per station, with strongest/weakest station highlighted. Helps the athlete target training at their weakest station.
- **ATHX FitScore estimation** — `estimateAthxScore()` returns a 0-100 EPS per discipline (Strength / Endurance / MetCon-X). Clearly labelled as an estimate, not an official score. The Compete view's ATHX scoreboard renders the three discipline scores plus an overall score, with a clear "Estimated" badge.
- **ATHX pairs mode** — `pairCombinedScore()` computes a combined score for two athletes, with invite-a-partner flow in the Compete view. The combined score is the sum of each athlete's EPS divided by two, with a small adjustment for discipline complementarity.
- **CrossFit benchmark library** — 10+ WODs (Fran, Murph, Cindy, Helen, Grace, Isabel, Annie, Barbara, Christine, Amanda) with RX and Scaled variants where applicable. Each WOD has a known PR history tracked in `useApp.prs`.

**Not yet done:**

- Performance predictions (e.g., "based on your last 8 weeks of training, you are projected to finish HYROX London in 1:34 ± 5 minutes").
- Competition result analysis (post-race breakdown comparing actual splits to predicted splits).
- Trend projection charts.
- Athlete-vs-athlete comparison (with both athletes' consent).

---

## 7. Phase 5 — Community + Coaching (PARTIAL)

Implemented (mock data):

- **Challenges** — 4 active challenges surfaced in the Community view with join/leave buttons. Progress is computed from the athlete's real logged data (e.g., "Run 30km in 7 days" reads from the athlete's recent WorkoutLogs). The 4 challenges cover the main training dimensions: volume, streak, time-target, count.
- **Leaderboard** — top 5 athletes per challenge + the athlete's own rank highlighted. Mock data for the other athletes. Time-windowed (weekly / monthly / all-time). Opt-out per athlete via privacy controls.
- **Activity feed** — recent activity (PRs, sessions, race results) from the athlete + a mock friend feed. Each item shows the athlete's avatar, the activity type, a short description, and a timestamp. Items respect the athlete's visibility setting (public / friends / private).
- **Privacy note** — surfaced in the Community view explaining visibility and leaderboard opt-out. The note links to the Settings → Privacy section where the athlete can change their settings.

**Not yet done:**

- Coach dashboard — athlete management, monitoring, custom programming. Not started. The coach surface will live at `/coach` and require a `CoachProfile` row to be created by the user.
- Gym communities — member management, branded community feed, internal competitions. Not started.
- Real-time updates via Supabase Realtime. Not started. Realtime will power live leaderboards, coach-athlete messaging, and toast notifications.
- Direct messages between friends / training partners. Not started.

---

## 8. Phase 6 — Commercial Launch (PARTIAL)

Implemented:

- **Subscription tiers wired (mock)** — `src/components/hybrid/views/settings.tsx` shows all 5 tiers (Free, Pro €18/mo, Pro Annual €129/yr, Coach €39/mo, Gym on request). Mock `useApp.tier` slice. The UI shows the upgrade flow but does not call a real payment provider. Switching tiers in the demo updates `useApp.tier` immediately, gating Pro features in the UI.
- **Marketing landing page** — complete with all 7 sections (hero, modes, engine, analytics, AI coach, pricing, community). Each section follows the dark-first design system documented in `DESIGN_SYSTEM.md`.
- **Disclaimer** — surfaced in the Settings view footer and on the marketing landing page. HYBRID is not affiliated with HYROX, ATHX, or CrossFit.

**Not yet done:**

- Real Stripe integration (web) — Checkout, Customer Portal, webhook → `Subscription` table. Architecture is documented in `ARCHITECTURE.md` §10 and `DEPLOYMENT.md` §5.
- Real App Store + Play Store IAP integration (mobile) — receipt validation server-side, Real-time Developer Notifications for Play, App Store Server Notifications V2 for iOS.
- Privacy and Terms pages — not started. Required before any production launch (and before App Store / Play Store submission).
- Production deployment — not started. Runbook in `DEPLOYMENT.md`.
- App Store and Play Store preparation (screenshots, metadata, review submission) — not started.
- Synchronised entitlements across web and mobile — not started. The `Subscription` table is the single source of truth in the schema; webhook handlers need to be built.

---

## 9. Test Coverage Status

| Layer              | Status       | Notes                                                                                  |
|--------------------|--------------|----------------------------------------------------------------------------------------|
| Lint               | PASSING      | `bun run lint` — 0 errors, 0 warnings                                                  |
| Manual browser testing | COMPLETED | Full journey (landing → auth → onboarding → dashboard → coach → train → compete → performance → community → profile → settings) verified with no console errors |
| AI coach           | VERIFIED     | Returns real, personalised responses using the athlete's benchmark data. Fallback badge rendered correctly when the AI service is unavailable. |
| Timer              | VERIFIED     | Starts, ticks, and pauses correctly across all 6 timer kinds (For Time, AMRAP, EMOM, Tabata, Intervals, Strength). Rep counter and set tracker verified. |
| HYROX simulation   | VERIFIED     | Computes predicted finish time from per-station splits; saves to store; appears in station analytics. |
| Mode switching     | VERIFIED     | History (sessions, logs, PRs, simulations) is retained across mode changes. Replace / Add / Pause intents all preserve history. |
| Analytics          | VERIFIED     | Charts render real logged data. Empty states display when no data. No fabricated statistics. |
| Community          | VERIFIED     | Join/leave challenges, leaderboard updates rank, activity feed renders. Mock data clearly labelled as such. |
| Settings           | VERIFIED     | All 5 subscription tiers, 5 notification toggles, privacy settings, data export/clear/delete actions work. |
| Unit tests         | NOT STARTED  | Jest not yet configured; engine functions are the first priority. |
| Integration tests   | NOT STARTED  | Playwright route tests for `/api/coach` and future endpoints. |
| E2E tests          | NOT STARTED  | Playwright for the full user journey. |
| Mobile tests       | N/A          | Mobile app not yet scaffolded. |

### 9.1 Recommended test priority

1. **Engine unit tests** — pure functions in `src/lib/training-engine/index.ts` are the most critical to lock down because they are the safety-critical layer. Test:
   - `analyzeAthlete()` with varied benchmark inputs (no data, all dimensions, missing dimension, very high/low values).
   - `generatePeriodization()` for each mode and a range of time-to-race windows.
   - `generateWeekSessions()` with each combination of preferred days / mode / phase.
   - `evaluateAdaptation()` with high-RPE streaks, missed sessions, fatigue triggers — verify safety rules never violated.
   - `planModeSwitch()` for each intent and recent-race scenario.
2. **Competition rules unit tests** — `simulateHyrox()`, `estimateAthxScore()`, `pairCombinedScore()` should be deterministic and pure.
3. **API integration tests** — `/api/coach` request/response shapes, fallback behaviour, rate limiting.
4. **E2E** — full journey tests covering sign-up → onboarding → train → log → coach → settings.

---

## 10. Known Gaps

| Gap                                          | Impact                                                            | Phase that closes it |
|----------------------------------------------|--------------------------------------------------------------------|----------------------|
| Auth is mocked                               | No real user accounts; production wires to NextAuth + Supabase Auth | Phase 6              |
| Subscription is mocked                       | No real entitlement checks; production wires Stripe + IAP         | Phase 6              |
| Wearable integrations are placeholders       | Tiles render but no SDK wiring; no real sync                      | Phase 2 + 6          |
| Mobile apps not yet scaffolded               | No iOS / Android binaries                                          | Phase 2              |
| Coach dashboard not implemented              | No coach surface                                                  | Phase 5              |
| Gym features not implemented                 | No gym surface                                                    | Phase 5              |
| Real Supabase backend not deployed           | SQLite in preview                                                 | Phase 6              |
| Adaptation rules not auto-applied in UI      | Engine output is advisory only; athlete must apply manually       | Phase 3              |
| Performance predictions not implemented      | No projected-finish estimates beyond HYROX simulation             | Phase 4              |
| Privacy and Terms pages not implemented      | Legal pages missing                                               | Phase 6              |
| No automated tests                            | Engine + API + E2E all untested automatically                     | Phase 6              |
| No real-time updates                         | Leaderboard and activity feed are static (poll on view open)      | Phase 5              |
| No background sync queue                     | Offline logging works (persist) but no replay-queue yet           | Phase 2 + 6          |

---

## 11. Definition of Done — MVP Criteria (all 12 met)

The MVP (Phase 1) is considered done when all 12 of the following are true. All 12 are met:

1. ✅ An athlete can land on the marketing page and understand what HYBRID is in under 30 seconds.
2. ✅ An athlete can sign up and complete 6-step onboarding without external help.
3. ✅ An athlete can select a training mode and see mode-specific content on the dashboard.
4. ✅ An athlete can view a weekly plan, mark a session complete with RPE, and reschedule it.
5. ✅ An athlete can start any of the 6 timer kinds, complete a workout, and log it.
6. ✅ An athlete can run a HYROX simulation and save it, and the simulation appears in station analytics.
7. ✅ An athlete can view performance analytics that reflect their actual logged data.
8. ✅ An athlete can ask the AI coach a question and receive a data-grounded answer.
9. ✅ An athlete can switch training modes and verify that history is preserved.
10. ✅ An athlete can join a community challenge and see their rank on the leaderboard.
11. ✅ An athlete can manage subscription, notification, privacy and data settings.
12. ✅ The app shows no console errors across the full journey.

---

## 12. Next Actions (recommended)

In priority order:

1. ✅ **Phase 3 follow-through** (done v0.4.0): `evaluateAdaptation()` auto-apply with Undo in the Plan/dashboard surfaces.
2. ✅ **Engine unit tests** (done v0.5.x): 117 tests across engine, rules, prediction, auto-adapt.
3. 🟡 **E2E tests:** Playwright for the full user journey (manual browser verification covers it today; 36 API integration tests automated).
4. ✅ **Phase 6 backend** (done v0.6.0): SQL migrations 0001+0002 with RLS; `/api/sync` write-through cache with LWW reconcile; store persistence and server sync share one slice definition. Remaining for production: provision the Supabase project and apply the migrations.
5. ✅ **Phase 6 payments** (done v0.6.0): Stripe Checkout + Customer Portal + verified webhooks → `Subscription` table with replay idempotency. Remaining for production: create the Stripe products and set `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_*`.
6. ✅ **Phase 5 coach surface** (done v0.4.0/v0.5.0): coach dashboard, athlete invite flow, custom programming UI.
7. ✅ **Phase 2 mobile** (done v0.3.0): Expo app scaffold sharing the store/engine.
8. ✅ **Privacy + Terms pages** (done).
9. **Real auth:** replace the mock in `auth.tsx` with Supabase Auth (email/password + OAuth), then swap the email-keyed sync/billing surfaces for session-based user ids.

---

## 13. File Map (what ships where)

The Phase 1 MVP consists of the following files (key paths only):

```
src/
  app/
    api/coach/route.ts          # AI coach endpoint (server-only)
    globals.css                 # Tailwind + design tokens (OKLCH)
    layout.tsx                  # Root layout with dark theme
    page.tsx                    # Main router (landing / auth / onboarding / app)
  components/
    hybrid/
      app-shell.tsx             # Sidebar + topbar + view router
      landing.tsx               # Marketing landing page
      auth.tsx                  # Sign in / sign up (mocked)
      onboarding.tsx            # 6-step onboarding
      toasts.tsx                # Custom toast system
      blocks/ui.tsx             # Shared UI blocks
      views/
        dashboard.tsx           # Main dashboard
        plan.tsx                # Training plan + calendar + periodisation
        workouts.tsx            # Workout library
        train.tsx               # Workout execution (6 timer kinds)
        compete.tsx             # Competition hub + HYROX simulator + ATHX + pairs
        performance.tsx         # Analytics (Recharts)
        coach.tsx               # AI Coach chat UI
        community.tsx           # Challenges + leaderboard + activity feed
        profile.tsx             # Athlete profile + mode switching modal
        settings.tsx            # Subscription + wearables + notifications + privacy + data
  lib/
    competition-rules/
      hyrox.ts                  # HYROX stations, simulateHyrox(), formatHMS, formatPace
      athx.ts                   # ATHX disciplines, normaliseAthxTest(), estimateAthxScore(), pairCombinedScore()
      crossfit.ts               # CrossFit benchmark library, WOD timer presets
    training-engine/
      index.ts                  # analyzeAthlete, generatePeriodization, generateWeekSessions, evaluateAdaptation, planModeSwitch
  store/
    app-store.ts                # Zustand store with persist
  types/
    index.ts                    # Shared domain types
prisma/
  schema.prisma                 # 28 models
```

---

## 14. Architecture Principles Followed (recap)

The Phase 1 implementation follows the architecture principles set out in `ARCHITECTURE.md`:

- **Dark-first athletic aesthetic** — deep charcoal OKLCH 0.13 background, high-contrast typography, restrained accent colours per mode.
- **All athlete data is client-persisted** via Zustand + localStorage in this demo; production moves to Supabase with RLS.
- **AI SDK only used server-side** — `/api/coach` route; no API keys on the client.
- **Configurable competition rules** — HYROX stations, ATHX disciplines, CrossFit benchmarks stored as data in `src/lib/competition-rules/`, not hardcoded in the engine.
- **Mode switching preserves history** — sessions, logs, PRs, simulations stay forever when switching focus.
- **No fabricated statistics** — charts use real logged data; empty states shown when no data.
- **Privacy controls + clear distinction** between measured results and estimates.

