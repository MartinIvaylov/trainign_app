# HYBRID Performance Platform — Database Schema

> **File:** `prisma/schema.prisma`  
> **Database today:** SQLite (`db/custom.db`)  
> **Database production:** Supabase Postgres with RLS  
> **Models:** 28  
> **Status:** Schema is portable; production applies RLS via migrations

---

## 1. Overview

The schema models one athlete as a single evolving system across multiple competition modes. Mode switching never deletes history; sessions, logs, PRs and simulations persist forever. The schema is organised in five clusters:

1. **Identity & profile** — User, AthleteProfile, AthletePreference, AthleteGoal
2. **Competitions** — Competition, AthleteCompetition, RaceResult, RaceSplit
3. **Training** — TrainingPlan, TrainingBlock, ScheduledWorkout, Workout, ExerciseLibrary, WorkoutExercise
4. **Logging & analytics** — WorkoutLog, ExerciseLog, Benchmark, BenchmarkResult, PersonalRecord, AthleteMetric, RecoveryLog
5. **Ecosystem** — WearableConnection, Partnership, CoachProfile, CoachAthlete, Challenge, ChallengeParticipant, ActivityFeedItem, Notification, Subscription, AiMessage, AiRecommendation

---

## 2. Models

### 2.1 User

Top-level account. One User has exactly one AthleteProfile (in the athlete flow). Coaches and gym admins are also Users with a CoachProfile row.

| Field        | Type     | Notes                                       |
|--------------|----------|---------------------------------------------|
| id           | String   | UUID, PK, `@id @default(uuid())`             |
| email        | String   | Unique, `@unique`                            |
| name         | String?  | Display name                                 |
| image        | String?  | Avatar URL                                   |
| emailVerified| DateTime?| NextAuth field                              |
| createdAt    | DateTime | `@default(now())`                            |
| updatedAt    | DateTime | `@updatedAt`                                 |

**Relationships:** `profile AthleteProfile?`, `coachProfile CoachProfile?`, `subscriptions Subscription[]`, `notifications Notification[]`, `feedItems ActivityFeedItem[]`, `wearables WearableConnection[]`, `coachLinks CoachAthlete[]` (as athlete or coach), `challengeParticipations ChallengeParticipant[]`.

**Indexes:** `email` unique.

**RLS:** A user can `SELECT`/`UPDATE` only their own row.

---

### 2.2 AthleteProfile

The athlete's identity and onboarding data. Shared across all modes.

| Field             | Type     | Notes                                                |
|-------------------|----------|------------------------------------------------------|
| id                | String   | UUID, PK                                              |
| userId            | String   | FK → User.id, unique                                  |
| displayName        | String   |                                                       |
| avatarUrl         | String?  |                                                       |
| dateOfBirth       | DateTime?|                                                       |
| sex               | String?  | "male" / "female" / "other"                          |
| heightCm          | Int?     |                                                       |
| bodyWeightKg      | Float?   |                                                       |
| background        | String   | enum: HYROX / CrossFit / Running / Strength / Newbie |
| experienceYears   | Int      |                                                       |
| activeMode        | String   | enum: HYROX / ATHX / CROSSFIT / MAINTENANCE          |
| previousModes     | String[] | modes the athlete has trained in                     |
| pausedModes       | String[] | modes the athlete has paused                         |
| createdAt         | DateTime |                                                       |
| updatedAt         | DateTime |                                                       |

**Relationships:** `user User` (back), `preferences AthletePreference?`, `goals AthleteGoal[]`, `plans TrainingPlan[]`, `scheduledWorkouts ScheduledWorkout[]`, `workoutLogs WorkoutLog[]`, `benchmarkResults BenchmarkResult[]`, `personalRecords PersonalRecord[]`, `raceResults RaceResult[]`, `athleteMetrics AthleteMetric[]`, `recoveryLogs RecoveryLog[]`, `wearables WearableConnection[]`, `partnerships Partnership[]`, `coachLinks CoachAthlete[]`, `challengeParticipations ChallengeParticipant[]`, `aiMessages AiMessage[]`, `aiRecommendations AiRecommendation[]`.

**Indexes:** `userId` unique, `activeMode`.

**RLS:** Athlete `SELECT`/`UPDATE` own row; authorised coaches `SELECT` only (via `CoachAthlete` join).

---

### 2.3 AthletePreference

