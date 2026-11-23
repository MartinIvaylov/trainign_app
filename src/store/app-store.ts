"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  AthleteProfileLite,
  AthletePreferencesLite,
  BenchmarkInput,
  GoalFocus,
  OnboardingData,
  PersonalRecordLite,
  ScheduledSession,
  TrainingMode,
  WorkoutLogLite,
} from "@/types";
import { v4 as uuid } from "uuid";
import { SYNCED_KEYS } from "@/lib/sync-keys";

type View =
  | "landing"
  | "auth"
  | "onboarding"
  | "app"
  | "pricing"
  | "privacy"
  | "terms";

type AppView =
  | "dashboard"
  | "plan"
  | "workouts"
  | "train"
  | "compete"
  | "performance"
  | "coach"
  | "community"
  | "profile"
  | "settings"
  | "coach_dashboard"
  | "gym";

interface CompetitionLite {
  format: TrainingMode;
  name: string;
  date: string;
  division?: string;
  location?: string;
}

interface ToastMessage {
  id: string;
  title: string;
  body?: string;
  kind: "info" | "success" | "warning" | "error";
}

interface HyroxSimulation {
  runSplits: number[];
  stationSplits: number[];
  transitionsSec: number;
  totalSec: number;
  finishFormatted: string;
  savedAt: string;
}

export interface RaceResultEntry {
  id: string;
  format: TrainingMode;
  competitionName: string;
  date: string;
  finishSec: number;
  targetSec?: number;
  division?: string;
  notes?: string;
  splits?: { name: string; sec: number }[];
  recordedAt: string;
}

export interface CoachAthlete {
  id: string;
  name: string;
  email: string;
  activeMode: TrainingMode;
  daysPerWeek: number;
  lastSessionDate?: string;
  recentRPE?: number;
  notes?: string;
  status: "active" | "pending" | "ended" | "injured" | "paused";
  addedAt: string;
  // Extended fields for the coach dashboard
  benchmarks?: {
    fiveKmSec?: number;
    backSquatKg?: number;
    deadliftKg?: number;
    franSec?: number;
  };
  lastSessionDays?: number;
  goals?: string;
}

export interface CoachWorkout {
  id: string;
  title: string;
  mode: TrainingMode;
  type: string;
  description: string;
  movements: { name: string; reps: string; note?: string }[];
  capMinutes?: number;
  assignedTo: string[]; // athlete ids
  assignedAt: string;
  allowAdaptation: boolean;
  notes?: string;
}

export interface AthleteCheckin {
  id: string;
  athleteId: string;
  date: string;
  rpe?: number;
  fatigue?: number;
  sleep?: number;
  notes?: string;
}

export interface CoachRecommendation {
  id: string;
  title: string;
  body: string;
  severity: "info" | "positive" | "warning" | "critical";
  source: "ai_coach" | "engine" | "manual";
  // Optional action the user can apply (e.g. "replace_session", "drop_intensity", "add_recovery")
  actionKind?: "replace_session" | "drop_intensity" | "add_recovery" | "preserve" | "review_plan";
  affectedSessionId?: string;
  // Lifecycle: pending → applied | dismissed
  status: "pending" | "applied" | "dismissed";
  createdAt: string;
  appliedAt?: string;
  dismissedAt?: string;
  // The original question that triggered this recommendation (for AI Coach source)
  originalQuestion?: string;
}

interface AppState {
  // --- navigation
  view: View;
  appView: AppView;
  setView: (v: View) => void;
  setAppView: (v: AppView) => void;

  // --- auth (mock — for preview only; production uses Supabase Auth)
  authed: boolean;
  email: string | null;
  setAuthed: (a: boolean, email?: string | null) => void;
  /** Apply the server-verified session (from /api/auth/*). */
  applySession: (session: { email: string; tier: AppState["tier"] }) => void;
  /** Clear the session AND this account's local data (shared-device safety). */
  signOut: () => void;

  // --- onboarding & profile
  onboarded: boolean;
  profile: AthleteProfileLite | null;
  preferences: AthletePreferencesLite | null;
  benchmarks: BenchmarkInput | null;
  activeMode: TrainingMode;
  activeGoal: GoalFocus | null;
  upcomingCompetition: CompetitionLite | null;
  setOnboarding: (data: OnboardingData) => void;
  setActiveMode: (m: TrainingMode) => void;
  switchMode: (m: TrainingMode, intent: "replace" | "add" | "pause") => void;

  // --- training
  sessions: ScheduledSession[];          // generated plan
  setSessions: (s: ScheduledSession[]) => void;
  markSessionComplete: (id: string, result: { rpe: number; result?: string; completedAt?: string }) => void;
  rescheduleSession: (id: string, newDate: string) => void;
  addCustomSession: (s: Omit<ScheduledSession, "id" | "completed">) => void;

  // --- workouts
  logs: WorkoutLogLite[];
  addLog: (l: Omit<WorkoutLogLite, "id">) => string;

  // --- PRs
  prs: PersonalRecordLite[];
  addPR: (p: Omit<PersonalRecordLite, "recordedAt">) => void;

