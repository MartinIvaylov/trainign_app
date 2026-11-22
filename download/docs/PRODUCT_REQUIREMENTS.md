# HYBRID Performance Platform — Product Requirements Document

> **Version:** 1.0  
> **Status:** Phase 0 + Phase 1 MVP shipped; Phase 3 partially wired  
> **Owner:** HYBRID Product Team  
> **Last reviewed:** current sprint

---

## 1. Product Vision

**ONE ATHLETE. ONE PROFILE. ONE TRAINING HISTORY. MULTIPLE COMPETITION FORMATS.**

HYBRID is a single-platform training environment that lets an athlete prepare for any of the major hybrid fitness competitions — HYROX, ATHX Games, CrossFit — without losing the continuity of their training history, personal records, or logged sessions. Where every other app on the market forces an athlete to choose a discipline and rebuild their identity from scratch each season, HYBRID treats the athlete as a *single evolving system* that competes in multiple formats.

The product's job is to:

1. **Train** the athlete with mode-aware programming that adapts to their measured strengths and weaknesses.
2. **Benchmark** the athlete across a stable set of standardised tests so progress is comparable over time and across modes.
3. **Compete** with simulator tools, score estimators and competition logging that mirror real event conditions.
4. **Evolve** the athlete by intelligently switching training focus between modes while preserving every session, log, PR, and simulation ever recorded.

---

## 2. Target Audience

### 2.1 Primary audience

- **HYROX first-timers** — athletes entering their first HYROX season who need structure, a countdown to race day, and a per-station simulator that turns "I think I can finish in 90 minutes" into a concrete training target.
- **Experienced HYROX athletes** — repeat racers chasing a personal best or qualifying time who need per-station analytics, weakness detection across the 8 stations, and periodisation that peaks for a specific race date.
- **ATHX competitors** — athletes preparing for the ATHX Games (Strength / Endurance / MetCon-X disciplines) who need a single Estimated Performance Score (0-100) and pairs-mode combined scoring.
- **CrossFit athletes transitioning to HYROX or ATHX** — athletes with a CrossFit base who want to add structured running and race-specific work without abandoning their benchmark library (Fran, Murph, etc.) or losing their PRs.
- **Hybrid athletes** — athletes who deliberately compete across multiple formats within a 12-month cycle and need to switch training focus between modes while preserving one continuous training history.

### 2.2 Secondary audience

- **Boxes and studios** — affiliates who want to programme for members across multiple formats and run internal challenges.
- **Coaches and trainers** — independent coaches who want to programme for, monitor, and adapt the training of multiple athletes from a single dashboard.
- **Training partners** — pairs of athletes (especially relevant to HYROX Pairs and ATHX Pairs events) who want a shared scoreboard and combined-result estimation.

---

## 3. Positioning Statement

**Train. Benchmark. Compete. Evolve.**

HYBRID is the only training platform that treats the athlete as one evolving system across multiple competition formats. We are not a HYROX app, an ATHX app, or a CrossFit app — we are an *athlete platform* that supports all three, plus a maintenance mode for in-season recovery, with a single shared profile, shared benchmarks, shared PRs, and shared training history.

---

## 4. Training Modes

The platform supports four training modes. Each athlete has exactly one **active mode** at a time, but switching modes never deletes history — sessions, logs, PRs and simulations stay forever. See §7 for the mode switching workflow.

### 4.1 HYROX

- Race countdown to a target race date, surfaced on the dashboard.
- 8-station HYROX simulator with per-station run + station splits, predicted finish time, strongest/weakest station analysis, and saved simulations for tracking.
- Station-specific analytics (running pace, station time, transition time) across logged simulations.
- Periodisation blocks: Base / Build / Specific / Taper.
- HYROX-specific workouts (1000m run + 20 burpee broad jumps, sled push intervals, wall ball + run combinations, etc.).

### 4.2 ATHX

- Three disciplines modelled: Strength, Endurance, MetCon-X.
- Estimated Performance Score (EPS) on a 0-100 scale per discipline, computed from normalised benchmark data.
- Pairs mode: combined score + invite-a-partner flow.
- ATHX scoreboard for logging test results and tracking improvement across the three disciplines.
- Periodisation blocks: Base / Strength / Aerobic / Specific / Taper.

### 4.3 CrossFit