Athlete's training preferences captured during onboarding.

| Field                  | Type     | Notes                                        |
|------------------------|----------|----------------------------------------------|
| id                     | String   | PK                                            |
| athleteProfileId       | String   | FK → AthleteProfile.id, unique               |
| daysPerWeek            | Int      | 3-7                                          |
| sessionDurationMin     | Int      | 30-120                                       |
| equipment              | String[] | dumbbell / barbell / erg / sled / wall ball / ... |
| location              | String   | gym / home / outdoor / mixed                 |
| intensityPreference    | String   | moderate / high / very-high                  |
| longRunDay             | String?  | preferred day of week                        |
| restDay                | String?  | preferred rest day                           |
| receiveReminders       | Boolean  | @default(true)                                |
| createdAt              | DateTime |                                               |
| updatedAt              | DateTime |                                               |

**Relationships:** `athleteProfile AthleteProfile` (back).

**Indexes:** `athleteProfileId` unique.

**RLS:** Athlete only.

---

### 2.4 AthleteGoal

Athlete's competition goals. An athlete can have multiple goals across modes; one is "primary".

| Field              | Type     | Notes                                       |
|--------------------|----------|---------------------------------------------|
| id                 | String   | PK                                          |
| athleteProfileId   | String   | FK → AthleteProfile.id                      |
| mode               | String   | HYROX / ATHX / CROSSFIT / MAINTENANCE       |
| goalType           | String   | finish / time-target / podium / top-x       |
| targetValue        | Float?   | target seconds, rounds, or load             |
| targetCompetitionId| String?  | FK → Competition.id (nullable)              |
| raceDate           | DateTime?| explicit date if no competition linked      |
| status             | String   | active / achieved / missed / paused         |
| isPrimary          | Boolean  | @default(false)                              |
| createdAt          | DateTime |                                              |
| updatedAt          | DateTime |                                              |

**Indexes:** `(athleteProfileId, status)`, `(athleteProfileId, mode, status)`.

**RLS:** Athlete + authorised coaches.

---

### 2.5 Competition

Configurable competition record. Events are not hardcoded; they live in `src/lib/competition-rules/` and are seeded into this table.

| Field          | Type     | Notes                                       |
|----------------|----------|---------------------------------------------|
| id             | String   | PK                                          |
| name           | String   |                                             |
| mode           | String   | HYROX / ATHX / CROSSFIT                     |
| organiser      | String?  | "HYROX", "ATHX Games", "CrossFit"           |
| eventDate      | DateTime |                                             |
| location       | String?  |                                             |
| divisions      | String[] | "Open M", "Open W", "Pro", "Mixed Pairs"...  |
| disciplines    | Json?    | ATHX: list of disciplines                   |
| stations       | Json?    | HYROX: list of stations                     |
| sourceUrl      | String?  | official event URL                          |
| createdAt      | DateTime |                                             |
| updatedAt      | DateTime |                                             |

**Relationships:** `athleteCompetitions AthleteCompetition[]`, `goals AthleteGoal[]`.

**Indexes:** `(mode, eventDate)`, `eventDate`.

**RLS:** Public `SELECT`. `INSERT`/`UPDATE` restricted to admins.

---

### 2.6 AthleteCompetition

Join table: athlete registered for a competition.

| Field              | Type     | Notes                                       |
|--------------------|----------|---------------------------------------------|
| id                 | String   | PK                                          |
| athleteProfileId   | String   | FK                                          |
| competitionId      | String   | FK                                          |
| division           | String   |                                             |
| registeredAt       | DateTime |                                             |
| resultId           | String?  | FK → RaceResult.id (nullable until logged)  |
| status             | String   | registered / completed / dns / dnf          |

**Indexes:** `(athleteProfileId, competitionId)` unique, `(competitionId, status)`.

**RLS:** Athlete + authorised coaches; competitors in the same competition can `SELECT` each other's row.

---

### 2.7 RaceResult

A logged competition result.

| Field             | Type     | Notes                                       |
|-------------------|----------|---------------------------------------------|
| id                | String   | PK                                          |
| athleteCompetitionId | String | FK                                          |
| totalSeconds      | Int      | total time in seconds                       |
| place             | Int?     | finishing position                          |
| division          | String   |                                             |
| verified          | Boolean  | @default(false) — verified vs user-submitted|
| sourceUrl         | String?  | link to official results page               |
| notes             | String?  |                                             |
| createdAt         | DateTime |                                             |

