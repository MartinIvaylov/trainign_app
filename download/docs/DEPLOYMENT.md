# HYBRID Performance Platform — Deployment

> **Last updated:** current sprint  
> **Scope:** All surfaces — web (Vercel), mobile (EAS), backend (Supabase), payments (Stripe + IAP), domain, monitoring, backups, CI/CD, environments, rollback.

---

## 1. Surfaces and Owners

| Surface            | Hosting             | Tooling                                  | Owner          |
|--------------------|---------------------|-------------------------------------------|----------------|
| Web                | Vercel              | Next.js 16 standalone build              | Web team       |
| Mobile             | EAS Build + Submit  | Expo + React Native                       | Mobile team    |
| Backend            | Supabase            | Postgres + RLS + Storage + Realtime       | Backend team   |
| Payments (web)     | Stripe              | Checkout + Customer Portal + webhooks     | Backend team   |
| Payments (mobile)  | App Store + Play Store | IAP, receipts validated server-side    | Mobile team    |
| Domain + DNS       | Cloudflare (or similar) | CNAME to Vercel, A records for apps   | DevOps         |
| Monitoring         | Vercel Analytics + Sentry + Supabase logs | Web + mobile + backend | DevOps |

---

## 2. Web (Vercel)

### 2.1 Build

```bash
bun install
bun run build
```

Output mode: `standalone` (configured in `next.config.ts`). Vercel detects Next.js automatically and runs the build command from `package.json`.

### 2.2 Deploy

```bash
# Preview deployment (per PR)
vercel

# Production deployment
vercel --prod
```

Or via Vercel's GitHub integration: every push to `main` deploys to production; every PR deploys a preview.

### 2.3 Environment variables

| Variable                    | Purpose                                                    | Required for        |
|-----------------------------|------------------------------------------------------------|---------------------|
| `NEXTAUTH_URL`              | The canonical app URL (e.g., `https://hybrid.app`)         | Auth                |
| `NEXTAUTH_SECRET`           | NextAuth session secret (32+ random bytes)                | Auth                |
| `DATABASE_URL`              | Supabase Postgres connection string                        | All DB access       |
| `DIRECT_URL`                | Supabase direct connection (for migrations)               | Migrations           |
| `STRIPE_SECRET_KEY`         | Stripe API secret                                          | Payments (web)      |
| `STRIPE_WEBHOOK_SECRET`     | Stripe webhook signing secret                             | Webhook verification|
| `STRIPE_PRICE_PRO_MONTHLY`  | Stripe Price ID for Pro monthly                           | Subscription        |
| `STRIPE_PRICE_PRO_ANNUAL`   | Stripe Price ID for Pro annual                            | Subscription        |
| `STRIPE_PRICE_COACH`        | Stripe Price ID for Coach tier                            | Subscription        |
| `SUPABASE_URL`              | Supabase project URL                                       | Backend             |
| `SUPABASE_ANON_KEY`         | Supabase anon key (client-safe)                            | Client              |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only)                   | Server / webhooks   |
| `ZAI_API_KEY`               | z-ai-web-dev-sdk key (server-only)                        | AI Coach            |

Set in the Vercel project settings → Environment Variables. Mark `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ZAI_API_KEY` as server-only (never expose to the client).

### 2.4 Custom domain

In Vercel: Settings → Domains → add `hybrid.app` and `www.hybrid.app`. Configure DNS:

```
hybrid.app         A     76.76.21.21
www.hybrid.app     CNAME cname.vercel-dns.com
```

Force HTTPS via Vercel's automatic Let's Encrypt certificates.

### 2.5 Output settings

`next.config.ts`:

```ts
const nextConfig = {
  output: 'standalone',
  experimental: { /* ... */ },
};
```

Vercel reads the standalone output and serves it directly.

---

## 3. Mobile (EAS Build + Submit)

### 3.1 Prerequisites

- Expo project under `apps/mobile` (planned). EAS CLI installed: `npm i -g eas-cli`.
- Apple Developer account (team ID) and App Store Connect API key.
- Google Play Console account and a Play Store service account JSON key.

