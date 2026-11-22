"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/store/app-store";
import { Card, PageHeader, SectionTitle, Pill, EmptyState, MiniBar } from "@/components/hybrid/blocks/ui";
import { MODE_META, ScheduledSession } from "@/types";
import {
  analyzeAthlete, generatePeriodization, generateWeekSessions, BlockPlan,
} from "@/lib/training-engine";
import { motion } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight, Plus, RefreshCw, Check, RotateCw, Activity, Dumbbell } from "lucide-react";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function PlanView() {
  const profile = useApp((s) => s.profile);
  const prefs = useApp((s) => s.preferences);
  const benchmarks = useApp((s) => s.benchmarks);
  const activeMode = useApp((s) => s.activeMode);
  const upcoming = useApp((s) => s.upcomingCompetition);
  const sessions = useApp((s) => s.sessions);
  const setSessions = useApp((s) => s.setSessions);
  const markComplete = useApp((s) => s.markSessionComplete);
  const addCustom = useApp((s) => s.addCustomSession);
  const reschedule = useApp((s) => s.rescheduleSession);
  const pushToast = useApp((s) => s.pushToast);

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedSession, setSelectedSession] = useState<ScheduledSession | null>(null);

  const blocks = useMemo<BlockPlan[]>(() => {
    if (!profile) return [];
    const weaknesses = analyzeAthlete({ benchmarks: benchmarks ?? {}, weightKg: profile?.weightKg });
    const today = new Date();
    const weeksAvailable = upcoming?.date
      ? Math.max(2, Math.round((new Date(upcoming.date).getTime() - today.getTime()) / (7 * 86400 * 1000)))
      : 12;
    return generatePeriodization({
      mode: activeMode,
      weeksAvailable,
      daysPerWeek: prefs?.daysPerWeek ?? 4,
      goal: "improve_overall",
      weaknesses,
    });
  }, [profile, prefs, benchmarks, activeMode, upcoming]);

  function regenerate() {
    const weaknesses = analyzeAthlete({ benchmarks: benchmarks ?? {}, weightKg: profile?.weightKg });
    const generated = generateWeekSessions({
      mode: activeMode,
      phase: blocks[0]?.phase ?? "base",
      preferredDays: prefs?.preferredDays ?? [1, 3, 5, 6],
      focusDimensions: weaknesses.filter((w) => w.severity === "high").map((w) => w.dimension),
    });
    setSessions(generated);
    pushToast({ kind: "success", title: "Plan regenerated", body: `${generated.length} sessions scheduled for this week.` });
  }

  function addRecoveryDay() {
    const dow = 0; // Sunday
    const today = new Date();
    const date = new Date(today);
    date.setDate(today.getDate() + ((7 - today.getDay()) % 7) + weekOffset * 7);
    addCustom({
      date: date.toISOString(),
      dayOfWeek: dow,
      title: "Recovery — Mobility",
      mode: activeMode,
      type: "recovery",
      durationMin: 30,
      intensity: "easy",
      notes: "Foam roll, light mobility, 20 min Z2.",
    });
    pushToast({ kind: "success", title: "Recovery day added" });
  }

  // Build week grid
  const weekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekSessions = useMemo(() => {
    const start = weekStart;
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return sessions.filter((s) => {
      const d = new Date(s.date);
      return d >= start && d < end;
    });
  }, [sessions, weekStart]);

  function getSessionByDay(dayOfWeek: number) {
    return weekSessions.filter((s) => s.dayOfWeek === dayOfWeek);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training plan"
        subtitle={`Active focus: ${MODE_META[activeMode].name} · ${prefs?.daysPerWeek ?? 4} sessions/week`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={regenerate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-secondary transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </button>
            <button
              onClick={addRecoveryDay}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add session
            </button>
          </div>
        }
      />

      {/* Periodisation blocks */}
      {blocks.length > 0 && (
        <Card>
          <SectionTitle hint={`${blocks.reduce((a, b) => a + b.weeks, 0)} weeks total`}>Periodisation blocks</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {blocks.map((b) => (
              <div
                key={b.index}
                className="p-3 rounded-md border border-border hover:border-foreground/30 transition"
              >
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                  Block {b.index + 1}
                </div>
                <div className="mt-1.5 font-semibold capitalize">{b.phase}</div>
                <div className="text-xs text-muted-foreground mt-1">{b.weeks} weeks · {b.sessionsPerWeek}/wk</div>
                <div className="text-xs mt-2">{b.focus}</div>
                <div className="mt-2.5">
                  <Pill>{b.intensity}</Pill>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-muted-foreground leading-relaxed">
            {blocks[0]?.description}
          </div>
        </Card>
      )}

      {/* Week view */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold">Week of {weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</h2>
            <div className="text-xs text-muted-foreground mt-0.5">
              {weekSessions.length} sessions · {weekSessions.filter((s) => s.completed).length} completed
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset(weekOffset - 1)}
              className="w-7 h-7 rounded-md border border-border hover:bg-secondary transition grid place-items-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-2.5 py-1 rounded-md border border-border hover:bg-secondary text-xs font-medium transition"
            >
              Today
            </button>
            <button
              onClick={() => setWeekOffset(weekOffset + 1)}
              className="w-7 h-7 rounded-md border border-border hover:bg-secondary transition grid place-items-center"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 min-w-[640px] sm:min-w-0 overflow-x-auto scrollbar-thin">
          {DOW_LABELS.map((dowLabel, dowIdx) => {
            const dayDate = new Date(weekStart);
            dayDate.setDate(weekStart.getDate() + dowIdx);
            const daySess = getSessionByDay(dowIdx);
            const isToday = dayDate.toDateString() === new Date().toDateString();
            return (
              <div key={dowIdx} className={`rounded-md border ${isToday ? "border-primary" : "border-border"} p-2 min-h-32 flex flex-col`}>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground font-medium">{dowLabel}</span>
                  <span className={isToday ? "text-primary font-bold" : "text-muted-foreground"}>{dayDate.getDate()}</span>
                </div>
                <div className="space-y-1.5 flex-1">
                  {daySess.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSession(s)}
                      className={`block w-full text-left p-2 rounded-md text-xs transition border ${
                        s.completed
                          ? "border-success/40 bg-success/10 opacity-70"
                          : "border-border hover:bg-secondary"
                      }`}
                      style={{ borderLeftWidth: 3, borderLeftColor: MODE_META[s.mode].color }}
                    >
                      <div className="font-semibold truncate">{s.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {s.durationMin ? `${s.durationMin}m · ` : ""}{s.intensity ?? ""}
                      </div>
                      {s.completed && (
                        <div className="mt-1 text-[10px] text-success flex items-center gap-1">
                          <Check className="w-3 h-3" /> Done
                        </div>
                      )}
                    </button>
                  ))}
                  {daySess.length === 0 && (
                    <div className="text-[10px] text-muted-foreground italic">Rest</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Selected session detail */}
      {selectedSession && (
        <SessionDetail
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onComplete={(rpe, result) => {
            markComplete(selectedSession.id, { rpe, result });
            setSelectedSession(null);
            pushToast({ kind: "success", title: "Session completed", body: `Logged with RPE ${rpe}/10.` });
          }}
          onReschedule={(newDate) => {
            reschedule(selectedSession.id, newDate);
            setSelectedSession(null);
            pushToast({ kind: "info", title: "Session rescheduled" });
          }}
        />
      )}

      {/* Empty state */}
      {sessions.length === 0 && (
        <EmptyState
          title="No sessions yet"
          body="Generate your initial training plan from your benchmarks, goals, and equipment. You can always adjust afterwards."
          action={
            <button
              onClick={regenerate}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
            >
              <RefreshCw className="w-4 h-4" /> Generate plan
            </button>
          }
        />
      )}

      {/* Monthly overview */}
      <Card>
        <SectionTitle hint="Next 30 days">Monthly overview</SectionTitle>
        <MonthlyHeatmap sessions={sessions} />
      </Card>
    </div>
  );
}

function SessionDetail({
  session, onClose, onComplete, onReschedule,
}: {
  session: ScheduledSession;
  onClose: () => void;
  onComplete: (rpe: number, result?: string) => void;
  onReschedule: (newDate: string) => void;
}) {
  const [rpe, setRpe] = useState(7);
  const [result, setResult] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState(session.date.slice(0, 10));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span className="w-2 h-2 rounded-full" style={{ background: MODE_META[session.mode].color }} />
            {MODE_META[session.mode].name} · {session.type.replace("_", " ")}
          </div>
          <h3 className="text-lg font-bold tracking-tight">{session.title}</h3>
          <div className="text-xs text-muted-foreground mt-1">
            {new Date(session.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            {session.durationMin && ` · ${session.durationMin} min`}
            {session.intensity && ` · ${session.intensity} intensity`}
          </div>
        </div>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
      </div>

      {session.notes && (
        <div className="p-3 rounded-md bg-secondary/30 text-sm text-muted-foreground mb-4">
          {session.notes}
        </div>
      )}

      {session.completed ? (
        <div className="p-3 rounded-md border border-success/40 bg-success/10 text-sm">
          <div className="font-semibold text-success flex items-center gap-1.5">
            <Check className="w-4 h-4" /> Completed
          </div>
          {session.result && <div className="text-xs text-muted-foreground mt-1">Result: {session.result}</div>}
          {session.rpe && <div className="text-xs text-muted-foreground">RPE: {session.rpe}/10</div>}
        </div>
      ) : (
        <>
          <div className="mb-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">RPE (effort) — {rpe}/10</div>
            <input
              type="range"
              min={1}
              max={10}
              value={rpe}
              onChange={(e) => setRpe(+e.target.value)}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>Easy</span><span>Moderate</span><span>Hard</span><span>Max</span>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-xs font-medium text-muted-foreground mb-1.5">Result (optional)</div>
            <input
              value={result}
              onChange={(e) => setResult(e.target.value)}
              placeholder="e.g. 22:30, 187 reps, 5×5 @ 100kg"
              className="w-full px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none focus:border-foreground/40"
            />
          </div>

          {showReschedule ? (
            <div className="flex items-center gap-2 mb-4">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none"
              />
              <button
                onClick={() => onReschedule(new Date(newDate).toISOString())}
                className="px-3 py-2 rounded-md border border-border text-xs font-medium hover:bg-secondary"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowReschedule(false)}
                className="px-3 py-2 rounded-md text-xs text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowReschedule(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
            >
              <RotateCw className="w-3.5 h-3.5" /> Reschedule
            </button>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => onComplete(rpe, result || undefined)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
            >
              <Check className="w-4 h-4" /> Mark complete
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}

function MonthlyHeatmap({ sessions }: { sessions: ScheduledSession[] }) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  start.setDate(start.getDate() - 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 35);

  const days: Date[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  function intensityFor(date: Date): number {
    return sessions.filter((s) => new Date(s.date).toDateString() === date.toDateString()).length;
  }

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {DOW_LABELS.map((d) => (
        <div key={d} className="text-[10px] text-muted-foreground text-center font-medium">{d}</div>
      ))}
      {days.map((d, i) => {
        const count = intensityFor(d);
        const isThisMonth = d.getMonth() === today.getMonth();
        const isToday = d.toDateString() === today.toDateString();
        return (
          <div
            key={i}
            className={`aspect-square rounded-md text-[10px] p-1 flex flex-col ${
              isToday ? "border-2 border-primary" : ""
            } ${
              count === 0
                ? "bg-secondary/40"
                : count === 1
                ? "bg-primary/30"
                : count === 2
                ? "bg-primary/60"
                : "bg-primary"
            } ${!isThisMonth ? "opacity-40" : ""}`}
          >
            <div className="font-semibold">{d.getDate()}</div>
            {count > 0 && (
              <div className="mt-auto text-primary-foreground">{count}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
