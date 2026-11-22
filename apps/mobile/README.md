# HYBRID — Mobile (Expo + React Native)

The mobile app is a first-class product, not a reduced version of the web app.

## Status

**Scaffold only.** This directory contains the mobile app architecture and key screen components. To run it locally you need a working Expo + EAS environment (not available in this sandbox). The code is ready to be installed, developed against, and submitted to the App Store and Google Play.

## Stack

- **Expo SDK 52** with Expo Router 4
- **React Native 0.76**
- **TypeScript 5** (strict)
- **Zustand 5 + AsyncStorage** for persisted client state (mirrors web store)
- **expo-haptics** for native haptic feedback on timer transitions and AMRAP rep counts
- **expo-keep-awake** to keep the screen awake during active workouts
- **expo-notifications** for workout reminders and competition countdowns
- **expo-health** for Apple Health / HealthKit integration
- **expo-secure-store** for token storage
- **expo-task-manager** for background sync (offline workout logging → backend sync)
- **react-native-svg** + **victory-native** for charts (Performance screen)
- **react-native-reanimated** + **react-native-gesture-handler** for native-feeling transitions

## Architecture

```
app/
  _layout.tsx          Root layout with bottom tab navigation
  auth.tsx              Sign-in screen
  onboarding.tsx       4-step onboarding (mobile-tailored)
  today/index.tsx       Bottom tab 1 — Today (focus + countdown + today's session)
  plan/index.tsx        Bottom tab 2 — Plan (week grid + blocks)
  train/index.tsx       Bottom tab 3 — Train (6 timers, native haptics, keep-awake)
  progress/index.tsx   Bottom tab 4 — Progress (charts + PRs)
  profile/index.tsx    Bottom tab 5 — Profile (mode switch, sub, wearables, sign out)
store/index.ts          Zustand store (mirrors web store)
```

## Native capabilities

- **Haptics** — medium impact on timer start/pause, light impact on rep count
- **Keep awake** — screen stays on during active workouts (Train tab)
- **Health integration** — Apple Health / HealthKit via `expo-health` (requires Health Share entitlement)
- **Push notifications** — workout reminders, competition countdown, weekly summary
- **Background sync** — offline workout logs queue and sync when network returns (via `expo-task-manager`)
- **Secure storage** — auth tokens via `expo-secure-store`
- **Native sharing** — share workout achievements via native share sheet

## How to run (when out of the sandbox)

```bash
cd apps/mobile
bun install
bun run dev            # start Expo dev server
bun run ios            # open in iOS simulator
bun run android        # open in Android emulator
```

## How to build and submit (production)

```bash
# Configure EAS once
eas login
eas build:configure

# Build for production
bun run build:ios
bun run build:android

# Submit to stores
bun run submit:ios
bun run submit:android
```

You'll need:
- App Store Connect API key (in `.easignore` or via `eas secrets`)
- Google Play Service Account JSON (in `eas.json` credentials)
- EAS project ID (replace `REPLACE_WITH_EAS_PROJECT_ID` in `app.json`)

## Shared packages

The mobile app shares business logic with the web app via the planned monorepo packages:
- `packages/training-engine` — periodisation, weakness detection, adaptation (already implemented in `src/lib/training-engine/`)
- `packages/validation` — zod schemas shared across web and mobile
- `packages/ui-tokens` — color and spacing tokens mirrored here as constants
- `packages/api-client` — typed API client for the HYBRID backend

In the current preview build, the mobile app uses inline copies of these utilities. The next step is to extract them into the workspace packages and import them from both `apps/web` and `apps/mobile`.

## Disclaimer

HYBRID is not affiliated with HYROX, ATHX Games, or CrossFit. Names are used only to describe compatible training formats.
