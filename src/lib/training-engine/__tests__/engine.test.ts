// Unit tests for the adaptive training engine.
// Run with: `bun test src/lib/training-engine/__tests__/engine.test.ts`
import { describe, expect, it } from "bun:test";
import {
  analyzeAthlete,
  generatePeriodization,
  generateWeekSessions,
  evaluateAdaptation,
  planModeSwitch,
} from "../index";
import type { BenchmarkInput, GoalFocus, TrainingMode } from "@/types";

describe("analyzeAthlete", () => {
  it("returns dimensions in expected order", () => {
    const out = analyzeAthlete({ benchmarks: {} });
    expect(out.map((w) => w.dimension)).toEqual(["running", "strength", "erg", "metcon"]);
  });

  it("flags low running score as high severity", () => {
    const out = analyzeAthlete({
      benchmarks: { fiveKmSec: 38 * 60 } as BenchmarkInput,
    });
    const running = out.find((w) => w.dimension === "running")!;
    expect(running.severity).toBe("high");
    expect(running.score).toBeLessThan(45);
  });

  it("flags elite 5k as low severity", () => {
    const out = analyzeAthlete({
      benchmarks: { fiveKmSec: 16 * 60 } as BenchmarkInput,
    });
    const running = out.find((w) => w.dimension === "running")!;
    expect(running.severity).toBe("low");
    expect(running.score).toBeGreaterThan(85);
  });

  it("computes strength relative to bodyweight when provided", () => {
    const out = analyzeAthlete({
      benchmarks: { backSquatKg: 180 } as BenchmarkInput,
      weightKg: 80,
    });
    const strength = out.find((w) => w.dimension === "strength")!;
    expect(strength.evidence).toContain("2.25");
  });

  it("returns neutral 50 for missing benchmarks", () => {
    const out = analyzeAthlete({ benchmarks: {} });
    out.forEach((w) => {
      expect(w.score).toBe(50);
    });
  });

  it("includes actionable recommendation text", () => {
    const out = analyzeAthlete({
      benchmarks: { fiveKmSec: 38 * 60 } as BenchmarkInput,
    });
    out.forEach((w) => {
      expect(w.recommendation.length).toBeGreaterThan(10);
      expect(w.evidence.length).toBeGreaterThan(5);
    });
  });
});

describe("generatePeriodization", () => {
  it("produces 4 blocks for HYROX with 12 weeks", () => {
    const blocks = generatePeriodization({
      mode: "hyrox",
      weeksAvailable: 12,
      daysPerWeek: 4,
      goal: "improve_overall" as GoalFocus,
      weaknesses: [],
    });
    expect(blocks.length).toBe(4);
    expect(blocks.map((b) => b.phase)).toEqual(["base", "strength", "specific", "taper"]);
    expect(blocks.reduce((a, b) => a + b.weeks, 0)).toBe(12);
  });

  it("produces 5 blocks for ATHX", () => {
    const blocks = generatePeriodization({
      mode: "athx",
      weeksAvailable: 12,
      daysPerWeek: 5,
      goal: "compete_advanced" as GoalFocus,
      weaknesses: [],
    });
    expect(blocks.length).toBe(5);
    expect(blocks[0].phase).toBe("base");
    expect(blocks[4].phase).toBe("taper");
  });

  it("produces 3 blocks for CrossFit", () => {
    const blocks = generatePeriodization({
      mode: "crossfit",
      weeksAvailable: 8,
      daysPerWeek: 5,
      goal: "improve_overall" as GoalFocus,
      weaknesses: [],
    });
    expect(blocks.length).toBe(3);
    expect(blocks[2].phase).toBe("taper");
  });

  it("produces 1 maintenance block with no taper", () => {
    const blocks = generatePeriodization({
      mode: "maintenance",
      weeksAvailable: 8,
      daysPerWeek: 3,
      goal: "improve_overall" as GoalFocus,
      weaknesses: [],
    });
    expect(blocks.length).toBe(1);
    expect(blocks[0].phase).toBe("maintenance");
    expect(blocks[0].intensity).toBe("moderate");
  });

  it("caps days per week at 6", () => {
    const blocks = generatePeriodization({
      mode: "hyrox",
      weeksAvailable: 8,
      daysPerWeek: 7,
      goal: "improve_overall" as GoalFocus,
      weaknesses: [],
    });
    blocks.forEach((b) => expect(b.sessionsPerWeek).toBeLessThanOrEqual(6));
  });

  it("never produces zero weeks", () => {
    const blocks = generatePeriodization({
      mode: "hyrox",
      weeksAvailable: 2,
      daysPerWeek: 4,
      goal: "improve_overall" as GoalFocus,
      weaknesses: [],
    });
    blocks.forEach((b) => expect(b.weeks).toBeGreaterThanOrEqual(1));
  });

  it("includes weakness focus in description when severity is high", () => {
    const weaknesses = analyzeAthlete({
      benchmarks: { fiveKmSec: 38 * 60 } as BenchmarkInput,
    });
    const blocks = generatePeriodization({
      mode: "hyrox",
      weeksAvailable: 12,
      daysPerWeek: 4,
      goal: "improve_overall" as GoalFocus,
      weaknesses,
    });
    expect(blocks[0].description).toContain("Weakness focus: running");
  });
});

