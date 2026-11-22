// CrossFit benchmark workouts — configurable library.
// HYBRID is not affiliated with CrossFit. Benchmarks are stored here so the
// engine can reference them; coaches can add custom WODs through the UI.

export interface CrossFitBenchmark {
  slug: string;
  name: string;
  type: "for_time" | "amrap" | "max_load" | "reps" | "rounds";
  description: string;
  rx: { men: string; women: string };
  cap?: number; // minutes
  movements: { name: string; reps: string; note?: string }[];
  // Approximate difficulty & typical response (used by engine only)
  category: "girl" | "hero" | "open" | "weightlifting" | "endurance" | "gymnastics" | "new";
  official?: boolean;
}

export const CROSSFIT_BENCHMARKS: CrossFitBenchmark[] = [
  {
    slug: "fran",
    name: "Fran",
    type: "for_time",
    category: "girl",
    cap: 12,
    description: "21-15-9 thrusters + pull-ups.",
    rx: { men: "43 kg thruster", women: "30 kg thruster" },
    movements: [
      { name: "Thruster", reps: "21-15-9" },
      { name: "Pull-up", reps: "21-15-9" },
    ],
  },
  {
    slug: "grace",
    name: "Grace",
    type: "for_time",
    category: "girl",
    cap: 10,
    description: "30 clean & jerks for time.",
    rx: { men: "60 kg", women: "43 kg" },
    movements: [{ name: "Clean & Jerk", reps: "30" }],
  },
  {
    slug: "helen",
    name: "Helen",
    type: "for_time",
    category: "girl",
    cap: 20,
    description: "3 rounds: 400 m run, 21 kettlebell swings, 12 pull-ups.",
    rx: { men: "24 kg KB", women: "16 kg KB" },
    movements: [
      { name: "Run", reps: "400 m" },
      { name: "Kettlebell Swing", reps: "21" },
      { name: "Pull-up", reps: "12" },
    ],
  },
  {
    slug: "murph",
    name: "Murph",
    type: "for_time",
    category: "hero",
    cap: 60,
    description:
      "1 mile run, 100 pull-ups, 200 push-ups, 300 squats, 1 mile run. With vest if Rx+.",
    rx: { men: "20 lb vest (Rx+)", women: "14 lb vest (Rx+)" },
    movements: [
      { name: "Run", reps: "1 mile" },
      { name: "Pull-up", reps: "100" },
      { name: "Push-up", reps: "200" },
      { name: "Air Squat", reps: "300" },
      { name: "Run", reps: "1 mile" },
    ],
  },
  {
    slug: "cindy",
    name: "Cindy",
    type: "amrap",
    category: "girl",
    cap: 20,
    description: "AMRAP 20: 5 pull-ups, 10 push-ups, 15 squats.",
    rx: { men: "Bodyweight", women: "Bodyweight" },
    movements: [
      { name: "Pull-up", reps: "5" },
      { name: "Push-up", reps: "10" },
      { name: "Air Squat", reps: "15" },
    ],
  },
  {
    slug: "fight_gone_bad",
    name: "Fight Gone Bad",
    type: "amrap",
    category: "girl",
    cap: 17,
    description:
      "3 rounds: 1 min each of wall ball, sumo deadlift high-pull, box jump, push press, row. 1 min rest between rounds.",
    rx: { men: "20 lb WB, 75 lb SDLHP, 24 in box, 75 lb PP", women: "14 lb WB, 55 lb SDLHP, 20 in box, 55 lb PP" },
    movements: [
      { name: "Wall Ball", reps: "1 min" },
      { name: "Sumo Deadlift High-Pull", reps: "1 min" },
      { name: "Box Jump", reps: "1 min" },
      { name: "Push Press", reps: "1 min" },
      { name: "Row", reps: "1 min (cal)" },
    ],
  },
  {
    slug: "diane",
    name: "Diane",
    type: "for_time",
    category: "girl",
    cap: 9,
    description: "21-15-9 deadlift + handstand push-ups.",
    rx: { men: "102 kg DL", women: "70 kg DL" },
    movements: [
      { name: "Deadlift", reps: "21-15-9" },
      { name: "Handstand Push-up", reps: "21-15-9" },
    ],
  },
  {
    slug: "elizabeth",
    name: "Elizabeth",
    type: "for_time",
    category: "girl",
    cap: 13,
    description: "21-15-9 clean + ring dips.",
    rx: { men: "61 kg clean", women: "43 kg clean" },
    movements: [
      { name: "Squat Clean", reps: "21-15-9" },
      { name: "Ring Dip", reps: "21-15-9" },
    ],
  },
  {
    slug: "isabel",
    name: "Isabel",
    type: "for_time",
    category: "girl",
    cap: 10,
    description: "30 snatches for time.",
    rx: { men: "60 kg", women: "43 kg" },
    movements: [{ name: "Snatch", reps: "30" }],
  },
  {
    slug: "angie",
    name: "Angie",
    type: "for_time",
    category: "girl",
    cap: 25,
    description: "100 pull-ups, 100 push-ups, 100 sit-ups, 100 squats.",
    rx: { men: "Bodyweight", women: "Bodyweight" },
    movements: [
      { name: "Pull-up", reps: "100" },
      { name: "Push-up", reps: "100" },
      { name: "Sit-up", reps: "100" },
      { name: "Air Squat", reps: "100" },
    ],
  },
];

export const WOD_TIMER_PRESETS = [
  { slug: "for_time", name: "For Time", description: "Count up; cap optional." },
  { slug: "amrap", name: "AMRAP", description: "Count down; score is total reps." },
  { slug: "emom", name: "EMOM", description: "Every minute on the minute." },
  { slug: "tabata", name: "Tabata", description: "20s on / 10s off × 8 rounds." },
  { slug: "intervals", name: "Intervals", description: "Custom work/rest." },
  { slug: "strength", name: "Strength", description: "Sets & reps tracking." },
] as const;

export type TimerSlug = (typeof WOD_TIMER_PRESETS)[number]["slug"];