- Benchmark WOD library (Fran, Murph, Cindy, Helen, Grace, Isabel, Annie, Barbara, Christine, Amanda, etc.).
- RX and Scaled variants where applicable.
- WOD timer presets: For Time, AMRAP, EMOM, Tabata, Intervals.
- Benchmark PRs tracked separately from competition PRs.
- Periodisation blocks: Base / Peak / Taper.

### 4.4 Maintenance

- Lower-volume, lower-intensity programming used between competition seasons or during recovery.
- Cross-mode sessions that keep all dimensions trained without targeting any single competition.
- Single maintenance block (no periodisation phases).
- Explicit recovery week recommendations driven by `evaluateAdaptation()`.

---

## 5. Adaptive Training Engine

The adaptive training engine lives in `src/lib/training-engine/index.ts` as a set of **pure functions with no side effects**. AI can augment the engine's output but cannot override safety constraints.

### 5.1 Responsibilities

1. `analyzeAthlete()` — normalises benchmarks across running, strength, erg, and MetCon dimensions and returns a `WeaknessFinding[]` with severity and recommendation.
2. `generatePeriodization()` — produces `BlockPlan[]` using mode-specific phases (see §5.2).
3. `generateWeekSessions()` — distributes sessions per preferred training days, active mode, and current phase.
4. `evaluateAdaptation()` — applies safety rules: high RPE / high fatigue / missed sessions trigger volume reduction and recovery insertion; never stacks missed sessions on top of upcoming sessions.
5. `planModeSwitch()` — preserves history when switching focus; recommends a recovery week if a recent race was logged; asks the athlete for intent (Replace / Add / Pause).
6. Compute a readiness score for dashboard surfacing.
7. Project HYROX finish time from per-station splits (delegated to `src/lib/competition-rules/hyrox.ts`).
8. Estimate ATHX EPS from benchmark inputs (delegated to `src/lib/competition-rules/athx.ts`).
9. Suggest deload weeks based on accumulated fatigue.
10. Mark simulations vs measured results distinctly — the engine never conflates estimates with recorded race splits.

### 5.2 Periodisation phases per mode

| Mode        | Phases                                          |
|-------------|-------------------------------------------------|
| HYROX       | Base → Build → Specific → Taper                 |
| ATHX        | Base → Strength → Aerobic → Specific → Taper    |
| CrossFit    | Base → Peak → Taper                             |
| Maintenance | single Maintenance block (no phase progression) |

### 5.3 Adaptation examples

- An athlete logs RPE 9 on three consecutive sessions in a week → next week's volume drops 15-25% and a recovery session is inserted.
- An athlete misses 2 sessions in a block → those sessions are dropped, not stacked on the upcoming week.
- An athlete logs fatigue 8/10 in the morning readiness form → today's session is downshifted one intensity tier.
- An athlete records a recent race result → a recovery week is recommended before any new block begins.

### 5.4 Safety requirements

- **Never stack missed sessions.** Missed sessions are dropped, not rescheduled on top of upcoming sessions.
- **Never increase volume >10% week-over-week** without an explicit override from the athlete.
- **Never programme two consecutive high-RPE days** without a recovery day between.
- **AI augmentation is advisory only.** The AI coach may suggest plan changes, but the engine's safety rules always win.
- **Estimates vs measured results are always distinct.** Simulated HYROX finishes and estimated ATHX EPS are labelled as such and never written back as race results.

---

## 6. Intelligent Mode Switching

Mode switching is a first-class workflow, not a destructive operation. The athlete is asked for their intent when switching modes:

| Intent     | Behaviour                                                                                      |
|------------|------------------------------------------------------------------------------------------------|
| **Replace**| New mode becomes the active focus; the previous mode's sessions are paused but not deleted.   |
| **Add**    | New mode is added alongside the current focus; both modes' sessions appear on the calendar.   |
| **Pause**  | Current mode is paused (sessions greyed out, not deleted); athlete returns to it later.        |

In all three cases, history is preserved: sessions, logs, PRs and simulations stay forever. The `planModeSwitch()` function in `src/lib/training-engine/index.ts` is the single source of truth for this behaviour.

---

## 7. Web App Structure

### 7.1 Main navigation (8 items)

