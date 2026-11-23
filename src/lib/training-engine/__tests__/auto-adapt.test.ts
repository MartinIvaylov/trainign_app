// Unit tests for the auto-applied adaptation engine.
// Run with: `bun test src/lib/training-engine/__tests__/auto-adapt.test.ts`
import { describe, expect, it } from "bun:test";
import { computeAutoAdaptation, applySuggestion, AdaptationSuggestion } from "../auto-adapt";
import type { WorkoutLogLite, ScheduledSession } from "@/types";

function makeSession(over: Partial<ScheduledSession> = {}): ScheduledSession {
  return {
    id: "s-" + Math.random().toString(36).slice(2, 8),
    date: new Date(Date.now() + 86400 * 1000).toISOString(), // tomorrow by default
    dayOfWeek: 1,
    title: "Test Session",
    mode: "hyrox",
    type: "strength",
    intensity: "hard",
    completed: false,
    ...over,
  };
}

function makeLog(over: Partial<WorkoutLogLite> = {}): WorkoutLogLite {
  return {
    id: "l-" + Math.random().toString(36).slice(2, 8),
    date: new Date().toISOString(),
    mode: "hyrox",
    type: "strength",
    title: "Test Workout",
    completed: true,
    rpe: 7,
    ...over,
  };
}

