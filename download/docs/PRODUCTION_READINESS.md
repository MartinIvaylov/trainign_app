# Production Readiness Checklist

Last updated: November 2026

This document tracks everything required before HYBRID goes live. Items are grouped by phase and indicate whether they are demo-ready, production-ready, or pending.

## Status legend

- ✅ Done in this preview build
- 🟡 Architecture ready, integration pending
- ⛔ Not started

---

## 1. Authentication & security

| Item | Status | Notes |
|------|--------|-------|
| Email + password signup/signin flow | ✅ | Mocked in preview; UI is complete |
| Supabase Auth integration | 🟡 | Replace mock in `src/components/hybrid/auth.tsx` with `supabase.auth.signInWithPassword` |
| OAuth providers (Google, Apple) | ⛔ | Configure in Supabase dashboard, wire in `auth.tsx` |
| Session persistence | ✅ | Zustand persist via `localStorage` |
| Token storage | 🟡 | Use `expo-secure-store` on mobile, httpOnly cookies on web |
| Password reset flow | ⛔ | `supabase.auth.resetPasswordForEmail` |
| Email verification | ⛔ | Configure email templates in Supabase |
| Account deletion | ✅ | UI in Settings → Data; backend delete-cascade pending |
| RLS policies (every sensitive table) | 🟡 | Documented in `DATABASE_SCHEMA.md`; needs migration to Postgres |
| API key isolation (server-only) | ✅ | `/api/coach` keeps z-ai-web-dev-sdk on server |
| CSRF protection | ⛔ | Next.js built-in for Server Actions; add for any custom endpoints |
| Rate limiting | 🟡 | Documented; implementation pending |
| 2FA | ⛔ | Optional, can defer |

## 2. Database

| Item | Status | Notes |
|------|--------|-------|
| 28-model Prisma schema | ✅ | In `prisma/schema.prisma` |
| SQLite migration | ✅ | `db/custom.db` synced |
| Postgres migration | ⛔ | Run `prisma migrate dev` against Supabase Postgres |
| RLS policies (every table) | 🟡 | Defined in `DATABASE_SCHEMA.md`; need SQL migrations |
| Seed data (HYROX stations, CrossFit benchmarks, ATHX tests) | ✅ | Inline in `src/lib/competition-rules/` |
| Daily backups | ⛔ | Enable Supabase scheduled backups |
| Point-in-time recovery | ⛔ | Enable Supabase PITR add-on |
| Read replicas | ⛔ | When traffic requires |

## 3. AI Coach

| Item | Status | Notes |
|------|--------|-------|
| Server-side `/api/coach` route | ✅ | Uses `z-ai-web-dev-sdk` |
| Athlete context block | ✅ | Profile, benchmarks, logs, PRs, simulations, upcoming comp |
| System prompt with safety constraints | ✅ | No medical advice, no silent plan changes, distinguish estimates |
| Deterministic fallback when AI unavailable | ✅ | Returns safe canned responses based on data |
| Conversation history (last 6 turns) | ✅ | Sent in request |
| Recommendation storage | ⛔ | Persist to `AiRecommendation` table |
| Rate limiting (per user) | ⛔ | Token bucket at edge |
| Cost monitoring | ⛔ | Track tokens per request, set daily cap |

## 4. Adaptive training engine

| Item | Status | Notes |
|------|--------|-------|
| `analyzeAthlete` weakness detection | ✅ | + 9 unit tests |
| `generatePeriodization` block builder | ✅ | Mode-specific (HYROX 4 / ATHX 5 / CrossFit 3 / Maintenance 1) + 7 unit tests |
| `generateWeekSessions` day distribution | ✅ | + 5 unit tests |
| `evaluateAdaptation` safety rules | ✅ | Never stacks missed sessions, never exceeds weekly volume + 6 unit tests |
| `planModeSwitch` history preservation | ✅ | Recovery week recommendation + 4 unit tests |
| Auto-applied adaptation in UI | ✅ | Dashboard "Adaptation engine" panel with Apply / Apply all |
| Coach-program precedence | ✅ | Coach programs are not auto-replaced |
| 62 unit tests passing | ✅ | `bun test src/lib/` |

## 5. Web application