### 3.2 EAS configuration

`eas.json`:

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development":  { "env": { "APP_VARIANT": "development" } },
    "staging":      { "env": { "APP_VARIANT": "staging" } },
    "production":   { "env": { "APP_VARIANT": "production" } }
  },
  "submit": {
    "production": {
      "ios":  { "ascApiKeyPath": "./.eas/asc-api-key.p8", "ascApiKeyId": "...", "ascApiIssuerId": "..." },
      "android": { "serviceAccountKeyPath": "./.eas/play-key.json", "track": "production" }
    }
  }
}
```

### 3.3 Build

```bash
# iOS production build
eas build --platform ios --profile production --non-interactive

# Android production build
eas build --platform android --profile production --non-interactive
```

### 3.4 Submit

```bash
# iOS — App Store Connect API key needed
eas submit --platform ios --latest

# Android — Play Store service account JSON needed
eas submit --platform android --latest
```

### 3.5 Secrets

Set mobile secrets via `eas secrets`:

```bash
eas secret:create --scope project --name SUPABASE_URL --value "https://<project>.supabase.co"
eas secret:create --scope project --name SUPABASE_ANON_KEY --value "..."
eas secret:create --scope project --name ZAI_API_KEY --value "..."
eas secret:create --scope project --name SENTRY_DSN --value "..."
```

These are injected at build time into the native binary. They do not end up in the JS bundle for the client (only `SUPABASE_URL` and `SUPABASE_ANON_KEY` are safe for the client).

### 3.6 TestFlight + Internal testing

- iOS: build with `--profile staging`, submit to TestFlight, distribute to beta testers via App Store Connect.
- Android: build with `--profile staging`, submit to Play Console internal testing track.

---

## 4. Backend (Supabase)

### 4.1 Project setup

1. Create a new Supabase project via the dashboard (or `supabase init` locally).
2. Note the project URL, anon key, and service role key.
3. Configure the Postgres connection string in `.env` as `DATABASE_URL` and `DIRECT_URL`.

### 4.2 Schema

Two paths to apply the schema:

**Option A — Prisma migrations (recommended):**

```bash
bunx prisma migrate deploy
```

Against the Supabase connection string.

**Option B — Supabase CLI:**

```bash
supabase db push
```

This applies the schema in `supabase/migrations/` (generated from `prisma/schema.prisma`).

### 4.3 RLS

Enable RLS on every sensitive table:

```sql
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AthleteProfile" ENABLE ROW LEVEL SECURITY;
-- ... and so on for all 28 models
```

Create policies per the table in `DATABASE_SCHEMA.md` §3. Example for `WorkoutLog`:

```sql
CREATE POLICY "athlete_select_own_logs"
  ON "WorkoutLog" FOR SELECT
  USING (auth.uid() = "athleteProfile"."userId"
         AND "athleteProfile"."id" = "WorkoutLog"."athleteProfileId");
```

Coach access to athlete logs is granted via a join to `CoachAthlete`:

```sql
CREATE POLICY "coach_select_athlete_logs"
  ON "WorkoutLog" FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "CoachAthlete" ca
    JOIN "CoachProfile" cp ON cp.id = ca.coachProfileId
    WHERE ca.athleteProfileId = "WorkoutLog"."athleteProfileId"
      AND cp.userId = auth.uid()
      AND ca.status = 'active'
  ));
