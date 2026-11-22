"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/store/app-store";
import { Card, PageHeader, Pill, SectionTitle, StatCard, EmptyState, MiniBar } from "@/components/hybrid/blocks/ui";
import { MODE_META, TrainingMode, ScheduledSession } from "@/types";
import { analyzeAthlete, generatePeriodization, generateWeekSessions } from "@/lib/training-engine";
import { formatHMS } from "@/lib/competition-rules/hyrox";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Search, Send, Check, X, Dumbbell, Calendar, BarChart3,
  AlertCircle, ClipboardList, UserPlus, ChevronRight, FileText, RotateCcw, Trash2,
} from "lucide-react";

interface ManagedAthlete {
  id: string;
  displayName: string;
  mode: TrainingMode;
  daysPerWeek: number;
  benchmarks: {
    fiveKmSec?: number;
    backSquatKg?: number;
    deadliftKg?: number;
    franSec?: number;
  };
  recentRPE: number;
  lastSessionDays: number;
  status: "active" | "pending" | "injured" | "paused";
  sessions: ScheduledSession[];
  notes: string;
  goals: string;
}

const SEED_ATHLETES: ManagedAthlete[] = [
  {
    id: "a1",
    displayName: "Jordan Blake",
    mode: "hyrox",
    daysPerWeek: 5,
    benchmarks: { fiveKmSec: 19 * 60, backSquatKg: 130, deadliftKg: 180, franSec: 240 },
    recentRPE: 7.5,
    lastSessionDays: 1,
    status: "active",
    sessions: [],
    notes: "Strong runner. Needs sled work. Target HYROX London 1:15.",
    goals: "Sub 1:15 HYROX London",
  },
  {
    id: "a2",
    displayName: "Sara Whitfield",
    mode: "athx",
    daysPerWeek: 4,
    benchmarks: { fiveKmSec: 21 * 60, backSquatKg: 95, deadliftKg: 130, franSec: 270 },
    recentRPE: 8.2,
    lastSessionDays: 3,
    status: "active",
    sessions: [],
    notes: "Strength plateau on press. Add accessory work.",
    goals: "ATHX FitScore > 70",
  },
  {
    id: "a3",
    displayName: "Marco Esposito",
    mode: "crossfit",
    daysPerWeek: 5,
    benchmarks: { fiveKmSec: 20 * 60, backSquatKg: 160, deadliftKg: 200, franSec: 200 },
    recentRPE: 6.8,
    lastSessionDays: 0,
    status: "active",
    sessions: [],
    notes: "Open prep going well. Watch shoulders.",
    goals: "CrossFit Open quarterfinals",
  },
  {
    id: "a4",
    displayName: "Elena Popova",
    mode: "maintenance",
    daysPerWeek: 3,
    benchmarks: { fiveKmSec: 24 * 60, backSquatKg: 75, deadliftKg: 110, franSec: 360 },
    recentRPE: 6.0,
    lastSessionDays: 5,
    status: "active",
    sessions: [],
    notes: "Returning from knee niggle. Avoid heavy squatting for 2 weeks.",
    goals: "General fitness + recovery",
  },
  {
    id: "a5",
    displayName: "Karim Abdullah",
    mode: "hyrox",
    daysPerWeek: 4,
    benchmarks: { fiveKmSec: 22 * 60, backSquatKg: 110, deadliftKg: 150, franSec: 280 },
    recentRPE: 7.0,
    lastSessionDays: 2,
    status: "pending",
    sessions: [],
    notes: "New athlete. Pending invitation acceptance.",
    goals: "First HYROX — finish under 1:30",
  },
];

