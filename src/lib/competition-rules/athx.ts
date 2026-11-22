// ATHX Games — training compatibility module.
// HYBRID is not affiliated with ATHX. Where official scoring rules are not
// publicly available, we compute an ESTIMATED Performance Score that is
// clearly distinguished from the official ATHX FitScore.

export type AthxDivision = "individual" | "pairs" | "team";

export interface AthxDiscipline {
  slug: "strength" | "endurance" | "metcon_x";
  name: string;
  description: string;
  categories: AthxTest[];
}

export interface AthxTest {
  slug: string;
  name: string;
  // The official test description as currently understood.
  // Set verified=false when the official spec is uncertain.
  verified: boolean;
  description: string;
  unit: "kg" | "reps" | "seconds" | "meters" | "calories";
  higherIsBetter: boolean;
  // Optional reference values used to estimate performance
  reference?: { beginner: number; intermediate: number; advanced: number; elite: number };
}

export const ATHX_DISCIPLINES: AthxDiscipline[] = [
  {
    slug: "strength",
    name: "Strength",
    description: "Heavy lifts and loaded movements. Tests absolute and relative strength.",
    categories: [
      {
        slug: "back_squat_1rm",
        name: "Back Squat 1RM",
        verified: true,
        description: "1 repetition maximum back squat.",
        unit: "kg",
        higherIsBetter: true,
        reference: { beginner: 60, intermediate: 100, advanced: 140, elite: 180 },
      },
      {
        slug: "deadlift_1rm",
        name: "Deadlift 1RM",
        verified: true,
        description: "1 repetition maximum deadlift.",
        unit: "kg",
        higherIsBetter: true,
        reference: { beginner: 80, intermediate: 130, advanced: 180, elite: 230 },
      },
      {
        slug: "strict_press_1rm",
        name: "Strict Press 1RM",
        verified: true,
        description: "1 repetition maximum strict press.",
        unit: "kg",
        higherIsBetter: true,
        reference: { beginner: 30, intermediate: 50, advanced: 70, elite: 90 },
      },
    ],
  },
  {
    slug: "endurance",
    name: "Endurance",
    description: "Aerobic and threshold capacity tests.",
    categories: [
      {
        slug: "run_5k",
        name: "5 km Run",
        verified: true,
        description: "5 km road or track time trial.",
        unit: "seconds",
        higherIsBetter: false,
        reference: { beginner: 1800, intermediate: 1400, advanced: 1200, elite: 1020 },
      },
      {
        slug: "row_2k",
        name: "2 km Row",
        verified: true,
        description: "2,000 m rowing erg time trial.",
        unit: "seconds",
        higherIsBetter: false,
        reference: { beginner: 540, intermediate: 450, advanced: 410, elite: 360 },
      },
      {
        slug: "skierg_1k",
        name: "1 km SkiErg",
        verified: true,
        description: "1,000 m SkiErg time trial.",
        unit: "seconds",
        higherIsBetter: false,
        reference: { beginner: 240, intermediate: 200, advanced: 180, elite: 160 },
      },
    ],
  },
  {
    slug: "metcon_x",
    name: "MetCon-X",
    description: "Mixed metabolic conditioning test combining weights, ergs, and gymnastics.",
    categories: [
      {
        slug: "metcon_x_test_a",
        name: "MetCon-X Test A",
        verified: false,
        description:
          "Standardised AMRAP workout. Score is total reps. Description is HYBRID's interpretation until officially published.",
        unit: "reps",
        higherIsBetter: true,
        reference: { beginner: 80, intermediate: 150, advanced: 220, elite: 300 },
      },
    ],
  },
];

// Estimated Performance Score (0–100)
// This is HYBRID's internal estimate. Where the official ATHX FitScore is
// published for an event, results pages show that instead.
export interface AthxEstimatorInput {
  strengthScore: number;   // 0..100 already-normalised
  enduranceScore: number;   // 0..100
  metconScore: number;      // 0..100
}

export function normaliseAthxTest(test: AthxTest, value: number): number {
  if (!test.reference) return 50;
  const { beginner, intermediate, advanced, elite } = test.reference;
  const levels = test.higherIsBetter
    ? [beginner, intermediate, advanced, elite]
    : [elite, advanced, intermediate, beginner];
  // Linear interpolation across anchors -> 25 / 50 / 75 / 100
  let score = 0;
  for (let i = 0; i < levels.length - 1; i++) {
    const lo = levels[i];
    const hi = levels[i + 1];
    if (value >= Math.min(lo, hi) && value <= Math.max(lo, hi)) {
      const t = (value - lo) / (hi - lo || 1);
      score = 25 * (i + 1) + 25 * t;
      return Math.round(Math.max(0, Math.min(100, score)));
    }
  }
  if (test.higherIsBetter) {
    if (value > elite) return 100;
    if (value < beginner) return 5;
  } else {
    if (value < elite) return 100;
    if (value > beginner) return 5;
  }
  return Math.round(score);
}

export function estimateAthxScore(input: AthxEstimatorInput): number {
  // Equal-weighted blend. Deterministic and explainable.
  const out = 0.34 * input.strengthScore + 0.33 * input.enduranceScore + 0.33 * input.metconScore;
  return Math.round(Math.max(0, Math.min(100, out)));
}

// ATHX pairs mode helpers
export interface AthxPairContribution {
  athleteScore: number;
  partnerScore: number;
}
export function pairCombinedScore(p: AthxPairContribution): number {
  // Pair score is the average of the two individual estimated scores.
  return Math.round((p.athleteScore + p.partnerScore) / 2);
}