**Relationships:** `splits RaceSplit[]`, `athleteCompetition AthleteCompetition`.

**Indexes:** `(athleteCompetitionId)`, `(verified)`.

**RLS:** Athlete + authorised coaches always `SELECT`; public `SELECT` only if `verified = true` and athlete's privacy setting is public.

---

### 2.8 RaceSplit

Per-station splits for a race result (HYROX 8 stations etc.).

| Field            | Type     | Notes                                       |
|-------------------|----------|---------------------------------------------|
| id                | String   | PK                                          |
| raceResultId      | String   | FK                                          |
| stationIndex      | Int      | 0-7 for HYROX                               |
| stationName       | String   |                                             |
| runSeconds        | Int      | run leg duration                            |
| stationSeconds    | Int      | station work duration                       |
| transitionSeconds| Int?     | optional                                    |

**Indexes:** `(raceResultId, stationIndex)` unique.

**RLS:** Inherited from RaceResult.

---

### 2.9 TrainingPlan

A training plan owned by an athlete (or assigned by a coach).

| Field              | Type     | Notes                                       |
|--------------------|----------|---------------------------------------------|
| id                 | String   | PK                                          |
| athleteProfileId   | String   | FK                                          |
| mode               | String   | HYROX / ATHX / CROSSFIT / MAINTENANCE       |
| name               | String   |                                             |
| startDate          | DateTime |                                             |
| endDate            | DateTime |                                             |
| targetCompetitionId| String?  | FK → Competition.id (optional)              |
| source             | String   | auto / coach / custom                       |
| active             | Boolean  | @default(true)                              |
| createdAt          | DateTime |                                             |
| updatedAt          | DateTime |                                             |

**Relationships:** `blocks TrainingBlock[]`, `scheduledWorkouts ScheduledWorkout[]`.

**Indexes:** `(athleteProfileId, active)`, `(athleteProfileId, mode)`.

**RLS:** Athlete + authorised coaches.

---

### 2.10 TrainingBlock

A periodisation block within a plan (e.g., Base, Build, Specific, Taper).

| Field              | Type     | Notes                                       |
|--------------------|----------|---------------------------------------------|
| id                 | String   | PK                                          |
| trainingPlanId     | String   | FK                                          |
| blockIndex         | Int      | ordinal                                     |
| phase              | String   | base / build / specific / taper / peak / aerobic / strength / maintenance |
| name               | String   |                                             |
| startDate          | DateTime |                                             |
| endDate            | DateTime |                                             |
| weeklyVolumeTargetMin | Int?  |                                             |
| intensityTargetRPE | Float?   |                                             |
| notes              | String?  |                                             |

**Indexes:** `(trainingPlanId, blockIndex)` unique.

**RLS:** Inherited from TrainingPlan.

---

### 2.11 ScheduledWorkout

A workout scheduled on a specific date.

| Field              | Type     | Notes                                       |
|--------------------|----------|---------------------------------------------|
| id                 | String   | PK                                          |
| trainingPlanId     | String   | FK                                          |
| trainingBlockId    | String?  | FK (nullable for ad-hoc)                     |
| workoutId          | String   | FK → Workout.id                             |
| scheduledDate      | DateTime |                                             |
| durationMin       | Int      |                                             |
| mode               | String   |                                             |
| status            | String   | scheduled / completed / skipped / rescheduled|
| completedLogId    | String?  | FK → WorkoutLog.id (nullable until done)    |
| createdAt          | DateTime |                                             |
| updatedAt          | DateTime |                                             |

**Indexes:** `(trainingPlanId, scheduledDate)`, `(scheduledDate)`, `(status)`.

**RLS:** Athlete + authorised coaches.

---

### 2.12 Workout

Reusable workout definition. The library.

| Field          | Type     | Notes                                       |
|----------------|----------|---------------------------------------------|
| id             | String   | PK                                          |
| mode           | String   | HYROX / ATHX / CROSSFIT / MAINTENANCE       |
| name           | String   |                                             |
| description    | String?  |                                             |
| workoutType    | String   | for_time / amrap / emom / tabata / intervals / strength |
| durationMin   | Int?     | estimated duration                          |
| intensityRPE  | Int?     | 1-10                                        |
| scales        | String[] | "RX", "Scaled", "Beginner"                  |
| tags          | String[] |                                             |
| source        | String   | official / community / custom              |
| createdBy      | String?  | User.id if custom                           |
| createdAt      | DateTime |                                             |
| updatedAt      | DateTime |                                             |