  // --- simulations
  hyroxSimulations: HyroxSimulation[];
  saveHyroxSimulation: (s: Omit<HyroxSimulation, "savedAt">) => void;

  // --- race results
  raceResults: RaceResultEntry[];
  addRaceResult: (r: Omit<RaceResultEntry, "id" | "recordedAt">) => void;
  deleteRaceResult: (id: string) => void;

  // --- coach dashboard
  coachAthletes: CoachAthlete[];
  addCoachAthlete: (a: Omit<CoachAthlete, "id" | "addedAt">) => void;
  updateCoachAthlete: (id: string, patch: Partial<CoachAthlete>) => void;
  removeCoachAthlete: (id: string) => void;

  coachWorkouts: CoachWorkout[];
  addCoachWorkout: (w: Omit<CoachWorkout, "id" | "assignedAt">) => void;
  deleteCoachWorkout: (id: string) => void;

  checkins: AthleteCheckin[];
  addCheckin: (c: Omit<AthleteCheckin, "id">) => void;

  // --- coach recommendations (AI Coach + engine)
  recommendations: CoachRecommendation[];
  addRecommendation: (r: Omit<CoachRecommendation, "id" | "createdAt" | "status">) => string;
  applyRecommendation: (id: string) => void;
  dismissRecommendation: (id: string) => void;
  clearAppliedRecommendations: () => void;

  // --- toasts
  toasts: ToastMessage[];
  pushToast: (t: Omit<ToastMessage, "id">) => void;
  dismissToast: (id: string) => void;

  // --- subscription
  // Display cache of the server entitlement. Only ever set from server
  // responses (/api/auth/me, /api/billing/checkout) — never from a click.
  tier: "free" | "pro" | "pro_annual" | "coach" | "gym";
  setTier: (t: AppState["tier"]) => void;

  // --- misc
  resetAll: () => void;
}

// ----------------------------------------------------------------------------
// Persisted slice — single source of truth for what survives a page reload
// (localStorage) and what gets mirrored to the server (write-through cache,
// see src/lib/sync.ts). Both consumers build their snapshot from this list.
// ----------------------------------------------------------------------------

// `authed` / `email` / `tier` are a local display cache only; they are
// re-verified against the session cookie on every app start (SyncManager)
// and are never part of the server snapshot (see SYNCED_KEYS).
export const PERSISTED_KEYS = ["authed", "email", "tier", ...SYNCED_KEYS] as const;

export type PersistedState = Pick<AppState, (typeof PERSISTED_KEYS)[number]>;

export type SyncedState = Pick<AppState, (typeof SYNCED_KEYS)[number]>;

/** Extract the slice mirrored to the server (no identity / tier fields). */
export function syncedState(s: AppState): SyncedState {
  const out = {} as Record<string, unknown>;
  for (const key of SYNCED_KEYS) out[key] = s[key];
  return out as SyncedState;
}

