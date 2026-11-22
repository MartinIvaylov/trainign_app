// Adaptive training engine — deterministic, explainable, safe.
// The engine decides block structure, weekly distribution, intensity and
// adaptations. AI Coach can PROPOSE modifications but cannot override the
// engine's safety constraints.

import {
  AthleteProfileLite,
  AthletePreferencesLite,
  BenchmarkInput,
  GoalFocus,
  Phase,
  ScheduledSession,
  TrainingMode,
} from "@/types";
import { HYROX_STATIONS, formatHMS, formatPace, simulateHyrox, HyroxSimulationInput } from "@/lib/competition-rules/hyrox";
import { ATHX_DISCIPLINES, normaliseAthxTest, estimateAthxScore } from "@/lib/competition-rules/athx";
import { CROSSFIT_BENCHMARKS } from "@/lib/competition-rules/crossfit";

// ---------------------------------------------------------------------------
// 1. Athlete analysis
// ---------------------------------------------------------------------------

export interface WeaknessFinding {
  dimension: string;          // "running" | "strength" | "erg" | "metcon" | "sled"
  score: number;              // 0..100
  severity: "low" | "moderate" | "high";
  evidence: string;
  recommendation: string;
}

function normSec(value: number | undefined, anchors: { best: number; worst: number }): number {
  if (value === undefined) return 50; // unknown -> neutral
  const { best, worst } = anchors;
  // best = fast time, worst = slow time. lower is better for time.
  const t = (value - best) / (worst - best || 1);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.round(100 * (1 - clamped));
}

function normKg(value: number | undefined, anchors: { beginner: number; elite: number }): number {
  if (value === undefined) return 50;
  const t = (value - anchors.beginner) / (anchors.elite - anchors.beginner || 1);
  return Math.round(Math.max(0, Math.min(100, t * 100)));
}

export function analyzeAthlete(input: {
  benchmarks: BenchmarkInput;
  weightKg?: number;
}): WeaknessFinding[] {
  const out: WeaknessFinding[] = [];
  const b = input.benchmarks;

  // Running: 5km
  const run5k = normSec(b.fiveKmSec, { best: 17 * 60, worst: 40 * 60 });
  out.push({
    dimension: "running",
    score: run5k,
    severity: run5k < 45 ? "high" : run5k < 70 ? "moderate" : "low",
    evidence:
      b.fiveKmSec !== undefined
        ? `5 km best: ${formatHMS(b.fiveKmSec)} (${formatPace(b.fiveKmSec / 5)} pace).`
        : `No 5 km benchmark recorded yet.`,
    recommendation:
      run5k < 50
        ? "Add 2 dedicated running sessions/week (1 interval, 1 easy Z2)."
        : "Maintain 1 easy run + 1 quality run per week.",
  });

  // Strength: back squat
  const squat = normKg(b.backSquatKg, { beginner: 60, elite: 180 });
  out.push({
    dimension: "strength",
    score: squat,
    severity: squat < 45 ? "high" : squat < 70 ? "moderate" : "low",
    evidence:
      b.backSquatKg !== undefined
        ? `Back squat 1RM: ${b.backSquatKg} kg${
            input.weightKg ? ` (${(b.backSquatKg / input.weightKg).toFixed(2)}× bodyweight)` : ""
          }.`
        : `No back squat benchmark recorded yet.`,
    recommendation:
      squat < 50
        ? "Block 1 strength emphasis: squat 3 × 5 progressive, 2×/week."
        : "Maintain 1 heavy strength session + 1 accessory session.",
  });

  // Erg
  const row = normSec(b.row2kSec, { best: 360, worst: 540 });
  const skierg = normSec(b.skierg1kSec, { best: 160, worst: 240 });
  const erg = Math.round((row + skierg) / 2);
  out.push({
    dimension: "erg",
    score: erg,
    severity: erg < 45 ? "high" : erg < 70 ? "moderate" : "low",
    evidence:
      b.row2kSec !== undefined && b.skierg1kSec !== undefined
        ? `Row 2 km: ${formatHMS(b.row2kSec)}, SkiErg 1 km: ${formatHMS(b.skierg1kSec)}.`
        : `Erg benchmarks incomplete.`,
    recommendation:
      erg < 50
        ? "Add 1 dedicated erg session/week with interval focus (4 × 500 m)."
        : "1 weekly erg conditioning block sufficient.",
  });

  // MetCon
  const fran = normSec(b.franSec, { best: 180, worst: 600 });
  out.push({
    dimension: "metcon",
    score: fran,
    severity: fran < 45 ? "high" : fran < 70 ? "moderate" : "low",
    evidence:
      b.franSec !== undefined ? `Fran: ${formatHMS(b.franSec)}` : `No Fran benchmark recorded.`,
    recommendation:
      fran < 50
        ? "Add 1 short MetCon (5–10 min) + 1 medium MetCon per week."
        : "1–2 MetCons per week to retain capacity.",
  });

  return out;
}