```

### 4.4 Storage

Create buckets:

- `avatars` (private) — athlete profile pictures. Signed URLs only.
- `activity-images` (private) — images attached to activity feed posts. Signed URLs only.
- `workout-media` (private) — workout diagrams and demo videos (planned).

Set lifecycle rules: avatars unlimited retention; activity images retained 90 days then archived.

### 4.5 Realtime

Enable Realtime on:

- `ActivityFeedItem` (live feed updates).
- `ChallengeParticipant` (live leaderboard).
- `Notification` (toast on new notification).
- `AiMessage` (streaming coach responses — planned).

### 4.6 Edge Functions

Deploy webhook handlers as Edge Functions (Deno):

- `functions/v1/stripe-webhook/index.ts`
- `functions/v1/appstore-webhook/index.ts`
- `functions/v1/playstore-webhook/index.ts`

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

The `--no-verify-jwt` flag is used because webhook payloads are verified by their own signature scheme (Stripe signature, App Store JWT, Play Store pub/sub).

---

## 5. Stripe

### 5.1 Products

Create in Stripe Dashboard:

| Product       | Price ID env var           | Recurrence | Amount |
|---------------|----------------------------|------------|--------|
| Pro Monthly   | `STRIPE_PRICE_PRO_MONTHLY` | month      | €18    |
| Pro Annual    | `STRIPE_PRICE_PRO_ANNUAL`  | year       | €129   |
| Coach Monthly | `STRIPE_PRICE_COACH`        | month      | €39    |
| Gym Monthly   | `STRIPE_PRICE_GYM` (planned)| month      | TBD    |

### 5.2 Webhook

In Stripe Dashboard → Developers → Webhooks:

- Endpoint URL: `https://hybrid.app/api/webhooks/stripe` (production) or Supabase Edge Function URL.
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
- Signing secret → `STRIPE_WEBHOOK_SECRET`.

### 5.3 Customer portal

Enable Customer Portal in Stripe Dashboard. Configure to allow:

- Cancel subscription
- Update payment method
- Switch between monthly and annual (Pro only)

Wire the portal URL into the Settings view via the `/api/subscription` endpoint returning a `portalUrl`.

### 5.4 Tax

Stripe Tax (or Manual tax collection). For EU athletes, VAT is collected based on the customer's country. Stripe Tax handles this automatically.

---

## 6. App Store

### 6.1 App metadata

- **App name:** HYBRID — Train. Benchmark. Compete. Evolve.
- **Subtitle:** One profile across HYROX, ATHX and CrossFit.
- **Description:** (per marketing copy)
- **Keywords:** HYROX, ATHX, CrossFit, hybrid training, fitness, race simulation, training plan, AMRAP, EMOM.
- **Category:** Health & Fitness.
- **Age rating:** 17+ (or appropriate based on content review; the app contains no user-generated content moderation tooling today, so 17+ is safest).
- **Privacy policy URL:** `https://hybrid.app/privacy` (must be live before submission).
- **Terms of service URL:** `https://hybrid.app/terms` (must be live before submission).

### 6.2 Screenshots

Required for iPhone 6.9" and iPad 13". Per Apple's guidelines. The landing page and the dashboard, train, compete, performance, and coach views are good candidates.

### 6.3 Review guidelines

The app mentions HYROX, ATHX, and CrossFit — unaffiliated brands. App Review requires that we:

- Do not imply endorsement by these brands.
- Do not use their logos without permission.
- Include a clear disclaimer in the app and on the App Store listing.
- Do not present competition results as official.

The disclaimer is in the Settings view and on the marketing page (see `PRODUCT_REQUIREMENTS.md` §17).

### 6.4 In-app purchases

Configure 4 IAP products:

