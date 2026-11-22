# HYBRID Performance Platform — Implementation Progress

> **Last updated:** current sprint  
> **Source of truth:** the codebase in `/home/z/my-project/`  
> **Status:** Phase 0 + Phase 1 MVP shipped; Phases 3, 4, 5, 6 partially wired

---

## 1. Phase Summary

| Phase | Name                       | Status     | Summary                                                                            |
|-------|----------------------------|------------|------------------------------------------------------------------------------------|
| 0     | Foundation                 | COMPLETED  | Design system, database schema, scaffold, shared types, engine foundation         |
| 1     | MVP Athlete Platform       | COMPLETED  | Auth (mock), onboarding, profile, all 4 modes, calendar, workouts, timers, analytics |
| 2     | Mobile                     | NOT STARTED| Expo iOS/Android apps planned; architecture in ARCHITECTURE.md                     |
| 3     | Adaptive Training Engine   | PARTIAL    | Engine functions implemented; AI coach with real LLM + fallback; auto-apply in UI not wired |
| 4     | Advanced Performance        | PARTIAL    | HYROX sim + station analytics, ATHX EPS + pairs, CrossFit benchmarks complete; predictions pending |
| 5     | Community + Coaching       | PARTIAL    | Community (challenges, leaderboard, feed) with mock data; coach + gym not started    |
| 6     | Commercial Launch          | PARTIAL    | Subscription tiers wired (mock); real Stripe + IAP not started; landing page complete |

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

1. **Phase 3 follow-through:** wire `evaluateAdaptation()` to auto-apply suggestions to the upcoming week's sessions in the Plan view, with an "Undo" affordance.
2. **Engine unit tests:** set up Jest, cover `src/lib/training-engine/index.ts` and `src/lib/competition-rules/*.ts` to 100%.
3. **E2E tests:** Playwright for the full user journey (landing → settings).
4. **Phase 6 backend:** deploy Supabase, apply Prisma migrations, enable RLS, replace the Zustand store with a write-through cache.
5. **Phase 6 payments:** wire Stripe Checkout + Customer Portal + webhooks → `Subscription` table.
6. **Phase 5 coach surface:** scaffold coach dashboard, athlete invite flow, custom programming UI.
7. **Phase 2 mobile:** scaffold Expo app, share `training-engine` + `validation` + `ui-tokens` packages.
8. **Privacy + Terms pages:** required before any production launch.

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

