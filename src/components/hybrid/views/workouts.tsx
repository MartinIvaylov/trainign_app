"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/store/app-store";
import { Card, PageHeader, Pill, SectionTitle, EmptyState } from "@/components/hybrid/blocks/ui";
import { MODE_META, TrainingMode } from "@/types";
import { CROSSFIT_BENCHMARKS } from "@/lib/competition-rules/crossfit";
import { HYROX_STATIONS } from "@/lib/competition-rules/hyrox";
import { motion } from "framer-motion";
import { Dumbbell, Plus, Search, Play, ChevronRight } from "lucide-react";

interface LibraryWorkout {
  id: string;
  title: string;
  mode: TrainingMode;
  type: string;
  duration?: string;
  description: string;
  rx?: string;
  movements: { name: string; reps?: string; note?: string }[];
}

export function WorkoutsView() {
  const setAppView = useApp((s) => s.setAppView);
  const activeMode = useApp((s) => s.activeMode);
  const [filter, setFilter] = useState<TrainingMode | "all">("all");
  const [query, setQuery] = useState("");

  const all = useMemo((): LibraryWorkout[] => {
    const cf = CROSSFIT_BENCHMARKS.map((b) => ({
      id: `cf-${b.slug}`,
      title: b.name,
      mode: "crossfit" as TrainingMode,
      type: b.type.replace("_", " "),
      duration: b.cap ? `${b.cap} min cap` : undefined,
      description: b.description,
      rx: b.rx.men,
      movements: b.movements,
    }));

    const hyrox = [
      { id: "hx-sim-1", title: "HYROX Race Simulation (Full)", mode: "hyrox" as TrainingMode, type: "race_sim", duration: "75 min", description: "Full race simulation with all 8 stations and 8 × 1 km runs.", movements: [] },
      { id: "hx-station-1", title: "SkiErg + Row Conditioning", mode: "hyrox" as TrainingMode, type: "conditioning", duration: "45 min", description: "1 km SkiErg + 1 km row × 3 rounds, easy pace.", movements: [] },
      { id: "hx-station-2", title: "Sled Practice (Push + Pull)", mode: "hyrox" as TrainingMode, type: "strength", duration: "40 min", description: "Sled push 4×20m + sled pull 4×20m, race load.", movements: [] },
      { id: "hx-intervals", title: "HYROX Run Intervals", mode: "hyrox" as TrainingMode, type: "interval", duration: "50 min", description: "8×400m at 5km pace, 90s rest.", movements: [] },
    ];

    const athx = [
      { id: "ax-mc-1", title: "MetCon-X Test A (AMRAP 20)", mode: "athx" as TrainingMode, type: "amrap", duration: "20 min", description: "Standard MetCon-X simulation. Score is total reps.", movements: [] },
      { id: "ax-str-1", title: "ATHX Strength Block — Squat", mode: "athx" as TrainingMode, type: "strength", duration: "75 min", description: "Back squat 5×5, accessory work.", movements: [] },
      { id: "ax-end-1", title: "ATHX Endurance — 5km + 2km row", mode: "athx" as TrainingMode, type: "interval", duration: "60 min", description: "5km threshold run + 2km row time trial.", movements: [] },
    ];

    const maint = [
      { id: "mn-z2-1", title: "Zone 2 Run / Row", mode: "maintenance" as TrainingMode, type: "run", duration: "45 min", description: "Easy aerobic, 65-75% max HR.", movements: [] },
      { id: "mn-mob-1", title: "Mobility + Recovery", mode: "maintenance" as TrainingMode, type: "mobility", duration: "30 min", description: "Foam roll + 20 min mobility flow.", movements: [] },
    ];

    return [...hyrox, ...athx, ...cf, ...maint];
  }, []);

  const filtered = all.filter((w) => {
    if (filter !== "all" && w.mode !== filter) return false;
    if (query && !w.title.toLowerCase().includes(query.toLowerCase()) && !w.description?.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workout library"
        subtitle="HYROX, ATHX, CrossFit and Maintenance sessions. Add your own in Profile."
        actions={
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition">
            <Plus className="w-3.5 h-3.5" /> Create workout
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-secondary/30 flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workouts..."
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((w) => (
          <motion.div
            key={w.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card hover className="h-full flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full" style={{ background: MODE_META[w.mode].color }} />
                  {MODE_META[w.mode].name} · {w.type}
                </div>
                {w.duration && <div className="text-xs text-muted-foreground">{w.duration}</div>}
              </div>
              <h3 className="font-semibold mt-2">{w.title}</h3>
              {w.description && <p className="text-xs text-muted-foreground mt-1.5 flex-1">{w.description}</p>}
              {w.movements && w.movements.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {w.movements.slice(0, 4).map((m, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                      {m.name}{m.reps ? ` ${m.reps}` : ""}
                    </span>
                  ))}
                  {w.movements.length > 4 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                      +{w.movements.length - 4}
                    </span>
                  )}
                </div>
              )}
              {w.rx && (
                <div className="mt-3 text-[10px] text-muted-foreground">
                  RX: <span className="text-foreground">{w.rx}</span>
                </div>
              )}
              <button
                onClick={() => setAppView("train")}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <Play className="w-3 h-3" /> Start session <ChevronRight className="w-3 h-3" />
              </button>
            </Card>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState title="No workouts match" body="Try a different filter or search query." />
      )}
    </div>
  );
}
