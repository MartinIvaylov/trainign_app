# HYBRID Performance Platform — API Documentation

> **Base URL (preview):** `https://localhost:3000/api`  
> **Base URL (production):** `https://api.hybrid.app/api/v1`  
> **Status:** Only `/api/coach` is implemented today; all other endpoints are planned and documented here for forward compatibility.

---

## 1. Conventions

### 1.1 Standard response envelope

Every JSON response uses the same envelope:

```json
{
  "data": { /* the resource or null */ },
  "error": null,             // or { code, message, details? }
  "meta": { /* pagination, timing, etc. */ }
}
```

### 1.2 Error codes

| Code                     | HTTP   | Meaning                                                       |
|--------------------------|--------|---------------------------------------------------------------|
| `unauthorized`           | 401    | No session or token                                           |
| `forbidden`              | 403    | Authenticated but not allowed to access this resource         |
| `not_found`              | 404    | Resource does not exist or is not visible to the caller      |
| `validation_failed`      | 422    | Request body failed zod validation                            |
| `rate_limited`           | 429    | Rate limit exceeded; retry with `Retry-After` header          |
| `conflict`               | 409    | Idempotency key reuse with a different payload                |
| `upstream_failed`        | 502    | A backing service (AI, Stripe, Supabase) returned an error   |
| `service_unavailable`    | 503    | The AI coach deterministic fallback was used                  |
| `internal_error`         | 500    | Anything else                                                 |

### 1.3 Authentication

- **Web:** session cookie set by NextAuth (`__Secure-next-auth.session-token`). All `/api/*` routes read the session server-side.
- **Mobile:** `Authorization: Bearer <supabase-access-token>` header. The token is the Supabase access token from the mobile client's session.

### 1.4 Versioning

Production uses the URL prefix `/api/v1/...`. The current preview omits the prefix because only `/api/coach` exists. When other endpoints ship, all routes move under `/v1`.

### 1.5 Rate limiting

Per-user token bucket. Defaults:

- 60 requests / minute for general endpoints.
- 30 requests / minute for `/api/coach`.
- 5 requests / minute for `/api/subscription` (sensitive).

Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### 1.6 Idempotency

POST and PUT operations that mutate state accept an `Idempotency-Key` header. If the same key is reused with the same payload within 24 hours, the original response is returned. If the same key is reused with a different payload, the response is `409 conflict`.

---

## 2. Implemented Endpoints

### 2.1 `POST /api/coach`

Send a question to the AI coach grounded in the athlete's real data.

**File:** `src/app/api/coach/route.ts`

#### Request body

```json
{
  "question": "Should I deload this week?",
  "context": {
    "profile": { "displayName": "Alex", "activeMode": "HYROX", "background": "HYROX" },
    "preferences": { "daysPerWeek": 5, "intensityPreference": "high" },
    "benchmarks": [ { "name": "5k run", "value": 1320, "unit": "seconds" } ],
    "activeMode": "HYROX",
    "upcoming": [ { "name": "Long run + sled push", "scheduledDate": "2025-01-12" } ],
    "recentLogs": [ { "workoutType": "for_time", "rpe": 9, "durationSec": 1820 } ],
    "recentPRs": [ { "name": "Fran", "value": 312, "unit": "seconds" } ],
    "hyroxFinishSim": { "predictedSeconds": 5400, "savedAt": "2025-01-05T10:00:00Z" }
  },
  "history": [
    { "role": "user", "content": "What's my weak station?" },
    { "role": "assistant", "content": "Your sled pull is 18% slower than your strongest station..." }
  ]
}
```

| Field        | Type     | Required | Notes                                                    |
|--------------|----------|----------|----------------------------------------------------------|
| `question`   | string   | yes      | Athlete's question. Max 2000 chars.                       |
| `context`   | object   | yes      | Athlete context block. Assembled by the client today; server will assemble in production. |
| `history`   | array    | no       | Last up to 20 messages.                                  |

#### Response (200)

```json
{
  "data": {
    "answer": "Your sled pull is 18% slower than your strongest station. Add 1 sled-pull session per week for the next 3 weeks. This is an estimate based on your last 5 simulations.",
    "toolsUsed": ["analyzeAthlete"],
    "fallback": false
  },
  "error": null,
  "meta": { "latencyMs": 1230, "tokensIn": 1850, "tokensOut": 92 }
}
```

#### System prompt summary

The system prompt enforces:

1. No medical advice; refer the athlete to a clinician for pain/injury.
2. No silent plan changes; any plan change is a suggestion the athlete must confirm.
3. Distinguish measured results from estimates explicitly.
4. Cite the data point(s) the answer is based on.
5. Stay within the athlete's stated goals and current mode.

The full system prompt is constructed in `src/app/api/coach/route.ts` and is server-only.

