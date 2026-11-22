# HYBRID Performance Platform — Architecture

> **Version:** 1.0  
> **Status:** Phase 0 + Phase 1 shipped; Phase 3 partially wired  
> **Scope:** This document describes the actual implementation plus the planned production architecture.

---

## 1. High-Level System Diagram

```
                         ┌──────────────────────────────────────────────┐
                         │                   ATHLETE                      │
                         │   (one profile, multiple competition modes)   │
                         └─────────────┬─────────────────────┬────────────┘
                                       │                     │
                            ┌──────────▼─────────┐  ┌─────────▼──────────┐
                            │   Web (Next.js 16) │  │  Mobile (Expo)     │
                            │  App Router + TS   │  │  React Native      │
                            │  Tailwind 4 + UI   │  │  Expo Router        │
                            │  Zustand client    │  │  Zustand client     │
                            └──────────┬─────────┘  └─────────┬──────────┘
                                       │                     │
                                       │   /api/* (server)   │ Bearer token
                                       │                     │ (planned)
                            ┌──────────▼─────────────────────▼──────────┐
                            │              Backend (Supabase)            │
                            │   Postgres + RLS + Storage + Realtime      │
                            │   Prisma 6 schema (28 models)              │
                            │   Edge Functions for webhooks              │
                            └──────────┬─────────────────────────────────┘
                                       │
                            ┌──────────▼─────────┐  ┌──────────────────┐
                            │  AI Coach route    │  │  Stripe / IAP    │
                            │  /api/coach        │  │  webhook handlers│
                            │  z-ai-web-dev-sdk  │  │  (Edge Functions)│
                            │  (server-only)     │  │                  │
                            └────────────────────┘  └──────────────────┘
```

The web client is the only surface built today. The mobile client shares the same training engine, validation, and UI tokens via workspace packages.

---

## 2. Monorepo Structure (planned production layout)

The current sandbox is a single Next.js app. The production layout is a Turborepo monorepo:

```
hybrid/
  apps/
    web/                         # Next.js 16 app (current codebase)
    mobile/                      # Expo + React Native (planned)
  packages/
    shared/                      # Cross-platform types (TrainingMode, Background, etc.)
    training-engine/             # Pure TS engine (analyzeAthlete, generatePeriodization, ...)
    validation/                  # zod schemas shared by web + mobile + edge
    ui-tokens/                   # Design tokens (OKLCH), consumed by web + native
    api-client/                  # Typed client for /api/v1/ routes
  supabase/
    migrations/                  # Prisma + SQL migrations
    functions/                  # Edge Functions (Stripe, App Store, Play Store webhooks)
    seed/                        # HYROX stations, CrossFit benchmarks, ATHX disciplines, dev athletes
  docs/                         # This directory
  turbo.json
  package.json
```

Today, the engine lives at `src/lib/training-engine/index.ts`, the types at `src/types/index.ts`, and the tokens at `src/app/globals.css`. When the monorepo is split out, these move to the packages above and the apps import them.

---

## 3. Tech Stack

### 3.1 Actual (Phase 0 + Phase 1)

| Layer              | Choice                                                          | Notes                                                                  |
|--------------------|-----------------------------------------------------------------|------------------------------------------------------------------------|
| Framework          | Next.js 16.1.3 (App Router, Turbopack)                          | Server Components + Route Handlers; Turbopack for fast dev builds      |
| Language           | TypeScript 5 (strict)                                          | The brief asked for JS; the sandbox enforces TS — see §4               |
| Styling            | Tailwind CSS 4                                                  | Custom design tokens in `src/app/globals.css`                          |
| UI components      | shadcn/ui (New York style)                                      | Complete component set, customised for dark athletic aesthetic        |
| Client state       | Zustand 5 + persist middleware                                 | Single store `useApp` in `src/store/app-store.ts`                      |
| ORM                | Prisma 6                                                        | SQLite via `db/custom.db`; Supabase Postgres target                    |
| Charts             | Recharts                                                        | Radar, line, area, bar — used in `views/performance.tsx`              |
| Animation          | Framer Motion                                                   | Page transitions, modal in/out, card hovers, AnimatePresence          |
| AI                 | z-ai-web-dev-sdk (server-only)                                  | Called via `/api/coach` route                                          |
| Auth (library)     | NextAuth.js v4                                                  | Available, not yet wired in the demo                                   |
| Database           | SQLite (`db/custom.db`)                                         | Portable schema; Postgres parity planned                               |

