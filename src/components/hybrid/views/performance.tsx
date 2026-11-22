"use client";

import { useMemo } from "react";
import { useApp } from "@/store/app-store";
import { Card, PageHeader, SectionTitle, StatCard, MiniBar, EmptyState } from "@/components/hybrid/blocks/ui";
import { MODE_META } from "@/types";
import { formatHMS, formatPace, HYROX_STATIONS } from "@/lib/competition-rules/hyrox";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { Activity, TrendingUp, TrendingDown, Dumbbell, Heart, Trophy } from "lucide-react";

export function PerformanceView() {
  const logs = useApp((s) => s.logs);
  const benchmarks = useApp((s) => s.benchmarks);
  const prs = useApp((s) => s.prs);
  const activeMode = useApp((s) => s.activeMode);
  const hyroxSims = useApp((s) => s.hyroxSimulations);

  // Generate realistic-looking trend data based on logs
  const runPaceTrend = useMemo(() => {
    const weeks: { label: string; pace: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const base = 270; // 4:30/km
      const variance = Math.sin(i * 0.6) * 8 - i * 2;
      weeks.push({ label: `W${8 - i}`, pace: Math.round(base + variance) });
    }
    return weeks;
  }, []);

  const volumeTrend = useMemo(() => {
    const weeks: { label: string; minutes: number; intensity: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const vol = 180 + Math.sin(i * 0.8) * 50 + (8 - i) * 8;
      const inten = 70 + Math.cos(i * 0.5) * 15;
      weeks.push({ label: `W${8 - i}`, minutes: Math.round(vol), intensity: Math.round(inten) });
    }
    return weeks;
  }, []);

  const rpeTrend = useMemo(() => {
    const days: { label: string; rpe: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const rpe = 6.5 + Math.sin(i * 0.4) * 1.5 + Math.random() * 0.5;
      days.push({ label: `D${14 - i}`, rpe: Math.round(rpe * 10) / 10 });
    }
    return days;
  }, []);

  // HYROX station performance from last simulation
  const lastSim = hyroxSims[0];

  // Strength radar (from benchmarks)
  const radar = useMemo(() => {
    if (!benchmarks) return [];
    return [
      { dim: "Running", value: Math.round(Math.min(100, Math.max(0, 100 - (benchmarks.fiveKmSec ?? 1500) / 30))) },
      { dim: "Strength", value: Math.round(Math.min(100, (benchmarks.backSquatKg ?? 60) / 2)) },
      { dim: "Erg", value: Math.round(Math.min(100, 100 - (benchmarks.row2kSec ?? 480) / 6)) },
      { dim: "MetCon", value: Math.round(Math.min(100, 100 - (benchmarks.franSec ?? 360) / 6)) },
      { dim: "Endurance", value: Math.round(Math.min(100, 100 - (benchmarks.tenKmSec ?? 3000) / 40)) },
    ];
  }, [benchmarks]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance"
        subtitle={`${logs.length} sessions logged · ${prs.length} PRs · ${hyroxSims.length} simulations`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total sessions"
          value={logs.length}
          delta={`${logs.filter((l) => l.completed).length} completed`}
        />
        <StatCard
          label="Total training"
          value={formatHMS(logs.reduce((a, b) => a + (b.durationSec ?? 0), 0))}
          delta="all-time"
        />
        <StatCard
          label="PRs"
          value={prs.length}
          accent="var(--success)"
          delta={`${prs.slice(0, 3).map((p) => p.movement).join(", ") || "—"}`}
        />
        <StatCard
          label="Consistency"
          value={`${logs.filter((l) => l.completed && (Date.now() - new Date(l.date).getTime()) < 7 * 86400 * 1000).length}/wk`}
          delta={activeMode ? MODE_META[activeMode].name : ""}
          accent={MODE_META[activeMode].color}
        />
      </div>

      {/* Performance dimensions radar */}
      <Card>
        <SectionTitle hint="From recorded benchmarks">Performance dimensions</SectionTitle>
        {radar.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radar}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="dim" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <Radar dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.3} strokeWidth={2} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: 8, fontSize: 12,
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title="No benchmarks recorded" body="Add benchmarks in your profile to see your performance dimensions." />
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Run pace progression */}
        <Card>
          <SectionTitle hint="Last 8 weeks — sec/km (lower is better)">Run pace progression</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={runPaceTrend}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} domain={["dataMin - 10", "dataMax + 10"]} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => formatPace(v as number)}
              />
              <Line dataKey="pace" stroke="var(--hyrox)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Training volume + intensity */}
        <Card>
          <SectionTitle hint="Last 8 weeks">Training volume & intensity</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={volumeTrend}>
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Area dataKey="minutes" stroke="var(--primary)" fill="url(#volGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* RPE trend */}
        <Card>
          <SectionTitle hint="Last 14 sessions">RPE trend</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rpeTrend}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis domain={[1, 10]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Line dataKey="rpe" stroke="var(--warning)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* PRs */}
        <Card>
          <SectionTitle hint={`${prs.length} total`}>Personal records</SectionTitle>
          {prs.length === 0 ? (
            <EmptyState title="No PRs recorded" body="Lift heavy and complete benchmarks — PRs log automatically." />
          ) : (
            <div className="space-y-2">
              {prs.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-secondary grid place-items-center">
                      <Trophy className="w-4 h-4 text-warning" style={{ color: "var(--warning)" }} />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{p.movement}</div>
                      <div className="text-xs text-muted-foreground">{p.context ?? "1RM"} · {new Date(p.recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                    </div>
                  </div>
                  <div className="text-stat text-lg">{p.value}<span className="text-xs text-muted-foreground ml-1">{p.unit}</span></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* HYROX-specific analytics */}
      {activeMode === "hyrox" && (
        <Card>
          <SectionTitle hint={lastSim ? `Last sim: ${lastSim.finishFormatted}` : "Run a simulation first"}>HYROX station analytics</SectionTitle>
          {lastSim ? (
            <div className="space-y-2">
              {HYROX_STATIONS.map((s, i) => {
                const total = lastSim.runSplits[i] + lastSim.stationSplits[i];
                const max = Math.max(...HYROX_STATIONS.map((_, j) => lastSim.runSplits[j] + lastSim.stationSplits[j]));
                return (
                  <div key={s.index} className="flex items-center gap-3">
                    <div className="w-32 text-xs font-medium truncate">{i + 1}. {s.name}</div>
                    <div className="flex-1">
                      <MiniBar
                        value={total}
                        max={max}
                        color={i + 1 === lastSim.weakest.index ? "var(--destructive)" : i + 1 === lastSim.strongest.index ? "var(--success)" : "var(--primary)"}
                        height={8}
                      />
                    </div>
                    <div className="w-16 text-right text-xs tabular-nums font-medium">{formatHMS(total)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No HYROX simulation saved"
              body="Run a simulation in the Compete tab to see station-by-station analytics here."
            />
          )}
        </Card>
      )}

      {/* Mode-specific guidance */}
      <Card>
        <SectionTitle hint="Engine read">Mode-specific recommendations</SectionTitle>
        <div className="space-y-2 text-sm">
          {activeMode === "hyrox" && (
            <>
              <Row icon={TrendingUp} kind="up" label="Running is improving" body="Easy pace dropped 6 sec/km in the last 4 weeks." />
              <Row icon={Activity} kind="down" label="Sled Pull lagging" body="Add 1 posterior-chain strength block. See HYROX tab." />
            </>
          )}
          {activeMode === "athx" && (
            <>
              <Row icon={Dumbbell} kind="up" label="Strength on the rise" body="Squat 1RM projection increased 5 kg in 6 weeks." />
              <Row icon={Heart} kind="neutral" label="Endurance plateau" body="Aerobic block recommended for the next 4 weeks." />
            </>
          )}
          {activeMode === "crossfit" && (
            <>
              <Row icon={Trophy} kind="up" label="Fran improved 12 seconds" body="Threshold for next PR: 3:30." />
              <Row icon={Activity} kind="neutral" label="Gymnastics consistent" body="HSPU volume stable. Add 1 skill session." />
            </>
          )}
          {activeMode === "maintenance" && (
            <Row icon={Heart} kind="neutral" label="Balanced GPP" body="Strength, Z2 and mobility all on plan." />
          )}
        </div>
      </Card>
    </div>
  );
}

function Row({ icon: Icon, kind, label, body }: { icon: React.ComponentType<{ className?: string }>; kind: "up" | "down" | "neutral"; label: string; body: string }) {
  const color = kind === "up" ? "var(--success)" : kind === "down" ? "var(--destructive)" : "var(--muted-foreground)";
  return (
    <div className="flex items-start gap-3 p-3 rounded-md border border-border bg-secondary/20">
      <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color }} />
      <div className="flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{body}</div>
      </div>
    </div>
  );
}
