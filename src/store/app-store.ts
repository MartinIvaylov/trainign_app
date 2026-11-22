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
  status: "active" | "pending" | "ended";
  addedAt: string;
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

  // --- toasts
  toasts: ToastMessage[];
  pushToast: (t: Omit<ToastMessage, "id">) => void;
  dismissToast: (id: string) => void;

  // --- subscription
  tier: "free" | "pro" | "pro_annual" | "coach" | "gym";
  setTier: (t: AppState["tier"]) => void;

  // --- misc
  resetAll: () => void;
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
      signOut: () =>
        set({
          authed: false,
          email: null,
          view: "landing",
          appView: "dashboard",
        }),

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
          tier: "free",
          view: "landing",
        }),
    }),
    {
      name: "hybrid-store-v2",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : (undefined as unknown as Storage))),
      partialize: (s) => ({
        authed: s.authed,
        email: s.email,
        onboarded: s.onboarded,
        profile: s.profile,
        preferences: s.preferences,
        benchmarks: s.benchmarks,
        activeMode: s.activeMode,
        activeGoal: s.activeGoal,
        upcomingCompetition: s.upcomingCompetition,
        sessions: s.sessions,
        logs: s.logs,
        prs: s.prs,
        hyroxSimulations: s.hyroxSimulations,
        raceResults: s.raceResults,
        coachAthletes: s.coachAthletes,
        coachWorkouts: s.coachWorkouts,
        checkins: s.checkins,
        tier: s.tier,
      }),
    },
  ),
);
