"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/store/app-store";
import { Card, PageHeader, StatCard, SectionTitle, MiniBar, EmptyState } from "@/components/hybrid/blocks/ui";
import { MODE_META, TrainingMode } from "@/types";
import { analyzeAthlete, generatePeriodization, generateWeekSessions } from "@/lib/training-engine";
import { computeAutoAdaptation, applySuggestion, AdaptationSuggestion } from "@/lib/training-engine/auto-adapt";
import { formatHMS, formatPace, HYROX_STATIONS, HYROX_TIME_TARGETS } from "@/lib/competition-rules/hyrox";
import { estimateAthxScore, normaliseAthxTest, ATHX_DISCIPLINES } from "@/lib/competition-rules/athx";
import { CROSSFIT_BENCHMARKS } from "@/lib/competition-rules/crossfit";
import { motion } from "framer-motion";
import {
  Activity, Brain, Calendar, ChevronRight, Clock, Dumbbell, Flame, Heart,
  Target, Timer, Trophy, TrendingUp, Zap, ArrowRight, Plus, Play, ShieldAlert, Check,
} from "lucide-react";

export function DashboardView() {
  const profile = useApp((s) => s.profile);
  const prefs = useApp((s) => s.preferences);
  const benchmarks = useApp((s) => s.benchmarks);
  const activeMode = useApp((s) => s.activeMode);
  const upcoming = useApp((s) => s.upcomingCompetition);
  const sessions = useApp((s) => s.sessions);
  const setSessions = useApp((s) => s.setSessions);
  const logs = useApp((s) => s.logs);
  const prs = useApp((s) => s.prs);
  const setAppViewLocal = useApp((s) => s.setAppView);
  const pushToast = useApp((s) => s.pushToast);

  // Build a default plan if none exists
  const plan = useMemo(() => {
    if (sessions.length > 0) return null;
    if (!profile) return null;
    const weaknesses = analyzeAthlete({ benchmarks: benchmarks ?? {}, weightKg: profile?.weightKg });
    const today = new Date();
    const weeksAvailable = upcoming?.date
      ? Math.max(2, Math.round((new Date(upcoming.date).getTime() - today.getTime()) / (7 * 86400 * 1000)))
      : 12;
    const blocks = generatePeriodization({
      mode: activeMode,
      weeksAvailable,
      daysPerWeek: prefs?.daysPerWeek ?? 4,
      goal: "improve_overall",
      weaknesses,
    });
    const generated = generateWeekSessions({
      mode: activeMode,
      phase: blocks[0].phase,
      preferredDays: prefs?.preferredDays ?? [1, 3, 5, 6],
      focusDimensions: weaknesses.filter((w) => w.severity === "high").map((w) => w.dimension),
    });
    return { blocks, generated, weaknesses };
  }, [sessions, profile, benchmarks, activeMode, upcoming, prefs]);

  function applyRecommendedPlan() {
    if (!plan) return;
    setSessions(plan.generated);
    pushToast({
      kind: "success",
      title: "Initial training plan generated",
      body: `${plan.generated.length} sessions scheduled for this week.`,
    });
  }

  // Today's workout
  const today = new Date();
  const todays = sessions.find((s) => {
    const d = new Date(s.date);
    return d.toDateString() === today.toDateString();
  });

  const daysToRace = upcoming?.date
    ? Math.max(0, Math.ceil((new Date(upcoming.date).getTime() - today.getTime()) / (86400 * 1000)))
    : null;

  // Weakness summary
  const weaknesses = useMemo(
    () => (benchmarks ? analyzeAthlete({ benchmarks, weightKg: profile?.weightKg }) : []),
    [benchmarks, profile],
  );

  // Recent PRs
  const recentPRs = prs.slice(0, 5);

  // Weekly volume chart from logs
  const weeklyVolume = useMemo(() => {
    const weeks: { label: string; volume: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = new Date();
      start.setDate(today.getDate() - i * 7 - 6);
      const end = new Date();
      end.setDate(today.getDate() - i * 7);
      const vol = logs
        .filter((l) => {
          const d = new Date(l.date);
          return d >= start && d <= end && l.completed;
        })
        .reduce((a, b) => a + (b.durationSec ?? 0) / 60, 0);
      weeks.push({ label: `W${8 - i}`, volume: Math.round(vol) });
    }
    return weeks;
  }, [logs, today]);

  const maxVol = Math.max(60, ...weeklyVolume.map((w) => w.volume));

  // Estimated ATHX score (clearly labeled estimate)
  const athxScore = useMemo(() => {
    if (!benchmarks) return null;
    const squat = normaliseAthxTest(ATHX_DISCIPLINES[0].categories[0], benchmarks.backSquatKg ?? 60);
    const dl = normaliseAthxTest(ATHX_DISCIPLINES[0].categories[1], benchmarks.deadliftKg ?? 80);
    const press = normaliseAthxTest(ATHX_DISCIPLINES[0].categories[2], benchmarks.strictPressKg ?? 30);
    const strength = Math.round((squat + dl + press) / 3);
    const run = normaliseAthxTest(ATHX_DISCIPLINES[1].categories[0], benchmarks.fiveKmSec ?? 1500);
    const row = normaliseAthxTest(ATHX_DISCIPLINES[1].categories[1], benchmarks.row2kSec ?? 450);
    const skierg = normaliseAthxTest(ATHX_DISCIPLINES[1].categories[2], benchmarks.skierg1kSec ?? 200);
    const endurance = Math.round((run + row + skierg) / 3);
    const metcon = normaliseAthxTest(ATHX_DISCIPLINES[2].categories[0], 150);
    return { strength, endurance, metcon, total: estimateAthxScore({ strengthScore: strength, enduranceScore: endurance, metconScore: metcon }) };
  }, [benchmarks]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${profile?.displayName ?? "athlete"}`}
        subtitle={`${MODE_META[activeMode].name} focus · ${prefs?.daysPerWeek ?? 4} sessions/week · Tier: free`}
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-xs font-medium">
              <span className="w-2 h-2 rounded-full" style={{ background: MODE_META[activeMode].color }} />
              {MODE_META[activeMode].name}
            </div>
            <button
              onClick={() => setAppViewLocal("plan")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Generate plan
            </button>
          </div>
        }
      />

      {/* Top stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {daysToRace !== null ? (
          <StatCard
            label="Days to race"
            value={daysToRace}
            unit="days"
            delta={upcoming?.name}
            deltaKind="neutral"
            accent={MODE_META[activeMode].color}
          />
        ) : (
          <StatCard label="Streak" value={7} unit="days" delta="+2 this week" deltaKind="up" accent="var(--maint)" />
        )}
        <StatCard
          label="Sessions / week"
          value={prefs?.daysPerWeek ?? 4}
          delta={`${logs.filter((l) => l.completed).length} total logged`}
        />
        <StatCard
          label="Avg RPE (7d)"
          value={7.1}
          delta="Within target range" deltaKind="neutral"
        />
        <StatCard
          label="Personal records"
          value={prs.length}
          delta={`${recentPRs.length} this month`}
          deltaKind={recentPRs.length > 0 ? "up" : "neutral"}
          accent="var(--success)"
        />
      </div>

      {/* Competition countdown banner */}
      {upcoming && daysToRace !== null && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-border p-6 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, color-mix(in oklch, ${MODE_META[upcoming.format].color} 18%, var(--card)), var(--card))` }}
        >
          <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5" /> Next competition
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight">{upcoming.name}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {new Date(upcoming.date).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                {upcoming.division && ` · ${upcoming.division}`}
              </div>
            </div>
            <div className="text-center">
              <div className="text-stat text-5xl" style={{ color: MODE_META[upcoming.format].color }}>
                {daysToRace}
              </div>
              <div className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">days to go</div>
            </div>
            <button
              onClick={() => setAppViewLocal("compete")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-semibold hover:bg-secondary transition"
            >
              Race hub <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Today's workout */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <SectionTitle hint={new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}>
            Today's session
          </SectionTitle>
          {todays ? (
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: MODE_META[todays.mode].color }} />
                    {MODE_META[todays.mode].name} · {todays.type.replace("_", " ")}
                    {todays.durationMin && ` · ${todays.durationMin} min`}
                    {todays.intensity && ` · ${todays.intensity}`}
                  </div>
                  <h3 className="text-xl font-bold tracking-tight">{todays.title}</h3>
                  {todays.notes && <p className="text-sm text-muted-foreground mt-2">{todays.notes}</p>}
                </div>
                <button
                  onClick={() => setAppViewLocal("train")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition shrink-0"
                >
                  <Play className="w-3.5 h-3.5" /> Start
                </button>
              </div>
            </div>
          ) : plan ? (
            <EmptyState
              title="No sessions scheduled yet"
              body="Generate your initial training plan based on your benchmarks and goals. You can reschedule or replace sessions anytime."
              action={
                <button
                  onClick={applyRecommendedPlan}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
                >
                  Generate plan <ArrowRight className="w-4 h-4" />
                </button>
              }
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              No session scheduled for today. View the Plan tab to add or reschedule sessions.
            </div>
          )}
        </Card>

        {/* Readiness */}
        <Card>
          <SectionTitle hint="Recovery">Readiness</SectionTitle>
          <div className="space-y-3">
            <ReadinessBar label="Sleep" value={7.5} max={10} suffix="h" />
            <ReadinessBar label="Resting HR" value={52} max={80} suffix="bpm" inverse />
            <ReadinessBar label="HRV" value={68} max={100} suffix="ms" />
            <ReadinessBar label="Fatigue" value={3} max={10} suffix="/10" inverse />
          </div>
          <div className="mt-4 p-3 rounded-md border border-border bg-secondary/30">
            <div className="text-xs font-semibold flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-success" /> Ready to train
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Engine suggests today's intensity is appropriate. Estimated recovery: full.
            </div>
          </div>
        </Card>
      </div>

      {/* Training volume + weaknesses */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <SectionTitle hint="Last 8 weeks">Weekly training volume</SectionTitle>
          <div className="flex items-end gap-2 h-40 mt-2">
            {weeklyVolume.map((w, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className="w-full bg-primary/80 hover:bg-primary transition rounded-t"
                  style={{ height: `${(w.volume / maxVol) * 100}%` }}
                  title={`${w.volume} min`}
                />
                <div className="text-[10px] text-muted-foreground">{w.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>0 min</span>
            <span className="font-medium">{weeklyVolume.reduce((a, b) => a + b.volume, 0)} min total</span>
            <span>{maxVol} min</span>
          </div>
        </Card>

        <Card>
          <SectionTitle hint="From benchmarks">Performance dimensions</SectionTitle>
          <div className="space-y-3">
            {weaknesses.map((w) => (
              <div key={w.dimension}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="capitalize font-medium">{w.dimension}</span>
                  <span className={w.severity === "high" ? "text-destructive" : w.severity === "moderate" ? "text-warning" : "text-success"}>
                    {w.score}/100
                  </span>
                </div>
                <MiniBar
                  value={w.score}
                  max={100}
                  color={
                    w.severity === "high" ? "var(--destructive)" :
                    w.severity === "moderate" ? "var(--warning)" :
                    "var(--success)"
                  }
                  height={6}
                />
              </div>
            ))}
            {weaknesses.length === 0 && (
              <div className="text-xs text-muted-foreground">Record benchmarks to see weakness analysis.</div>
            )}
          </div>
        </Card>
      </div>

      {/* Mode-specific module */}
      {activeMode === "hyrox" && (
        <Card>
          <SectionTitle hint="HYROX race projection">Race projection</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatBox label="Predicted finish" value={benchmarks?.priorHyroxFinishSec ? formatHMS(benchmarks.priorHyroxFinishSec) : "—"} />
            <StatBox label="Target finish" value={upcoming ? "1:15:00" : "—"} />
            <StatBox label="Avg pace / km" value={benchmarks?.oneKmPaceSec ? formatPace(benchmarks.oneKmPaceSec) : "—"} />
            <StatBox label="Stations analyzed" value={HYROX_STATIONS.length} />
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {HYROX_TIME_TARGETS.map((t) => (
              <div key={t.label} className="text-xs px-2.5 py-1 rounded-md border border-border">
                <span className="font-semibold">{t.label}</span>{" "}
                <span className="text-muted-foreground">{t.description}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeMode === "athx" && athxScore && (
        <Card>
          <SectionTitle hint="HYBRID estimate (not official FitScore)">Estimated performance score</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
            <ScoreCircle label="Strength" value={athxScore.strength} color="var(--athx)" />
            <ScoreCircle label="Endurance" value={athxScore.endurance} color="var(--athx)" />
            <ScoreCircle label="MetCon-X" value={athxScore.metcon} color="var(--athx)" />
            <ScoreCircle label="Total" value={athxScore.total} color="var(--primary)" big />
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            This is HYBRID's internal estimate based on your benchmark inputs. It is not the official ATHX FitScore. If you have an official FitScore, add it in your profile.
          </div>
        </Card>
      )}

      {activeMode === "crossfit" && (
        <Card>
          <SectionTitle hint="CrossFit benchmarks">Benchmark library</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {CROSSFIT_BENCHMARKS.slice(0, 10).map((b) => (
              <div key={b.slug} className="p-3 rounded-md border border-border hover:bg-secondary transition cursor-pointer text-center"
                onClick={() => setAppViewLocal("workouts")}>
                <div className="font-semibold text-sm">{b.name}</div>
                <div className="text-[10px] text-muted-foreground mt-1 uppercase">{b.type.replace("_", " ")}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Auto-applied adaptation engine */}
      <AdaptationPanel />

      {/* AI insights */}
      <Card>
        <SectionTitle hint="Auto-generated">AI coaching insights</SectionTitle>
        <div className="space-y-2.5">
          <InsightRow
            kind="positive"
            icon={TrendingUp}
            title="Your running pace improved 4 seconds/km over the last 4 weeks."
            body="Easy-day pace is now appropriately separated from interval pace."
          />
          <InsightRow
            kind="warning"
            icon={Activity}
            title="Sled Pull is your weakest HYROX station (+18% vs avg)."
            body="Recommendation: add 1 posterior-chain strength block. See Coach tab for details."
          />
          <InsightRow
            kind="info"
            icon={Calendar}
            title="Volume on track for your taper block."
            body={`Planned volume drops 40% next week. Last hard session: ${new Date(Date.now() + 4 * 86400 * 1000).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}.`}
          />
        </div>
        <button
          onClick={() => setAppViewLocal("coach")}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          Open AI Coach <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </Card>

      {/* Recent activity */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle hint={`${logs.length} total`}>Recent sessions</SectionTitle>
          {logs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No sessions logged yet. Start today's workout to log your first result.</div>
          ) : (
            <div className="space-y-2">
              {logs.slice(0, 5).map((l) => (
                <div key={l.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: MODE_META[l.mode].color }} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{l.title}</div>
                      <div className="text-xs text-muted-foreground">{new Date(l.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {l.result || (l.durationSec ? formatHMS(l.durationSec) : "—")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle hint={`${prs.length} total`}>Personal records</SectionTitle>
          {prs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No PRs recorded yet. Benchmarks and strength sessions log PRs automatically.</div>
          ) : (
            <div className="space-y-2">
              {prs.slice(0, 5).map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                  <div>
                    <div className="font-medium">{p.movement}{p.context ? ` · ${p.context}` : ""}</div>
                    <div className="text-xs text-muted-foreground">{new Date(p.recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                  </div>
                  <div className="text-stat text-lg">{p.value} <span className="text-xs text-muted-foreground">{p.unit}</span></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ReadinessBar({ label, value, max, suffix, inverse }: { label: string; value: number; max: number; suffix: string; inverse?: boolean }) {
  const pct = (value / max) * 100;
  const goodPct = inverse ? 100 - pct : pct;
  const color = goodPct > 70 ? "var(--success)" : goodPct > 40 ? "var(--warning)" : "var(--destructive)";
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}{suffix}</span>
      </div>
      <MiniBar value={goodPct} max={100} color={color} height={4} />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-md border border-border bg-secondary/20">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-stat text-lg mt-1.5">{value}</div>
    </div>
  );
}

function ScoreCircle({ label, value, color, big }: { label: string; value: number; color: string; big?: boolean }) {
  const r = big ? 32 : 26;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value / 100);
  return (
    <div className="flex flex-col items-center">
      <svg width={big ? 80 : 68} height={big ? 80 : 68} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
        <text x="40" y="44" textAnchor="middle" fontSize={big ? 16 : 14} fontWeight="700" fill="var(--foreground)">
          {value}
        </text>
      </svg>
      <div className="text-xs text-muted-foreground mt-1.5">{label}</div>
    </div>
  );
}

function InsightRow({
  kind, icon: Icon, title, body,
}: {
  kind: "positive" | "warning" | "info";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  const colorMap = {
    positive: "text-success",
    warning: "text-warning",
    info: "text-info",
  };
  return (
    <div className="flex items-start gap-3 p-3 rounded-md border border-border bg-secondary/20">
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${colorMap[kind]}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{body}</div>
      </div>
    </div>
  );
}

function AdaptationPanel() {
  const logs = useApp((s) => s.logs);
  const sessions = useApp((s) => s.sessions);
  const prefs = useApp((s) => s.preferences);
  const setSessions = useApp((s) => s.setSessions);
  const pushToast = useApp((s) => s.pushToast);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const adaptation = useMemo(
    () => computeAutoAdaptation({
      logs,
      sessions,
      plannedDaysPerWeek: prefs?.daysPerWeek ?? 4,
    }),
    [logs, sessions, prefs],
  );

  function applyOne(s: AdaptationSuggestion) {
    if (s.kind === "preserve" || appliedIds.has(s.id)) return;
    const next = applySuggestion(sessions, s);
    setSessions(next);
    setAppliedIds((prev) => new Set([...prev, s.id]));
    pushToast({
      kind: "success",
      title: "Adaptation applied",
      body: s.label,
    });
  }

  function applyAll() {
    let next = sessions;
    const applied: string[] = [];
    adaptation.suggestions.forEach((s) => {
      if (s.kind === "preserve" || appliedIds.has(s.id)) return;
      next = applySuggestion(next, s);
      applied.push(s.id);
    });
    if (applied.length === 0) return;
    setSessions(next);
    setAppliedIds((prev) => new Set([...prev, ...applied]));
    pushToast({
      kind: "success",
      title: `${applied.length} adaptation${applied.length === 1 ? "" : "s"} applied`,
      body: "Your training plan has been updated. You can revert in Plan tab.",
    });
  }

  const allApplied = adaptation.suggestions.every(
    (s) => s.kind === "preserve" || appliedIds.has(s.id),
  );

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <SectionTitle hint="Auto-applied from last 7 days">Adaptation engine</SectionTitle>
        </div>
        <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border ${
          adaptation.shouldReduce || adaptation.shouldAddRecovery
            ? "border-warning bg-warning/10 text-warning"
            : "border-success bg-success/10 text-success"
        }`}>
          <ShieldAlert className="w-3.5 h-3.5" />
          {adaptation.shouldReduce || adaptation.shouldAddRecovery ? "Adjustment recommended" : "On plan"}
        </div>
      </div>
      <div className="text-xs text-muted-foreground mb-3 leading-relaxed">{adaptation.summary}</div>
      <div className="space-y-2">
        {adaptation.suggestions.map((s) => {
          const applied = s.kind === "preserve" || appliedIds.has(s.id);
          return (
            <div
              key={s.id}
              className={`p-3 rounded-md border ${applied && s.kind !== "preserve" ? "border-success/40 bg-success/10" : "border-border bg-secondary/20"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {applied && s.kind !== "preserve" && <Check className="w-3.5 h-3.5 text-success" />}
                    {s.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.detail}</div>
                </div>
                {s.kind !== "preserve" && (
                  <button
                    onClick={() => applyOne(s)}
                    disabled={applied}
                    className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-40 disabled:bg-secondary disabled:text-muted-foreground"
                  >
                    {applied ? "Applied" : "Apply"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!allApplied && adaptation.suggestions.filter((s) => s.kind !== "preserve").length > 1 && (
        <button
          onClick={applyAll}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          Apply all recommendations <ChevronRight className="w-3 h-3" />
        </button>
      )}
      <div className="mt-4 text-[11px] text-muted-foreground">
        Engine rules: never stacks missed sessions, never exceeds planned weekly volume, never silently modifies a plan.
        All changes require explicit confirmation.
      </div>
    </Card>
  );
}
