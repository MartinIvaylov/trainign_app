// Mobile Zustand store — mirrors the web store.
// Uses AsyncStorage via createJSONStorage for persistence.
// In production, sync via the HYBRID backend (Supabase) with conflict resolution.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type TrainingMode = "hyrox" | "athx" | "crossfit" | "maintenance";

export interface AthleteProfile {
  displayName: string;
  trainingAge: "beginner" | "intermediate" | "advanced" | "elite";
  background: string;
  sex?: string;
  weightKg?: number;
}

export interface AthletePreferences {
  daysPerWeek: number;
  sessionMinutes: number;
  preferredDays: number[];
  equipment: string[];
  location: string;
}

export interface BenchmarkInput {
  fiveKmSec?: number;
  backSquatKg?: number;
  deadliftKg?: number;
  franSec?: number;
  priorHyroxFinishSec?: number;
}

export interface CompetitionLite {
  format: TrainingMode;
  name: string;
  date: string;
  division?: string;
}

export interface SessionLite {
  id: string;
  dayOfWeek: number;
  date: string;
  title: string;
  mode: TrainingMode;
  type: string;
  durationMin?: number;
  intensity?: string;
  completed: boolean;
}

export interface LogLite {
  id: string;
  date: string;
  title: string;
  mode: TrainingMode;
  type: string;
  result?: string;
  rpe?: number;
  durationSec?: number;
  completed: boolean;
}

export interface PRLite {
  movement: string;
  value: number;
  unit: string;
  context?: string;
  recordedAt: string;
}

interface AppState {
  authed: boolean;
  email: string | null;
  onboarded: boolean;
  profile: AthleteProfile | null;
  preferences: AthletePreferences | null;
  benchmarks: BenchmarkInput | null;
  activeMode: TrainingMode;
  upcomingCompetition: CompetitionLite | null;
  sessions: SessionLite[];
  logs: LogLite[];
  prs: PRLite[];
  hyroxSimulations: { id: string; finishFormatted: string; savedAt: string }[];
  tier: "free" | "pro" | "pro_annual" | "coach";

  setAuthed: (email: string) => void;
  completeOnboarding: () => void;
  signOut: () => void;
  setActiveMode: (m: TrainingMode) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      authed: false,
      email: null,
      onboarded: false,
      profile: null,
      preferences: null,
      benchmarks: null,
      activeMode: "hyrox",
      upcomingCompetition: null,
      sessions: [],
      logs: [],
      prs: [],
      hyroxSimulations: [],
      tier: "free",

      setAuthed: (email) => set({ authed: true, email }),
      completeOnboarding: () =>
        set({
          onboarded: true,
          profile: {
            displayName: "Athlete",
            trainingAge: "intermediate",
            background: "general",
          },
          preferences: {
            daysPerWeek: 4,
            sessionMinutes: 60,
            preferredDays: [1, 3, 5, 6],
            equipment: ["home_gym", "barbells", "dumbbells"],
            location: "home_gym",
          },
          activeMode: "hyrox",
        }),
      signOut: () =>
        set({
          authed: false,
          email: null,
          onboarded: false,
          profile: null,
          preferences: null,
          benchmarks: null,
          sessions: [],
          logs: [],
          prs: [],
        }),
      setActiveMode: (m) => set({ activeMode: m }),
    }),
    {
      name: "hybrid-mobile-store",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