### 3.2 Planned

| Layer              | Choice                                                          | Notes                                                                  |
|--------------------|-----------------------------------------------------------------|------------------------------------------------------------------------|
| Backend            | Supabase Postgres                                               | RLS on all sensitive tables                                            |
| Auth               | NextAuth + Supabase Auth                                        | Email/password + OAuth (Google, Apple, GitHub)                        |
| Storage            | Supabase Storage                                                | Avatars, activity feed images                                          |
| Realtime           | Supabase Realtime                                               | Coach-athlete messaging, leaderboard live updates                      |
| Payments (web)     | Stripe Checkout + Customer Portal                               | Webhooks → entitlement updates                                          |
| Payments (mobile)  | App Store + Play Store IAP                                      | Receipts validated server-side                                         |
| Mobile             | Expo + React Native + Expo Router                               | Native bottom tabs, haptics, keep-awake, background sync              |
| Wearables          | Apple HealthKit, Health Connect, Garmin, Strava, Whoop         | Adapter pattern per provider                                           |
| Testing            | Jest (unit), Playwright (integration + E2E)                    | Engine unit tests are the highest priority                             |

---

## 4. Note on TypeScript

The original project brief asked for plain JavaScript. The sandbox environment we are building in enforces TypeScript. We have adopted **TypeScript throughout** with the following rules:

- `strict: true` in `tsconfig.json`.
- No `any` where avoidable. When a third-party type is incomplete, we use `unknown` and narrow with type guards.
- Domain types live in `src/types/index.ts` and are the single source of truth shared across UI, store, engine, and API.
- The Prisma client is generated from `prisma/schema.prisma` and its types are imported into domain types where they overlap.

This is documented so future contributors and the production split-out do not regress to `any`.

---

## 5. Frontend Architecture

### 5.1 Client-side state

A single Zustand store `useApp` in `src/store/app-store.ts` with the `persist` middleware holds:

- `auth` (mocked user object)
- `profile` (athlete identity + background)
- `prefs` (training preferences: days per week, equipment, mode)
- `benchmarks` (latest benchmark results)
- `sessions` (scheduled + completed)
- `logs` (workout logs)
- `prs` (personal records)
- `hyroxSims` (saved HYROX simulations)
- `tier` (subscription tier — mocked)
- `toasts` (custom toast queue)
- `appView` (current view state for the in-app router)

Selectors are used at the call site to minimise re-renders. The store is the *only* source of truth on the client during the demo. In production, the store becomes a write-through cache of Supabase data.

### 5.2 View router pattern

The Next.js app exposes a single route — `/`. `src/app/page.tsx` is a top-level router that decides what to render based on the persisted store state:

```
  no auth       → <Landing /> or <Auth />
  auth + no profile → <Onboarding />
  auth + profile    → <AppShell />
```

`AppShell` (`src/components/hybrid/app-shell.tsx`) renders the sidebar + topbar and uses the `appView` slice of the store to switch between `Dashboard`, `Plan`, `Workouts`, `Train`, `Compete`, `Performance`, `Coach`, `Community`, `Profile`, `Settings`. This avoids the cost of full route transitions and keeps the in-app navigation instant; URL-based routing is reserved for the marketing pages and future deep links.

### 5.3 Server-only AI

The AI coach never runs on the client. The chat UI (`src/components/hybrid/views/coach.tsx`) posts to `/api/coach` (see `src/app/api/coach/route.ts`). The route:

1. Reads the session (today: mocked; production: NextAuth session).
2. Loads athlete context from the store/DB.
3. Builds the system prompt + context block.
4. Calls `z-ai-web-dev-sdk`.
5. Returns the answer + `toolsUsed` flag + `fallback` flag.

API keys never reach the client. The deterministic fallback kicks in if the AI service is unavailable, returns an error, or is rate-limited.

---

## 6. Backend Architecture

### 6.1 Prisma schema

`prisma/schema.prisma` defines 28 models. See `DATABASE_SCHEMA.md` for the full per-model reference. The schema is portable: the same file builds against SQLite (today) and Postgres (production). Postgres-specific concerns (JSONB columns, RLS) are handled via migrations, not schema changes.

### 6.2 SQLite (preview) vs Supabase Postgres (production)

| Concern                     | SQLite (today)                     | Supabase Postgres (production)                |
|-----------------------------|------------------------------------|-----------------------------------------------|
| File/location               | `db/custom.db`                     | Supabase project                              |
| RLS                         | not enforced (single-user dev)     | enforced per model                            |
| JSON columns                | stored as TEXT                     | native JSONB                                  |
| Realtime                    | not available                      | Supabase Realtime                             |
| Storage                     | filesystem                         | Supabase Storage buckets                       |
| Auth                        | mocked in store                    | Supabase Auth + NextAuth                       |

### 6.3 Migration strategy

1. Keep the Prisma schema as the source of truth.
2. Run `prisma migrate dev` against SQLite locally.
3. For production, generate Postgres-equivalent migrations with `prisma migrate diff` and apply via `supabase db push` or Prisma migrate against the Supabase connection string.
4. Add JSONB columns via a separate migration for fields that benefit (e.g., `AiRecommendation.payload`).
5. Enable RLS on all sensitive models and create policies (see `DATABASE_SCHEMA.md` §3).

---

## 7. AI Coach Architecture

```
┌─────────────┐  POST { question, context, history }   ┌──────────────────────┐
│  Coach.tsx  │ ─────────────────────────────────────► │  /api/coach/route.ts │
└─────────────┘                                         │                       │
      ▲                                                  │  1. read session      │
      │  { answer, toolsUsed, fallback }                 │  2. build context     │
      └──────────────────────────────────────────────────┤  3. system prompt     │
                                                         │  4. call z-ai-sdk     │
                                                         │     (server-only)     │
                                                         │  5. fallback if down  │
                                                         │  6. return answer     │
                                                         └──────────────────────┘
```

### 7.1 System prompt summary

The system prompt enforces:

- No medical advice; refer athletes to a clinician for pain/injury.
- No silent plan changes; any plan change is a suggestion the athlete must confirm.
- Distinguish measured results from estimates.
- Cite the data point(s) the answer is based on.
- Stay within the athlete's stated goals and current mode.

### 7.2 Athlete context block

Built server-side and includes: profile, preferences, active mode, benchmarks, upcoming sessions (next 14 days), recent logs (last 14 days), recent PRs (last 90 days), recent HYROX simulations (last 5), tier. No PII beyond what the athlete themselves entered.

### 7.3 Deterministic fallback

If the AI service is unavailable, errors, or times out, the route returns a deterministic response generated from the engine's `analyzeAthlete()` output and the athlete's recent logs. The response is clearly labelled as a fallback so the athlete knows the AI did not run.

---

## 8. Adaptive Training Engine

The engine is a set of pure functions in `src/lib/training-engine/index.ts`:

| Function                   | Responsibility                                                                       |
|----------------------------|--------------------------------------------------------------------------------------|
| `analyzeAthlete()`         | Normalise benchmarks across run/strength/erg/MetCon; return `WeaknessFinding[]`      |
| `generatePeriodization()`  | Produce `BlockPlan[]` using mode-specific phases                                    |
| `generateWeekSessions()`   | Distribute sessions per preferred days, mode, and phase                             |
| `evaluateAdaptation()`     | Apply safety rules: high RPE / fatigue / missed sessions → reduce, recover, never stack |
| `planModeSwitch()`         | Preserve history, recommend recovery week if recent race, ask intent (Replace/Add/Pause) |