#### Deterministic fallback

If the AI service is unavailable, returns an error, or times out:

```json
{
  "data": {
    "answer": "<deterministic summary of analyzeAthlete() output + recent logs>",
    "toolsUsed": ["analyzeAthlete"],
    "fallback": true
  },
  "error": null,
  "meta": { "latencyMs": 8, "fallbackReason": "upstream_timeout" }
}
```

The `fallback: true` flag lets the UI badge the response as "offline answer".

#### Error responses

| Status | Code                | When                                              |
|--------|---------------------|----------------------------------------------------|
| 401    | `unauthorized`      | No session                                         |
| 422    | `validation_failed`| Missing `question` or `context`                    |
| 429    | `rate_limited`     | > 30 requests / minute                             |
| 502    | `upstream_failed`  | AI service returned a non-recoverable error        |
| 503    | `service_unavailable` | Fallback used                                   |

#### Rate limiting (planned)

30 requests / minute per user. When exceeded, returns 429 with `Retry-After: 60`.

---

## 3. Planned Endpoints

All endpoints below are documented for forward compatibility. They are not yet implemented.

### 3.1 Auth

#### `POST /api/auth/[...nextauth]`

NextAuth handler. Not a REST endpoint; the full NextAuth surface is mounted under this catch-all. Supports `signIn`, `signOut`, `getSession`, `getCsrfToken`, and provider callbacks.

**Status:** NextAuth is available in the project but not yet wired. Auth is currently mocked in the Zustand store.

---

### 3.2 Workouts

#### `GET /api/workouts`

List workouts in the library.

**Query params:**

| Param       | Type     | Default | Notes                                       |
|-------------|----------|---------|---------------------------------------------|
| `mode`      | string   | -       | HYROX / ATHX / CROSSFIT / MAINTENANCE       |
| `type`      | string   | -       | for_time / amrap / emom / tabata / intervals / strength |
| `tags`      | string[] | -       | Comma-separated                            |
| `q`         | string   | -       | Full-text search on name + description     |
| `limit`     | int      | 20      | Max 100                                    |
| `cursor`    | string   | -       | Pagination cursor                          |

**Response (200):**

```json
{
  "data": [ { "id": "wk_1", "name": "1k Run + 20 WB", "mode": "HYROX", "workoutType": "for_time" } ],
  "error": null,
  "meta": { "nextCursor": "wk_20", "hasMore": true }
}
```

#### `POST /api/workouts`

Create a custom workout. Requires authentication. The new workout is owned by the caller.

**Request body:**

```json
{
  "name": "My custom EMOM",
  "mode": "CROSSFIT",
  "workoutType": "emom",
  "durationMin": 16,
  "intensityRPE": 7,
  "scales": ["Scaled"],
  "tags": ["metcon", "custom"],
  "exercises": [
    { "exerciseId": "ex_burpee", "orderIndex": 0, "repsTarget": 15 },
    { "exerciseId": "ex_box_jump", "orderIndex": 1, "repsTarget": 12 }
  ]
}
```

**Response (201):** the created Workout with `id`, `createdAt`, `updatedAt`.

#### `GET /api/workouts/:id`

Returns a single workout with its exercises.

#### `PUT /api/workouts/:id`

Updates a workout. Only the owner can update.

#### `DELETE /api/workouts/:id`

Deletes a workout. Only the owner can delete; official/community workouts cannot be deleted.

---

### 3.3 Workout Logs

#### `GET /api/workout-logs`

List the caller's workout logs.

**Query params:**

| Param       | Type     | Default | Notes                                |
|-------------|----------|---------|--------------------------------------|
| `mode`      | string   | -       | Filter by mode                       |
| `from`      | ISO date | -       | Logs on or after this date          |
| `to`        | ISO date | -       | Logs on or before this date          |
| `limit`     | int      | 20      | Max 100                              |
| `cursor`    | string   | -       | Pagination cursor                    |

**Response (200):** array of `WorkoutLog` rows with `exerciseLogs` nested.

#### `POST /api/workout-logs`

Create a workout log. This is the call the Train view makes after finishing a workout.

**Request body:**

```json
{
  "workoutId": "wk_1",
  "scheduledWorkoutId": "sw_1",
  "mode": "HYROX",
  "workoutType": "for_time",
  "startedAt": "2025-01-10T08:00:00Z",
  "completedAt": "2025-01-10T08:32:14Z",
  "durationSec": 1934,
  "resultValue": 1934,
  "resultUnit": "seconds",
  "rpe": 8,
  "notes": "Felt strong on the sled push.",
  "exerciseLogs": [
    { "exerciseId": "ex_run", "setIndex": 0, "durationSec": 240 },
    { "exerciseId": "ex_wb", "setIndex": 0, "reps": 20 }
  ]
}
```