- `tier.pro.monthly` — recurring monthly, €18.99 (Apple's price tier).
- `tier.pro.annual` — recurring annual, €129.99.
- `tier.coach.monthly` — recurring monthly, €39.99.
- (Gym tier handled off-App-Store, e.g., web only.)

Server-side validation: post the receipt base64 to `/api/subscription` (channel = `app_store`), which validates against the App Store Server API and writes to `Subscription`.

### 6.5 TestFlight

Upload a build to App Store Connect, add internal + external testers. External testing requires a brief Beta App Review (typically 24-48 hours).

---

## 7. Play Store

### 7.1 App metadata

- **App name:** HYBRID — Train. Benchmark. Compete. Evolve.
- **Short description:** One profile across HYROX, ATHX and CrossFit.
- **Full description:** (per marketing copy)
- **Category:** Health & Fitness.
- **Content rating:** Fill out the IARC questionnaire (likely Teen or Mature based on user-generated content presence — today, Teen is appropriate).
- **Privacy policy URL:** `https://hybrid.app/privacy`.
- **Target audience:** 18+.

### 7.2 Release tracks

1. **Internal testing** — up to 100 testers via email.
2. **Closed testing** — by invite link or email list.
3. **Open testing** — public beta via Play Store listing.
4. **Production** — full release.

### 7.3 In-app purchases

Configure 4 IAP products (mirror of App Store). Server-side validation: post the purchase token to `/api/subscription` (channel = `play_store`), which validates via the Play Developer API and writes to `Subscription`.

### 7.4 Real-time Developer Notifications

Set up a Pub/Sub topic in Google Cloud, subscribe the Supabase Edge Function, configure the Play Console to push notifications to the topic. The Edge Function consumes notifications and writes to `Subscription`.

---

## 8. Domain + DNS

Register the canonical domain. Configure:

```
hybrid.app                A      76.76.21.21          (Vercel)
www.hybrid.app            CNAME  cname.vercel-dns.com  (Vercel)
api.hybrid.app            CNAME  <supabase-project>.supabase.co   (planned, for direct API access)
app.hybrid.app            A      <EAS / hosting>       (planned, for marketing redirects to stores)
```

Email:

- Use a transactional email provider (Postmark, Resend) for verification emails and notification digests.
- Configure SPF, DKIM, DMARC for the `hybrid.app` domain.

---

## 9. Monitoring

| Surface    | Tool                              | What we capture                                            |
|------------|-----------------------------------|------------------------------------------------------------|
| Web        | Vercel Analytics                  | Page views, web vitals (LCP, CLS, INP)                     |
| Web        | Sentry (browser)                 | JS errors, unhandled promise rejections                    |
| Server     | Sentry (server, Next.js)         | Route handler errors, edge function errors                 |
| Mobile     | Sentry (React Native)            | Native + JS crashes, unhandled exceptions                 |
| Mobile     | EAS error reporting              | Build + submit errors                                      |
| Backend    | Supabase logs                    | Postgres queries, Auth events, Storage events, Realtime   |
| Backend    | Sentry (Edge Functions)          | Edge Function errors                                       |
| Payments   | Stripe Dashboard + Play Console  | Failed payments, refunds, subscription status              |

Alert routing: Sentry errors → PagerDuty for `error` and above; Supabase CPU > 80% for 5 min → PagerDuty; Stripe `invoice.payment_failed` → Slack channel `#billing`.

---

## 10. Backup Strategy

| Asset                  | Backup strategy                                              | Retention        |
|------------------------|--------------------------------------------------------------|------------------|
| Supabase Postgres      | Supabase automatic daily backups + point-in-time recovery    | 7 days PITR       |
| Supabase Storage       | Weekly snapshot of bucket contents to an external S3 bucket | 12 weeks         |
| Prisma migrations      | Committed to git, pushed to GitHub (immutable history)       | forever          |
| Stripe data           | Stripe's own retention; export customer list monthly         | monthly exports  |
| App Store / Play Store | Store Console data is retained by the platforms              | platform-managed |
| Sentry / Analytics     | Aggregated data only; raw events retained per plan          | per plan         |

Restore drill: once per quarter, restore the staging Supabase project from a production backup and verify the schema + a sample of rows.

---

## 11. CI/CD (GitHub Actions)

### 11.1 Pull request

```yaml
# .github/workflows/pr.yml
name: PR
on: [pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bun run lint
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bun run test -- --ci
```

### 11.2 Merge to main

```yaml
# .github/workflows/main.yml
name: main
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bun run build
      - run: bun run test -- --ci
  deploy-preview:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

Vercel's own GitHub integration also deploys previews per PR; the workflow above is a backup.

### 11.3 EAS build on tag

```yaml
# .github/workflows/release.yml
name: release
on:
  push:
    tags: ['v*']
jobs:
  eas-ios:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: expo/expo-github-action@v8
        with: { expo-version: latest, eas-version: latest, token: ${{ secrets.EXPO_TOKEN }} }
      - run: eas build --platform ios --profile production --non-interactive
      - run: eas submit --platform ios --latest --non-interactive
  eas-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: expo/expo-github-action@v8
        with: { expo-version: latest, eas-version: latest, token: ${{ secrets.EXPO_TOKEN }} }
      - run: eas build --platform android --profile production --non-interactive
      - run: eas submit --platform android --latest --non-interactive
```

---

## 12. Environment Matrix

| Environment   | Database                      | Auth                          | Payments            | Domain                              |
|---------------|-------------------------------|-------------------------------|---------------------|-------------------------------------|
| Local dev      | SQLite (`db/custom.db`)      | Mocked in Zustand store       | Mocked              | `http://localhost:3000`             |
| Preview        | Supabase staging             | NextAuth + Supabase Auth (test) | Stripe test mode    | `https://preview.hybrid.app` (Vercel preview) |
| Production     | Supabase production          | NextAuth + Supabase Auth      | Stripe live + IAP live | `https://hybrid.app`             |

Local dev uses SQLite so contributors can run the app without a Supabase project. The Prisma schema is portable; switching to staging or production is a `.env` change.

---

## 13. Rollback

### 13.1 Web (Vercel)

Vercel keeps every deployment. To roll back:

- Dashboard → Deployments → select a previous deployment → "Promote to Production". Instant.
- Or via CLI: `vercel promote <deployment-url>`.

### 13.2 Backend (Supabase)

- **Schema rollback:** Prisma migrations are forward-only. A rollback is a new migration that reverses the previous one. Migrations are committed to git.
- **Data rollback:** Supabase point-in-time recovery. Restore to a timestamp up to 7 days in the past. Restored to a *new* project to avoid clobbering the live one; switch the `DATABASE_URL` env var to point at the restored project.

### 13.3 Mobile (App Store / Play Store)

- **App Store:** submit a previous build via `eas submit --platform ios --id <previous-build-id>`. The new submission rolls back the live version. App Review may be required if the previous build was not already approved.
- **Play Store:** roll back to a previous release in the Play Console. Production → Create release → choose a previous build. Live within minutes.

### 13.4 Stripe

Roll back a misconfigured webhook by disabling the webhook endpoint in Stripe Dashboard. Customer entitlements already written to `Subscription` remain; they are corrected by a follow-up reconciliation job that re-reads the customer's subscription state from Stripe.

---

## 14. Pre-Launch Checklist

Before flipping production on:

- [ ] Privacy policy live at `https://hybrid.app/privacy`
- [ ] Terms of service live at `https://hybrid.app/terms`
- [ ] Supabase project production, RLS enabled on all 28 models, policies tested
- [ ] Prisma migrations applied to production Supabase
- [ ] Vercel project configured, all env vars set, custom domain live, HTTPS forced
- [ ] Stripe live mode configured, webhook signing verified end-to-end
- [ ] App Store + Play Store listings submitted and approved
- [ ] Sentry + Vercel Analytics configured in production
- [ ] Backup strategy verified (one successful restore from a production backup)
- [ ] Smoke test of the full journey in production (sign up → onboarding → train → log → coach → settings → subscribe)
- [ ] Stripe test payment in production (then refunded)
- [ ] IAP test purchase in TestFlight / internal testing (then refunded)
- [ ] DNS verified (apex, www, api, app subdomains)
- [ ] Email deliverability verified (SPF, DKIM, DMARC)

---

## 15. Post-Launch Operations

- **Weekly:** review Sentry error trends, Stripe failed-payment count, Supabase query latency.
- **Monthly:** review subscription churn, AI coach fallback rate, workout completion rate, mode-switch frequency. Adjust the engine's safety rules based on real-world patterns.
- **Quarterly:** restore drill from a production Supabase backup; rotate `NEXTAUTH_SECRET` and any service account keys.
- **Per release:** tag in git, run the EAS build workflow, submit to stores, update the App Store / Play Store release notes.
