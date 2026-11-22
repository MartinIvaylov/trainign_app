// Shared domain types — used across the platform.

export type TrainingMode = "hyrox" | "athx" | "crossfit" | "maintenance";

export type Background =
  | "crossfit"
  | "hyrox"
  | "athx"
  | "running"
  | "gym"
  | "general"
  | "beginner";

export type Equipment =
  | "full_gym"
  | "crossfit_box"
  | "home_gym"
  | "running_track"
  | "skierg"
  | "rowerg"
  | "sled"
  | "assault_bike"
  | "dumbbells"
  | "kettlebells"
  | "barbells"
  | "wall_balls"
  | "sandbag"
  | "farmers_handles"
  | "other";

export type GoalFocus =
  | "first_competition"
  | "improve_time"
  | "improve_strength"
  | "improve_endurance"
  | "improve_overall"
  | "compete_advanced";

export type Phase =
  | "base"
  | "strength"
  | "aerobic"
  | "specific"
  | "competition"
  | "taper"
  | "recovery"
  | "maintenance";

export interface AthleteProfileLite {
  id?: string;
  email?: string;
  displayName: string;
  dateOfBirth?: string;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  sex?: "male" | "female" | "other" | "prefer_not";
  trainingAge: "beginner" | "intermediate" | "advanced" | "elite";
  background: Background;
  primaryGoal?: GoalFocus;
  onboardedAt?: string;
  avatarUrl?: string;
  location?: string;
}

export interface AthletePreferencesLite {
  daysPerWeek: number;
  sessionMinutes: number;
  preferredDays: number[]; // 0..6
  equipment: Equipment[];
  location: "full_gym" | "crossfit_box" | "home_gym" | "track" | "outdoors";
  injuries?: string;
  notes?: string;
}

export interface BenchmarkInput {
  fiveKmSec?: number;     // running
  tenKmSec?: number;
  oneKmPaceSec?: number;  // sec/km
  backSquatKg?: number;   // 1RM or estimated
  deadliftKg?: number;
  strictPressKg?: number;
  row2kSec?: number;
  skierg1kSec?: number;
  franSec?: number;
  graceSec?: number;
  priorHyroxFinishSec?: number;
  priorAthxScore?: number; // 0..100 official FitScore, if known
}

export interface OnboardingData {
  profile: AthleteProfileLite;
  preferences: AthletePreferencesLite;
  benchmarks: BenchmarkInput;
  upcomingCompetition?: {
    format: TrainingMode;
    name: string;
    date: string; // ISO date
    division?: string;
  };
  goal: GoalFocus;
}

export interface ScheduledSession {
  id: string;
  date: string; // ISO
  dayOfWeek: number;
  title: string;
  mode: TrainingMode;
  type: string;
  durationMin?: number;
  intensity?: "easy" | "moderate" | "hard" | "very_hard" | "test";
  notes?: string;
  workoutId?: string;
  completed: boolean;
  completedAt?: string;
  result?: string;
  rpe?: number;
}

export interface WorkoutLogLite {
  id: string;
  date: string;
  mode: TrainingMode;
  type: string;
  title: string;
  durationSec?: number;
  result?: string;
  rpe?: number;
  rxScaled?: "rx" | "scaled" | "modified";
  notes?: string;
  completed: boolean;
  exercises?: {
    name: string;
    sets?: number;
    reps?: string;
    weightKg?: number;
    durationSec?: number;
    distanceM?: number;
    notes?: string;
  }[];
}

export interface PersonalRecordLite {
  movement: string;
  value: number;
  unit: "kg" | "seconds" | "meters" | "reps";
  context?: string;
  recordedAt: string;
}

export const MODE_META: Record<
  TrainingMode,
  { name: string; tagline: string; color: string; description: string }
> = {
  hyrox: {
    name: "HYROX",
    tagline: "8 × 1 km run. 8 functional stations.",
    color: "var(--hyrox)",
    description:
      "Race-specific training, simulation and pacing for HYROX competitions. Supports Open, Pro, Doubles and Relay divisions.",
  },
  athx: {
    name: "ATHX",
    tagline: "Strength. Endurance. MetCon-X.",
    color: "var(--athx)",
    description:
      "Three scored disciplines with FitScore tracking (official or clearly-labeled estimate). Individual and pairs modes supported.",
  },
  crossfit: {
    name: "CrossFit",
    tagline: "Functional fitness. RX or Scaled.",
    color: "var(--crossfit)",
    description:
      "Daily WODs, benchmark library, timers (AMRAP / EMOM / For Time / Tabata / Intervals) and personal records.",
  },
  maintenance: {
    name: "Maintenance",
    tagline: "General Physical Preparation.",
    color: "var(--maint)",
    description:
      "Balanced strength, Zone 2 conditioning, mobility and recovery between competitions or whenever no race is targeted.",
  },
};