Server computes PRs broken by this log and returns them in the response:

```json
{
  "data": { "logId": "wl_1", "brokenPRs": [ { "name": "1k+WB", "value": 1934, "unit": "seconds" } ] },
  "error": null,
  "meta": null
}
```

---

### 3.4 Training Plan

#### `GET /api/plan`

Returns the caller's active training plan with blocks and scheduled workouts.

**Query params:**

| Param       | Type   | Default | Notes                          |
|-------------|--------|---------|--------------------------------|
| `mode`      | string | -       | Filter by mode                |
| `from`      | date   | -       | Sessions on or after this date|
| `to`        | date   | -       | Sessions on or before this date|

#### `POST /api/plan`

Generate a new training plan using the engine.

**Request body:**

```json
{
  "mode": "HYROX",
  "startDate": "2025-01-15",
  "targetDate": "2025-04-15",
  "targetCompetitionId": "comp_hyrox_london",
  "daysPerWeek": 5,
  "intensityPreference": "high"
}
```

The server calls `generatePeriodization()` + `generateWeekSessions()` from `src/lib/training-engine/index.ts`.

**Response (201):** the created TrainingPlan with its blocks and initial scheduled workouts.

---

### 3.5 Plan Sessions

#### `POST /api/plan/sessions`

Create (schedule) a session. Ad-hoc or auto-generated.

#### `PUT /api/plan/sessions/:id`

Update a scheduled session. Used for:

- Reschedule (`scheduledDate` change).
- Mark complete with RPE → server creates the linked WorkoutLog.
- Mark skipped.

#### `DELETE /api/plan/sessions/:id`

Delete a scheduled session. Sessions in the past can be deleted only if not yet completed.

---

### 3.6 Benchmarks

#### `GET /api/benchmarks`

List benchmark catalogue. Public endpoint (no auth needed).

**Query params:** `mode`, `category`.

#### `POST /api/benchmarks`

Create a benchmark result. Authenticated.

**Request body:**

```json
{
  "benchmarkId": "bm_5k_run",
  "measuredAt": "2025-01-10",
  "value": 1320,
  "unit": "seconds",
  "source": "manual",
  "notes": "Track run"
}
```

---

### 3.7 Personal Records

#### `GET /api/personal-records`

List the caller's PRs.

**Query params:** `mode`, `from`, `to`.

#### `POST /api/personal-records`

Manually record a PR (e.g., a race result). Most PRs are created automatically when a `WorkoutLog` is posted.

---

### 3.8 Competitions

#### `GET /api/competitions`

List competitions.

**Query params:** `mode`, `from`, `to`, `organiser`.

#### `POST /api/competitions`

Register the caller for a competition (creates `AthleteCompetition` row).

**Request body:**

```json
{
  "competitionId": "comp_hyrox_london",
  "division": "Open M"
}
```

---

### 3.9 HYROX Simulator

#### `POST /api/hyrox/simulate`

Pure compute endpoint. No persistence. Returns the predicted finish time + per-station breakdown from per-station run + station splits.

**Request body:**

```json
{
  "stationSplits": [
    { "runSeconds": 240, "stationSeconds": 90 },
    { "runSeconds": 245, "stationSeconds": 130 },
    { "runSeconds": 250, "stationSeconds": 200 },
    { "runSeconds": 248, "stationSeconds": 150 },
    { "runSeconds": 252, "stationSeconds": 200 },
    { "runSeconds": 246, "stationSeconds": 180 },
    { "runSeconds": 250, "stationSeconds": 170 },
    { "runSeconds": 252, "stationSeconds": 140 }
  ],
  "transitionSeconds": 15
}
```

**Response (200):**

```json
{
  "data": {
    "predictedSeconds": 5187,
    "perStation": [
      { "index": 0, "runSeconds": 240, "stationSeconds": 90, "totalSeconds": 330 },
      { "index": 1, "runSeconds": 245, "stationSeconds": 130, "totalSeconds": 375 }
    ],
    "strongestStationIndex": 0,
    "weakestStationIndex": 2,
    "estimated": true
  },
  "error": null,
  "meta": null
}
```

The `estimated: true` field is mandatory. The simulation is never written to RaceResult; it is stored in `hyroxSims` in the client store and persisted via a separate save endpoint (planned).

The compute logic lives in `src/lib/competition-rules/hyrox.ts` (`simulateHyrox()`, `formatHMS`, `formatPace`).

---

### 3.10 ATHX Score

#### `POST /api/athx/score`

Pure compute endpoint. Returns the Estimated Performance Score (EPS) on a 0-100 scale per discipline (Strength / Endurance / MetCon-X) and an overall score.

**Request body:**