1. **Dashboard** — countdown, today's workout, weekly volume chart, readiness radar, AI insights, recent sessions, PRs, mode-specific module.
2. **Plan** — periodisation blocks, weekly calendar (interactive), session detail drawer (mark complete with RPE, reschedule, add custom session), monthly heatmap.
3. **Workouts** — library filterable by mode, search, RX/Scaled tags.
4. **Train** — workout execution with 6 timer kinds (For Time, AMRAP, EMOM, Tabata, Intervals, Strength), rep counter, set tracking, finish form (RPE, result, notes), saves to logs.
5. **Compete** — competition hub, HYROX simulator, ATHX scoreboard, Pairs mode.
6. **Performance** — Recharts radar (5 dimensions), line (run pace), area (volume + intensity), line (RPE trend), PRs list, HYROX station analytics bar.
7. **Coach** — AI Coach chat interface backed by `/api/coach`.
8. **Community** — challenges, leaderboard, activity feed, privacy note.

### 7.2 Dashboard components

- Race countdown (mode-aware: HYROX race date, ATHX event date, CrossFit Open dates).
- Today's workout card with quick-action to Train.
- Weekly volume chart (area chart, mode-coloured).
- Readiness radar (Recharts radar, 5 dimensions).
- AI insights strip (top 3 recommendations from the engine).
- Recent sessions list (last 5 with RPE, mode, duration).
- PRs strip (latest 3 personal records).
- Mode-specific module:
  - HYROX → finish projection card.
  - ATHX → Estimated Performance Score card.
  - CrossFit → benchmark PRs card.

### 7.3 Calendar features

- Weekly view (Mon → Sun grid of sessions).
- Monthly heatmap (volume by day, colour-graded).
- Click a session → drawer with detail, mark complete (RPE slider), reschedule, or delete.
- Add custom session to any day.
- Drag-and-drop reschedule is planned (not yet implemented).
- Empty days show a faint "+" affordance.

### 7.4 Workout experience requirements

- Six timer kinds: For Time (count up), AMRAP (count up with round counter), EMOM (interval beeps every minute), Tabata (20/10 protocol), Intervals (work/rest configurable), Strength (set/rep tracker, rest timer).
- Rep counter with +/- controls and direct entry.
- Set tracking with auto-advance on completion.
- Finish form: RPE (1-10), result (time / rounds / load), notes (free text).
- On finish, the session writes to `WorkoutLog` and triggers PR checks against `PersonalRecord`.
- Workout logging works offline; sessions are queued and synced when connectivity returns.

---

## 8. Mobile App Structure (planned)

The mobile app is not yet built. The architecture is documented in `ARCHITECTURE.md`. The bottom nav will be:

1. **Today** — countdown, today's session, quick-start workout.
2. **Plan** — weekly calendar, swipeable.
3. **Train** — timer in full screen, keep-screen-awake, haptic feedback on interval beeps.
4. **Progress** — analytics charts and PRs.
5. **Profile** — avatar, mode switching, settings.

### Mobile-specific capabilities

- Native timer that survives backgrounding.
- Apple HealthKit / Health Connect sync (background).
- Push notifications for scheduled sessions and recovery reminders.
- Haptic feedback on interval transitions.
- Keep-screen-awake during active workouts.
- Offline-first logging with background sync queue.
- Camera capture for activity feed posts (planned).
- Biometric quick-unlock (planned).

---

## 9. Performance Analytics

### 9.1 Global dashboard

A single performance dashboard that aggregates all logged data across modes. No fabricated statistics — every chart is fed by real `WorkoutLog`, `BenchmarkResult`, `PersonalRecord`, and `RaceResult` rows. When there is no data, an empty state is shown.

### 9.2 Performance dimensions

Seven dimensions are tracked across all modes:

1. **Aerobic endurance** — running pace, 5k/10k times, run volume.
2. **Strength** — load lifted, benchmark strength scores.
3. **MetCon capacity** — benchmark WOD times, AMRAP scores.
4. **Work capacity** — weekly training volume, RPE-weighted.
5. **Skill/movement** — technique-driven movements (wall ball, burpee broad jumps, etc.).
6. **Recovery** — readiness scores, sleep, fatigue trends.
7. **Consistency** — sessions completed vs scheduled, streak counts.

The dashboard radar currently visualises 5 of these (see `src/components/hybrid/views/performance.tsx`); the remaining two are surfaced in dedicated widgets.

### 9.3 Mode-specific analytics

