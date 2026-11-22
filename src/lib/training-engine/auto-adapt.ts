// Auto-applied adaptation engine.
// Reviews recent logs + recovery inputs and produces adjustments the athlete
// can confirm. The engine never silently mutates the plan — it surfaces
// recommendations and waits for explicit confirmation.

import { WorkoutLogLite, ScheduledSession } from "@/types";
import { evaluateAdaptation, AdaptationResult } from "@/lib/training-engine";

export interface AutoAdaptation extends AdaptationResult {
  // Suggestions to apply (id + label + action) — applied only when athlete confirms
  suggestions: AdaptationSuggestion[];
  // Summary used in the dashboard card
  summary: string;
}

export interface AdaptationSuggestion {
  id: string;
  kind: "replace_session" | "drop_intensity" | "add_recovery" | "preserve";
  label: string;
  detail: string;
  affectedSessionId?: string;
  appliedAt?: string;
}

export function computeAutoAdaptation(input: {
  logs: WorkoutLogLite[];
  sessions: ScheduledSession[];
  plannedDaysPerWeek: number;
  reportedFatigue?: number;
}): AutoAdaptation {
  const sevenDaysAgo = Date.now() - 7 * 86400 * 1000;
  const recentLogs = input.logs.filter((l) => new Date(l.date).getTime() >= sevenDaysAgo);
  const completedSessions = recentLogs.filter((l) => l.completed).length;
  const plannedSessions = input.plannedDaysPerWeek;
  const recentRPE = recentLogs
    .filter((l) => l.rpe !== undefined && l.rpe !== null)
    .map((l) => l.rpe!)
    .slice(-5);
  // Count missed sessions: scheduled in past 7 days, not completed, date in past
  const now = Date.now();
  const missed = input.sessions.filter((s) => {
    const d = new Date(s.date).getTime();
    return d >= sevenDaysAgo && d <= now && !s.completed;
  }).length;

  const base = evaluateAdaptation({
    completedSessions,
    plannedSessions,
    recentRPE,
    reportedFatigue: input.reportedFatigue,
    missedSessions: missed,
  });

  const suggestions: AdaptationSuggestion[] = [];

  if (base.shouldAddRecovery) {
    // Find next scheduled hard session and suggest replacing it with Z2 + mobility
    const nextHard = input.sessions.find((s) => {
      const d = new Date(s.date).getTime();
      return d > now && !s.completed && (s.intensity === "hard" || s.intensity === "very_hard");
    });
    if (nextHard) {
      suggestions.push({
        id: `rec-${nextHard.id}`,
        kind: "replace_session",
        label: `Replace "${nextHard.title}" with recovery`,
        detail: "30 min Z2 + mobility. Resume hard training next cycle.",
        affectedSessionId: nextHard.id,
      });
    } else {
      suggestions.push({
        id: "rec-add-recovery",
        kind: "add_recovery",
        label: "Add a recovery day this week",
        detail: "20–30 min easy mobility. Skip the next accessory block.",
      });
    }
  }

  if (base.shouldReduce && !base.shouldAddRecovery) {
    const nextHard = input.sessions.find((s) => {
      const d = new Date(s.date).getTime();
      return d > now && !s.completed && (s.intensity === "hard" || s.intensity === "very_hard");
    });
    if (nextHard) {
      suggestions.push({
        id: `drop-${nextHard.id}`,
        kind: "drop_intensity",
        label: `Drop intensity on "${nextHard.title}" by one zone`,
        detail: "Keep volume, lower target pace/load. Engine recommendation based on recent RPE.",
        affectedSessionId: nextHard.id,
      });
    }
  }

  if (missed >= 2) {
    const upcoming = input.sessions.find((s) => {
      const d = new Date(s.date).getTime();
      return d > now && !s.completed && s.type !== "strength" && s.type !== "interval";
    });
    if (upcoming && suggestions.findIndex((s) => s.affectedSessionId === upcoming.id) === -1) {
      suggestions.push({
        id: `drop-${upcoming.id}`,
        kind: "drop_intensity",
        label: `Keep "${upcoming.title}" but drop one accessory block`,
        detail: "Preserve the key quality session, remove accessories to absorb missed load.",
        affectedSessionId: upcoming.id,
      });
    }
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "preserve",
      kind: "preserve",
      label: "Continue current plan",
      detail: "Engine detects no adaptation needed. Recent load is on plan.",
    });
  }

  const summary = base.reason;

  return { ...base, suggestions, summary };
}

export function applySuggestion(
  sessions: ScheduledSession[],
  suggestion: AdaptationSuggestion,
): ScheduledSession[] {
  if (!suggestion.affectedSessionId) return sessions;
  return sessions.map((s) => {
    if (s.id !== suggestion.affectedSessionId) return s;
    if (suggestion.kind === "replace_session") {
      return {
        ...s,
        title: `Recovery — Mobility (replaces ${s.title})`,
        type: "recovery",
        intensity: "easy",
        notes: "Auto-applied: 30 min Z2 + mobility. Recent load was high.",
      };
    }
    if (suggestion.kind === "drop_intensity") {
      const newIntensity = s.intensity === "very_hard" ? "hard" : s.intensity === "hard" ? "moderate" : s.intensity;
      return {
        ...s,
        intensity: newIntensity as ScheduledSession["intensity"],
        notes: `${s.notes ?? ""}\n\nAuto-applied: intensity dropped one zone based on recent RPE/adaptation check.`,
      };
    }
    return s;
  });
}
