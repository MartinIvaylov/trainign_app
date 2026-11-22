"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/store/app-store";
import { Card, PageHeader, Pill, SectionTitle, StatCard, EmptyState, MiniBar } from "@/components/hybrid/blocks/ui";
import { MODE_META, TrainingMode } from "@/types";
import {
  HYROX_STATIONS, HYROX_DIVISIONS, simulateHyrox, formatHMS, formatPace, HYROX_TIME_TARGETS,
} from "@/lib/competition-rules/hyrox";
import { estimateAthxScore, normaliseAthxTest, ATHX_DISCIPLINES, pairCombinedScore } from "@/lib/competition-rules/athx";
import { predictHyroxFinish, analyzeRaceResult, HyroxPrediction } from "@/lib/training-engine";
import { motion } from "framer-motion";
import { Trophy, Plus, MapPin, Calendar, ChevronRight, Save, Activity, Users, Brain, Target, TrendingUp, TrendingDown, Trash2 } from "lucide-react";

const UPCOMING_EVENTS = [
  { format: "hyrox" as TrainingMode, name: "HYROX London", city: "London", country: "UK", date: "2027-03-14" },
  { format: "hyrox" as TrainingMode, name: "HYROX Munich", city: "Munich", country: "DE", date: "2027-04-04" },
  { format: "hyrox" as TrainingMode, name: "HYROX Stockholm", city: "Stockholm", country: "SE", date: "2027-04-25" },
  { format: "athx" as TrainingMode, name: "ATHX Games — Qualifier", city: "Online", country: "—", date: "2027-02-20" },
  { format: "athx" as TrainingMode, name: "ATHX Games — Finals", city: "Dubai", country: "AE", date: "2027-05-10" },
  { format: "crossfit" as TrainingMode, name: "CrossFit Open — WOD 25.1", city: "Worldwide", country: "—", date: "2027-02-27" },
];

