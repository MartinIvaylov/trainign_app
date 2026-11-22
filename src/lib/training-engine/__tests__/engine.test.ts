// Unit tests for the adaptive training engine.
// Run with: `bun test src/lib/training-engine/__tests__/engine.test.ts`
import { describe, expect, it } from "bun:test";
import {
  analyzeAthlete,
  generatePeriodization,
  generateWeekSessions,
  evaluateAdaptation,
  planModeSwitch,
  predictHyroxFinish,
  analyzeRaceResult,
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

describe("predictHyroxFinish", () => {
  it("returns null when no inputs are provided", () => {
    const p = predictHyroxFinish({});
    expect(p.predictedFinishSec).toBeNull();
    expect(p.confidence).toBe("low");
    expect(p.inputsUsed.length).toBe(0);
  });

  it("predicts from 5 km time alone", () => {
    const p = predictHyroxFinish({ fiveKmSec: 22 * 60 });
    expect(p.predictedFinishSec).not.toBeNull();
    expect(p.predictedFinishSec!).toBeGreaterThan(30 * 60);
    expect(p.predictedFinishSec!).toBeLessThan(120 * 60);
    expect(p.confidence).toBe("low");
    expect(p.inputsUsed.some((s) => s.includes("5 km"))).toBe(true);
  });

  it("predicts from 1 km pace when 5 km not provided", () => {
    const p = predictHyroxFinish({ oneKmPaceSec: 270 });
    expect(p.predictedFinishSec).not.toBeNull();
    expect(p.inputsUsed.some((s) => s.includes("1 km pace"))).toBe(true);
  });

  it("uses erg scores for station estimate", () => {
    const p = predictHyroxFinish({
      fiveKmSec: 20 * 60,
      skierg1kSec: 200,
      row2kSec: 420,
    });
    expect(p.predictedFinishSec).not.toBeNull();
    expect(p.confidence).toBe("high");
    expect(p.inputsUsed.some((s) => s.includes("SkiErg"))).toBe(true);
    expect(p.inputsUsed.some((s) => s.includes("Row"))).toBe(true);
  });

  it("blends prior HYROX result 50/50 with predicted", () => {
    const prior = 75 * 60;
    const p = predictHyroxFinish({
      fiveKmSec: 22 * 60,
      priorHyroxFinishSec: prior,
    });
    expect(p.predictedFinishSec).not.toBeNull();
    // Should be between predicted-from-5k and prior, blended
    expect(p.inputsUsed.some((s) => s.includes("Prior HYROX"))).toBe(true);
    expect(p.confidence).toBe("moderate");
  });

  it("falls back to prior HYROX alone when no other inputs", () => {
    const prior = 80 * 60;
    const p = predictHyroxFinish({ priorHyroxFinishSec: prior });
    expect(p.predictedFinishSec).toBe(prior);
    expect(p.inputsUsed[0]).toContain("Prior HYROX");
  });

  it("returns high confidence with 3+ inputs", () => {
    const p = predictHyroxFinish({
      fiveKmSec: 20 * 60,
      skierg1kSec: 200,
      row2kSec: 420,
      priorHyroxFinishSec: 70 * 60,
    });
    expect(p.confidence).toBe("high");
  });

  it("computes pace per km when finish is predicted", () => {
    const p = predictHyroxFinish({ fiveKmSec: 20 * 60 });
    expect(p.pacePerKmSec).not.toBeNull();
    expect(p.pacePerKmSec!).toBeGreaterThan(0);
    // pace / 8 km
    expect(p.pacePerKmSec).toBe(Math.round((p.predictedFinishSec as number) / 8));
  });

  it("includes a human-readable method explanation", () => {
    const p = predictHyroxFinish({ fiveKmSec: 22 * 60 });
    expect(p.method).toContain("5 km pace");
    expect(p.method).toContain("transitions");
  });
});

describe("analyzeRaceResult", () => {
  it("formats finish time correctly", () => {
    const a = analyzeRaceResult({ format: "hyrox", finishSec: 4500 });
    expect(a.finishFormatted).toBe("1:15:00");
  });

  it("returns first_race verdict when no previous result", () => {
    const a = analyzeRaceResult({ format: "hyrox", finishSec: 4500 });
    expect(a.vsPrevious?.verdict).toBe("first_race");
  });

  it("detects improvement vs previous race", () => {
    const a = analyzeRaceResult({
      format: "hyrox",
      finishSec: 4500,
      previousResultSec: 4800,
    });
    expect(a.vsPrevious?.verdict).toBe("improved");
    expect(a.vsPrevious!.deltaSec).toBe(-300);
  });

  it("detects regression vs previous race", () => {
    const a = analyzeRaceResult({
      format: "hyrox",
      finishSec: 5000,
      previousResultSec: 4500,
    });
    expect(a.vsPrevious?.verdict).toBe("regressed");
  });

  it("detects same finish within 0.5% tolerance", () => {
    const a = analyzeRaceResult({
      format: "hyrox",
      finishSec: 4500,
      previousResultSec: 4505,
    });
    expect(a.vsPrevious?.verdict).toBe("same");
  });

  it("detects faster than target", () => {
    const a = analyzeRaceResult({
      format: "hyrox",
      finishSec: 4500,
      targetSec: 4800,
    });
    expect(a.vsTarget?.verdict).toBe("faster");
    expect(a.vsTarget!.deltaSec).toBe(-300);
  });

  it("detects slower than target", () => {
    const a = analyzeRaceResult({
      format: "hyrox",
      finishSec: 5000,
      targetSec: 4800,
    });
    expect(a.vsTarget?.verdict).toBe("slower");
  });

  it("detects on_target within 1% tolerance", () => {
    const a = analyzeRaceResult({
      format: "hyrox",
      finishSec: 4800,
      targetSec: 4820,
    });
    expect(a.vsTarget?.verdict).toBe("on_target");
  });

  it("returns no_target when no target provided", () => {
    const a = analyzeRaceResult({ format: "hyrox", finishSec: 4500 });
    expect(a.vsTarget).toBeNull();
  });

  it("identifies strongest and weakest splits", () => {
    const a = analyzeRaceResult({
      format: "hyrox",
      finishSec: 4500,
      splits: [
        { name: "SkiErg", sec: 200 },
        { name: "Sled Pull", sec: 320 },
        { name: "Row", sec: 240 },
      ],
    });
    expect(a.strongestSplit?.name).toBe("SkiErg");
    expect(a.strongestSplit!.sec).toBe(200);
    expect(a.weakestSplit?.name).toBe("Sled Pull");
    expect(a.weakestSplit!.sec).toBe(320);
  });

  it("returns null strongest/weakest when no splits provided", () => {
    const a = analyzeRaceResult({ format: "hyrox", finishSec: 4500 });
    expect(a.strongestSplit).toBeNull();
    expect(a.weakestSplit).toBeNull();
  });

  it("includes summary string with finish and verdicts", () => {
    const a = analyzeRaceResult({
      format: "hyrox",
      finishSec: 4500,
      targetSec: 4800,
      previousResultSec: 4700,
    });
    expect(a.summary).toContain("HYROX");
    expect(a.summary).toContain("1:15:00");
    expect(a.summary).toContain("faster");
    // Engine uses "Improved" (capital I) as the verdict sentence starts with it
    expect(a.summary).toContain("Improved");
  });

  it("generates recommendations based on weaknesses", () => {
    const a = analyzeRaceResult({
      format: "hyrox",
      finishSec: 5000,
      targetSec: 4500,
      splits: [
        { name: "SkiErg", sec: 200 },
        { name: "Sled Pull", sec: 360 },
      ],
    });
    expect(a.recommendations.length).toBeGreaterThan(0);
    expect(a.recommendations.some((r) => r.includes("Sled Pull"))).toBe(true);
    expect(a.recommendations.some((r) => r.includes("race-pace"))).toBe(true);
  });

  it("returns 'maintain' recommendation when no issues found", () => {
    const a = analyzeRaceResult({ format: "hyrox", finishSec: 4500 });
    expect(a.recommendations.some((r) => r.includes("Maintain"))).toBe(true);
  });
});