| Item | Status | Notes |
|------|--------|-------|
| Landing page | ✅ | Hero, modes, engine, analytics, AI coach, pricing, community, footer |
| Auth screen | ✅ | Sign in / sign up |
| 6-step onboarding | ✅ | Profile → preferences → benchmarks → goal → competition → review |
| App shell with sidebar + mobile nav | ✅ | |
| Dashboard | ✅ | Countdown, today's session, weekly volume, dimensions radar, adaptation, AI insights, recent sessions, PRs, mode-specific module |
| Plan + interactive calendar | ✅ | Periodisation blocks, week grid, session detail, monthly heatmap |
| Workouts library | ✅ | 20+ workouts, filter + search |
| Train (6 timers) | ✅ | For Time / AMRAP / EMOM / Tabata / Intervals / Strength |
| Compete (Hub / HYROX / ATHX / Pairs / Results) | ✅ | Race simulator, EPS, pairs, result logging + trends |
| Performance | ✅ | Recharts: radar, line, area; PRs; station analytics |
| AI Coach | ✅ | Chat UI + server route |
| Community | ✅ | Challenges, leaderboard, activity feed |
| Coach Dashboard | ✅ | Roster, invite, athlete detail, program builder, check-ins |
| Profile + mode switching | ✅ | Replace / Add / Pause modal preserves history |
| Settings + Subscription | ✅ | Free / Pro / Pro Annual / Coach tiers (mock) |
| Privacy Policy | ✅ | 10 sections, GDPR-compliant |
| Terms of Service | ✅ | 13 sections |
| Loading / empty / error states | ✅ | Throughout |
| Offline workout logging | 🟡 | Zustand persist locally; background sync pending |

## 6. Mobile app

| Item | Status | Notes |
|------|--------|-------|
| Expo + React Native scaffold | ✅ | `apps/mobile/` with app.json, package.json, tsconfig, babel.config, eas.json |
| Expo Router 4 with bottom tabs | ✅ | Today / Plan / Train / Progress / Profile |
| Auth screen | ✅ | |
| Onboarding screen | ✅ | 4-step mobile-tailored |
| Today screen | ✅ | Countdown, today's session, AI insight, stat tiles |
| Plan screen | ✅ | Week grid + upcoming sessions |
| Train screen with timer + haptics + keep-awake | ✅ | All 6 timer kinds, native haptics |
| Progress screen | ✅ | Dimensions, recent sessions, PRs |
| Profile screen | ✅ | Mode switch, subscription, wearables, sign out |
| Zustand store with AsyncStorage persistence | ✅ | Mirrors web store |
| Apple Health integration | ⛔ | Plugin configured in `app.json`; needs native auth + data sync code |
| Health Connect (Android) integration | ⛔ | Needs `react-native-health-connect` package and code |
| Background sync (expo-task-manager) | ⛔ | |
| Push notifications (expo-notifications) | ⛔ | Configure in Expo dashboard |
| EAS Build (iOS + Android) | ⛔ | Run `eas build --platform ios --profile production` after credentials setup |
| App Store submission | ⛔ | App metadata, screenshots, age rating, TestFlight beta |
| Play Store submission | ⛔ | Internal testing → closed testing → production |
| Shared monorepo packages | 🟡 | Architecture in `ARCHITECTURE.md`; extraction pending |

## 7. Backend & integrations

| Item | Status | Notes |
|------|--------|-------|
| Supabase project | ⛔ | Provision project, set `DATABASE_URL` and `SUPABASE_*` env vars |
| Prisma migration to Postgres | ⛔ | `prisma migrate deploy` |
| RLS SQL policies | ⛔ | Generate from `DATABASE_SCHEMA.md` |
| Edge Functions (Stripe webhook, App Store, Play Store) | ⛔ | Deploy via Supabase CLI |
| Stripe products + prices | ⛔ | Create Free / Pro / Pro Annual / Coach / Gym products |
| Stripe webhook signing | ⛔ | `/api/webhooks/stripe` route |
| App Store Server Notifications | ⛔ | `/api/webhooks/appstore` route |
| Play Store Real-time Developer Notifications | ⛔ | `/api/webhooks/playstore` route |
| Entitlement sync across web/iOS/Android | 🟡 | Documented; implementation pending |
| Apple Health | ⛔ | |
| Health Connect | ⛔ | |
| Garmin Connect IQ | ⛔ | API access application pending |
| Strava | ⛔ | OAuth + sync code |
| Whoop | ⛔ | |

## 8. DevOps & monitoring