```json
{
  "strengthTests": [ { "name": "1RM back squat", "value": 160, "unit": "kg" } ],
  "enduranceTests": [ { "name": "5k run", "value": 1320, "unit": "seconds" } ],
  "metconTests": [ { "name": "Fran", "value": 312, "unit": "seconds" } ],
  "bodyWeightKg": 78
}
```

**Response (200):**

```json
{
  "data": {
    "strengthScore": 72,
    "enduranceScore": 68,
    "metconXScore": 65,
    "overallScore": 68,
    "estimated": true,
    "breakdown": {
      "strength": { "rawInputs": [...], "normalised": 0.72 },
      "endurance": { "rawInputs": [...], "normalised": 0.68 },
      "metconX": { "rawInputs": [...], "normalised": 0.65 }
    }
  },
  "error": null,
  "meta": null
}
```

The compute logic lives in `src/lib/competition-rules/athx.ts` (`normaliseAthxTest()`, `estimateAthxScore()`, `pairCombinedScore()`).

---

### 3.11 Subscription

#### `POST /api/subscription`

Two modes:

1. **Web — Stripe checkout**. Request:

   ```json
   { "channel": "web", "tier": "pro", "interval": "monthly", "returnUrl": "https://hybrid.app/settings" }
   ```

   Response (200):

   ```json
   { "data": { "checkoutUrl": "https://checkout.stripe.com/..." }, "error": null, "meta": null }
   ```

2. **Mobile — receipt validation**. Request:

   ```json
   { "channel": "app_store", "receiptBase64": "...", "productId": "tier.pro.monthly" }
   ```

   Response (200):

   ```json
   { "data": { "tier": "pro", "status": "active", "expiresAt": "2025-02-15T00:00:00Z" }, "error": null, "meta": null }
   ```

The server records the purchase in the `Subscription` table.

---

### 3.12 Webhooks

#### `POST /api/webhooks/stripe`

Stripe webhook handler. Verifies the signature, then processes the event:

- `checkout.session.completed` → create Subscription row.
- `customer.subscription.updated` → update status, period end, cancel-at-period-end.
- `customer.subscription.deleted` → mark canceled.

#### `POST /api/webhooks/appstore`

App Store Server Notification V2. Verifies the JWT signature, then processes the notification type (`DID_RENEW`, `EXPIRED`, `REFUND`, `GRACE_PERIOD_EXPIRED`, etc.) and writes to `Subscription`.

#### `POST /api/webhooks/playstore`

Play Store Real-time Developer Notification. Verifies the request, decodes the pub/sub message, then processes the subscription notification type and writes to `Subscription`.

All webhook endpoints respond `200 OK` with an empty body on success. They do not use the standard response envelope — they speak the protocol of their respective stores.

---

### 3.13 Wearables

#### `POST /api/wearables/connect`

Start the OAuth flow for a provider (Garmin, Strava, Whoop). Apple Health and Health Connect are native-only and do not use this endpoint.

**Request body:**

```json
{ "provider": "strava", "returnUrl": "https://hybrid.app/settings/wearables" }
```

**Response (200):**

```json
{ "data": { "authUrl": "https://www.strava.com/oauth/authorize?..." }, "error": null, "meta": null }
```

#### `POST /api/wearables/sync`

Manual sync trigger. Pulls the latest sessions + metrics from the connected provider and writes them to `WorkoutLog` / `AthleteMetric`.

**Request body:**

```json
{ "provider": "strava", "from": "2025-01-01", "to": "2025-01-10" }
```

**Response (200):**

```json
{
  "data": { "importedSessions": 4, "importedMetrics": 7, "skippedDuplicates": 2 },
  "error": null,
  "meta": { "syncedAt": "2025-01-10T12:00:00Z" }
}
```

---

## 4. Error Handling Reference

| Endpoint                       | Notable errors                                                         |
|--------------------------------|------------------------------------------------------------------------|
| `POST /api/coach`              | `service_unavailable` (fallback used), `upstream_failed`               |
| `POST /api/workout-logs`      | `validation_failed`, `conflict` (idempotency mismatch)                |
| `POST /api/hyrox/simulate`    | `validation_failed` (splits length ≠ 8)                               |
| `POST /api/athx/score`        | `validation_failed` (missing required discipline inputs)             |
| `POST /api/subscription`      | `upstream_failed` (Stripe / App Store / Play Store)                    |
| `POST /api/webhooks/*`        | Always 200 unless signature verification fails (then 400)             |

---

## 5. Client SDK (planned)

A typed client in `packages/api-client` will wrap these endpoints with:

- Automatic bearer-token attachment.
- Automatic retry on `429` and `5xx` with exponential backoff.
- Automatic idempotency-key generation for POST operations.
- zod-validated responses matching the standard envelope.

The web and mobile apps both import this client; the only difference is the token source (cookie vs Secure Store).
