"use client";

import { useState } from "react";
import { useApp } from "@/store/app-store";
import {
  Card, PageHeader, SectionTitle, Pill, EmptyState,
} from "@/components/hybrid/blocks/ui";
import { MODE_META, TrainingMode, BenchmarkInput } from "@/types";
import { formatHMS, formatPace } from "@/lib/competition-rules/hyrox";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Pencil, ArrowRightLeft, X,
} from "lucide-react";

type ModeIntent = "replace" | "add" | "pause";

interface RecentCompetition {
  id: string;
  name: string;
  division: string;
  result: string;
  mode: TrainingMode;
  date: string;
}

const RECENT_COMPETITIONS: RecentCompetition[] = [
  {
    id: "rc1",
    name: "HYROX London 2026",
    division: "Open",
    result: "Finish 1:18:30",
    mode: "hyrox",
    date: "2026-10-12",
  },
  {
    id: "rc2",
    name: "ATHX Qualifier 2026",
    division: "Individual",
    result: "EPS 64 (estimated)",
    mode: "athx",
    date: "2026-06-04",
  },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON_SUN_ORDER = [1, 2, 3, 4, 5, 6, 0];
const ALL_MODES: TrainingMode[] = ["hyrox", "athx", "crossfit", "maintenance"];

interface BenchmarkDef {
  label: string;
  value?: number;
  format: (v: number) => string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

function buildBenchmarkDefs(b: BenchmarkInput | null): BenchmarkDef[] {
  if (!b) return [];
  return [
    { label: "5 km run", value: b.fiveKmSec, format: (v) => formatHMS(v) },
    { label: "10 km run", value: b.tenKmSec, format: (v) => formatHMS(v) },
    { label: "1 km pace", value: b.oneKmPaceSec, format: (v) => formatPace(v) },
    { label: "Back squat", value: b.backSquatKg, format: (v) => `${v} kg` },
    { label: "Deadlift", value: b.deadliftKg, format: (v) => `${v} kg` },
    { label: "Strict press", value: b.strictPressKg, format: (v) => `${v} kg` },
    { label: "2 km row", value: b.row2kSec, format: (v) => formatHMS(v) },
    { label: "1 km SkiErg", value: b.skierg1kSec, format: (v) => formatHMS(v) },
    { label: "Fran", value: b.franSec, format: (v) => formatHMS(v) },
    { label: "Grace", value: b.graceSec, format: (v) => formatHMS(v) },
    { label: "Prior HYROX finish", value: b.priorHyroxFinishSec, format: (v) => formatHMS(v) },
    { label: "Prior ATHX FitScore", value: b.priorAthxScore, format: (v) => `${v}/100` },
  ];
}

export function ProfileView() {
  const profile = useApp((s) => s.profile);
  const prefs = useApp((s) => s.preferences);
  const benchmarks = useApp((s) => s.benchmarks);
  const activeMode = useApp((s) => s.activeMode);
  const prs = useApp((s) => s.prs);
  const switchMode = useApp((s) => s.switchMode);
  const pushToast = useApp((s) => s.pushToast);
  const [pendingMode, setPendingMode] = useState<TrainingMode | null>(null);

  function confirmIntent(intent: ModeIntent) {
    if (!pendingMode) return;
    switchMode(pendingMode, intent);
    setPendingMode(null);
  }

  const benchmarkDefs = buildBenchmarkDefs(benchmarks);
  const recordedBenchmarks = benchmarkDefs.filter(
    (b) => b.value !== undefined && b.value !== null,
  );

  const displayName = profile?.displayName ?? "Athlete";
  const trainingAge = profile?.trainingAge ?? "—";
  const background = profile?.background ?? "—";
  const location = profile?.location ?? null;
  const initials = getInitials(displayName);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <PageHeader
        title="Profile"
        subtitle="One athlete. One history. Multiple competition formats."
      />

      {/* Top section: avatar + identity + mode switching */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground grid place-items-center text-xl font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight">{displayName}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
              <span className="capitalize">{trainingAge} training age</span>
              <span className="opacity-50">·</span>
              <span className="capitalize">{background} background</span>
              {location && (
                <>
                  <span className="opacity-50">·</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {location}
                  </span>
                </>
              )}
            </div>

            {/* Mode switching panel */}
            <div className="mt-4 p-3 rounded-md border border-border bg-secondary/20">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">
                Mode switching
              </div>
              <div className="flex flex-wrap gap-2">
                {ALL_MODES.map((m) => (
                  <Pill
                    key={m}
                    color={MODE_META[m].color}
                    active={activeMode === m}
                    onClick={() => setPendingMode(m)}
                  >
                    {MODE_META[m].name}
                  </Pill>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Active training focus */}
      <Card>
        <SectionTitle hint="Current focus">Active training focus</SectionTitle>
        <div className="flex items-start gap-3 mb-4 p-3 rounded-md border border-border bg-secondary/20">
          <span
            className="w-3 h-3 rounded-full mt-1.5 shrink-0"
            style={{ background: MODE_META[activeMode].color }}
          />
          <div className="min-w-0">
            <div className="font-semibold">{MODE_META[activeMode].name}</div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {MODE_META[activeMode].tagline}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">
              {MODE_META[activeMode].description}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ALL_MODES.map((m) => {
            const active = activeMode === m;
            return (
              <button
                key={m}
                onClick={() => setPendingMode(m)}
                className={`p-3 rounded-md border text-left transition ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-secondary/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: MODE_META[m].color }}
                  />
                  <div className="text-sm font-semibold">{MODE_META[m].name}</div>
                </div>
                <div className="text-[11px] text-muted-foreground line-clamp-2">
                  {MODE_META[m].tagline}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Benchmarks */}
        <Card>
          <SectionTitle hint={`${recordedBenchmarks.length} recorded`}>
            Benchmarks
          </SectionTitle>
          {recordedBenchmarks.length === 0 ? (
            <EmptyState
              title="No benchmarks recorded"
              body="Complete onboarding or re-run onboarding to record your benchmark inputs."
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {recordedBenchmarks.map((b) => (
                <div
                  key={b.label}
                  className="p-3 rounded-md border border-border bg-secondary/20"
                >
                  <div className="text-[11px] text-muted-foreground uppercase tracking-widest">
                    {b.label}
                  </div>
                  <div className="text-stat text-lg mt-1.5">
                    {b.format(b.value as number)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() =>
              pushToast({
                kind: "info",
                title: "Edit benchmarks",
                body: "Re-run onboarding to update benchmarks.",
              })
            }
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-secondary transition"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        </Card>

        {/* Personal records */}
        <Card>
          <SectionTitle hint={`${prs.length} total`}>Personal records</SectionTitle>
          {prs.length === 0 ? (
            <EmptyState
              title="No personal records yet"
              body="Benchmarks and strength sessions record PRs automatically. Complete a few sessions to populate this list."
            />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin pr-1">
              {prs.map((p, i) => (
                <div
                  key={`${p.movement}-${i}`}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0 gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {p.movement}
                      {p.context ? ` · ${p.context}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.recordedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="text-stat text-lg shrink-0">
                    {p.value}{" "}
                    <span className="text-xs text-muted-foreground">{p.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent competitions */}
      <Card>
        <SectionTitle hint="User-submitted">Recent competitions</SectionTitle>
        <div className="space-y-2">
          {RECENT_COMPETITIONS.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 p-3 rounded-md border border-border"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-1.5 h-10 rounded-full shrink-0"
                  style={{ background: MODE_META[c.mode].color }}
                />
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Pill color={MODE_META[c.mode].color}>
                      {MODE_META[c.mode].name}
                    </Pill>
                    <span>{c.division}</span>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold">{c.result}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(c.date).toLocaleDateString(undefined, {
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          HYBRID is not affiliated with these events; results are user-submitted.
        </div>
      </Card>

      {/* Training preferences */}
      <Card>
        <SectionTitle hint="From onboarding">Training preferences</SectionTitle>
        {!prefs ? (
          <EmptyState
            title="No preferences recorded"
            body="Complete onboarding to record your training preferences."
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <PrefRow label="Days / week" value={`${prefs.daysPerWeek}`} />
            <PrefRow label="Session minutes" value={`${prefs.sessionMinutes}`} />
            <PrefRow
              label="Location"
              value={prefs.location.replace(/_/g, " ")}
              capitalize
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="text-[11px] text-muted-foreground uppercase tracking-widest mb-2">
                Preferred days
              </div>
              <div className="flex flex-wrap gap-1.5">
                {MON_SUN_ORDER.map((d) => {
                  const active = prefs.preferredDays.includes(d);
                  return (
                    <span
                      key={d}
                      className={`text-xs px-2.5 py-1 rounded-md border ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {DAY_LABELS[d]}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="text-[11px] text-muted-foreground uppercase tracking-widest mb-2">
                Equipment ({prefs.equipment.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {prefs.equipment.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    No equipment specified.
                  </span>
                ) : (
                  prefs.equipment.map((e) => (
                    <span
                      key={e}
                      className="text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground capitalize"
                    >
                      {e.replace(/_/g, " ")}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Mode switch modal */}
      <AnimatePresence>
        {pendingMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setPendingMode(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              className="rounded-lg border border-border bg-card p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-md grid place-items-center shrink-0"
                    style={{ background: MODE_META[pendingMode].color }}
                  >
                    <ArrowRightLeft className="w-5 h-5 text-background" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">
                      Switch to {MODE_META[pendingMode].name}?
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {MODE_META[pendingMode].tagline}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setPendingMode(null)}
                  className="text-muted-foreground hover:text-foreground transition shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                <IntentButton
                  title="Replace"
                  body="Replace your current focus. Training history is preserved."
                  onClick={() => confirmIntent("replace")}
                />
                <IntentButton
                  title="Add"
                  body="Keep current mode sessions and add this as a secondary focus."
                  onClick={() => confirmIntent("add")}
                />
                <IntentButton
                  title="Pause"
                  body="Pause competition prep and switch to Maintenance."
                  onClick={() => confirmIntent("pause")}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PrefRow({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="p-3 rounded-md border border-border bg-secondary/20">
      <div className="text-[11px] text-muted-foreground uppercase tracking-widest">
        {label}
      </div>
      <div className={`text-stat text-lg mt-1.5 ${capitalize ? "capitalize" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function IntentButton({
  title,
  body,
  onClick,
}: {
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full p-3 rounded-md border border-border hover:bg-secondary/30 transition text-left"
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{body}</div>
    </button>
  );
}
