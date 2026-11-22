"use client";

import { useState } from "react";
import { useApp } from "@/store/app-store";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Calendar, Dumbbell, Heart, Target, User,
  Check, Activity, Settings, Trophy, Footprints,
} from "lucide-react";
import {
  AthleteProfileLite, AthletePreferencesLite, Background, BenchmarkInput,
  Equipment, GoalFocus, OnboardingData, TrainingMode,
} from "@/types";
import { HYROX_DIVISIONS, formatHMS } from "@/lib/competition-rules/hyrox";

const TOTAL_STEPS = 6;

export function OnboardingFlow() {
  const setOnboarding = useApp((s) => s.setOnboarding);
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<AthleteProfileLite>({
    displayName: "",
    trainingAge: "intermediate",
    background: "general",
    sex: "prefer_not",
  });
  const [preferences, setPreferences] = useState<AthletePreferencesLite>({
    daysPerWeek: 4,
    sessionMinutes: 60,
    preferredDays: [1, 3, 5, 6],
    equipment: ["home_gym", "dumbbells", "kettlebells", "barbells"],
    location: "home_gym",
  });
  const [benchmarks, setBenchmarks] = useState<BenchmarkInput>({});
  const [goal, setGoal] = useState<GoalFocus>("improve_overall");
  const [competition, setCompetition] = useState<{
    enabled: boolean;
    format: TrainingMode;
    name: string;
    date: string;
    division?: string;
  }>({
    enabled: false,
    format: "hyrox",
    name: "",
    date: "",
  });

  const canNext = (() => {
    if (step === 0) return profile.displayName.trim().length > 0;
    if (step === 1) return preferences.preferredDays.length > 0 && preferences.equipment.length > 0;
    return true;
  })();

  function next() {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
    else finish();
  }
  function back() {
    if (step > 0) setStep(step - 1);
  }
  function finish() {
    const data: OnboardingData = {
      profile,
      preferences,
      benchmarks,
      goal,
      upcomingCompetition: competition.enabled
        ? {
            format: competition.format,
            name: competition.name || "Upcoming competition",
            date: competition.date || new Date(Date.now() + 60 * 86400 * 1000).toISOString(),
            division: competition.division,
          }
        : undefined,
    };
    setOnboarding(data);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold text-sm">H</div>
            <div className="font-bold tracking-tight">HYBRID</div>
          </div>
          <div className="text-xs text-muted-foreground">
            Step {step + 1} of {TOTAL_STEPS}
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${
                i <= step ? "bg-primary" : "bg-secondary"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {step === 0 && (
              <StepWrapper
                icon={User}
                title="Tell us about you"
                subtitle="This builds your athlete profile. You can edit anything later."
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input label="Display name" required>
                    <input
                      value={profile.displayName}
                      onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                      placeholder="Alex Carter"
                      className="w-full bg-transparent outline-none text-sm"
                    />
                  </Input>
                  <Select
                    label="Sex (optional)"
                    value={profile.sex ?? "prefer_not"}
                    onChange={(v) => setProfile({ ...profile, sex: v as AthleteProfileLite["sex"] })}
                    options={[
                      { value: "prefer_not", label: "Prefer not to say" },
                      { value: "female", label: "Female" },
                      { value: "male", label: "Male" },
                      { value: "other", label: "Other" },
                    ]}
                  />
                  <Input label="Age">
                    <input
                      type="number"
                      value={profile.age ?? ""}
                      onChange={(e) => setProfile({ ...profile, age: e.target.value ? +e.target.value : undefined })}
                      placeholder="32"
                      className="w-full bg-transparent outline-none text-sm"
                    />
                  </Input>
                  <Input label="Height (cm, optional)">
                    <input
                      type="number"
                      value={profile.heightCm ?? ""}
                      onChange={(e) => setProfile({ ...profile, heightCm: e.target.value ? +e.target.value : undefined })}
                      placeholder="178"
                      className="w-full bg-transparent outline-none text-sm"
                    />
                  </Input>
                  <Input label="Weight (kg, optional)">
                    <input
                      type="number"
                      value={profile.weightKg ?? ""}
                      onChange={(e) => setProfile({ ...profile, weightKg: e.target.value ? +e.target.value : undefined })}
                      placeholder="76"
                      className="w-full bg-transparent outline-none text-sm"
                    />
                  </Input>
                  <Select
                    label="Training age"
                    value={profile.trainingAge}
                    onChange={(v) => setProfile({ ...profile, trainingAge: v as AthleteProfileLite["trainingAge"] })}
                    options={[
                      { value: "beginner", label: "Beginner (<1 year)" },
                      { value: "intermediate", label: "Intermediate (1–3 years)" },
                      { value: "advanced", label: "Advanced (3–7 years)" },
                      { value: "elite", label: "Elite (7+ years)" },
                    ]}
                  />
                </div>

                <div className="mt-6">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Training background</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {([
                      { v: "crossfit", label: "CrossFit" },
                      { v: "hyrox", label: "HYROX" },
                      { v: "athx", label: "ATHX" },
                      { v: "running", label: "Running" },
                      { v: "gym", label: "Traditional gym" },
                      { v: "general", label: "General fitness" },
                      { v: "beginner", label: "Beginner" },
                    ] as { v: Background; label: string }[]).map((b) => (
                      <button
                        key={b.v}
                        onClick={() => setProfile({ ...profile, background: b.v })}
                        className={`py-2.5 px-3 rounded-md border text-sm font-medium transition ${
                          profile.background === b.v
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border hover:bg-secondary"
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              </StepWrapper>
            )}

            {step === 1 && (
              <StepWrapper
                icon={Calendar}
                title="Your training availability"
                subtitle="We use this to schedule realistic sessions you can actually do."
              >
                <div className="grid sm:grid-cols-3 gap-4">
                  <Input label="Sessions per week">
                    <input
                      type="number"
                      min={2}
                      max={7}
                      value={preferences.daysPerWeek}
                      onChange={(e) => setPreferences({ ...preferences, daysPerWeek: Math.max(2, Math.min(7, +e.target.value || 4)) })}
                      className="w-full bg-transparent outline-none text-sm"
                    />
                  </Input>
                  <Input label="Session length (min)">
                    <input
                      type="number"
                      min={20}
                      max={180}
                      step={5}
                      value={preferences.sessionMinutes}
                      onChange={(e) => setPreferences({ ...preferences, sessionMinutes: +e.target.value || 60 })}
                      className="w-full bg-transparent outline-none text-sm"
                    />
                  </Input>
                  <Select
                    label="Training location"
                    value={preferences.location}
                    onChange={(v) => setPreferences({ ...preferences, location: v as AthletePreferencesLite["location"] })}
                    options={[
                      { value: "full_gym", label: "Full gym" },
                      { value: "crossfit_box", label: "CrossFit box" },
                      { value: "home_gym", label: "Home gym" },
                      { value: "track", label: "Running track" },
                      { value: "outdoors", label: "Outdoors" },
                    ]}
                  />
                </div>

                <div className="mt-6">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Preferred training days</div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => {
                      const selected = preferences.preferredDays.includes(i);
                      return (
                        <button
                          key={i}
                          onClick={() =>
                            setPreferences({
                              ...preferences,
                              preferredDays: selected
                                ? preferences.preferredDays.filter((x) => x !== i)
                                : [...preferences.preferredDays, i],
                            })
                          }
                          className={`py-2.5 rounded-md text-xs font-medium border transition ${
                            selected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:bg-secondary"
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Available equipment</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {([
                      { v: "full_gym", label: "Full gym" },
                      { v: "crossfit_box", label: "CrossFit box" },
                      { v: "home_gym", label: "Home gym" },
                      { v: "running_track", label: "Running track" },
                      { v: "skierg", label: "SkiErg" },
                      { v: "rowerg", label: "RowErg" },
                      { v: "sled", label: "Sled" },
                      { v: "assault_bike", label: "Assault bike" },
                      { v: "dumbbells", label: "Dumbbells" },
                      { v: "kettlebells", label: "Kettlebells" },
                      { v: "barbells", label: "Barbells" },
                      { v: "wall_balls", label: "Wall balls" },
                      { v: "sandbag", label: "Sandbag" },
                      { v: "farmers_handles", label: "Farmers handles" },
                    ] as { v: Equipment; label: string }[]).map((e) => {
                      const selected = preferences.equipment.includes(e.v);
                      return (
                        <button
                          key={e.v}
                          onClick={() =>
                            setPreferences({
                              ...preferences,
                              equipment: selected
                                ? preferences.equipment.filter((x) => x !== e.v)
                                : [...preferences.equipment, e.v],
                            })
                          }
                          className={`py-2 px-3 rounded-md border text-sm transition flex items-center gap-2 ${
                            selected ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded border grid place-items-center ${selected ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                            {selected && <Check className="w-2.5 h-2.5" />}
                          </span>
                          {e.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6">
                  <Input label="Injuries or limitations (optional)">
                    <input
                      value={preferences.injuries ?? ""}
                      onChange={(e) => setPreferences({ ...preferences, injuries: e.target.value })}
                      placeholder="e.g. right knee meniscus, avoid heavy squatting"
                      className="w-full bg-transparent outline-none text-sm"
                    />
                  </Input>
                </div>
              </StepWrapper>
            )}

            {step === 2 && (
              <StepWrapper
                icon={Activity}
                title="Benchmarks (optional)"
                subtitle="Add what you know. Skip what you don't — you can record results later."
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <BenchmarkInput label="5 km run time" placeholder="22:30" unit="mm:ss" valueFormat="time"
                    onChange={(v) => setBenchmarks((b) => ({ ...b, fiveKmSec: v }))} />
                  <BenchmarkInput label="10 km run time" placeholder="48:00" unit="mm:ss" valueFormat="time"
                    onChange={(v) => setBenchmarks((b) => ({ ...b, tenKmSec: v }))} />
                  <BenchmarkInput label="1 km pace" placeholder="4:30" unit="mm:ss/km" valueFormat="time"
                    onChange={(v) => setBenchmarks((b) => ({ ...b, oneKmPaceSec: v }))} />
                  <BenchmarkInput label="Back squat 1RM (kg)" placeholder="100" unit="kg"
                    onChange={(v) => setBenchmarks((b) => ({ ...b, backSquatKg: v }))} />
                  <BenchmarkInput label="Deadlift 1RM (kg)" placeholder="140" unit="kg"
                    onChange={(v) => setBenchmarks((b) => ({ ...b, deadliftKg: v }))} />
                  <BenchmarkInput label="Strict press 1RM (kg)" placeholder="55" unit="kg"
                    onChange={(v) => setBenchmarks((b) => ({ ...b, strictPressKg: v }))} />
                  <BenchmarkInput label="2 km row time" placeholder="7:30" unit="mm:ss" valueFormat="time"
                    onChange={(v) => setBenchmarks((b) => ({ ...b, row2kSec: v }))} />
                  <BenchmarkInput label="1 km SkiErg" placeholder="3:30" unit="mm:ss" valueFormat="time"
                    onChange={(v) => setBenchmarks((b) => ({ ...b, skierg1kSec: v }))} />
                  <BenchmarkInput label="Fran (time)" placeholder="3:45" unit="mm:ss" valueFormat="time"
                    onChange={(v) => setBenchmarks((b) => ({ ...b, franSec: v }))} />
                  <BenchmarkInput label="Grace (time)" placeholder="2:30" unit="mm:ss" valueFormat="time"
                    onChange={(v) => setBenchmarks((b) => ({ ...b, graceSec: v }))} />
                </div>

                <div className="mt-6 p-4 rounded-md border border-border bg-secondary/30">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Previous results (optional)</div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <BenchmarkInput label="Previous HYROX finish" placeholder="1:18:30" unit="h:mm:ss" valueFormat="longtime"
                      onChange={(v) => setBenchmarks((b) => ({ ...b, priorHyroxFinishSec: v }))} />
                    <BenchmarkInput label="Previous ATHX FitScore" placeholder="68" unit="/100"
                      onChange={(v) => setBenchmarks((b) => ({ ...b, priorAthxScore: v }))} />
                  </div>
                </div>
              </StepWrapper>
            )}

            {step === 3 && (
              <StepWrapper
                icon={Target}
                title="What's your primary goal?"
                subtitle="This shapes your starting training mode and periodisation."
              >
                <div className="grid sm:grid-cols-2 gap-3">
                  {([
                    { v: "first_competition", label: "Complete first competition", body: "Build fitness and confidence for a first HYROX, ATHX or local event." },
                    { v: "improve_time", label: "Improve finishing time", body: "You've competed before and want to go faster." },
                    { v: "improve_strength", label: "Improve strength", body: "Strength is your bottleneck; focus on lifts and loaded movements." },
                    { v: "improve_endurance", label: "Improve endurance", body: "Build aerobic capacity and threshold running." },
                    { v: "improve_overall", label: "Improve overall fitness", body: "Balanced development across all dimensions." },
                    { v: "compete_advanced", label: "Compete at advanced level", body: "Targeting a podium or age-group placing." },
                  ] as { v: GoalFocus; label: string; body: string }[]).map((g) => (
                    <button
                      key={g.v}
                      onClick={() => setGoal(g.v)}
                      className={`p-4 rounded-md border text-left transition ${
                        goal === g.v ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 grid place-items-center ${goal === g.v ? "border-primary" : "border-border"}`}>
                          {goal === g.v && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        </div>
                        <div className="font-semibold">{g.label}</div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1.5 pl-6">{g.body}</div>
                    </button>
                  ))}
                </div>
              </StepWrapper>
            )}

            {step === 4 && (
              <StepWrapper
                icon={Trophy}
                title="Upcoming competition?"
                subtitle="Add a competition date so we can build your countdown and taper."
              >
                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={() => setCompetition({ ...competition, enabled: true })}
                    className={`flex-1 p-4 rounded-md border text-left transition ${
                      competition.enabled ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"
                    }`}
                  >
                    <div className="font-semibold text-sm">Yes, I have an event</div>
                    <div className="text-xs text-muted-foreground mt-1">We'll build a countdown and taper plan.</div>
                  </button>
                  <button
                    onClick={() => setCompetition({ ...competition, enabled: false })}
                    className={`flex-1 p-4 rounded-md border text-left transition ${
                      !competition.enabled ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"
                    }`}
                  >
                    <div className="font-semibold text-sm">Not yet</div>
                    <div className="text-xs text-muted-foreground mt-1">We'll start in Maintenance mode.</div>
                  </button>
                </div>

                {competition.enabled && (
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-3 gap-4">
                      <Select
                        label="Format"
                        value={competition.format}
                        onChange={(v) => setCompetition({ ...competition, format: v as TrainingMode })}
                        options={[
                          { value: "hyrox", label: "HYROX" },
                          { value: "athx", label: "ATHX" },
                          { value: "crossfit", label: "CrossFit comp" },
                        ]}
                      />
                      <Input label="Event name">
                        <input
                          value={competition.name}
                          onChange={(e) => setCompetition({ ...competition, name: e.target.value })}
                          placeholder="HYROX London 2027"
                          className="w-full bg-transparent outline-none text-sm"
                        />
                      </Input>
                      <Input label="Date">
                        <input
                          type="date"
                          value={competition.date}
                          onChange={(e) => setCompetition({ ...competition, date: e.target.value })}
                          className="w-full bg-transparent outline-none text-sm"
                        />
                      </Input>
                    </div>
                    {competition.format === "hyrox" && (
                      <Select
                        label="Division"
                        value={competition.division ?? "open"}
                        onChange={(v) => setCompetition({ ...competition, division: v })}
                        options={HYROX_DIVISIONS.map((d) => ({ value: d.slug, label: d.name }))}
                      />
                    )}
                  </div>
                )}
              </StepWrapper>
            )}

            {step === 5 && (
              <StepWrapper
                icon={Check}
                title="Review and build your profile"
                subtitle="This generates your initial plan and athlete dashboard."
              >
                <div className="space-y-3">
                  <ReviewRow label="Athlete" value={profile.displayName || "—"} />
                  <ReviewRow label="Background" value={profile.background} />
                  <ReviewRow label="Training age" value={profile.trainingAge} />
                  <ReviewRow label="Sessions / week" value={`${preferences.daysPerWeek} × ${preferences.sessionMinutes} min`} />
                  <ReviewRow label="Equipment" value={`${preferences.equipment.length} items`} />
                  <ReviewRow
                    label="Benchmarks recorded"
                    value={Object.values(benchmarks).filter((v) => v !== undefined && v !== null && !Number.isNaN(v)).length.toString()}
                  />
                  <ReviewRow label="Primary goal" value={goal.replace(/_/g, " ")} />
                  <ReviewRow
                    label="Competition"
                    value={
                      competition.enabled
                        ? `${competition.format.toUpperCase()} — ${competition.name || "Upcoming"}${competition.date ? ` (${competition.date})` : ""}`
                        : "Maintenance to start"
                    }
                  />
                </div>

                <div className="mt-6 p-4 rounded-md border border-border bg-secondary/30 text-sm text-muted-foreground">
                  Your starting training mode will be{" "}
                  <span className="text-foreground font-semibold">
                    {competition.enabled ? competition.format.toUpperCase() : "Maintenance"}
                  </span>
                  . You can switch anytime without losing history.
                </div>
              </StepWrapper>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Footer nav */}
        <div className="mt-10 flex items-center justify-between">
          <button
            onClick={back}
            disabled={step === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium border border-border hover:bg-secondary transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button
            onClick={next}
            disabled={!canNext}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {step === TOTAL_STEPS - 1 ? "Build profile" : "Continue"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StepWrapper({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-md bg-primary/10 text-primary grid place-items-center">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <div className="text-sm text-muted-foreground mt-0.5">{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Input({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted-foreground mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </div>
      <div className="px-3 py-2.5 rounded-md border border-border bg-secondary/30 focus-within:border-foreground/40 transition">
        {children}
      </div>
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted-foreground mb-1.5">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-md border border-border bg-secondary/30 text-sm focus:outline-none focus:border-foreground/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function parseTime(value: string): number | undefined {
  // "mm:ss" or "h:mm:ss" -> seconds
  if (!value) return undefined;
  const parts = value.split(":").map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return undefined;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return undefined;
}

function BenchmarkInput({
  label,
  placeholder,
  unit,
  valueFormat = "number",
  onChange,
}: {
  label: string;
  placeholder?: string;
  unit?: string;
  valueFormat?: "time" | "longtime" | "number";
  onChange: (v: number | undefined) => void;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted-foreground mb-1.5">{label}</div>
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-border bg-secondary/30 focus-within:border-foreground/40 transition">
        <input
          type="text"
          placeholder={placeholder}
          onChange={(e) => {
            const v = valueFormat === "number" ? parseFloat(e.target.value) : parseTime(e.target.value);
            onChange(v === undefined || Number.isNaN(v) ? undefined : v);
          }}
          className="flex-1 bg-transparent outline-none text-sm tabular-nums"
        />
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-sm font-medium capitalize">{value}</div>
    </div>
  );
}