**Relationships:** `exercises WorkoutExercise[]`, `scheduledIn ScheduledWorkout[]`, `logs WorkoutLog[]`.

**Indexes:** `(mode)`, `(workoutType)`, `(mode, workoutType)`.

**RLS:** Public `SELECT` for official/community; `INSERT`/`UPDATE`/`DELETE` for `createdBy` user only.

---

### 2.13 ExerciseLibrary

The movement library.

| Field          | Type     | Notes                                       |
|----------------|----------|---------------------------------------------|
| id             | String   | PK                                          |
| name           | String   |                                             |
| category       | String   | run / lift / gymnastic / erg / sled / wall ball / burpee |
| movementType   | String   | for_distance / for_reps / for_load / for_time|
| measurement    | String   | seconds / meters / reps / kg / rounds       |
| description    | String?  |                                             |
| videoUrl       | String?  |                                             |
| createdAt      | DateTime |                                             |
| updatedAt      | DateTime |                                             |

**Relationships:** `workoutLinks WorkoutExercise[]`.

**Indexes:** `(category)`, `(name)`.

**RLS:** Public `SELECT`.

---

### 2.14 WorkoutExercise

Join: workout ↔ exercise with ordering and rep schemes.

| Field          | Type     | Notes                                       |
|----------------|----------|---------------------------------------------|
| id             | String   | PK                                          |
| workoutId      | String   | FK                                          |
| exerciseId     | String   | FK                                          |
| orderIndex    | Int      |                                             |
| repsTarget    | Int?     |                                             |
| distanceMeters| Int?     |                                             |
| loadKg        | Float?   |                                             |
| durationSec   | Int?     |                                             |
| rounds        | Int?     |                                             |
| notes         | String?  |                                             |

**Indexes:** `(workoutId, orderIndex)` unique.

**RLS:** Inherited from Workout.

---

### 2.15 WorkoutLog

A completed workout log. Single source of truth for analytics.

| Field            | Type     | Notes                                       |
|-------------------|----------|---------------------------------------------|
| id                | String   | PK                                          |
| athleteProfileId  | String   | FK                                          |
| workoutId         | String?  | FK (nullable for free-form)                |
| scheduledWorkoutId| String? | FK (nullable for ad-hoc)                    |
| mode              | String   |                                             |
| workoutType       | String   |                                             |
| startedAt         | DateTime |                                             |
| completedAt       | DateTime |                                             |
| durationSec       | Int      |                                             |
| resultValue       | Float?   | time / rounds / load                       |
| resultUnit       | String   | seconds / rounds / kg                       |
| rpe              | Int      | 1-10                                        |
| notes             | String?  |                                             |
| source            | String   | manual / wearable / imported                |
| wearableSource   | String?  | provider name                               |
| createdAt         | DateTime |                                             |

**Relationships:** `exerciseLogs ExerciseLog[]`, `prs PersonalRecord[]` (PRs broken during this log).

**Indexes:** `(athleteProfileId, completedAt)` desc, `(athleteProfileId, mode, completedAt)`, `(completedAt)`.

**RLS:** Athlete only (and authorised coaches).

---

### 2.16 ExerciseLog

Per-exercise results within a workout log.

| Field           | Type     | Notes                                       |
|------------------|----------|---------------------------------------------|
| id               | String   | PK                                          |
| workoutLogId      | String   | FK                                          |
| exerciseId       | String   | FK                                          |
| setIndex         | Int      | 0-based                                     |
| reps             | Int?     |                                             |
| loadKg           | Float?   |                                             |
| distanceMeters    | Int?     |                                             |
| durationSec      | Int?     |                                             |
| resultUnit      | String   |                                             |

**Indexes:** `(workoutLogId, exerciseId, setIndex)` unique.

**RLS:** Inherited from WorkoutLog.

---

### 2.17 Benchmark

Standardised benchmark definitions (e.g., 5k run, 1RM back squat, 2k row, Fran).