// ---------------------------------------------------------------------------
// 2. Periodisation plan generation
// ---------------------------------------------------------------------------

export interface BlockPlan {
  index: number;       // 0-based
  weeks: number;
  phase: Phase;
  focus: string;
  sessionsPerWeek: number;
  description: string;
  intensity: "easy" | "moderate" | "hard" | "very_hard";
}

export function generatePeriodization(input: {
  mode: TrainingMode;
  weeksAvailable: number;     // until competition
  daysPerWeek: number;
  goal: GoalFocus;
  weaknesses: WeaknessFinding[];
}): BlockPlan[] {
  const weeks = Math.max(2, input.weeksAvailable);
  const days = Math.min(6, Math.max(2, input.daysPerWeek));
  const highPriority = input.weaknesses.filter((w) => w.severity === "high").map((w) => w.dimension);
  const focusNote = highPriority.length
    ? `Weakness focus: ${highPriority.join(", ")}.`
    : "Balanced development across dimensions.";

  // Default periodisation template
  if (input.mode === "hyrox") {
    // 8-week base, 6-week build, 4-week specific, 2-week taper, 1-week race week
    return buildHyroxCycle(weeks, days, focusNote);
  }
  if (input.mode === "athx") {
    return buildAthxCycle(weeks, days, focusNote);
  }
  if (input.mode === "crossfit") {
    return buildCrossFitCycle(weeks, days, focusNote);
  }
  return buildMaintenanceCycle(weeks, days);
}

function buildHyroxCycle(weeks: number, days: number, focus: string): BlockPlan[] {
  const blocks: BlockPlan[] = [];
  // Base — first 30%
  const baseWeeks = Math.max(2, Math.round(weeks * 0.3));
  // Build — next 30%
  const buildWeeks = Math.max(2, Math.round(weeks * 0.3));
  // Specific — next 25%
  const specWeeks = Math.max(2, Math.round(weeks * 0.25));
  // Taper — remaining ~10-15%
  const taperWeeks = Math.max(1, weeks - baseWeeks - buildWeeks - specWeeks);

  blocks.push({
    index: 0,
    weeks: baseWeeks,
    phase: "base",
    sessionsPerWeek: days,
    focus: "Aerobic base + general strength",
    intensity: "moderate",
    description: `Aerobic base development with 2 easy runs, 1 strength day, 1 MetCon, 1 Z2 erg. ${focus}`,
  });
  blocks.push({
    index: 1,
    weeks: buildWeeks,
    phase: "strength",
    sessionsPerWeek: days,
    focus: "Strength + run volume",
    intensity: "hard",
    description: `Increase run volume and add station-specific strength (sled, sandbag, farmers). ${focus}`,
  });
  blocks.push({
    index: 2,
    weeks: specWeeks,
    phase: "specific",
    sessionsPerWeek: days,
    focus: "Station practice + race pace",
    intensity: "hard",
    description: `Race-pace intervals, station simulations and transition work. ${focus}`,
  });
  blocks.push({
    index: 3,
    weeks: taperWeeks,
    phase: "taper",
    sessionsPerWeek: Math.max(2, days - 1),
    focus: "Taper + race-day prep",
    intensity: "easy",
    description: "Volume drops 40-50%. Maintain intensity, sharpen race pace.",
  });
  return blocks;
}