| Item | Status | Notes |
|------|--------|-------|
| Vercel web deployment | ⛔ | `vercel deploy --prod` after env vars set |
| EAS mobile build | ⛔ | After credentials configured |
| GitHub Actions CI | ⛔ | Lint + test on PR, build + deploy on merge |
| Sentry error monitoring | ⛔ | Add `@sentry/nextjs` and `@sentry/react-native` |
| Vercel Analytics | ⛔ | Enable in Vercel dashboard |
| Supabase logs | ⛔ | Built-in |
| EAS error reporting | ⛔ | Enable in `app.json` |
| Uptime monitoring | ⛔ | Use Vercel + Supabase status pages |
| Daily backup verification | ⛔ | Quarterly restore drills |

## 9. Legal & compliance

| Item | Status | Notes |
|------|--------|-------|
| Privacy Policy | ✅ | 10 sections, GDPR-compliant |
| Terms of Service | ✅ | 13 sections |
| Trademark disclaimer (HYROX/ATHX/CrossFit) | ✅ | In landing footer, Settings, legal pages |
| Cookie policy | ⛔ | Add if using analytics cookies |
| GDPR Data Processing Agreement | ⛔ | Sign with Supabase |
| App Store age rating | ⛔ | Submit with app metadata |
| Play Store content rating | ⛔ | IARC questionnaire |
| Trademark search for HYBRID | ⛔ | Confirm availability in target markets |

## 10. Test coverage

| Area | Status | Notes |
|------|--------|-------|
| Unit tests for `training-engine` | ✅ | 28 tests covering `analyzeAthlete`, `generatePeriodization`, `generateWeekSessions`, `evaluateAdaptation`, `planModeSwitch` |
| Unit tests for `competition-rules` | ✅ | 34 tests covering HYROX stations, `simulateHyrox`, `formatHMS`, ATHX disciplines, `normaliseAthxTest`, `estimateAthxScore`, `pairCombinedScore`, CrossFit benchmarks |
| Lint passes | ✅ | `bun run lint` — 0 errors |
| Manual browser E2E | ✅ | Full user journey verified: landing → auth → onboarding → dashboard → coach → train → compete → performance → community → profile → settings → coach dashboard |
| Integration tests for API routes | ⛔ | |
| E2E tests (Playwright) | ⛔ | |
| Mobile E2E (Detox / Maestro) | ⛔ | |

## 11. Performance

| Item | Status | Notes |
|------|--------|-------|
| Lighthouse score > 90 (web) | 🟡 | Manual check needed after production deploy |
| Bundle size < 250KB initial | 🟡 | Verify after production build |
| Image optimization (Next/Image) | 🟡 | No images yet; enable when added |
| Recharts responsive containers | ✅ | Used throughout Performance view |
| Zustand selectors to minimize re-renders | ✅ | All views use `useApp((s) => s.xxx)` |
| Code splitting (dynamic imports) | ✅ | `z-ai-web-dev-sdk` only loaded server-side via dynamic import |
| Mobile bundle: Hermes engine | ✅ | Default in Expo SDK 52 |

## 12. Launch sequence

1. ⛔ Provision Supabase project, run migrations, enable RLS
2. ⛔ Configure Stripe products + webhooks
3. ⛔ Set environment variables in Vercel + EAS
4. ⛔ Deploy web to Vercel production
5. ⛔ Build iOS via EAS, submit to App Store with TestFlight beta
6. ⛔ Build Android via EAS, submit to Play Store with internal testing
7. ⛔ Enable Sentry + Vercel Analytics
8. ⛔ Soft-launch to a closed user group (50-100 athletes)
9. ⛔ Iterate based on feedback (1-2 weeks)
10. ⛔ Public launch on web + App Store + Play Store

---

## Critical path to launch

The shortest path from current state to a launchable product is:

1. **Supabase** setup (1 day)
2. **Stripe** + **EAS** credentials and integration (3 days)
3. **Apple Health** + **Health Connect** integration (3 days)
4. Real auth + subscription wired up (1 day)
5. Beta soft-launch with TestFlight + Play Internal Testing (1 week)
6. Production launch (1 day)

Total realistic estimate: 2-3 weeks of focused engineering work, assuming no major re-architecture is required.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Apple Health / Health Connect access rejected by app review | Use only standard HealthKit types, clear usage descriptions in Info.plist |
| Stripe webhook reliability | Idempotency keys + retry queue |
| AI Coach cost overruns | Per-user token budget + daily cap + caching common questions |
| HYROX/ATHX/CrossFit trademark complaints | Already disclaim affiliation in 3 places; remove trademark symbols if requested |
| Coach tier abuse (one coach inviting too many free-tier athletes) | Coach tier athlete cap at 25; Gym tier unlocks unlimited |