- **HYROX** — per-station bar chart (run time vs station time vs transition), predicted finish trend over simulations, strongest/weakest station.
- **ATHX** — radar across Strength / Endurance / MetCon-X disciplines, EPS trend.
- **CrossFit** — benchmark PRs list, RX vs Scaled breakdown, recent WOD times.
- **Maintenance** — volume + intensity area chart, readiness trend, recovery quality.

---

## 10. AI Coach

### 10.1 Capabilities

- Conversational coaching grounded in the athlete's real data (benchmarks, recent logs, PRs, upcoming sessions, HYROX finish simulations).
- Answers training questions, explains plan decisions, suggests adjustments.
- Distinguishes between measured results and estimates.
- Refuses to give medical advice and refuses to silently change the training plan.
- Falls back to a deterministic response if the AI service is unavailable.

### 10.2 Response requirements

- Cite the data point(s) the answer is based on.
- Distinguish measured vs estimated values explicitly.
- Never prescribe medical advice; refer the athlete to a clinician for pain/injury.
- Never silently change the training plan; any plan change is surfaced as a suggestion the athlete must confirm.
- Stay within the system prompt guardrails (see `API_DOCUMENTATION.md`).

### 10.3 Data sources

- Athlete profile + preferences (Zustand store, production: Supabase).
- Benchmarks + benchmark results.
- Recent workout logs (last 14 days).
- Recent personal records (last 90 days).
- Upcoming scheduled sessions (next 14 days).
- HYROX simulation history (last 5 simulations).
- Active training mode.

The full context block is assembled server-side in `/api/coach/route.ts` and never exposes API keys to the client.

---

## 11. Community Features

### 11.1 Challenges

- Four active challenges are surfaced (e.g., "Run 30km in 7 days", "5 HYROX sims in a week", "Sub-5 Fran", "30-day streak").
- Join / leave with one tap.
- Progress is computed from the athlete's real logged data.

### 11.2 Leaderboards

- Top 5 athletes per challenge + the athlete's own rank highlighted.
- Time-windowed (weekly / monthly / all-time).
- Opt-out per athlete via privacy controls.

### 11.3 Gym communities (planned)

- Boxes and studios can create a private community.
- Members see internal leaderboards and challenges.
- Gym admins can pin announcements and run internal competitions.

### 11.4 Privacy controls

- Per-athlete visibility setting: public / friends only / private.
- Per-athlete "share results in feed" toggle.
- Leaderboard opt-out.
- Explicit privacy note in the Community view: "Your data is only shared when you choose to share it."

---

## 12. Coach and Gym Platform (planned)

### 12.1 Coach capabilities

- Invite athletes via email or invite link.
- View athlete dashboard (training, logs, PRs, readiness).
- Build custom training plans per athlete.
- Receive AI-assisted suggestions, but the coach's programming always wins.
- Communicate with athletes via in-app messaging (planned).

### 12.2 Gym capabilities

- Member management (invite, suspend, remove).
- Group programming across all members.
- Internal challenges and leaderboards.
- Branded community feed.

### 12.3 Precedence rules

1. Athlete's manual plan overrides always win.
2. Coach's custom programming overrides AI suggestions.
3. AI suggestions are advisory only.
4. The training engine's safety rules (§5.4) cannot be overridden by anyone, including coaches.

---

## 13. Competition Hub

### 13.1 Configurable events

- HYROX stations, ATHX disciplines, and CrossFit benchmarks are stored as data in `src/lib/competition-rules/`, not hardcoded. New stations, disciplines or benchmarks are added by editing the relevant file, not by touching engine code.

### 13.2 Manual entry

- Athletes log competition results manually (time, rounds, load, splits).
- Results are tagged as **verified** (entered from a sanctioned event with a result link) or **user-submitted**.

### 13.3 Verified vs user-submitted

- **Verified** results show a check-mark badge and are eligible for community leaderboards.
- **User-submitted** results are private to the athlete unless they explicitly opt in to share.

### 13.4 No affiliation disclaimer

HYBRID is an independent training platform. We are not affiliated with, endorsed by, or sponsored by HYROX, ATHX Games, or CrossFit. All competition names and formats are property of their respective owners. The Competition Hub is a personal logging tool for athletes preparing for these events.

---

## 14. Monetization

### 14.1 Tiers