function buildAthxCycle(weeks: number, days: number, focus: string): BlockPlan[] {
  const baseWeeks = Math.max(2, Math.round(weeks * 0.25));
  const strengthWeeks = Math.max(2, Math.round(weeks * 0.25));
  const enduranceWeeks = Math.max(2, Math.round(weeks * 0.25));
  const metconWeeks = Math.max(2, weeks - baseWeeks - strengthWeeks - enduranceWeeks - 1);
  const taperWeeks = 1;
  return [
    {
      index: 0, weeks: baseWeeks, phase: "base", sessionsPerWeek: days, focus: "Base + movement quality",
      intensity: "moderate", description: `Build aerobic base and movement quality. ${focus}`,
    },
    {
      index: 1, weeks: strengthWeeks, phase: "strength", sessionsPerWeek: days, focus: "Strength block",
      intensity: "hard", description: `Squat, deadlift, press progression. ${focus}`,
    },
    {
      index: 2, weeks: enduranceWeeks, phase: "aerobic", sessionsPerWeek: days, focus: "Endurance block",
      intensity: "hard", description: `Run, row, SkiErg progression. ${focus}`,
    },
    {
      index: 3, weeks: metconWeeks, phase: "specific", sessionsPerWeek: days, focus: "MetCon-X prep",
      intensity: "very_hard", description: `MetCon-X simulations + transitions. ${focus}`,
    },
    {
      index: 4, weeks: taperWeeks, phase: "taper", sessionsPerWeek: Math.max(2, days - 1),
      focus: "Taper", intensity: "easy", description: "Sharpen, taper and recovery.",
    },
  ];
}

function buildCrossFitCycle(weeks: number, days: number, focus: string): BlockPlan[] {
  const baseWeeks = Math.max(2, Math.round(weeks * 0.4));
  const peakWeeks = Math.max(2, Math.round(weeks * 0.4));
  const taperWeeks = Math.max(1, weeks - baseWeeks - peakWeeks);
  return [
    {
      index: 0, weeks: baseWeeks, phase: "base", sessionsPerWeek: days, focus: "General prep",
      intensity: "moderate", description: `Skill work, lifts, short MetCons. ${focus}`,
    },
    {
      index: 1, weeks: peakWeeks, phase: "specific", sessionsPerWeek: days, focus: "Open-style prep",
      intensity: "hard", description: `Benchmark retests, Open-style workouts. ${focus}`,
    },
    {
      index: 2, weeks: taperWeeks, phase: "taper", sessionsPerWeek: Math.max(2, days - 1),
      focus: "Taper", intensity: "easy", description: "Deload before competition.",
    },
  ];
}

function buildMaintenanceCycle(weeks: number, days: number): BlockPlan[] {
  return [
    {
      index: 0, weeks, phase: "maintenance", sessionsPerWeek: days, focus: "GPP",
      intensity: "moderate",
      description: "Balanced strength, Z2 conditioning, mobility and recovery.",
    },
  ];
}

// ---------------------------------------------------------------------------
// 3. Weekly schedule generation — concrete sessions per day
// ---------------------------------------------------------------------------

const DOW_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function generateWeekSessions(input: {
  mode: TrainingMode;
  phase: Phase;
  preferredDays: number[];
  focusDimensions: string[];   // from weaknesses
}): ScheduledSession[] {
  const days = input.preferredDays.length > 0 ? input.preferredDays : [1, 3, 5, 6];
  const out: ScheduledSession[] = [];
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  let order = 0;
  for (const dow of days) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + ((dow + 6) % 7));
    const session = makeSession(input, dow, order++);
    if (session) {
      out.push({
        ...session,
        id: `gen-${dow}-${order}`,
        date: date.toISOString(),
        dayOfWeek: dow,
        completed: false,
      });
    }
  }
  return out;
}