| Field           | Type     | Notes                                       |
|------------------|----------|---------------------------------------------|
| id               | String   | PK                                          |
| name             | String   |                                             |
| category         | String   | run / lift / erg / metcon                   |
| measurement      | String   | seconds / kg / reps                         |
| mode             | String   | HYROX / ATHX / CROSSFIT / MAINTENANCE       |
| isCrossMode      | Boolean  | @default(false) — applies to multiple modes |
| description      | String?  |                                             |
| createdAt        | DateTime |                                             |

**Relationships:** `results BenchmarkResult[]`.

**Indexes:** `(mode)`, `(category)`, `(name)` unique.

**RLS:** Public `SELECT`.

---

### 2.18 BenchmarkResult

A single recorded benchmark result for an athlete.

| Field            | Type     | Notes                                       |
|-------------------|----------|---------------------------------------------|
| id                | String   | PK                                          |
| athleteProfileId  | String   | FK                                          |
| benchmarkId       | String   | FK                                          |
| measuredAt        | DateTime |                                             |
| value             | Float    | result value                                |
| unit              | String   |                                             |
| source            | String   | manual / wearable / verified               |
| notes             | String?  |                                             |
| createdAt         | DateTime |                                             |

**Indexes:** `(athleteProfileId, benchmarkId, measuredAt)` desc, `(benchmarkId, measuredAt)`.

**RLS:** Athlete + authorised coaches.

---

### 2.19 PersonalRecord

A personal record. Linked to the WorkoutLog that broke it.

| Field            | Type     | Notes                                       |
|-------------------|----------|---------------------------------------------|
| id                | String   | PK                                          |
| athleteProfileId  | String   | FK                                          |
| benchmarkId       | String?  | FK → Benchmark (if benchmark-tied)          |
| workoutLogId      | String?  | FK → WorkoutLog (if broken during a log)    |
| mode              | String   |                                             |
| name              | String   | "Fran", "5k run", "1RM back squat"          |
| value             | Float    |                                             |
| unit              | String   |                                             |
| achievedAt        | DateTime |                                             |
| isEstimate        | Boolean  | @default(false)                             |
| createdAt         | DateTime |                                             |

**Indexes:** `(athleteProfileId, name, achievedAt)` desc, `(athleteProfileId, mode)`.

**RLS:** Athlete + authorised coaches; public `SELECT` only if athlete's privacy = public.

---

### 2.20 AthleteMetric

Daily metrics: weight, sleep, HRV, fatigue, mood, soreness.

| Field            | Type     | Notes                                       |
|-------------------|----------|---------------------------------------------|
| id                | String   | PK                                          |
| athleteProfileId  | String   | FK                                          |
| measuredAt        | DateTime | day                                         |
| bodyWeightKg      | Float?   |                                             |
| sleepHours        | Float?   |                                             |
| hrvMs             | Int?     |                                             |
| restingHr         | Int?     |                                             |
| fatigue           | Int?     | 1-10                                        |
| soreness          | Int?     | 1-10                                        |
| mood              | Int?     | 1-10                                        |
| source            | String   | manual / wearable                          |
| createdAt         | DateTime |                                             |

**Indexes:** `(athleteProfileId, measuredAt)` desc.

**RLS:** Athlete + authorised coaches.

---

### 2.21 RecoveryLog

Recovery sessions logged separately (sleep, sauna, mobility, etc.).

| Field            | Type     | Notes                                       |
|-------------------|----------|---------------------------------------------|
| id                | String   | PK                                          |
| athleteProfileId  | String   | FK                                          |
| recoveryType      | String   | sleep / sauna / ice_bath / mobility / massage |
| durationMin       | Int      |                                             |
| qualityRPE        | Int?     | 1-10                                        |
| measuredAt        | DateTime |                                             |
| notes             | String?  |                                             |

**Indexes:** `(athleteProfileId, measuredAt)` desc, `(recoveryType)`.

**RLS:** Athlete only.

---

### 2.22 WearableConnection

An athlete's connected wearable account.

| Field            | Type     | Notes                                       |
|-------------------|----------|---------------------------------------------|
| id                | String   | PK                                          |
| userId            | String   | FK → User.id                                |
| provider          | String   | apple_health / health_connect / garmin / strava / whoop |
| externalAccountId | String   | provider's account id                       |
| accessToken       | String?  | encrypted                                   |
| refreshToken      | String?  | encrypted                                   |
| lastSyncedAt      | DateTime?|                                             |
| status            | String   | active / expired / revoked                  |
| createdAt         | DateTime |                                             |
| updatedAt         | DateTime |                                             |