**Rules:**

- Pure functions. No side effects. No network calls. No reads of the Zustand store inside the engine — the caller passes data in.
- Deterministic. Same inputs → same outputs.
- AI augments the engine's output but cannot override safety constraints. The engine is the single source of truth for what is safe to programme.
- Estimates vs measured results are kept distinct at the type level.

---

## 9. Authentication

### 9.1 Today (mocked)

`useApp.auth` is a mocked user object created on sign-in. There is no real password check, no session cookie, no token. The demo's `Auth` screen (`src/components/hybrid/auth.tsx`) accepts any input and writes a mock user to the store.

### 9.2 Production

- **NextAuth.js v4** wired at `/api/auth/[...nextauth]`.
- **Supabase Auth** as the backing provider.
- **Providers:** email/password, Google, Apple, GitHub.
- **Session:** HTTP-only cookie on web, refresh token in Expo Secure Store on mobile.
- **Mobile API:** Bearer token from Supabase session, attached to every `/api/v1/*` request.

---

## 10. Subscription Architecture

```
  Web (Stripe)              Mobile (App Store / Play Store)
       │                            │
       ▼                            ▼
  /api/webhooks/stripe       /api/webhooks/appstore
                             /api/webhooks/playstore
       │                            │
       └────────────┬───────────────┘
                    ▼
        ┌────────────────────┐
        │  Subscription table │  ← single source of truth for entitlement
        │  (tier, source,     │
        │   expiresAt, ...)   │
        └────────────────────┘
                    │
                    ▼
        useApp.tier (web)   +   mobile entitlement cache
```

Webhook handlers normalise the payload from each store and write to the same `Subscription` row, keyed by the athlete's user ID. The athlete sees the same entitlement on every surface. Receipt validation is server-side only.

---

## 11. Wearable Integration Architecture

Each provider is an adapter implementing a common interface:

```ts
interface WearableAdapter {
  provider: 'apple_health' | 'health_connect' | 'garmin' | 'strava' | 'whoop';
  connect(): Promise<AuthHandle>;        // start OAuth / native auth flow
  sync(handle): Promise<SyncResult>;     // pull latest sessions + metrics
  disconnect(handle): Promise<void>;
}
```

- **Apple HealthKit** — via `expo-health` on mobile (planned).
- **Health Connect** — via `react-native-health-connect` on Android (planned).
- **Garmin / Strava / Whoop** — OAuth 2.0 via server-side route `/api/wearables/connect` + `/api/wearables/sync`.
- **Background sync** — `expo-task-manager` on mobile; cron-triggered Edge Function on web.
- **Manual fallback** — if a provider API is unavailable, the athlete can manually enter a session. The UI makes clear which sessions are synced vs manual.

Today, the wearable tiles in `src/components/hybrid/views/settings.tsx` are placeholders. No real SDK is wired.

---

## 12. Security

