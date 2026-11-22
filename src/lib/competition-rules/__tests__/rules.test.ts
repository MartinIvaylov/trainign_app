// Unit tests for competition rules.
import { describe, expect, it } from "bun:test";
import {
  simulateHyrox,
  formatHMS,
  formatPace,
  pacePerKm,
  HYROX_STATIONS,
  HYROX_TIME_TARGETS,
} from "../hyrox";
import {
  ATHX_DISCIPLINES,
  normaliseAthxTest,
  estimateAthxScore,
  pairCombinedScore,
} from "../athx";
import { CROSSFIT_BENCHMARKS } from "../crossfit";

describe("HYROX rules", () => {
  it("defines all 8 stations in correct order", () => {
    expect(HYROX_STATIONS.length).toBe(8);
    expect(HYROX_STATIONS.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("uses correct station names", () => {
    expect(HYROX_STATIONS[0].name).toBe("SkiErg");
    expect(HYROX_STATIONS[1].name).toBe("Sled Push");
    expect(HYROX_STATIONS[7].name).toBe("Wall Balls");
  });

  it("has Open division standards for every station", () => {
    HYROX_STATIONS.forEach((s) => {
      expect(s.standards.open).toBeDefined();
    });
  });
});

describe("simulateHyrox", () => {
  it("sums all splits correctly", () => {
    const out = simulateHyrox({
      runSplits: [360, 360, 360, 360, 360, 360, 360, 360], // 8 × 6 min
      stationSplits: [180, 180, 180, 180, 180, 180, 180, 180], // 8 × 3 min
      transitionsSec: 120,
    });
    expect(out.runTotalSec).toBe(2880);
    expect(out.stationTotalSec).toBe(1440);
    expect(out.transitionSec).toBe(120);
    expect(out.totalSec).toBe(4440);
  });

  it("identifies the strongest station (lowest combined time)", () => {
    const out = simulateHyrox({
      runSplits: [300, 400, 350, 360, 380, 370, 360, 350],
      stationSplits: [180, 240, 200, 200, 220, 210, 200, 200],
    });
    expect(out.strongest.index).toBe(1);
    expect(out.strongest.name).toBe("SkiErg");
  });

  it("identifies the weakest station (highest combined time)", () => {
    const out = simulateHyrox({
      runSplits: [300, 400, 350, 360, 380, 370, 360, 350],
      stationSplits: [180, 240, 200, 200, 220, 210, 200, 200],
    });
    expect(out.weakest.index).toBe(2);
    expect(out.weakest.name).toBe("Sled Push");
  });

  it("computes average run pace over 8 km", () => {
    const out = simulateHyrox({
      runSplits: [360, 360, 360, 360, 360, 360, 360, 360], // 48 min total
      stationSplits: [0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(out.averageRunPaceSecPerKm).toBe(360); // 6:00/km
  });

  it("formats finish time as h:mm:ss when over 1 hour", () => {
    const out = simulateHyrox({
      runSplits: Array(8).fill(420),
      stationSplits: Array(8).fill(240),
      transitionsSec: 240,
    });
    expect(out.finishFormatted).toMatch(/^\d:\d\d:\d\d$/);
  });

  it("handles zero transitions gracefully", () => {
    const out = simulateHyrox({
      runSplits: [360],
      stationSplits: [180],
    });
    expect(out.transitionSec).toBe(0);
  });
});

describe("formatHMS / formatPace / pacePerKm", () => {
  it("formats seconds as m:ss", () => {
    expect(formatHMS(0)).toBe("0:00");
    expect(formatHMS(75)).toBe("1:15");
    expect(formatHMS(3600)).toBe("1:00:00");
  });

  it("clamps negative values to 0", () => {
    expect(formatHMS(-10)).toBe("0:00");
  });

  it("formats pace as m:ss/km", () => {
    expect(formatPace(360)).toBe("6:00/km");
    expect(formatPace(540)).toBe("9:00/km");
  });

  it("computes pace per km", () => {
    expect(pacePerKm(5, 1500)).toBe(300); // 25 min / 5 km = 5:00/km
    expect(pacePerKm(0, 100)).toBe(0);
  });
});

describe("HYROX time targets", () => {
  it("includes Elite, Advanced, Intermediate, Beginner, First-timer categories", () => {
    const labels = HYROX_TIME_TARGETS.map((t) => t.label);
    expect(labels).toEqual(["Elite", "Advanced", "Intermediate", "Beginner", "First-timer"]);
  });

  it("targets are sorted from fastest to slowest", () => {
    for (let i = 1; i < HYROX_TIME_TARGETS.length; i++) {
      expect(HYROX_TIME_TARGETS[i].sec).toBeGreaterThan(HYROX_TIME_TARGETS[i - 1].sec);
    }
  });
});

describe("ATHX rules", () => {
  it("defines 3 disciplines", () => {
    expect(ATHX_DISCIPLINES.length).toBe(3);
    expect(ATHX_DISCIPLINES.map((d) => d.slug)).toEqual(["strength", "endurance", "metcon_x"]);
  });

  it("has reference anchors for strength tests", () => {
    ATHX_DISCIPLINES[0].categories.forEach((c) => {
      expect(c.reference).toBeDefined();
      expect(c.reference!.beginner).toBeLessThan(c.reference!.elite);
    });
  });
});

describe("normaliseAthxTest", () => {
  it("returns 100 for elite-level performance", () => {
    const test = ATHX_DISCIPLINES[0].categories[0]; // back squat, higher better
    expect(normaliseAthxTest(test, 200)).toBe(100);
  });

  it("returns low score for beginner performance", () => {
    const test = ATHX_DISCIPLINES[0].categories[0];
    const score = normaliseAthxTest(test, 40);
    expect(score).toBeLessThan(15);
  });

  it("returns 100 for endurance test when time is below elite anchor", () => {
    const test = ATHX_DISCIPLINES[1].categories[0]; // 5km run, lower better
    expect(normaliseAthxTest(test, 900)).toBe(100); // 15 min 5k = elite
  });

  it("handles missing reference gracefully", () => {
    const test = { ...ATHX_DISCIPLINES[0].categories[0], reference: undefined };
    expect(normaliseAthxTest(test, 100)).toBe(50);
  });

  it("clamps result to 0..100", () => {
    const test = ATHX_DISCIPLINES[0].categories[0];
    expect(normaliseAthxTest(test, 1000)).toBeLessThanOrEqual(100);
    expect(normaliseAthxTest(test, 0)).toBeGreaterThanOrEqual(0);
  });
});

describe("estimateAthxScore", () => {
  it("averages the three discipline scores with correct weights", () => {
    const out = estimateAthxScore({
      strengthScore: 60,
      enduranceScore: 70,
      metconScore: 80,
    });
    // 0.34*60 + 0.33*70 + 0.33*80 = 20.4 + 23.1 + 26.4 = 69.9 ≈ 70
    expect(out).toBe(70);
  });

  it("returns 0 when all scores are 0", () => {
    expect(estimateAthxScore({ strengthScore: 0, enduranceScore: 0, metconScore: 0 })).toBe(0);
  });

  it("returns 100 when all scores are 100", () => {
    expect(estimateAthxScore({ strengthScore: 100, enduranceScore: 100, metconScore: 100 })).toBe(100);
  });

  it("clamps to 0..100 even if inputs are out of range", () => {
    expect(estimateAthxScore({ strengthScore: 200, enduranceScore: 200, metconScore: 200 })).toBe(100);
    expect(estimateAthxScore({ strengthScore: -50, enduranceScore: -50, metconScore: -50 })).toBe(0);
  });
});

describe("pairCombinedScore", () => {
  it("averages two athletes' scores", () => {
    expect(pairCombinedScore({ athleteScore: 60, partnerScore: 80 })).toBe(70);
  });

  it("handles equal scores", () => {
    expect(pairCombinedScore({ athleteScore: 75, partnerScore: 75 })).toBe(75);
  });

  it("rounds to nearest integer", () => {
    expect(pairCombinedScore({ athleteScore: 60, partnerScore: 81 })).toBe(71); // 70.5 rounds to 71
  });
});

describe("CrossFit benchmark library", () => {
  it("includes the named Girl benchmarks", () => {
    const names = CROSSFIT_BENCHMARKS.map((b) => b.name);
    ["Fran", "Grace", "Helen", "Cindy", "Diane", "Elizabeth", "Isabel", "Angie"].forEach((n) => {
      expect(names).toContain(n);
    });
  });

  it("includes a hero benchmark (Murph)", () => {
    expect(CROSSFIT_BENCHMARKS.some((b) => b.name === "Murph" && b.category === "hero")).toBe(true);
  });

  it("every benchmark has an RX definition for men and women", () => {
    CROSSFIT_BENCHMARKS.forEach((b) => {
      expect(b.rx.men).toBeTruthy();
      expect(b.rx.women).toBeTruthy();
    });
  });

  it("every benchmark has at least one movement", () => {
    CROSSFIT_BENCHMARKS.forEach((b) => {
      expect(b.movements.length).toBeGreaterThan(0);
    });
  });

  it("Fran is 21-15-9 with thrusters and pull-ups", () => {
    const fran = CROSSFIT_BENCHMARKS.find((b) => b.slug === "fran")!;
    expect(fran.type).toBe("for_time");
    expect(fran.movements.find((m) => m.name === "Thruster")?.reps).toBe("21-15-9");
    expect(fran.movements.find((m) => m.name === "Pull-up")?.reps).toBe("21-15-9");
  });
});