describe("generateWeekSessions", () => {
  it("returns one session per preferred day", () => {
    const out = generateWeekSessions({
      mode: "hyrox",
      phase: "base",
      preferredDays: [1, 3, 5],
      focusDimensions: [],
    });
    expect(out.length).toBe(3);
  });

  it("assigns unique dayOfWeek values matching preferences", () => {
    const out = generateWeekSessions({
      mode: "crossfit",
      phase: "specific",
      preferredDays: [2, 4, 6],
      focusDimensions: [],
    });
    const days = out.map((s) => s.dayOfWeek).sort();
    expect(days).toEqual([2, 4, 6]);
  });

  it("uses default 4-day plan if preferredDays is empty", () => {
    const out = generateWeekSessions({
      mode: "hyrox",
      phase: "base",
      preferredDays: [],
      focusDimensions: [],
    });
    expect(out.length).toBe(4);
  });

  it("produces sessions with the requested mode", () => {
    (["hyrox", "athx", "crossfit", "maintenance"] as TrainingMode[]).forEach((mode) => {
      const out = generateWeekSessions({
        mode,
        phase: "base",
        preferredDays: [1, 3, 5, 6],
        focusDimensions: [],
      });
      out.forEach((s) => expect(s.mode).toBe(mode));
    });
  });

  it("all generated sessions are initially not completed", () => {
    const out = generateWeekSessions({
      mode: "hyrox",
      phase: "base",
      preferredDays: [1, 3, 5, 6],
      focusDimensions: [],
    });
    out.forEach((s) => expect(s.completed).toBe(false));
  });
});

describe("evaluateAdaptation", () => {
  it("flags high RPE as needing reduction", () => {
    const out = evaluateAdaptation({
      completedSessions: 4,
      plannedSessions: 4,
      recentRPE: [9, 9, 9, 9],
      missedSessions: 0,
    });
    expect(out.shouldReduce).toBe(true);
    expect(out.adjustments.length).toBeGreaterThan(0);
  });

  it("flags self-reported fatigue 8+ as needing recovery", () => {
    const out = evaluateAdaptation({
      completedSessions: 3,
      plannedSessions: 4,
      recentRPE: [6, 7, 6],
      reportedFatigue: 9,
      missedSessions: 0,
    });
    expect(out.shouldAddRecovery).toBe(true);
    expect(out.reason).toContain("fatigue");
  });

  it("does not stack missed sessions", () => {
    const out = evaluateAdaptation({
      completedSessions: 1,
      plannedSessions: 4,
      recentRPE: [6],
      missedSessions: 3,
    });
    expect(out.adjustments.some((a) => a.toLowerCase().includes("stack"))).toBe(true);
  });

  it("reports no adaptation needed when on plan", () => {
    const out = evaluateAdaptation({
      completedSessions: 4,
      plannedSessions: 4,
      recentRPE: [6, 7, 6, 7],
      missedSessions: 0,
    });
    expect(out.shouldReduce).toBe(false);
    expect(out.shouldAddRecovery).toBe(false);
  });

  it("handles empty RPE list gracefully", () => {
    const out = evaluateAdaptation({
      completedSessions: 0,
      plannedSessions: 4,
      recentRPE: [],
      missedSessions: 0,
    });
    expect(out.reason).toBeTruthy();
    expect(out.adjustments).toBeInstanceOf(Array);
  });

  it("reduces next session intensity when 3+ sessions avg RPE >= 9", () => {
    const out = evaluateAdaptation({
      completedSessions: 3,
      plannedSessions: 4,
      recentRPE: [9, 10, 9],
      missedSessions: 0,
    });
    expect(out.adjustments.some((a) => a.includes("Reduce next session intensity"))).toBe(true);
  });
});

describe("planModeSwitch", () => {
  it("preserves history on every intent", () => {
    (["replace", "add", "pause"] as const).forEach((intent) => {
      const plan = planModeSwitch({
        from: "hyrox",
        to: "athx",
        intent,
      });
      expect(plan.preserveHistory).toBe(true);
    });
  });

  it("recommends recovery week when race was <14 days ago", () => {
    const plan = planModeSwitch({
      from: "hyrox",
      to: "athx",
      intent: "replace",
      daysSinceLastRace: 7,
    });
    expect(plan.recoveryWeeksRecommended).toBe(1);
    expect(plan.transitionNote).toContain("recovery");
  });

  it("does not recommend recovery when no recent race", () => {
    const plan = planModeSwitch({
      from: "hyrox",
      to: "athx",
      intent: "replace",
      daysSinceLastRace: 60,
    });
    expect(plan.recoveryWeeksRecommended).toBe(0);
  });

  it("always returns correct from/to modes", () => {
    const plan = planModeSwitch({
      from: "crossfit",
      to: "maintenance",
      intent: "pause",
    });
    expect(plan.fromMode).toBe("crossfit");
    expect(plan.toMode).toBe("maintenance");
  });
});
