// HYROX competition rules — configurable, not hardcoded.
// Source: publicly documented HYROX rules and station standards.
// This is for training compatibility only; HYBRID is not affiliated with HYROX.

export type HyroxDivision =
  | "open"
  | "pro"
  | "doubles"
  | "relay"
  | "women"
  | "men"
  | "mixed_doubles"
  | "women_doubles"
  | "men_doubles"
  | "relay_team";

export interface HyroxStationRule {
  index: number; // 1..8
  name: string;
  slug: string;
  category: "erg" | "sled" | "carrying" | "jumping" | "rowing" | "wall";
  description: string;
  standards: Partial<Record<HyroxDivision, { load?: string; reps?: string; distance?: string; target?: string }>>;
}

export const HYROX_STATIONS: HyroxStationRule[] = [
  {
    index: 1,
    name: "SkiErg",
    slug: "skierg",
    category: "erg",
    description: "1,000 m on the SkiErg.",
    standards: {
      open: { distance: "1000m" },
      pro: { distance: "1000m" },
      doubles: { distance: "1000m (split)" },
    },
  },
  {
    index: 2,
    name: "Sled Push",
    slug: "sled_push",
    category: "sled",
    description: "Push the sled 20 m four times (80 m total).",
    standards: {
      open: { load: "102 kg (women: 78 kg)" },
      pro: { load: "132 kg (women: 102 kg)" },
      doubles: { load: "152 kg (mixed: 122 kg)" },
    },
  },
  {
    index: 3,
    name: "Sled Pull",
    slug: "sled_pull",
    category: "sled",
    description: "Pull the sled 20 m four times (80 m total).",
    standards: {
      open: { load: "102 kg (women: 78 kg)" },
      pro: { load: "132 kg (women: 102 kg)" },
      doubles: { load: "152 kg (mixed: 122 kg)" },
    },
  },
  {
    index: 4,
    name: "Burpee Broad Jumps",
    slug: "burpee_broad_jumps",
    category: "jumping",
    description: "Burpee broad jumps covering 80 m.",
    standards: {
      open: { distance: "80m" },
      pro: { distance: "80m" },
    },
  },
  {
    index: 5,
    name: "Rowing",
    slug: "row",
    category: "rowing",
    description: "1,000 m on the rowing erg.",
    standards: {
      open: { distance: "1000m" },
      pro: { distance: "1000m" },
      doubles: { distance: "1000m (split)" },
    },
  },
  {
    index: 6,
    name: "Farmers Carry",
    slug: "farmers_carry",
    category: "carrying",
    description: "Carry two kettlebells / weights 80 m.",
    standards: {
      open: { load: "2 × 20 kg (women: 2 × 16 kg)" },
      pro: { load: "2 × 24 kg (women: 2 × 20 kg)" },
      doubles: { load: "2 × 24 kg (women: 2 × 20 kg)" },
    },
  },
  {
    index: 7,
    name: "Sandbag Lunges",
    slug: "sandbag_lunges",
    category: "carrying",
    description: "Walking lunges carrying the sandbag over 80 m.",
    standards: {
      open: { load: "20 kg (women: 15 kg)" },
      pro: { load: "30 kg (women: 20 kg)" },
      doubles: { load: "30 kg (women: 20 kg)" },
    },
  },
  {
    index: 8,
    name: "Wall Balls",
    slug: "wall_balls",
    category: "wall",
    description: "100 wall balls to target.",
    standards: {
      open: { load: "9 kg (women: 6 kg)", reps: "100" },
      pro: { load: "9 kg (women: 6 kg)", reps: "100" },
      doubles: { load: "9 kg (women: 6 kg)", reps: "100 (split)" },
    },
  },
];

export const HYROX_DIVISIONS = [
  { slug: "open", name: "Open (Individual)", description: "Standard loads, individual." },
  { slug: "pro", name: "Pro (Individual)", description: "Heavier sleds, individual." },
  { slug: "doubles", name: "Doubles", description: "Two athletes share the work." },
  { slug: "relay", name: "Relay Team", description: "4 athletes, each runs one station pair." },
] as const;

export interface HyroxSimulationInput {
  runSplits: number[];      // length 8, seconds
  stationSplits: number[];  // length 8, seconds
  transitionsSec?: number;
}

export interface HyroxSimulationResult {
  totalSec: number;
  runTotalSec: number;
  stationTotalSec: number;
  transitionSec: number;
  averageRunPaceSecPerKm: number;
  strongest: { index: number; name: string; sec: number };
  weakest: { index: number; name: string; sec: number };
  finishFormatted: string;
}

export function formatHMS(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function pacePerKm(distanceKm: number, sec: number): number {
  if (distanceKm <= 0) return 0;
  return sec / distanceKm;
}

export function formatPace(secPerKm: number): string {
  const s = Math.max(0, Math.round(secPerKm));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}/km`;
}

export function simulateHyrox(input: HyroxSimulationInput): HyroxSimulationResult {
  const runTotalSec = input.runSplits.reduce((a, b) => a + b, 0);
  const stationTotalSec = input.stationSplits.reduce((a, b) => a + b, 0);
  const transitionSec = input.transitionsSec ?? 0;
  const totalSec = runTotalSec + stationTotalSec + transitionSec;

  const combined = HYROX_STATIONS.map((s, i) => ({
    index: s.index,
    name: s.name,
    sec: (input.runSplits[i] ?? 0) + (input.stationSplits[i] ?? 0),
  }));
  const strongest = combined.reduce((a, b) => (a.sec < b.sec ? a : b));
  const weakest = combined.reduce((a, b) => (a.sec > b.sec ? a : b));

  return {
    totalSec,
    runTotalSec,
    stationTotalSec,
    transitionSec,
    averageRunPaceSecPerKm: pacePerKm(8, runTotalSec),
    strongest,
    weakest,
    finishFormatted: formatHMS(totalSec),
  };
}

export const HYROX_TIME_TARGETS = [
  { label: "Elite", sec: 60 * 60, description: "Sub 60 minutes" },
  { label: "Advanced", sec: 70 * 60, description: "60–70 minutes" },
  { label: "Intermediate", sec: 80 * 60, description: "70–80 minutes" },
  { label: "Beginner", sec: 90 * 60, description: "80–90 minutes" },
  { label: "First-timer", sec: 105 * 60, description: "90+ minutes" },
];