function makeSession(
  input: { mode: TrainingMode; phase: Phase; focusDimensions: string[] },
  dow: number,
  order: number,
): Omit<ScheduledSession, "id" | "date" | "dayOfWeek" | "completed"> | null {
  const { mode, phase, focusDimensions } = input;

  if (mode === "hyrox") {
    // 4 days: easy run, strength, intervals, MetCon + erg
    switch (order) {
      case 0:
        return {
          title: "Easy Run + Mobility",
          mode: "hyrox",
          type: "run",
          durationMin: 45,
          intensity: "easy",
          notes: "Z2 effort. Conversational pace. 5–8 km.",
        };
      case 1:
        return {
          title: "Lower-Body Strength + Sled Practice",
          mode: "hyrox",
          type: "strength",
          durationMin: 75,
          intensity: "hard",
          notes: "Back squat 5×5, RDL 4×6, sled push 4×20 m, sled pull 4×20 m.",
        };
      case 2:
        return {
          title: "Run Intervals + Wall Balls",
          mode: "hyrox",
          type: "interval",
          durationMin: 60,
          intensity: "hard",
          notes: "8 × 400 m at 5 km pace, 90s rest. 100 wall balls (10 × 10).",
        };
      case 3:
        return {
          title: "SkiErg + Row + Sandbag Conditioning",
          mode: "hyrox",
          type: "conditioning",
          durationMin: 70,
          intensity: "hard",
          notes: "1 km SkiErg, 1 km row, 80 m sandbag lunges. 3 rounds, easy pace.",
        };
      default:
        return null;
    }
  }

  if (mode === "athx") {
    switch (order) {
      case 0:
        return {
          title: "Strength — Squat + Press",
          mode: "athx",
          type: "strength",
          durationMin: 75,
          intensity: "hard",
          notes: "Back squat 5×5, strict press 4×6, accessory work.",
        };
      case 1:
        return {
          title: "Endurance — Run + Row",
          mode: "athx",
          type: "interval",
          durationMin: 60,
          intensity: "hard",
          notes: "5 km run at threshold + 2 km row time trial.",
        };
      case 2:
        return {
          title: "Strength — Deadlift + Pull",
          mode: "athx",
          type: "strength",
          durationMin: 75,
          intensity: "hard",
          notes: "Deadlift 5×3, pull-ups, rows.",
        };
      case 3:
        return {
          title: "MetCon-X Simulation",
          mode: "athx",
          type: "amrap",
          durationMin: 20,
          intensity: "very_hard",
          notes: "MetCon-X Test A simulation (AMRAP 20).",
        };
      default:
        return null;
    }
  }

  if (mode === "crossfit") {
    switch (order) {
      case 0:
        return { title: "Daily WOD — Skill + Lift", mode: "crossfit", type: "for_time", durationMin: 60, intensity: "moderate", notes: "Skill + 1 lift + WOD." };
      case 1:
        return { title: "Strength Day", mode: "crossfit", type: "strength", durationMin: 75, intensity: "hard", notes: "Heavy lift + accessory." };
      case 2:
        return { title: "Conditioning Day", mode: "crossfit", type: "amrap", durationMin: 30, intensity: "hard", notes: "Mid-length AMRAP." };
      case 3:
        return { title: "Benchmark Day", mode: "crossfit", type: "for_time", durationMin: 20, intensity: "very_hard", notes: "Re-test a benchmark (Fran, Grace, Helen…)." };
      default:
        return null;
    }
  }

  // maintenance
  switch (order) {
    case 0:
      return { title: "Full-Body Strength", mode: "maintenance", type: "strength", durationMin: 60, intensity: "moderate", notes: "Squat, press, row." };
    case 1:
      return { title: "Z2 Run / Row", mode: "maintenance", type: "run", durationMin: 45, intensity: "easy", notes: "Easy aerobic." };
    case 2:
      return { title: "Mobility + Recovery", mode: "maintenance", type: "mobility", durationMin: 30, intensity: "easy", notes: "Active mobility." };
    case 3:
      return { title: "Mixed Conditioning", mode: "maintenance", type: "interval", durationMin: 40, intensity: "moderate", notes: "4 rounds easy intervals." };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// 4. Adaptation rules — adjust upcoming sessions based on completed data
// ---------------------------------------------------------------------------

export interface AdaptationInput {
  completedSessions: number;            // last 7 days
  plannedSessions: number;              // last 7 days
  recentRPE: number[];                  // last 5 sessions
  reportedFatigue?: number;             // 0-10 self-reported
  missedSessions: number;               // last 7 days
}

export interface AdaptationResult {
  shouldReduce: boolean;
  shouldAddRecovery: boolean;
  reason: string;
  adjustments: string[];
}

export function evaluateAdaptation(input: AdaptationInput): AdaptationResult {
  const avgRPE = input.recentRPE.length
    ? input.recentRPE.reduce((a, b) => a + b, 0) / input.recentRPE.length
    : 0;
  const reasons: string[] = [];
  const adjustments: string[] = [];

  if (input.reportedFatigue !== undefined && input.reportedFatigue >= 8) {
    reasons.push(`Reported fatigue ${input.reportedFatigue}/10 — high.`);
    adjustments.push("Replace next hard session with 30 min Z2 + mobility.");
    adjustments.push("Skip strength this week if fatigue persists.");
  }
  if (avgRPE >= 9 && input.recentRPE.length >= 3) {
    reasons.push(`3+ session average RPE ${avgRPE.toFixed(1)} — acute load high.`);
    adjustments.push("Reduce next session intensity by one zone.");
  }
  if (input.missedSessions >= 2) {
    reasons.push(`${input.missedSessions} sessions missed in the last 7 days.`);
    adjustments.push("Do not stack missed sessions. Re-plan the rest of the week.");
    adjustments.push("Drop one accessory block; preserve the key quality session.");
  }
  if (input.completedSessions >= input.plannedSessions && avgRPE <= 7) {
    reasons.push("Athlete is on plan with manageable RPE — no reduction needed.");
  }

  const shouldReduce = avgRPE >= 9 || (input.reportedFatigue ?? 0) >= 8;
  const shouldAddRecovery = shouldReduce || input.missedSessions >= 2;

  return {
    shouldReduce,
    shouldAddRecovery,
    reason: reasons.join(" ") || "No adaptation required.",
    adjustments: adjustments.length ? adjustments : ["Continue current plan."],
  };
}

// ---------------------------------------------------------------------------
// 5. Mode switching — preserves history, asks for intent
// ---------------------------------------------------------------------------

export type ModeSwitchIntent = "replace" | "add" | "pause";

export interface ModeSwitchPlan {
  intent: ModeSwitchIntent;
  fromMode: TrainingMode;
  toMode: TrainingMode;
  preserveHistory: boolean;
  recoveryWeeksRecommended: number;
  newGoalId?: string;
  transitionNote: string;
}

export function planModeSwitch(input: {
  from: TrainingMode;
  to: TrainingMode;
  intent: ModeSwitchIntent;
  daysSinceLastRace?: number;
}): ModeSwitchPlan {
  const needsRecovery = input.from !== input.to && (input.daysSinceLastRace ?? 999) < 14;
  return {
    intent: input.intent,
    fromMode: input.from,
    toMode: input.to,
    preserveHistory: true,
    recoveryWeeksRecommended: needsRecovery ? 1 : 0,
    transitionNote: needsRecovery
      ? `A 1-week recovery block is recommended before starting ${input.to.toUpperCase()} training.`
      : `Ready to transition from ${input.from.toUpperCase()} to ${input.to.toUpperCase()}. Previous training history is preserved.`,
  };
}

// ---------------------------------------------------------------------------
// 6. HYROX race simulation UI helpers
// ---------------------------------------------------------------------------

export { simulateHyrox, formatHMS, formatPace, HYROX_STATIONS };
export { ATHX_DISCIPLINES, normaliseAthxTest, estimateAthxScore };
export { CROSSFIT_BENCHMARKS };
export { DOW_FULL };