**Indexes:** `(userId, provider)` unique, `(status)`.

**RLS:** User only.

---

### 2.23 Partnership

A training pair (relevant to HYROX Pairs and ATHX Pairs).

| Field            | Type     | Notes                                       |
|-------------------|----------|---------------------------------------------|
| id                | String   | PK                                          |
| athleteAProfileId | String  | FK                                          |
| athleteBProfileId | String  | FK                                          |
| mode              | String   | HYROX / ATHX                                |
| status            | String   | pending / active / inactive                 |
| invitedAt         | DateTime |                                             |
| acceptedAt        | DateTime?|                                             |
| createdAt         | DateTime |                                             |

**Indexes:** `(athleteAProfileId, athleteBProfileId, mode)` unique, `(status)`.

**RLS:** Both athletes in the partnership.

---

### 2.24 CoachProfile

A coach's profile. A User becomes a coach by creating a CoachProfile.

| Field            | Type     | Notes                                       |
|-------------------|----------|---------------------------------------------|
| id                | String   | PK                                          |
| userId            | String   | FK → User.id, unique                        |
| displayName       | String   |                                             |
| bio               | String?  |                                             |
| specialties       | String[] | HYROX / ATHX / CROSSFIT / hybrid            |
| hourlyRateEur     | Float?   |                                             |
| isAcceptingClients| Boolean  | @default(true)                              |
| createdAt         | DateTime |                                             |
| updatedAt         | DateTime |                                             |

**Relationships:** `athletes CoachAthlete[]`, `user User` (back).

**Indexes:** `userId` unique.

**RLS:** Public `SELECT` (basic info); coach `UPDATE` own row only.

---

### 2.25 CoachAthlete

Authorised relationship between a coach and an athlete.

| Field            | Type     | Notes                                       |
|-------------------|----------|---------------------------------------------|
| id                | String   | PK                                          |
| coachProfileId    | String   | FK → CoachProfile.id                        |
| athleteProfileId  | String   | FK → AthleteProfile.id                      |
| status            | String   | invited / active / declined / ended         |
| invitedAt         | DateTime |                                             |
| acceptedAt        | DateTime?|                                             |
| endedAt           | DateTime?|                                             |
| notes             | String?  |                                             |

**Indexes:** `(coachProfileId, athleteProfileId)` unique, `(athleteProfileId, status)`.

**RLS:** Coach sees own athletes; athlete sees own coaches.

---

### 2.26 Challenge

A community challenge.

| Field            | Type     | Notes                                       |
|-------------------|----------|---------------------------------------------|
| id                | String   | PK                                          |
| name              | String   |                                             |
| description       | String   |                                             |
| mode              | String   |                                             |
| challengeType     | String   | volume / streak / time-target / count       |
| targetValue       | Float    |                                             |
| targetUnit        | String   | km / sessions / minutes                     |
| startDate         | DateTime |                                             |
| endDate           | DateTime |                                             |
| isPublic          | Boolean  | @default(true)                              |
| createdBy         | String?  | User.id (null for official)                |
| createdAt         | DateTime |                                             |

**Relationships:** `participants ChallengeParticipant[]`.

**Indexes:** `(mode, startDate)`, `(isPublic, startDate)`.

**RLS:** Public `SELECT` for public challenges; private challenges visible to participants only.

---

### 2.27 ChallengeParticipant

An athlete's participation in a challenge.

| Field             | Type     | Notes                                       |
|--------------------|----------|---------------------------------------------|
| id                 | String   | PK                                          |
| challengeId        | String   | FK                                          |
| athleteProfileId   | String   | FK                                          |
| joinedAt           | DateTime |                                             |
| progressValue      | Float    | @default(0)                                 |
| isCompleted        | Boolean  | @default(false)                             |
| completedAt        | DateTime?|                                             |
| optedInToLeaderboard| Boolean | @default(true)                              |

**Indexes:** `(challengeId, athleteProfileId)` unique, `(challengeId, optedInToLeaderboard, progressValue)` for leaderboard queries.

**RLS:** Athlete + authorised coaches; public `SELECT` on leaderboard fields only if `optedInToLeaderboard = true`.

---

### 2.28 ActivityFeedItem

An item in the activity feed (PR, completed session, race result, challenge joined).