- **RLS policies per model.** Every sensitive model has a policy that restricts access to the owning athlete + authorised coaches (see `DATABASE_SCHEMA.md` §3).
- **Server-only API keys.** `ZAI_API_KEY`, `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are server-only environment variables. They are never bundled into client code. Next.js Route Handlers run server-side by default.
- **No PII in client logs.** The client logs store only non-identifying diagnostic data. Real logs go to Sentry with PII scrubbing enabled.
- **Encryption at rest.** Supabase Postgres encrypts at rest. Supabase Storage buckets encrypt at rest. Avatars and activity images are stored with private visibility and signed URLs.
- **Privacy controls per athlete.** Visibility (public / friends / private), leaderboard opt-out, share-results toggle. The Community view surfaces a privacy note explaining these controls.

---

## 13. Performance

- **Turbopack** for dev builds (fast cold start, fast HMR).
- **Code-splitting via dynamic imports** — heavy views (Coach, Compete simulator) are loaded on demand.
- **Zustand selectors** to subscribe only to the slices a component needs, minimising re-renders.
- **Recharts responsive containers** — every chart wraps in `<ResponsiveContainer>` so it adapts to its parent.
- **Image optimization via `next/image`** — landing page images are served via `next/image` with explicit `width`/`height` to avoid layout shift.
- **Server Components** where possible — the marketing landing page is mostly static and rendered server-side.
- **No fabricated statistics.** Charts read from real data. Empty states are shown when there is no data, so we never render an expensive chart with fake numbers.

---

## 14. Offline Strategy

- **Workout logging works offline.** The Zustand store is persisted to `localStorage` via the `persist` middleware. A workout can be completed with no network connection.
- **Background sync queue.** When connectivity returns, queued writes are replayed against Supabase.
- **Conflict resolution.** For session results, the rule is **last-write-wins** on the result fields (time, rounds, load, RPE). For scheduled sessions, the version with the most recent `updatedAt` wins; reschedules do not propagate to the past.
- **Hydration.** The store rehydrates from `localStorage` on app boot. If the server returns newer data on the first fetch, the store is overwritten with server data and the local queue is replayed.

---

## 15. Testing Strategy

| Layer              | Tooling                 | Coverage target (Phase 6)                  |
|--------------------|-------------------------|---------------------------------------------|
| Training engine    | Jest unit tests         | 100% of `src/lib/training-engine/*`         |
| Competition rules  | Jest unit tests         | `hyrox.ts`, `athx.ts`, `crossfit.ts`        |
| API routes         | Playwright route tests  | `/api/coach`, `/api/workout-logs`, webhooks |
| End-to-end         | Playwright              | Landing → onboarding → train → log → coach  |
| Mobile             | Jest + React Native Testing Library | components, store                |

Today, no automated tests exist. Manual browser verification of the full journey is documented in `IMPLEMENTATION_PROGRESS.md`. Unit tests for the engine are the first priority for Phase 6.

---

## 16. Mobile Architecture (planned)

The mobile app is not yet built. The target architecture:

- **Expo + React Native + Expo Router** — file-based routing, native modules via config plugins.
- **Shared packages** — `training-engine`, `validation`, `ui-tokens`, `shared` are imported from the workspace, not duplicated.
- **Native navigation** — bottom tabs (Today / Plan / Train / Progress / Profile) via Expo Router's `Tabs` layout.
- **Native-feeling interactions** — haptics on interval beeps, swipe-to-dismiss on cards, pull-to-refresh on lists.
- **Expo Secure Store** for session refresh tokens.
- **expo-notifications** for scheduled session reminders and recovery nudges.
- **expo-task-manager** for background wearable sync.
- **Apple HealthKit** via `expo-health`.
- **Health Connect** via `react-native-health-connect`.
- **Keep-screen-awake** via `expo-keep-awake` during active workouts.
- **Haptics** via `expo-haptics`.

The mobile app shares the `/api/v1/*` API with the web app and uses the same Supabase backend with the same RLS policies.

---

## 17. Deployment

See `DEPLOYMENT.md` for the full runbook. Summary:

- **Web** — Vercel. `vercel deploy --prod`. Standalone output.
- **Mobile** — EAS Build + Submit. `eas build` then `eas submit`.
- **Backend** — Supabase. `supabase db push` to apply schema, then enable RLS, deploy Edge Functions.
- **Payments** — Stripe (web) + App Store + Play Store (mobile), webhook handlers in Edge Functions.
- **Domain** — CNAME to Vercel for web, A records for app subdomains.

---

## 18. Observability

- **Web errors** — Sentry (browser + server).
- **Mobile errors** — Sentry React Native + EAS error reporting.
- **Supabase logs** — Postgres queries, Auth events, Storage events, Realtime events.
- **Vercel Analytics** — web vitals + page views.
- **Custom metrics** — AI coach latency, fallback rate, workout completion rate, mode-switch frequency. Surfaced in a future internal admin dashboard.