| Tier           | Price              | Audience              | Key features                                                                 |
|----------------|--------------------|-----------------------|-------------------------------------------------------------------------------|
| **Free**       | €0                 | anyone                | Single training mode, basic analytics, manual logging                         |
| **Pro**        | €15-20 / month     | serious athletes      | All 4 modes, full analytics, AI coach, mode switching, HYROX simulator, pairs  |
| **Pro Annual** | €100-150 / year    | committed athletes    | Pro features at ~30% discount vs monthly                                     |
| **Coach**      | €39 / month        | independent coaches   | Pro features + athlete management + custom programming                        |
| **Gym**        | pricing on request | boxes and studios     | Coach features + member management + branded community + internal challenges |

The current demo mocks these tiers in `src/components/hybrid/views/settings.tsx`. Production wires real Stripe (web) and App Store / Play Store in-app purchases (mobile) with synchronised entitlements.

### 14.2 Payment channels

- **Web:** Stripe Checkout + Customer Portal + webhook-driven entitlement updates.
- **iOS:** App Store in-app purchase, receipt validated server-side via App Store Server API.
- **Android:** Play Store in-app purchase, Real-time Developer Notifications consumed by `/api/webhooks/playstore`.

### 14.3 Synchronised entitlements

A single `Subscription` table (see `DATABASE_SCHEMA.md`) records the active tier regardless of where it was purchased. Webhook handlers from Stripe, App Store and Play Store all write to the same table. The athlete sees the same entitlement on web and mobile.

---

## 15. Development Phases

| Phase | Name                            | Status     | Deliverables                                                                                            |
|-------|---------------------------------|------------|--------------------------------------------------------------------------------------------------------|
| 0     | Foundation                      | COMPLETED  | Design system, database schema, monorepo scaffold, shared types, training engine foundation            |
| 1     | MVP Athlete Platform            | COMPLETED  | Mock auth, 6-step onboarding, profile, mode selection, HYROX/CrossFit/ATHX modules, calendar, workouts, timers, analytics, competition countdown |
| 2     | Mobile                          | NOT STARTED| Expo iOS/Android apps, native navigation, HealthKit/Health Connect, push, haptics, keep-awake         |
| 3     | Adaptive Training Engine        | PARTIAL    | `analyzeAthlete`, `generatePeriodization`, `generateWeekSessions`, `evaluateAdaptation`, `planModeSwitch`, AI coach implemented; auto-application of adaptation rules in UI not yet wired |
| 4     | Advanced Performance             | PARTIAL    | HYROX simulation + station analytics, ATHX EPS + pairs, CrossFit benchmarks complete; performance predictions and competition result analysis pending |
| 5     | Community + Coaching            | PARTIAL    | Community (challenges, leaderboard, feed) with mock data; coach dashboard + gym communities not started |
| 6     | Commercial Launch               | PARTIAL    | Subscription tiers wired as mock; real Stripe + IAP not started; landing page complete; legal pages + store submission not started |

---

## 16. Definition of Done (MVP criteria)

The MVP (Phase 1) is considered done when all of the following are true:

1. An athlete can land on the marketing page and understand what HYBRID is in under 30 seconds.
2. An athlete can sign up and complete 6-step onboarding without external help.
3. An athlete can select a training mode and see mode-specific content on the dashboard.
4. An athlete can view a weekly plan, mark a session complete with RPE, and reschedule it.
5. An athlete can start any of the 6 timer kinds, complete a workout, and log it.
6. An athlete can run a HYROX simulation and save it, and the simulation appears in station analytics.
7. An athlete can view performance analytics that reflect their actual logged data.
8. An athlete can ask the AI coach a question and receive a data-grounded answer.
9. An athlete can switch training modes and verify that history (sessions, logs, PRs, sims) is preserved.
10. An athlete can join a community challenge and see their rank on the leaderboard.
11. An athlete can manage subscription, notification, privacy and data settings.
12. The app shows no console errors across the full journey (landing → settings).

All 12 criteria are currently met by the Phase 1 build.

---

## 17. Disclaimer

HYBRID is an independent training platform. We are **not affiliated with, endorsed by, or sponsored by HYROX, ATHX Games, or CrossFit, Inc.** All competition names, formats and station configurations are the property of their respective owners. The platform is a personal training and logging tool; it does not grant entry to, or ranking in, any sanctioned event. Athletes must register for official competitions through the official channels of each event organiser.