| Field            | Type     | Notes                                       |
|--------------------|----------|---------------------------------------------|
| id                | String   | PK                                          |
| userId            | String   | FK → User.id                                |
| itemType          | String   | pr / session / race / challenge / sim       |
| title             | String   |                                             |
| body              | String?  |                                             |
| refId             | String?  | id of referenced entity                     |
| imageUrls         | String[] |                                             |
| visibility        | String   | public / friends / private                  |
| createdAt         | DateTime |                                             |

**Indexes:** `(userId, createdAt)` desc, `(createdAt)`, `(visibility, createdAt)`.

**RLS:** Owner full access; public `SELECT` only if `visibility = public` and athlete's profile privacy is public.

---

### 2.29 Notification

| Field            | Type     | Notes                                       |
|-------------------|----------|---------------------------------------------|
| id                | String   | PK                                          |
| userId            | String   | FK → User.id                                |
| kind              | String   | session_reminder / pr / challenge / coach / system |
| title             | String   |                                             |
| body              | String?  |                                             |
| refId             | String?  |                                             |
| readAt            | DateTime?|                                             |
| createdAt         | DateTime |                                             |

**Indexes:** `(userId, readAt)`, `(userId, createdAt)`.

**RLS:** User only.

---

### 2.30 Subscription

The athlete's subscription tier. Single source of truth for entitlement.

| Field            | Type     | Notes                                       |
|-------------------|----------|---------------------------------------------|
| id                | String   | PK                                          |
| userId            | String   | FK → User.id, unique (one active tier per user) |
| tier              | String   | free / pro / pro_annual / coach / gym       |
| status            | String   | active / trialing / past_due / canceled     |
| source            | String   | stripe / app_store / play_store / manual    |
| externalSubscriptionId | String? | provider's subscription id                |
| currentPeriodEnd  | DateTime?|                                             |
| cancelAtPeriodEnd | Boolean  | @default(false)                              |
| createdAt         | DateTime |                                             |
| updatedAt         | DateTime |                                             |

**Indexes:** `userId` unique, `(status)`, `(externalSubscriptionId)`.

**RLS:** User + admin only.

---

### 2.31 AiMessage

A single AI coach message (user or assistant).

| Field            | Type     | Notes                                       |
|-------------------|----------|---------------------------------------------|
| id                | String   | PK                                          |
| athleteProfileId  | String   | FK                                          |
| role              | String   | user / assistant / system                   |
| content           | String   |                                             |
| contextSnapshot  | Json?    | snapshot of context sent                    |
| fallback          | Boolean  | @default(false) — true if deterministic     |
| toolsUsed         | String[] |                                             |
| createdAt         | DateTime |                                             |

**Indexes:** `(athleteProfileId, createdAt)`, `(fallback)`.

**RLS:** Athlete only.

---

### 2.32 AiRecommendation

A recommendation the engine produced for an athlete (e.g., "deload this week").

| Field            | Type     | Notes                                       |
|--------------------|----------|---------------------------------------------|
| id                | String   | PK                                          |
| athleteProfileId   | String   | FK                                          |
| recommendationType | String   | deload / focus_change / weakness / recovery / pr_celebration |
| severity          | String   | info / warning / critical                   |
| title             | String   |                                             |
| body              | String   |                                             |
| payload           | Json     | structured data for the UI                  |
| isApplied         | Boolean  | @default(false)                             |
| dismissedAt       | DateTime?|                                             |
| createdAt         | DateTime |                                             |

**Indexes:** `(athleteProfileId, isApplied, createdAt)`, `(severity)`.

**RLS:** Athlete + authorised coaches.

---

## 3. RLS Policy Recommendations