describe("computeAutoAdaptation", () => {
  it("returns preserve suggestion when on plan with moderate RPE", () => {
    const result = computeAutoAdaptation({
      logs: [makeLog({ rpe: 7 }), makeLog({ rpe: 6 }), makeLog({ rpe: 7 })],
      sessions: [makeSession()],
      plannedDaysPerWeek: 3,
    });
    expect(result.shouldReduce).toBe(false);
    expect(result.shouldAddRecovery).toBe(false);
    expect(result.suggestions.some((s) => s.kind === "preserve")).toBe(true);
  });

  it("flags high RPE (avg >= 9) as needing reduction", () => {
    const result = computeAutoAdaptation({
      logs: [makeLog({ rpe: 10 }), makeLog({ rpe: 9 }), makeLog({ rpe: 9 })],
      sessions: [makeSession({ intensity: "hard" })],
      plannedDaysPerWeek: 3,
    });
    expect(result.shouldReduce).toBe(true);
  });

  it("suggests replacing next hard session when recovery is needed", () => {
    const hardSession = makeSession({ intensity: "very_hard", title: "Race Pace Intervals" });
    const result = computeAutoAdaptation({
      logs: [makeLog({ rpe: 10 }), makeLog({ rpe: 9 }), makeLog({ rpe: 9 })],
      sessions: [hardSession],
      plannedDaysPerWeek: 3,
      reportedFatigue: 9,
    });
    expect(result.shouldAddRecovery).toBe(true);
    const replaceSuggestion = result.suggestions.find((s) => s.kind === "replace_session");
    expect(replaceSuggestion).toBeDefined();
    expect(replaceSuggestion!.affectedSessionId).toBe(hardSession.id);
    expect(replaceSuggestion!.label).toContain("Race Pace Intervals");
  });

  it("suggests adding recovery day when no upcoming hard session exists", () => {
    const result = computeAutoAdaptation({
      logs: [makeLog({ rpe: 10 }), makeLog({ rpe: 9 })],
      sessions: [], // no upcoming sessions
      plannedDaysPerWeek: 2,
      reportedFatigue: 9,
    });
    expect(result.shouldAddRecovery).toBe(true);
    expect(result.suggestions.some((s) => s.kind === "add_recovery")).toBe(true);
  });

  it("flags self-reported fatigue >= 8 as needing recovery", () => {
    const result = computeAutoAdaptation({
      logs: [],
      sessions: [],
      plannedDaysPerWeek: 4,
      reportedFatigue: 8,
    });
    expect(result.shouldAddRecovery).toBe(true);
    expect(result.shouldReduce).toBe(true);
  });

  it("does not flag moderate fatigue (7 or below)", () => {
    const result = computeAutoAdaptation({
      logs: [],
      sessions: [],
      plannedDaysPerWeek: 4,
      reportedFatigue: 7,
    });
    expect(result.shouldAddRecovery).toBe(false);
  });

  it("handles missed sessions (scheduled in past, not completed)", () => {
    const missedSession = makeSession({
      date: new Date(Date.now() - 2 * 86400 * 1000).toISOString(), // 2 days ago
      completed: false,
    });
    const missedSession2 = makeSession({
      date: new Date(Date.now() - 3 * 86400 * 1000).toISOString(), // 3 days ago
      completed: false,
    });
    const result = computeAutoAdaptation({
      logs: [],
      sessions: [missedSession, missedSession2],
      plannedDaysPerWeek: 4,
    });
    expect(result.suggestions.length).toBeGreaterThan(0);
    // Should mention missed sessions in the reason
    const reasonLower = result.reason.toLowerCase();
    expect(reasonLower.includes("missed") || reasonLower.includes("sessions")).toBe(true);
  });

  it("counts only sessions in the last 7 days as missed", () => {
    const oldMissed = makeSession({
      date: new Date(Date.now() - 10 * 86400 * 1000).toISOString(), // 10 days ago
      completed: false,
    });
    const result = computeAutoAdaptation({
      logs: [],
      sessions: [oldMissed],
      plannedDaysPerWeek: 4,
    });
    // Old missed session should not trigger adaptation
    expect(result.suggestions.some((s) => s.kind === "preserve")).toBe(true);
  });

  it("includes a human-readable summary", () => {
    const result = computeAutoAdaptation({
      logs: [makeLog({ rpe: 7 })],
      sessions: [],
      plannedDaysPerWeek: 1,
    });
    expect(result.summary.length).toBeGreaterThan(0);
    expect(typeof result.summary).toBe("string");
  });

  it("handles empty logs and sessions gracefully", () => {
    const result = computeAutoAdaptation({
      logs: [],
      sessions: [],
      plannedDaysPerWeek: 4,
    });
    expect(result).toBeDefined();
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});

describe("applySuggestion", () => {
  it("replaces a session with recovery when kind is replace_session", () => {
    const session = makeSession({ title: "Heavy Strength", intensity: "hard", type: "strength" });
    const suggestion: AdaptationSuggestion = {
      id: "rec-1",
      kind: "replace_session",
      label: "Replace with recovery",
      detail: "30 min Z2 + mobility",
      affectedSessionId: session.id,
    };
    const result = applySuggestion([session], suggestion);
    expect(result[0].title).toContain("Recovery — Mobility");
    expect(result[0].type).toBe("recovery");
    expect(result[0].intensity).toBe("easy");
    expect(result[0].notes).toContain("Auto-applied");
  });

  it("drops intensity by one zone when kind is drop_intensity", () => {
    const veryHard = makeSession({ intensity: "very_hard" });
    const hard = makeSession({ intensity: "hard" });
    const moderate = makeSession({ intensity: "moderate" });

    const dropVeryHard = applySuggestion([veryHard], {
      id: "d1", kind: "drop_intensity", label: "Drop", detail: "d", affectedSessionId: veryHard.id,
    });
    expect(dropVeryHard[0].intensity).toBe("hard");

    const dropHard = applySuggestion([hard], {
      id: "d2", kind: "drop_intensity", label: "Drop", detail: "d", affectedSessionId: hard.id,
    });
    expect(dropHard[0].intensity).toBe("moderate");

    // Moderate should stay moderate (no further drop)
    const dropModerate = applySuggestion([moderate], {
      id: "d3", kind: "drop_intensity", label: "Drop", detail: "d", affectedSessionId: moderate.id,
    });
    expect(dropModerate[0].intensity).toBe("moderate");
  });

  it("adds auto-applied note when dropping intensity", () => {
    const session = makeSession({ intensity: "hard", notes: "Original note" });
    const result = applySuggestion([session], {
      id: "d1", kind: "drop_intensity", label: "Drop", detail: "d", affectedSessionId: session.id,
    });
    expect(result[0].notes).toContain("Original note");
    expect(result[0].notes).toContain("Auto-applied");
  });

  it("returns sessions unchanged when no affectedSessionId", () => {
    const session = makeSession();
    const suggestion: AdaptationSuggestion = {
      id: "no-op", kind: "preserve", label: "Preserve", detail: "d",
    };
    const result = applySuggestion([session], suggestion);
    expect(result[0]).toEqual(session);
  });

  it("returns sessions unchanged when affectedSessionId does not match any session", () => {
    const session = makeSession({ id: "s-real" });
    const suggestion: AdaptationSuggestion = {
      id: "d1", kind: "replace_session", label: "Replace", detail: "d",
      affectedSessionId: "s-different",
    };
    const result = applySuggestion([session], suggestion);
    expect(result[0].title).toBe("Test Session"); // unchanged
  });

  it("only modifies the affected session, leaving others unchanged", () => {
    const target = makeSession({ intensity: "hard", title: "Target" });
    const other = makeSession({ intensity: "hard", title: "Other" });
    const result = applySuggestion([target, other], {
      id: "d1", kind: "drop_intensity", label: "Drop", detail: "d",
      affectedSessionId: target.id,
    });
    expect(result[0].intensity).toBe("moderate"); // target dropped
    expect(result[1].intensity).toBe("hard"); // other unchanged
  });

  it("returns empty array for empty sessions input", () => {
    const result = applySuggestion([], {
      id: "d1", kind: "replace_session", label: "Replace", detail: "d",
      affectedSessionId: "nonexistent",
    });
    expect(result).toEqual([]);
  });
});