/** Extract the persisted (localStorage) slice from the full store state. */
export function snapshotState(s: AppState): PersistedState {
  const out = {} as Record<string, unknown>;
  for (const key of PERSISTED_KEYS) {
    out[key] = s[key];
  }
  return out as PersistedState;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      view: "landing",
      appView: "dashboard",
      setView: (v) => set({ view: v }),
      setAppView: (v) => set({ appView: v }),

      authed: false,
      email: null,
      setAuthed: (a, email = null) => set({ authed: a, email }),
      applySession: ({ email, tier }) => set({ authed: true, email, tier }),
      signOut: () => {
        // Drop identity first so the sync subscription never mirrors the
        // reset (empty) state to the account that is signing out.
        set({ authed: false, email: null, view: "landing", appView: "dashboard" });
        get().resetAll();
      },

      onboarded: false,
      profile: null,
      preferences: null,
      benchmarks: null,
      activeMode: "hyrox",
      activeGoal: null,
      upcomingCompetition: null,

      setOnboarding: (data) => {
        set({
          onboarded: true,
          profile: data.profile,
          preferences: data.preferences,
          benchmarks: data.benchmarks,
          activeMode: data.upcomingCompetition?.format ?? "hyrox",
          activeGoal: data.goal,
          upcomingCompetition: data.upcomingCompetition ?? null,
          view: "app",
          appView: "dashboard",
        });
      },
      setActiveMode: (m) => set({ activeMode: m }),
      switchMode: (m, intent) => {
        const from = get().activeMode;
        if (intent === "replace") {
          set({ activeMode: m });
          get().pushToast({
            kind: "success",
            title: `Switched focus to ${m.toUpperCase()}`,
            body: `Previous ${from.toUpperCase()} history is preserved. Training history carries over.`,
          });
        } else if (intent === "add") {
          set({ activeMode: m });
          get().pushToast({
            kind: "info",
            title: `Added ${m.toUpperCase()} goal`,
            body: `${from.toUpperCase()} sessions remain scheduled.`,
          });
        } else {
          set({ activeMode: "maintenance" });
          get().pushToast({
            kind: "info",
            title: `Paused competition prep`,
            body: "Switched to Maintenance. Return any time.",
          });
        }
      },

      sessions: [],
      setSessions: (s) => set({ sessions: s }),
      markSessionComplete: (id, result) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, completed: true, completedAt: result.completedAt ?? new Date().toISOString(), rpe: result.rpe, result: result.result } : s,
          ),
        })),
      rescheduleSession: (id, newDate) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, date: newDate, dayOfWeek: new Date(newDate).getDay() } : s,
          ),
        })),
      addCustomSession: (s) =>
        set((state) => ({ sessions: [...state.sessions, { ...s, id: uuid(), completed: false }] })),

      logs: [],
      addLog: (l) => {
        const id = uuid();
        set((state) => ({ logs: [{ ...l, id }, ...state.logs] }));
        return id;
      },

      prs: [],
      addPR: (p) =>
        set((state) => ({
          prs: [
            { ...p, recordedAt: new Date().toISOString(), movement: p.movement, value: p.value, unit: p.unit, context: p.context },
            ...state.prs.filter((x) => x.movement !== p.movement || x.context !== p.context),
          ].slice(0, 100),
        })),

      hyroxSimulations: [],
      saveHyroxSimulation: (s) =>
        set((state) => ({
          hyroxSimulations: [{ ...s, savedAt: new Date().toISOString() }, ...state.hyroxSimulations].slice(0, 20),
        })),

      raceResults: [],
      addRaceResult: (r) =>
        set((state) => ({
          raceResults: [
            { ...r, id: uuid(), recordedAt: new Date().toISOString() },
            ...state.raceResults,
          ].slice(0, 50),
        })),
      deleteRaceResult: (id) =>
        set((state) => ({ raceResults: state.raceResults.filter((r) => r.id !== id) })),

      coachAthletes: [],
      addCoachAthlete: (a) =>
        set((state) => ({
          coachAthletes: [...state.coachAthletes, { ...a, id: uuid(), addedAt: new Date().toISOString() }],
        })),
      updateCoachAthlete: (id, patch) =>
        set((state) => ({
          coachAthletes: state.coachAthletes.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      removeCoachAthlete: (id) =>
        set((state) => ({ coachAthletes: state.coachAthletes.filter((a) => a.id !== id) })),

      coachWorkouts: [],
      addCoachWorkout: (w) =>
        set((state) => ({
          coachWorkouts: [...state.coachWorkouts, { ...w, id: uuid(), assignedAt: new Date().toISOString() }],
        })),
      deleteCoachWorkout: (id) =>
        set((state) => ({ coachWorkouts: state.coachWorkouts.filter((w) => w.id !== id) })),

      checkins: [],
      addCheckin: (c) =>
        set((state) => ({ checkins: [{ ...c, id: uuid() }, ...state.checkins].slice(0, 200) })),

      recommendations: [],
      addRecommendation: (r) => {
        const id = uuid();
        const rec: CoachRecommendation = {
          ...r,
          id,
          createdAt: new Date().toISOString(),
          status: "pending",
        };
        set((state) => ({ recommendations: [rec, ...state.recommendations].slice(0, 50) }));
        return id;
      },
      applyRecommendation: (id) =>
        set((state) => ({
          recommendations: state.recommendations.map((r) =>
            r.id === id ? { ...r, status: "applied" as const, appliedAt: new Date().toISOString() } : r,
          ),
        })),
      dismissRecommendation: (id) =>
        set((state) => ({
          recommendations: state.recommendations.map((r) =>
            r.id === id ? { ...r, status: "dismissed" as const, dismissedAt: new Date().toISOString() } : r,
          ),
        })),
      clearAppliedRecommendations: () =>
        set((state) => ({
          recommendations: state.recommendations.filter((r) => r.status === "pending"),
        })),

      toasts: [],
      pushToast: (t) => {
        const id = uuid();
        set((state) => ({ toasts: [...state.toasts, { ...t, id }] }));
        setTimeout(() => {
          set((state) => ({ toasts: state.toasts.filter((x) => x.id !== id) }));
        }, 4500);
      },
      dismissToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((x) => x.id !== id) })),

      tier: "free",
      setTier: (t) => {
        set({ tier: t });
        get().pushToast({
          kind: "success",
          title: `Subscription updated`,
          body: `Active tier: ${t.replace("_", " ").toUpperCase()}`,
        });
      },

      resetAll: () =>
        set({
          onboarded: false,
          profile: null,
          preferences: null,
          benchmarks: null,
          activeMode: "hyrox",
          activeGoal: null,
          upcomingCompetition: null,
          sessions: [],
          logs: [],
          prs: [],
          hyroxSimulations: [],
          raceResults: [],
          coachAthletes: [],
          coachWorkouts: [],
          checkins: [],
          recommendations: [],
          tier: "free",
          view: "landing",
        }),
    }),
    {
      name: "hybrid-store-v2",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage))),
      partialize: (s) => snapshotState(s),
    },
  ),
);