| Model                | RLS policy                                                                                       |
|----------------------|--------------------------------------------------------------------------------------------------|
| User                 | `SELECT`/`UPDATE` own row only.                                                                  |
| AthleteProfile       | Athlete full; authorised coaches `SELECT` via `CoachAthlete` join.                              |
| AthletePreference    | Athlete only.                                                                                    |
| AthleteGoal          | Athlete + authorised coaches.                                                                    |
| Competition          | Public `SELECT`. Admins only `INSERT`/`UPDATE`.                                                  |
| AthleteCompetition   | Athlete + coaches; competitors in the same event `SELECT` each other's row.                     |
| RaceResult           | Athlete + coaches always; public `SELECT` only if `verified = true` and athlete privacy = public.|
| RaceSplit            | Inherits from RaceResult.                                                                        |
| TrainingPlan         | Athlete + authorised coaches.                                                                   |
| TrainingBlock        | Inherits from TrainingPlan.                                                                      |
| ScheduledWorkout     | Athlete + authorised coaches.                                                                   |
| Workout              | Public `SELECT` for official/community; `INSERT`/`UPDATE`/`DELETE` for `createdBy` only.        |
| ExerciseLibrary      | Public `SELECT`.                                                                                 |
| WorkoutExercise      | Inherits from Workout.                                                                           |
| WorkoutLog           | Athlete + authorised coaches.                                                                   |
| ExerciseLog          | Inherits from WorkoutLog.                                                                        |
| Benchmark            | Public `SELECT`.                                                                                 |
| BenchmarkResult      | Athlete + authorised coaches.                                                                   |
| PersonalRecord       | Athlete + coaches; public `SELECT` only if athlete privacy = public.                            |
| AthleteMetric        | Athlete + authorised coaches.                                                                   |
| RecoveryLog          | Athlete only.                                                                                    |
| WearableConnection   | User only.                                                                                       |
| Partnership          | Both athletes in the partnership.                                                               |
| CoachProfile         | Public `SELECT` basic info; coach `UPDATE` own row.                                             |
| CoachAthlete         | Coach sees own athletes; athlete sees own coaches.                                             |
| Challenge            | Public `SELECT` for public; participants `SELECT` private.                                       |
| ChallengeParticipant | Athlete + coaches; public `SELECT` on leaderboard fields only if opted-in.                     |
| ActivityFeedItem     | Owner full; public `SELECT` only if `visibility = public` and athlete privacy = public.        |
| Notification         | User only.                                                                                       |
| Subscription         | User + admin only.                                                                              |
| AiMessage            | Athlete only.                                                                                    |
| AiRecommendation     | Athlete + authorised coaches.                                                                   |

---

## 4. Migration Strategy

1. **Local dev** uses SQLite (`db/custom.db`). `prisma migrate dev` creates and applies migrations.
2. **Production** uses Supabase Postgres. The schema is portable; the same `schema.prisma` builds against both.
3. **Postgres-specific JSONB** is added via a separate migration for fields that benefit:
   - `Competition.disciplines` and `Competition.stations`
   - `AiMessage.contextSnapshot`
   - `AiRecommendation.payload`
4. **Apply schema** with either `prisma migrate deploy` (against the Supabase connection string) or `supabase db push` if using the Supabase CLI workflow.
5. **Enable RLS** on every sensitive table (see §3).
6. **Create indexes** on common query paths:
   - `(athleteProfileId, completedAt)` on WorkoutLog
   - `(athleteProfileId, status)` on AthleteGoal
   - `(challengeId, optedInToLeaderboard, progressValue)` on ChallengeParticipant for leaderboard queries
   - `(createdAt)` desc on ActivityFeedItem
7. **Backfill** row-level ownership columns where needed (e.g., `createdBy` on Workout when migrating from demo data).

---

## 5. Seed Data

Seed data lives in `prisma/seed.ts` (planned) and is sourced from the data files in `src/lib/competition-rules/`:

- **HYROX stations** — 8 stations (1000m run + burpee broad jumps, sled push, sled pull, rowing, burpee box jumps, farmers carry, sandbag lunges, wall balls). Defined in `src/lib/competition-rules/hyrox.ts`.
- **CrossFit benchmarks** — 10+ WODs (Fran, Murph, Cindy, Helen, Grace, Isabel, Annie, Barbara, Christine, Amanda). Defined in `src/lib/competition-rules/crossfit.ts`.
- **ATHX disciplines** — 3 disciplines (Strength, Endurance, MetCon-X) and their associated tests. Defined in `src/lib/competition-rules/athx.ts`.
- **Benchmark catalogue** — running (5k, 10k, 1 mile), strength (1RM back squat, 1RM deadlift, 1RM clean), erg (2k row, 5k row), MetCon (Fran, Murph).
- **Sample athletes for dev** — three demo athletes (HYROX-focussed, CrossFit-focussed, ATHX-focussed) with seeded benchmarks and a month of workout logs so analytics have data to render.

The seed runs against SQLite locally and against a staging Supabase project for the preview environment.
