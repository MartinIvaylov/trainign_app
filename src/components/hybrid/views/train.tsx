"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/store/app-store";
import { Card, PageHeader, Pill, SectionTitle, EmptyState } from "@/components/hybrid/blocks/ui";
import { MODE_META, WorkoutLogLite } from "@/types";
import { CROSSFIT_BENCHMARKS, WOD_TIMER_PRESETS, TimerSlug } from "@/lib/competition-rules/crossfit";
import { formatHMS } from "@/lib/competition-rules/hyrox";
import { motion } from "framer-motion";
import {
  Play, Pause, RotateCcw, Check, ChevronRight, Dumbbell, Timer as TimerIcon,
  X, Plus, Activity, Flag,
} from "lucide-react";

type TimerKind = "for_time" | "amrap" | "emom" | "tabata" | "intervals" | "strength";

export function TrainView() {
  const [active, setActive] = useState<{ kind: TimerKind; config: any } | null>(null);
  const setAppView = useApp((s) => s.setAppView);
  const sessions = useApp((s) => s.sessions);
  const pushToast = useApp((s) => s.pushToast);

  const today = new Date();
  const todays = sessions.find((s) => new Date(s.date).toDateString() === today.toDateString());

  if (active) {
    return (
      <ActiveWorkout
        kind={active.kind}
        config={active.config}
        sessionTitle={todays?.title}
        onExit={() => setActive(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Train"
        subtitle="Distraction-free workout execution with native-feeling timers."
      />

      {/* Today's session */}
      {todays && (
        <Card>
          <SectionTitle hint="From your plan">Today's session</SectionTitle>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: MODE_META[todays.mode].color }} />
                {MODE_META[todays.mode].name} · {todays.type.replace("_", " ")}
              </div>
              <h3 className="text-lg font-bold">{todays.title}</h3>
              {todays.notes && <p className="text-sm text-muted-foreground mt-2">{todays.notes}</p>}
            </div>
            <button
              onClick={() => {
                const kind = inferKind(todays.type);
                setActive({ kind, config: buildConfig(kind, todays) });
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
            >
              <Play className="w-4 h-4" /> Start session
            </button>
          </div>
        </Card>
      )}

      {/* Quick timers */}
      <div>
        <SectionTitle hint="Standalone timers">Quick start</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {WOD_TIMER_PRESETS.map((p) => (
            <button
              key={p.slug}
              onClick={() => {
                const kind = p.slug as TimerKind;
                setActive({ kind, config: buildConfig(kind, null) });
              }}
              className="p-3 rounded-md border border-border hover:bg-secondary transition text-left"
            >
              <div className="font-semibold text-sm">{p.name}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Benchmarks library */}
      <Card>
        <SectionTitle hint="CrossFit benchmarks">Run a benchmark</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {CROSSFIT_BENCHMARKS.map((b) => (
            <button
              key={b.slug}
              onClick={() => setActive({
                kind: b.type === "amrap" ? "amrap" : "for_time",
                config: {
                  title: b.name,
                  durationSec: b.cap ? b.cap * 60 : undefined,
                  movements: b.movements,
                  rx: b.rx,
                  description: b.description,
                },
              })}
              className="p-3 rounded-md border border-border hover:border-foreground/30 hover:bg-secondary transition text-left"
            >
              <div className="font-semibold text-sm">{b.name}</div>
              <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">
                {b.type.replace("_", " ")}{b.cap ? ` · ${b.cap}m cap` : ""}
              </div>
            </button>
          ))}
        </div>
      </Card>

      <EmptyState
        title="Build a custom session"
        body="Quick start any timer above. Logs are saved automatically with RPE and notes."
        action={
          <button
            onClick={() => setAppView("workouts")}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-secondary transition"
          >
            Browse workout library <ChevronRight className="w-4 h-4" />
          </button>
        }
      />
    </div>
  );
}

function inferKind(type: string): TimerKind {
  if (type === "amrap") return "amrap";
  if (type === "emom") return "emom";
  if (type === "tabata") return "tabata";
  if (type === "interval") return "intervals";
  if (type === "strength") return "strength";
  return "for_time";
}

function buildConfig(kind: TimerKind, session: any): any {
  const base = {
    title: session?.title ?? "Workout",
    durationSec: session?.durationMin ? session.durationMin * 60 : 600,
  };
  if (kind === "amrap") return { ...base, durationSec: 20 * 60 };
  if (kind === "emom") return { ...base, durationSec: 12 * 60, intervalSec: 60 };
  if (kind === "tabata") return { ...base, workSec: 20, restSec: 10, rounds: 8 };
  if (kind === "intervals") return { ...base, workSec: 60, restSec: 60, rounds: 8 };
  if (kind === "strength") return { ...base, movements: ["Back Squat", "RDL", "Press"] };
  return { ...base };
}

// =========================================================================
// Active workout execution
// =========================================================================

function ActiveWorkout({
  kind, config, sessionTitle, onExit,
}: {
  kind: TimerKind;
  config: any;
  sessionTitle?: string;
  onExit: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            {kind.replace("_", " ")}
          </div>
          <h1 className="text-display text-2xl">{config.title ?? sessionTitle ?? "Workout"}</h1>
        </div>
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-secondary transition"
        >
          <X className="w-3.5 h-3.5" /> Exit
        </button>
      </div>

      <TimerView kind={kind} config={config} />

      {config.movements && (
        <Card>
          <SectionTitle hint={config.rx ? `RX: ${config.rx.men}` : ""}>Movements</SectionTitle>
          <div className="space-y-2">
            {config.movements.map((m: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-secondary grid place-items-center text-xs font-bold">{i + 1}</div>
                  <div>
                    <div className="font-medium text-sm">{m.name}</div>
                    {m.reps && <div className="text-xs text-muted-foreground">{m.reps}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {config.description && (
        <Card>
          <SectionTitle>Workout description</SectionTitle>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </Card>
      )}
    </div>
  );
}

function TimerView({ kind, config }: { kind: TimerKind; config: any }) {
  const [elapsed, setElapsed] = useState(0); // seconds elapsed
  const [running, setRunning] = useState(false);
  const [rpe, setRpe] = useState(7);
  const [result, setResult] = useState("");
  const [reps, setReps] = useState(0);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [forceDone, setForceDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSec = config.durationSec ?? 600;
  const workSec = config.workSec ?? 60;
  const restSec = config.restSec ?? 60;
  const rounds = config.rounds ?? 8;
  const intervalSec = config.intervalSec ?? 60;

  // Tick — auto-stop when reaching done state
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        // Compute done boundary for current kind
        let doneBoundary = Infinity;
        if (kind === "amrap" || kind === "for_time") doneBoundary = totalSec;
        else if (kind === "tabata" || kind === "intervals") doneBoundary = (workSec + restSec) * rounds;
        else if (kind === "emom") doneBoundary = totalSec;
        if (next >= doneBoundary) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return doneBoundary === Infinity ? next : doneBoundary;
        }
        return next;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, kind, totalSec, workSec, restSec, rounds]);

  // Derived phase & round (no setState in effect)
  const { phase, round } = useMemo(() => {
    if (forceDone) return { phase: "done" as const, round: 1 };
    if (kind === "tabata" || kind === "intervals") {
      const cycleLen = workSec + restSec;
      const r = Math.floor(elapsed / cycleLen) + 1;
      if (r > rounds) return { phase: "done" as const, round: rounds };
      const pos = elapsed % cycleLen;
      return { phase: (pos < workSec ? "work" : "rest") as "work" | "rest", round: r };
    }
    if (kind === "emom") {
      const r = Math.floor(elapsed / intervalSec) + 1;
      if (r > totalSec / intervalSec) return { phase: "done" as const, round: r - 1 };
      return { phase: "work" as const, round: r };
    }
    if (kind === "amrap" || kind === "for_time") {
      if (elapsed >= totalSec) return { phase: "done" as const, round: 1 };
      return { phase: "work" as const, round: 1 };
    }
    return { phase: "work" as const, round: 1 };
  }, [elapsed, kind, workSec, restSec, rounds, intervalSec, totalSec, forceDone]);

  function toggleRun() {
    if (phase === "done") return;
    setRunning((r) => !r);
  }

  function reset() {
    setElapsed(0); setRunning(false); setReps(0); setResult(""); setSaved(false); setForceDone(false);
  }

  function save() {
    const addLog = useApp.getState().addLog;
    const addPR = useApp.getState().addPR;
    let res = result;
    if (kind === "amrap") res = `${reps} reps`;
    if (kind === "for_time" || kind === "tabata" || kind === "intervals") res = formatHMS(elapsed);
    addLog({
      date: new Date().toISOString(),
      mode: useApp.getState().activeMode,
      type: kind,
      title: config.title ?? "Workout",
      durationSec: elapsed,
      rpe,
      result: res,
      rxScaled: "rx",
      notes: notes || undefined,
      completed: true,
    });
    setSaved(true);
    useApp.getState().pushToast({
      kind: "success",
      title: "Workout saved",
      body: `${config.title} — ${res || formatHMS(elapsed)}`,
    });
  }

  // Display
  const displaySec = kind === "amrap" ? Math.max(0, totalSec - elapsed) : elapsed;
  const phaseLabel = kind === "tabata" || kind === "intervals"
    ? phase === "work" ? "WORK" : phase === "rest" ? "REST" : "DONE"
    : kind === "emom"
    ? `ROUND ${round}`
    : kind === "amrap"
    ? elapsed >= totalSec ? "DONE" : "AMRAP"
    : "FOR TIME";

  const progressPct =
    kind === "amrap" || kind === "for_time"
      ? (elapsed / totalSec) * 100
      : ((round - 1) / rounds) * 100 + ((phase === "rest" ? workSec : elapsed % (workSec + restSec)) / (workSec + restSec)) * (100 / rounds);

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
          {phaseLabel}
        </div>
        <motion.div
          key={phase}
          initial={{ scale: 0.98, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-stat text-7xl sm:text-8xl tabular-nums"
          style={{
            color: phase === "work" ? "var(--primary)" : phase === "rest" ? "var(--maint)" : phase === "done" ? "var(--success)" : "var(--foreground)",
          }}
        >
          {formatHMS(displaySec)}
        </motion.div>

        {(kind === "tabata" || kind === "intervals" || kind === "emom") && (
          <div className="mt-4 text-sm text-muted-foreground">
            Round <span className="font-bold text-foreground">{Math.min(round, rounds)}</span> of {rounds}
          </div>
        )}

        {/* Progress bar */}
        <div className="mt-6 w-full max-w-md">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, progressPct)}%`,
                background: phase === "work" ? "var(--primary)" : phase === "rest" ? "var(--maint)" : "var(--success)",
              }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={reset}
            className="w-12 h-12 rounded-full border border-border hover:bg-secondary transition grid place-items-center"
            aria-label="Reset"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={toggleRun}
            disabled={phase === "done"}
            className="w-20 h-20 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition grid place-items-center disabled:opacity-40"
            aria-label={running ? "Pause" : "Start"}
          >
            {running ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
          </button>
          <button
            onClick={() => { setForceDone(true); setRunning(false); }}
            className="w-12 h-12 rounded-full border border-border hover:bg-secondary transition grid place-items-center"
            aria-label="Finish"
          >
            <Flag className="w-5 h-5" />
          </button>
        </div>

        {/* AMRAP rep counter */}
        {kind === "amrap" && (
          <div className="mt-8 w-full max-w-md">
            <div className="text-xs font-medium text-muted-foreground mb-2">Rep counter</div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setReps((r) => Math.max(0, r - 1))}
                className="w-12 h-12 rounded-md border border-border text-xl font-bold hover:bg-secondary"
              >
                −
              </button>
              <div className="text-stat text-5xl w-24 tabular-nums">{reps}</div>
              <button
                onClick={() => setReps((r) => r + 1)}
                className="w-12 h-12 rounded-md border border-border text-xl font-bold hover:bg-secondary"
              >
                +
              </button>
              <button
                onClick={() => setReps((r) => r + 5)}
                className="px-3 h-12 rounded-md border border-border text-sm font-medium hover:bg-secondary"
              >
                +5
              </button>
            </div>
          </div>
        )}

        {/* Strength tracking */}
        {kind === "strength" && (
          <div className="mt-8 w-full max-w-md">
            <StrengthTracker />
          </div>
        )}

        {/* Finish form */}
        {phase === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 w-full max-w-md space-y-4"
          >
            <div className="text-sm font-semibold text-success flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> Workout complete
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">RPE — {rpe}/10</div>
              <input
                type="range" min={1} max={10} value={rpe}
                onChange={(e) => setRpe(+e.target.value)}
                className="w-full"
              />
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">Result</div>
              <input
                value={result}
                onChange={(e) => setResult(e.target.value)}
                placeholder={kind === "amrap" ? `${reps} reps` : "12:34 / 5 rounds + 12 / 5×5 @ 100kg"}
                className="w-full px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none"
              />
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1.5">Notes (optional)</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="How did this feel?"
                className="w-full px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none resize-none"
              />
            </div>

            <button
              onClick={save}
              disabled={saved}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {saved ? <><Check className="w-4 h-4" /> Saved</> : "Save workout"}
            </button>
          </motion.div>
        )}
      </div>
    </Card>
  );
}

function StrengthTracker() {
  const [sets, setSets] = useState<{ weight: string; reps: string; done: boolean }[]>([
    { weight: "", reps: "", done: false },
  ]);
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-2">Set tracking</div>
      <div className="space-y-1.5">
        {sets.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-6 text-xs text-muted-foreground font-medium">#{i + 1}</div>
            <input
              type="number"
              value={s.weight}
              onChange={(e) => setSets((prev) => prev.map((p, idx) => idx === i ? { ...p, weight: e.target.value } : p))}
              placeholder="kg"
              className="flex-1 px-2 py-1.5 rounded-md border border-border bg-secondary/30 text-sm outline-none w-16"
            />
            <span className="text-xs text-muted-foreground">×</span>
            <input
              type="number"
              value={s.reps}
              onChange={(e) => setSets((prev) => prev.map((p, idx) => idx === i ? { ...p, reps: e.target.value } : p))}
              placeholder="reps"
              className="flex-1 px-2 py-1.5 rounded-md border border-border bg-secondary/30 text-sm outline-none w-16"
            />
            <button
              onClick={() => setSets((prev) => prev.map((p, idx) => idx === i ? { ...p, done: !p.done } : p))}
              className={`w-7 h-7 rounded-md grid place-items-center border ${s.done ? "bg-success text-white border-success" : "border-border"}`}
            >
              {s.done && <Check className="w-4 h-4" />}
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => setSets((prev) => [...prev, { weight: "", reps: "", done: false }])}
        className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus className="w-3 h-3" /> Add set
      </button>
    </div>
  );
}