export function CompeteView() {
  const [tab, setTab] = useState<"hub" | "hyrox" | "athx" | "pairs" | "results">("hub");
  const upcoming = useApp((s) => s.upcomingCompetition);
  const pushToast = useApp((s) => s.pushToast);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compete"
        subtitle="HYROX, ATHX and CrossFit events, simulations and results."
        actions={
          <div className="flex items-center gap-1.5">
            <Pill active={tab === "hub"} onClick={() => setTab("hub")}>Hub</Pill>
            <Pill active={tab === "hyrox"} color="var(--hyrox)" onClick={() => setTab("hyrox")}>HYROX</Pill>
            <Pill active={tab === "athx"} color="var(--athx)" onClick={() => setTab("athx")}>ATHX</Pill>
            <Pill active={tab === "pairs"} color="var(--athx)" onClick={() => setTab("pairs")}>Pairs</Pill>
            <Pill active={tab === "results"} color="var(--success)" onClick={() => setTab("results")}>Results</Pill>
          </div>
        }
      />

      {upcoming && tab === "hub" && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-border p-6 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, color-mix(in oklch, ${MODE_META[upcoming.format].color} 18%, var(--card)), var(--card))` }}
        >
          <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5" /> Your next competition
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight">{upcoming.name}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {new Date(upcoming.date).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                {upcoming.division && ` · ${upcoming.division}`}
              </div>
            </div>
            <div className="text-center">
              <div className="text-stat text-5xl" style={{ color: MODE_META[upcoming.format].color }}>
                {Math.max(0, Math.ceil((new Date(upcoming.date).getTime() - Date.now()) / (86400 * 1000)))}
              </div>
              <div className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">days to go</div>
            </div>
          </div>
        </motion.div>
      )}

      {tab === "hub" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Events on calendar" value={UPCOMING_EVENTS.length} accent="var(--primary)" />
            <StatCard label="Your competitions" value={1} delta={upcoming?.name ?? "—"} accent="var(--hyrox)" />
            <StatCard label="Hyrox simulations saved" value={useApp.getState().hyroxSimulations.length} accent="var(--athx)" />
            <StatCard label="Race results logged" value={0} accent="var(--maint)" />
          </div>

          <Card>
            <SectionTitle hint={`${UPCOMING_EVENTS.length} upcoming`}>Competition calendar</SectionTitle>
            <div className="space-y-2">
              {UPCOMING_EVENTS.map((e, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-secondary/30 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-1.5 h-12 rounded-full" style={{ background: MODE_META[e.format].color }} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{e.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {e.city}, {e.country}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => pushToast({ kind: "success", title: "Registered", body: `${e.name} added to your competitions.` })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-secondary transition"
                  >
                    Register <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Events shown are illustrative. Add your own competition from your profile or through manual entry — HYBRID does not scrape official event sites.
            </div>
          </Card>

          <Card>
            <SectionTitle hint="Manual entry">Log a past result</SectionTitle>
            <div className="grid sm:grid-cols-3 gap-3">
              <select className="px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none">
                <option>HYROX</option>
                <option>ATHX</option>
                <option>CrossFit</option>
              </select>
              <input placeholder="Finish time / score" className="px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none" />
              <button
                onClick={() => pushToast({ kind: "success", title: "Result logged" })}
                className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
              >
                Save result
              </button>
            </div>
          </Card>
        </>
      )}

      {tab === "hyrox" && <HyroxSimulator />}
      {tab === "athx" && <AthxScoreboard />}
      {tab === "pairs" && <AthxPairs />}
      {tab === "results" && <ResultsPanel />}
    </div>
  );
}

function HyroxSimulator() {
  const [runSplits, setRunSplits] = useState<number[]>(Array(8).fill(360));
  const [stationSplits, setStationSplits] = useState<number[]>(Array(8).fill(180));
  const [transitions, setTransitions] = useState<number>(180);
  const saveHyrox = useApp((s) => s.saveHyroxSimulation);
  const pushToast = useApp((s) => s.pushToast);

  const result = useMemo(() => simulateHyrox({ runSplits, stationSplits, transitionsSec: transitions }), [runSplits, stationSplits, transitions]);

  function update(arr: number[], i: number, v: number) {
    const next = [...arr];
    next[i] = v;
    if (arr === runSplits) setRunSplits(next); else setStationSplits(next);
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle hint="Enter expected or completed splits">HYROX race simulation</SectionTitle>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard label="Predicted finish" value={result.finishFormatted} accent="var(--hyrox)" />
          <StatCard label="Avg pace" value={formatPace(result.averageRunPaceSecPerKm)} accent="var(--primary)" />
          <StatCard label="Strongest block" value={HYROX_STATIONS[result.strongest.index - 1].name} delta={`${formatHMS(result.strongest.sec)}`} accent="var(--success)" />
          <StatCard label="Weakest block" value={HYROX_STATIONS[result.weakest.index - 1].name} delta={`${formatHMS(result.weakest.sec)}`} accent="var(--destructive)" />
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-xs text-muted-foreground text-left border-b border-border">
                <th className="py-2 pr-3">Station</th>
                <th className="py-2 pr-3">Standard (Open)</th>
                <th className="py-2 pr-3">Run split (mm:ss)</th>
                <th className="py-2 pr-3">Station (mm:ss)</th>
                <th className="py-2 pr-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {HYROX_STATIONS.map((s, i) => {
                const total = runSplits[i] + stationSplits[i];
                return (
                  <tr key={s.index} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3 font-medium">{i + 1}. {s.name}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{s.standards.open?.load ?? s.standards.open?.distance ?? s.standards.open?.reps}</td>
                    <td className="py-2 pr-3">
                      <TimeInput value={runSplits[i]} onChange={(v) => update(runSplits, i, v)} />
                    </td>
                    <td className="py-2 pr-3">
                      <TimeInput value={stationSplits[i]} onChange={(v) => update(stationSplits, i, v)} />
                    </td>
                    <td className="py-2 pr-3 tabular-nums font-semibold">{formatHMS(total)}</td>
                  </tr>
                );
              })}
              <tr className="border-b border-border">
                <td colSpan={2} className="py-2 font-medium">Transitions (total)</td>
                <td colSpan={2} className="py-2 pr-3">
                  <TimeInput value={transitions} onChange={setTransitions} />
                </td>
                <td className="py-2 pr-3 tabular-nums">{formatHMS(transitions)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex flex-wrap gap-1.5">
            {HYROX_TIME_TARGETS.map((t) => (
              <div key={t.label} className={`text-xs px-2.5 py-1 rounded-md border ${
                result.totalSec <= t.sec ? "border-primary bg-primary/10 font-semibold" : "border-border"
              }`}>
                <span className="font-semibold">{t.label}</span> {t.description}
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              saveHyrox({
                runSplits, stationSplits, transitionsSec: transitions,
                totalSec: result.totalSec, finishFormatted: result.finishFormatted,
              });
              pushToast({ kind: "success", title: "Simulation saved", body: `Predicted finish: ${result.finishFormatted}` });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition"
          >
            <Save className="w-3.5 h-3.5" /> Save simulation
          </button>
        </div>
      </Card>

      <Card>
        <SectionTitle>Per-station contribution</SectionTitle>
        <div className="space-y-2">
          {HYROX_STATIONS.map((s, i) => {
            const total = runSplits[i] + stationSplits[i];
            const max = Math.max(...HYROX_STATIONS.map((_, j) => runSplits[j] + stationSplits[j]));
            return (
              <div key={s.index} className="flex items-center gap-3">
                <div className="w-32 text-xs font-medium truncate">{i + 1}. {s.name}</div>
                <div className="flex-1">
                  <MiniBar value={total} max={max} color={i + 1 === result.weakest.index ? "var(--destructive)" : i + 1 === result.strongest.index ? "var(--success)" : "var(--primary)"} height={8} />
                </div>
                <div className="w-16 text-right text-xs tabular-nums font-medium">{formatHMS(total)}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function TimeInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const mm = Math.floor(value / 60);
  const ss = value % 60;
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        value={mm}
        onChange={(e) => onChange((+e.target.value || 0) * 60 + ss)}
        className="w-12 px-1.5 py-1 rounded border border-border bg-secondary/30 text-sm tabular-nums outline-none"
      />
      <span className="text-xs text-muted-foreground">:</span>
      <input
        type="number"
        min={0}
        max={59}
        value={ss}
        onChange={(e) => onChange(mm * 60 + (+e.target.value || 0))}
        className="w-12 px-1.5 py-1 rounded border border-border bg-secondary/30 text-sm tabular-nums outline-none"
      />
    </div>
  );
}

function AthxScoreboard() {
  const benchmarks = useApp((s) => s.benchmarks);
  const score = useMemo(() => {
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
      <Card>
        <SectionTitle hint="HYBRID estimate — not official FitScore">Estimated performance score</SectionTitle>
        {score ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <ScoreBox label="Strength" value={score.strength} color="var(--athx)" />
            <ScoreBox label="Endurance" value={score.endurance} color="var(--athx)" />
            <ScoreBox label="MetCon-X" value={score.metcon} color="var(--athx)" />
            <ScoreBox label="Total EPS" value={score.total} color="var(--primary)" big />
          </div>
        ) : (
          <EmptyState title="No benchmarks recorded" body="Add benchmarks in your profile to estimate your performance score." />
        )}
        <div className="mt-4 text-xs text-muted-foreground">
          HYBRID computes an Estimated Performance Score (EPS) from your benchmark inputs. This is distinct from the official ATHX FitScore. If you have an official FitScore, enter it in your profile and we will display that instead.
        </div>
      </Card>

      <Card>
        <SectionTitle hint="Three scored disciplines">ATHX disciplines</SectionTitle>
        <div className="space-y-4">
          {ATHX_DISCIPLINES.map((d) => (
            <div key={d.slug} className="p-3 rounded-md border border-border">
              <div className="font-semibold text-sm flex items-center gap-2">
                <span className="w-1.5 h-4 rounded-full" style={{ background: "var(--athx)" }} />
                {d.name}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{d.description}</div>
              <div className="mt-3 space-y-1.5">
                {d.categories.map((c) => (
                  <div key={c.slug} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{c.name}</span>
                    <span className={`px-1.5 py-0.5 rounded ${c.verified ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                      {c.verified ? "verified" : "estimate"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AthxPairs() {
  const [athleteScore, setAthleteScore] = useState(68);
  const [partnerScore, setPartnerScore] = useState(72);
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "invited">("idle");
  const pushToast = useApp((s) => s.pushToast);

  const combined = pairCombinedScore({ athleteScore, partnerScore });

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle hint="Individual + pairs">ATHX pairs mode</SectionTitle>
        <div className="text-sm text-muted-foreground mb-4">
          Train with a partner. Share a plan, coordinate sessions, compare benchmark improvements and track pair-specific preparation.
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-md border border-border">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest">You</div>
            <div className="mt-2 flex items-end gap-2">
              <div className="text-stat text-3xl">{athleteScore}</div>
              <div className="text-xs text-muted-foreground mb-1">EPS</div>
            </div>
            <input
              type="range" min={0} max={100} value={athleteScore}
              onChange={(e) => setAthleteScore(+e.target.value)}
              className="w-full mt-3"
            />
          </div>
          <div className="p-4 rounded-md border border-border">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Partner</div>
            <div className="mt-2 flex items-end gap-2">
              <div className="text-stat text-3xl">{partnerScore}</div>
              <div className="text-xs text-muted-foreground mb-1">EPS</div>
            </div>
            <input
              type="range" min={0} max={100} value={partnerScore}
              onChange={(e) => setPartnerScore(+e.target.value)}
              className="w-full mt-3"
            />
          </div>
        </div>

        <div className="mt-4 p-4 rounded-md bg-secondary/30">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Combined pair score</div>
          <div className="mt-1 text-stat text-4xl" style={{ color: "var(--athx)" }}>{combined}</div>
          <div className="text-xs text-muted-foreground mt-1">Average of both individual estimated scores.</div>
        </div>

        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <input
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            placeholder="Partner name"
            className="px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none"
          />
          <input
            value={partnerEmail}
            onChange={(e) => setPartnerEmail(e.target.value)}
            placeholder="Partner email"
            className="px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none"
          />
        </div>

        {status === "idle" ? (
          <button
            onClick={() => {
              if (!partnerName) {
                pushToast({ kind: "warning", title: "Add a partner name" });
                return;
              }
              setStatus("invited");
              pushToast({ kind: "success", title: "Partnership created", body: `${partnerName} has been invited.` });
            }}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" /> Create partnership
          </button>
        ) : (
          <div className="mt-4 p-3 rounded-md border border-success/40 bg-success/10 text-sm text-success">
            Partnership with <span className="font-semibold">{partnerName || "your partner"}</span> created. Status: pending partner acceptance.
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Pair sessions this week</SectionTitle>
        <div className="space-y-2">
          {["MetCon-X Test A simulation", "Strength — Squat & Press", "Endurance — 5 km + 2 km row"].map((s, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-md border border-border">
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-athx" style={{ color: "var(--athx)" }} />
                <div className="text-sm font-medium">{s}</div>
              </div>
              <div className="text-xs text-muted-foreground">Synced with partner</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ScoreBox({ label: _label, value, color, big }: { label: string; value: number; color: string; big?: boolean }) {
  return (
    <div className={`p-4 rounded-md border border-border text-center ${big ? "bg-primary/10" : ""}`}>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{_label}</div>
      <div className="mt-2 text-stat" style={{ fontSize: big ? "3rem" : "2rem", color }}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">/100</div>
    </div>
  );
}

function ResultsPanel() {
  const pushToast = useApp((s) => s.pushToast);
  const hyroxSims = useApp((s) => s.hyroxSimulations);
  const storeResults = useApp((s) => s.raceResults);
  const addRaceResult = useApp((s) => s.addRaceResult);
  const deleteRaceResult = useApp((s) => s.deleteRaceResult);

  // Convert stored race results to the display format
  const storedDisplay = storeResults.map((r) => ({
    id: r.id,
    format: r.format as "hyrox" | "athx" | "crossfit",
    name: r.competitionName,
    date: r.date,
    division: r.division ?? "—",
    finish: r.finishSec ? formatHMS(r.finishSec) : "—",
    finishSec: r.finishSec,
    notes: r.notes,
  }));

  const seedResults: Array<{
    id: string;
    format: "hyrox" | "athx" | "crossfit";
    name: string;
    date: string;
    division: string;
    finish: string;
    finishSec?: number;
    rank?: number;
    notes?: string;
  }> = [
    {
      id: "r1",
      format: "hyrox",
      name: "HYROX London 2026",
      date: "2026-10-12",
      division: "Open (Men)",
      finish: "1:18:30",
      finishSec: 4710,
      rank: 312,
      notes: "Strongest station: SkiErg. Weakest: Sled Pull.",
    },
    {
      id: "r2",
      format: "athx",
      name: "ATHX Qualifier 2026",
      date: "2026-06-04",
      division: "Individual",
      finish: "EPS 64 (estimated)",
      notes: "Strength 71, Endurance 58, MetCon-X 63. Not the official FitScore.",
    },
  ];

  const [results, setResults] = useState(storedDisplay.length > 0 ? storedDisplay : seedResults);

  const [form, setForm] = useState({
    format: "hyrox" as "hyrox" | "athx" | "crossfit",
    name: "",
    date: "",
    division: "",
    finish: "",
    finishSec: "",
    rank: "",
    notes: "",
  });

  function addResult() {
    if (!form.name || !form.date) {
      pushToast({ kind: "warning", title: "Add at least name and date" });
      return;
    }
    const finishSec = form.finishSec ? parseInt(form.finishSec, 10) : undefined;
    const r = {
      id: `r-${Date.now()}`,
      format: form.format,
      name: form.name,
      date: form.date,
      division: form.division || "—",
      finish: form.finish || "—",
      finishSec,
      rank: form.rank ? parseInt(form.rank, 10) : undefined,
      notes: form.notes || undefined,
    };
    setResults((prev) => [r, ...prev]);
    // Also persist to store so results survive page reload
    addRaceResult({
      format: form.format,
      competitionName: form.name,
      date: form.date,
      finishSec: finishSec ?? 0,
      division: form.division || undefined,
      notes: form.notes || undefined,
    });
    setForm({ format: "hyrox", name: "", date: "", division: "", finish: "", finishSec: "", rank: "", notes: "" });
    pushToast({ kind: "success", title: "Result logged", body: `${r.name} — ${r.finish}` });
  }

  function removeResult(id: string) {
    setResults((prev) => prev.filter((r) => r.id !== id));
    // Also remove from store if it exists there
    const storeResult = storeResults.find((r) => r.id === id);
    if (storeResult) deleteRaceResult(id);
  }

  // Compute trends if we have multiple HYROX results
  const hyroxResults = results.filter((r) => r.format === "hyrox" && r.finishSec).sort((a, b) => a.date.localeCompare(b.date));
  const trend = hyroxResults.length >= 2
    ? hyroxResults[hyroxResults.length - 1].finishSec! - hyroxResults[0].finishSec!
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle hint="Saved HYROX simulations">From your simulations</SectionTitle>
        {hyroxSims.length === 0 ? (
          <div className="text-sm text-muted-foreground">No HYROX simulations saved yet. Run one in the HYROX tab.</div>
        ) : (
          <div className="space-y-2">
            {hyroxSims.slice(0, 5).map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-md border border-border">
                <div>
                  <div className="text-sm font-medium">Simulation {hyroxSims.length - i}</div>
                  <div className="text-xs text-muted-foreground">{new Date(s.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>
                </div>
                <div className="text-stat text-lg">{s.finishFormatted}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle hint="Manual entry">Log a competition result</SectionTitle>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <select
            value={form.format}
            onChange={(e) => setForm({ ...form, format: e.target.value as "hyrox" | "athx" | "crossfit" })}
            className="px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none"
          >
            <option value="hyrox">HYROX</option>
            <option value="athx">ATHX</option>
            <option value="crossfit">CrossFit</option>
          </select>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Event name (HYROX London 2027)"
            className="px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none"
          />
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none"
          />
          <input
            value={form.division}
            onChange={(e) => setForm({ ...form, division: e.target.value })}
            placeholder="Division (Open, Pro, Doubles)"
            className="px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none"
          />
          <input
            value={form.finish}
            onChange={(e) => setForm({ ...form, finish: e.target.value })}
            placeholder="Finish (1:18:30 or EPS 64)"
            className="px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none"
          />
          <input
            value={form.finishSec}
            onChange={(e) => setForm({ ...form, finishSec: e.target.value })}
            placeholder="Finish seconds (optional, for trends)"
            className="px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none"
          />
          <input
            value={form.rank}
            onChange={(e) => setForm({ ...form, rank: e.target.value })}
            placeholder="Rank (optional)"
            className="px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none"
          />
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes (strongest/weakest, conditions)"
            className="px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none"
          />
        </div>
        <button
          onClick={addResult}
          className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> Save result
        </button>
      </Card>

      {trend !== null && (
        <Card>
          <SectionTitle hint="From logged HYROX results">HYROX finish time trend</SectionTitle>
          <div className="flex items-center justify-between p-3 rounded-md border border-border bg-secondary/20">
            <div>
              <div className="text-sm text-muted-foreground">Change between first and latest result</div>
              <div className="text-xs text-muted-foreground mt-1">
                {hyroxResults[0].date.slice(0, 10)} → {hyroxResults[hyroxResults.length - 1].date.slice(0, 10)}
              </div>
            </div>
            <div className={`text-stat text-2xl ${trend < 0 ? "text-success" : trend > 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {trend < 0 ? "-" : "+"}{formatHMS(Math.abs(trend))}
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {trend < 0 ? "Improvement — your training is working." : trend > 0 ? "Slower than before — review your block before next race." : "Held pace. Look for marginal gains."}
          </div>
        </Card>
      )}

      <RacePredictionCard />

      <Card>
        <SectionTitle hint="Engine analysis of each logged result">Per-result analysis</SectionTitle>
        {results.filter((r) => r.finishSec).length === 0 ? (
          <div className="text-sm text-muted-foreground">Add finish seconds to your results for engine analysis.</div>
        ) : (
          <div className="space-y-3">
            {results.filter((r) => r.finishSec).map((r) => {
              const targetSec = r.format === "hyrox" ? 75 * 60 : r.format === "athx" ? undefined : undefined;
              const prevResultSec = results.find((p) => p.id !== r.id && p.format === r.format && p.finishSec)?.finishSec;
              const analysis = analyzeRaceResult({
                format: r.format,
                finishSec: r.finishSec!,
                targetSec,
                previousResultSec: prevResultSec,
              });
              return (
                <div key={r.id} className="p-3 rounded-md border border-border">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="font-medium text-sm">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.date} · {r.format.toUpperCase()}</div>
                    </div>
                    <div className="text-stat text-lg">{r.finish}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{analysis.summary}</div>
                  {analysis.recommendations.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {analysis.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle hint={`${results.length} logged`}>Your competition history</SectionTitle>
        {results.length === 0 ? (
          <EmptyState title="No results logged yet" body="Add your past competitions above to track trends." />
        ) : (
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.id} className="p-3 rounded-md border border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-1.5 h-12 rounded-full shrink-0" style={{ background: MODE_META[r.format].color }} />
                    <div className="min-w-0">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>{new Date(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                        <span>·</span>
                        <span>{r.division}</span>
                        {r.rank && (<><span>·</span><span>Rank #{r.rank}</span></>)}
                      </div>
                      {r.notes && <div className="text-xs text-muted-foreground mt-1.5 italic">"{r.notes}"</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-stat text-base">{r.finish}</div>
                    <button
                      onClick={() => removeResult(r.id)}
                      className="text-xs text-muted-foreground hover:text-destructive transition"
                      aria-label="Delete result"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 text-xs text-muted-foreground">
          HYBRID stores competition results you log. We do not scrape official event sites or imply affiliation with HYROX, ATHX or CrossFit.
        </div>
      </Card>
    </div>
  );
}

function RacePredictionCard() {
  const benchmarks = useApp((s) => s.benchmarks);
  const profile = useApp((s) => s.profile);
  const upcoming = useApp((s) => s.upcomingCompetition);

  const prediction: HyroxPrediction | null = useMemo(() => {
    if (!benchmarks) return null;
    return predictHyroxFinish({
      fiveKmSec: benchmarks.fiveKmSec,
      oneKmPaceSec: benchmarks.oneKmPaceSec,
      row2kSec: benchmarks.row2kSec,
      skierg1kSec: benchmarks.skierg1kSec,
      priorHyroxFinishSec: benchmarks.priorHyroxFinishSec,
      weightKg: profile?.weightKg,
      backSquatKg: benchmarks.backSquatKg,
      deadliftKg: benchmarks.deadliftKg,
    });
  }, [benchmarks, profile]);

  if (!prediction || prediction.predictedFinishSec === null) {
    return (
      <Card>
        <SectionTitle hint="From your benchmarks">HYROX race prediction</SectionTitle>
        <EmptyState
          title="Not enough data for a prediction"
          body="Add at least a 5 km run time or a prior HYROX finish in your profile to generate a predicted finish time."
        />
      </Card>
    );
  }

  const daysToRace = upcoming?.date
    ? Math.max(0, Math.ceil((new Date(upcoming.date).getTime() - Date.now()) / 86400 * 1000))
    : null;

  // Confidence color
  const confColor = prediction.confidence === "high" ? "var(--success)" : prediction.confidence === "moderate" ? "var(--warning)" : "var(--destructive)";

  return (
    <Card>
      <SectionTitle hint={`${prediction.confidence} confidence`}>HYROX race prediction</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-md border border-border bg-secondary/20">
          <div className="text-xs text-muted-foreground uppercase tracking-widest">Predicted finish</div>
          <div className="text-stat text-4xl mt-2" style={{ color: "var(--hyrox)" }}>
            {formatHMS(prediction.predictedFinishSec!)}
          </div>
          {prediction.pacePerKmSec && (
            <div className="text-xs text-muted-foreground mt-2">
              Avg pace {formatPace(prediction.pacePerKmSec)} · 8 km
            </div>
          )}
        </div>
        <div className="p-4 rounded-md border border-border bg-secondary/20">
          <div className="text-xs text-muted-foreground uppercase tracking-widest">Confidence</div>
          <div className="text-stat text-xl mt-2 capitalize" style={{ color: confColor }}>
            {prediction.confidence}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Based on {prediction.inputsUsed.length} input{prediction.inputsUsed.length === 1 ? "" : "s"}.
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 rounded-md border border-border bg-secondary/20 text-xs">
        <div className="font-medium mb-1.5">Method</div>
        <div className="text-muted-foreground leading-relaxed">{prediction.method}</div>
      </div>

      {prediction.inputsUsed.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">Inputs used</div>
          <div className="flex flex-wrap gap-1.5">
            {prediction.inputsUsed.map((inp, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded-md border border-border bg-secondary/30">
                {inp}
              </span>
            ))}
          </div>
        </div>
      )}

      {daysToRace !== null && (
        <div className="mt-4 p-3 rounded-md border border-primary/40 bg-primary/5 text-sm">
          <div className="font-semibold">
            {daysToRace} days to {upcoming?.name}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Use this prediction to set your target. Adjust your taper if the predicted finish is more than 5% slower than your target.
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {HYROX_TIME_TARGETS.map((t) => (
          <div
            key={t.label}
            className={`text-xs px-2.5 py-1 rounded-md border ${
              prediction.predictedFinishSec! <= t.sec
                ? "border-primary bg-primary/10 font-semibold"
                : "border-border"
            }`}
          >
            <span className="font-semibold">{t.label}</span> {t.description}
          </div>
        ))}
      </div>
    </Card>
  );
}