export function CoachDashboardView() {
  const pushToast = useApp((s) => s.pushToast);
  const [athletes, setAthletes] = useState<ManagedAthlete[]>(SEED_ATHLETES);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TrainingMode | "all">("all");
  const [selected, setSelected] = useState<ManagedAthlete | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [programBuilderOpen, setProgramBuilderOpen] = useState(false);

  const filtered = athletes.filter((a) => {
    if (filter !== "all" && a.mode !== filter) return false;
    if (search && !a.displayName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = useMemo(() => {
    const active = athletes.filter((a) => a.status === "active").length;
    const pending = athletes.filter((a) => a.status === "pending").length;
    const avgRPE = athletes.length > 0
      ? athletes.reduce((sum, a) => sum + a.recentRPE, 0) / athletes.length
      : 0;
    const sessionsThisWeek = athletes.reduce((sum, a) => sum + a.daysPerWeek, 0);
    return { active, pending, avgRPE, sessionsThisWeek };
  }, [athletes]);

  function sendInvite(name: string, email: string) {
    if (!name || !email) {
      pushToast({ kind: "warning", title: "Add name and email" });
      return;
    }
    const newAthlete: ManagedAthlete = {
      id: `a-${Date.now()}`,
      displayName: name,
      mode: "hyrox",
      daysPerWeek: 4,
      benchmarks: {},
      recentRPE: 0,
      lastSessionDays: 999,
      status: "pending",
      sessions: [],
      notes: "Pending invitation acceptance.",
      goals: "",
    };
    setAthletes((prev) => [...prev, newAthlete]);
    setInviteOpen(false);
    pushToast({ kind: "success", title: `Invitation sent to ${name}`, body: `Status: pending. They'll appear active when accepted.` });
  }

  function assignProgram(athleteId: string, programName: string, sessions: ScheduledSession[]) {
    setAthletes((prev) => prev.map((a) =>
      a.id === athleteId
        ? { ...a, sessions: [...sessions], notes: `${a.notes}\n\nAssigned: ${programName}` }
        : a
    ));
    pushToast({
      kind: "success",
      title: "Program assigned",
      body: `${programName} — ${sessions.length} sessions scheduled. Athlete will see this in their Plan tab.`,
    });
  }

  function removeAthlete(id: string) {
    setAthletes((prev) => prev.filter((a) => a.id !== id));
    pushToast({ kind: "info", title: "Athlete removed", body: "They will be notified by email." });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coach dashboard"
        subtitle="Manage your athletes, build programs, monitor performance."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setProgramBuilderOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-secondary transition"
            >
              <ClipboardList className="w-3.5 h-3.5" /> Program builder
            </button>
            <button
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition"
            >
              <UserPlus className="w-3.5 h-3.5" /> Invite athlete
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active athletes" value={stats.active} accent="var(--primary)" delta={`${stats.pending} pending`} />
        <StatCard label="Sessions / week (all)" value={stats.sessionsThisWeek} delta="across all athletes" />
        <StatCard label="Avg RPE (roster)" value={stats.avgRPE.toFixed(1)} delta={stats.avgRPE > 8 ? "high load — review" : "in range"} deltaKind={stats.avgRPE > 8 ? "down" : "neutral"} />
        <StatCard label="Coach tier" value="Coach" accent="var(--athx)" delta="verified" />
      </div>

      {/* Filter + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-secondary/30 flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search athletes..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill active={filter === "all"} onClick={() => setFilter("all")}>All</Pill>
          {(["hyrox", "athx", "crossfit", "maintenance"] as TrainingMode[]).map((m) => (
            <Pill key={m} active={filter === m} color={MODE_META[m].color} onClick={() => setFilter(m)}>
              {MODE_META[m].name}
            </Pill>
          ))}
        </div>
      </div>

      {/* Athlete roster */}
      <Card>
        <SectionTitle hint={`${filtered.length} of ${athletes.length} shown`}>Athlete roster</SectionTitle>
        {filtered.length === 0 ? (
          <EmptyState
            title="No athletes match"
            body="Try a different filter or invite a new athlete."
            action={
              <button
                onClick={() => setInviteOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
              >
                <UserPlus className="w-4 h-4" /> Invite athlete
              </button>
            }
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((a) => (
              <AthleteRow
                key={a.id}
                athlete={a}
                onSelect={() => setSelected(a)}
                onRemove={() => removeAthlete(a.id)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Athlete detail modal */}
      <AnimatePresence>
        {selected && (
          <AthleteDetailModal
            athlete={selected}
            onClose={() => setSelected(null)}
            onAssignProgram={(name, sessions) => {
              assignProgram(selected.id, name, sessions);
              setSelected(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Invite modal */}
      <AnimatePresence>
        {inviteOpen && (
          <InviteModal onClose={() => setInviteOpen(false)} onSend={sendInvite} />
        )}
      </AnimatePresence>

      {/* Program builder */}
      <AnimatePresence>
        {programBuilderOpen && (
          <ProgramBuilderModal
            athletes={athletes}
            onClose={() => setProgramBuilderOpen(false)}
            onAssign={assignProgram}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AthleteRow({
  athlete, onSelect, onRemove,
}: {
  athlete: ManagedAthlete;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const statusColor =
    athlete.status === "active" ? "var(--success)" :
    athlete.status === "pending" ? "var(--warning)" :
    athlete.status === "injured" ? "var(--destructive)" :
    "var(--muted-foreground)";

  return (
    <div
      className="flex items-start justify-between gap-3 p-3 rounded-md border border-border hover:bg-secondary/20 transition cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-full bg-secondary grid place-items-center text-sm font-bold shrink-0">
          {athlete.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-medium">{athlete.displayName}</div>
            <Pill color={MODE_META[athlete.mode].color}>{MODE_META[athlete.mode].name}</Pill>
            <span
              className="text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded"
              style={{ background: `color-mix(in oklch, ${statusColor} 15%, transparent)`, color: statusColor }}
            >
              {athlete.status}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span>{athlete.daysPerWeek}/wk</span>
            {athlete.recentRPE > 0 && <span>RPE {athlete.recentRPE}</span>}
            <span>Last session: {athlete.lastSessionDays === 0 ? "today" : athlete.lastSessionDays === 999 ? "—" : `${athlete.lastSessionDays}d ago`}</span>
          </div>
          {athlete.goals && <div className="text-xs mt-1 text-foreground/70 italic">Goal: {athlete.goals}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="text-muted-foreground hover:text-destructive transition"
          aria-label="Remove athlete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  );
}

function AthleteDetailModal({
  athlete, onClose, onAssignProgram,
}: {
  athlete: ManagedAthlete;
  onClose: () => void;
  onAssignProgram: (programName: string, sessions: ScheduledSession[]) => void;
}) {
  const [notes, setNotes] = useState(athlete.notes);

  // Compute weakness analysis for this athlete
  const weaknesses = useMemo(() => analyzeAthlete({
    benchmarks: athlete.benchmarks as any,
  }), [athlete]);

  // Generate a recommended program based on mode
  const recommendedProgram = useMemo(() => {
    const blocks = generatePeriodization({
      mode: athlete.mode,
      weeksAvailable: 8,
      daysPerWeek: athlete.daysPerWeek,
      goal: "improve_overall",
      weaknesses,
    });
    const sessions = generateWeekSessions({
      mode: athlete.mode,
      phase: blocks[0].phase,
      preferredDays: [1, 3, 5, 6].slice(0, athlete.daysPerWeek),
      focusDimensions: weaknesses.filter((w) => w.severity === "high").map((w) => w.dimension),
    });
    return { blocks, sessions, name: `${athlete.mode.toUpperCase()} base block` };
  }, [athlete, weaknesses]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        className="rounded-lg border border-border bg-card max-w-3xl w-full max-h-[85vh] overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-5 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-secondary grid place-items-center font-bold shrink-0">
              {athlete.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight">{athlete.displayName}</h2>
                <Pill color={MODE_META[athlete.mode].color}>{MODE_META[athlete.mode].name}</Pill>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {athlete.daysPerWeek} sessions/week · Last session {athlete.lastSessionDays === 0 ? "today" : athlete.lastSessionDays === 999 ? "—" : `${athlete.lastSessionDays}d ago`}
              </div>
              {athlete.goals && <div className="text-sm text-foreground mt-1.5 italic">"{athlete.goals}"</div>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Benchmarks */}
          <div>
            <SectionTitle hint="From athlete profile">Benchmarks</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <BenchTile label="5 km" value={athlete.benchmarks.fiveKmSec ? formatHMS(athlete.benchmarks.fiveKmSec) : "—"} />
              <BenchTile label="Back squat" value={athlete.benchmarks.backSquatKg ? `${athlete.benchmarks.backSquatKg} kg` : "—"} />
              <BenchTile label="Deadlift" value={athlete.benchmarks.deadliftKg ? `${athlete.benchmarks.deadliftKg} kg` : "—"} />
              <BenchTile label="Fran" value={athlete.benchmarks.franSec ? formatHMS(athlete.benchmarks.franSec) : "—"} />
            </div>
          </div>

          {/* Weakness analysis */}
          <div>
            <SectionTitle hint="Engine analysis">Performance dimensions</SectionTitle>
            <div className="space-y-2">
              {weaknesses.map((w) => (
                <div key={w.dimension}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="capitalize font-medium">{w.dimension}</span>
                    <span className={w.severity === "high" ? "text-destructive" : w.severity === "moderate" ? "text-warning" : "text-success"}>
                      {w.score}/100 — {w.severity}
                    </span>
                  </div>
                  <MiniBar
                    value={w.score}
                    max={100}
                    color={w.severity === "high" ? "var(--destructive)" : w.severity === "moderate" ? "var(--warning)" : "var(--success)"}
                    height={6}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Recommended program */}
          <div>
            <SectionTitle hint={`${recommendedProgram.blocks.length} blocks · ${recommendedProgram.sessions.length} sessions/week`}>
              Recommended program
            </SectionTitle>
            <div className="p-3 rounded-md border border-border bg-secondary/20">
              <div className="font-semibold">{recommendedProgram.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{recommendedProgram.blocks[0].description}</div>
              <div className="mt-3 space-y-1">
                {recommendedProgram.sessions.slice(0, 5).map((s) => (
                  <div key={s.id} className="text-xs flex items-center justify-between py-1 border-b border-border last:border-0">
                    <span className="truncate">{s.title}</span>
                    <span className="text-muted-foreground ml-2 shrink-0">{s.durationMin ?? "—"}m · {s.intensity ?? "—"}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => onAssignProgram(recommendedProgram.name, recommendedProgram.sessions)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition"
              >
                <Send className="w-3 h-3" /> Assign program
              </button>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Coach programming takes precedence over the AI engine. The athlete can override individual sessions but cannot delete the coach-assigned plan.
            </div>
          </div>

          {/* Coach notes */}
          <div>
            <SectionTitle hint="Visible only to coach">Coach notes</SectionTitle>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none resize-none"
              placeholder="Notes only you can see. Use for tracking niggles, motivation, scheduling conflicts."
            />
            <button
              onClick={() => useApp.getState().pushToast({ kind: "success", title: "Notes saved", body: "Visible only to you." })}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-secondary transition"
            >
              <Check className="w-3 h-3" /> Save notes
            </button>
          </div>

          {/* Check-in */}
          <div>
            <SectionTitle hint="Send a check-in">Quick check-in</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {["How are you feeling this week?", "Any niggles or fatigue?", "Ready for tomorrow's session?", "Confirm next race date"].map((q) => (
                <button
                  key={q}
                  onClick={() => useApp.getState().pushToast({ kind: "info", title: "Check-in sent", body: q })}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-secondary transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function BenchTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-md border border-border bg-secondary/20">
      <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</div>
      <div className="text-stat text-base mt-1">{value}</div>
    </div>
  );
}

function InviteModal({
  onClose, onSend,
}: {
  onClose: () => void;
  onSend: (name: string, email: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        className="rounded-lg border border-border bg-card max-w-md w-full p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Invite athlete</h2>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <div className="text-xs font-medium text-muted-foreground mb-1.5">Athlete name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jordan Blake"
              className="w-full px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none focus:border-foreground/40"
            />
          </label>
          <label className="block">
            <div className="text-xs font-medium text-muted-foreground mb-1.5">Email</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jordan@example.com"
              className="w-full px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none focus:border-foreground/40"
            />
          </label>
        </div>
        <button
          onClick={() => onSend(name, email)}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
        >
          <Send className="w-4 h-4" /> Send invitation
        </button>
        <div className="mt-3 text-[11px] text-muted-foreground">
          Athletes must accept the invitation before they appear active on your roster. They keep control of their data at all times.
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProgramBuilderModal({
  athletes, onClose, onAssign,
}: {
  athletes: ManagedAthlete[];
  onClose: () => void;
  onAssign: (athleteId: string, programName: string, sessions: ScheduledSession[]) => void;
}) {
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>(athletes[0]?.id ?? "");
  const [programName, setProgramName] = useState("Custom Coach Program");
  const [mode, setMode] = useState<TrainingMode>("hyrox");
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [phase, setPhase] = useState<"base" | "strength" | "specific" | "taper" | "maintenance">("base");

  const previewSessions = useMemo(() => generateWeekSessions({
    mode,
    phase,
    preferredDays: [1, 3, 5, 6].slice(0, daysPerWeek),
    focusDimensions: [],
  }), [mode, phase, daysPerWeek]);

  function assign() {
    if (!selectedAthleteId) return;
    onAssign(selectedAthleteId, programName, previewSessions);
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        className="rounded-lg border border-border bg-card max-w-2xl w-full max-h-[85vh] overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border p-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Program builder</h2>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs font-medium text-muted-foreground mb-1.5">Assign to athlete</div>
              <select
                value={selectedAthleteId}
                onChange={(e) => setSelectedAthleteId(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none"
              >
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>{a.displayName}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="text-xs font-medium text-muted-foreground mb-1.5">Program name</div>
              <input
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none"
              />
            </label>
            <label className="block">
              <div className="text-xs font-medium text-muted-foreground mb-1.5">Mode</div>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as TrainingMode)}
                className="w-full px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none"
              >
                <option value="hyrox">HYROX</option>
                <option value="athx">ATHX</option>
                <option value="crossfit">CrossFit</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </label>
            <label className="block">
              <div className="text-xs font-medium text-muted-foreground mb-1.5">Phase</div>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value as any)}
                className="w-full px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none"
              >
                <option value="base">Base</option>
                <option value="strength">Strength</option>
                <option value="specific">Specific</option>
                <option value="taper">Taper</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </label>
            <label className="block">
              <div className="text-xs font-medium text-muted-foreground mb-1.5">Days per week</div>
              <input
                type="number"
                min={2}
                max={6}
                value={daysPerWeek}
                onChange={(e) => setDaysPerWeek(Math.max(2, Math.min(6, +e.target.value || 4)))}
                className="w-full px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none"
              />
            </label>
          </div>

          <div>
            <SectionTitle hint={`${previewSessions.length} sessions will be assigned`}>Preview</SectionTitle>
            <div className="space-y-1.5">
              {previewSessions.map((s) => (
                <div key={s.id} className="p-2 rounded-md border border-border text-xs flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.title}</div>
                    <div className="text-muted-foreground mt-0.5">{s.type.replace("_", " ")} · {s.intensity ?? "—"}</div>
                  </div>
                  <div className="text-muted-foreground shrink-0 ml-2">{s.durationMin ?? "—"}m</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <button
              onClick={() => { setProgramName("Custom Coach Program"); setMode("hyrox"); setPhase("base"); setDaysPerWeek(4); }}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
            <button
              onClick={assign}
              disabled={!selectedAthleteId}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> Assign program
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
