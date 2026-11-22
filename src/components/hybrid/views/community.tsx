"use client";

import { useState } from "react";
import { useApp } from "@/store/app-store";
import {
  Card, PageHeader, SectionTitle, StatCard, Pill, MiniBar,
} from "@/components/hybrid/blocks/ui";
import { MODE_META, TrainingMode } from "@/types";
import { motion } from "framer-motion";
import {
  Trophy, Users, Flame, Activity, Clock, ShieldCheck,
} from "lucide-react";

interface Challenge {
  id: string;
  name: string;
  mode: TrainingMode;
  joined: number;
  weeksLeft: number;
  progress: number;
}

const CHALLENGES: Challenge[] = [
  { id: "c1", name: "30-day running challenge", mode: "hyrox", joined: 1240, weeksLeft: 2, progress: 45 },
  { id: "c2", name: "HYROX station challenge", mode: "hyrox", joined: 820, weeksLeft: 3, progress: 12 },
  { id: "c3", name: "5 km improvement challenge", mode: "athx", joined: 612, weeksLeft: 4, progress: 0 },
  { id: "c4", name: "Strength progression challenge", mode: "crossfit", joined: 1052, weeksLeft: 6, progress: 30 },
];

interface LeaderboardRow {
  rank: number;
  name: string;
  mode: TrainingMode;
  points: number;
}

const LEADERBOARD: LeaderboardRow[] = [
  { rank: 1, name: "A. Volkov", mode: "crossfit", points: 4120 },
  { rank: 2, name: "M. Lindqvist", mode: "hyrox", points: 3980 },
  { rank: 3, name: "S. Costa", mode: "athx", points: 3845 },
  { rank: 4, name: "J. Petersen", mode: "hyrox", points: 3720 },
  { rank: 5, name: "L. Aydin", mode: "crossfit", points: 3650 },
];

interface ActivityItem {
  id: string;
  icon: typeof Trophy;
  name: string;
  action: string;
  time: string;
  color: string;
}

const ACTIVITY: ActivityItem[] = [
  { id: "a1", icon: Flame, name: "A. Volkov", action: "completed Fran in 3:12", time: "2h ago", color: "var(--crossfit)" },
  { id: "a2", icon: Trophy, name: "M. Lindqvist", action: "hit a new PR Deadlift 180 kg", time: "4h ago", color: "var(--hyrox)" },
  { id: "a3", icon: Activity, name: "S. Costa", action: "finished HYROX simulation 1:14:30", time: "1d ago", color: "var(--hyrox)" },
  { id: "a4", icon: Users, name: "J. Petersen", action: "joined the 30-day running challenge", time: "2d ago", color: "var(--athx)" },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function CommunityView() {
  const profile = useApp((s) => s.profile);
  const pushToast = useApp((s) => s.pushToast);
  const [joined, setJoined] = useState<Record<string, boolean>>({});

  function handleJoin(c: Challenge) {
    const isCurrentlyJoined = !!joined[c.id];
    setJoined((prev) => ({ ...prev, [c.id]: !prev[c.id] }));
    if (!isCurrentlyJoined) {
      pushToast({ kind: "success", title: `Joined ${c.name}` });
    }
  }

  const myName = profile?.displayName ?? "You";
  const myPoints = 1820;
  const myRank = 348;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <PageHeader
        title="Community"
        subtitle="Athletes, challenges and leaderboards — without the social noise."
      />

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Athletes worldwide" value="12,480" accent="var(--primary)" />
        <StatCard label="Active challenges" value={8} accent="var(--hyrox)" />
        <StatCard label="Public workouts shared" value="1,932" accent="var(--athx)" />
        <StatCard label="Coaches verified" value={47} accent="var(--maint)" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Active challenges */}
        <Card className="lg:col-span-2">
          <SectionTitle hint="4 live">Active challenges</SectionTitle>
          <div className="space-y-3">
            {CHALLENGES.map((c) => {
              const isJoined = !!joined[c.id];
              return (
                <div
                  key={c.id}
                  className="p-4 rounded-md border border-border hover:bg-secondary/20 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold">{c.name}</div>
                        <Pill color={MODE_META[c.mode].color}>{MODE_META[c.mode].name}</Pill>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {c.joined.toLocaleString()} joined · {c.weeksLeft} weeks left
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoin(c)}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                        isJoined
                          ? "border border-border text-muted-foreground hover:bg-secondary"
                          : "bg-primary text-primary-foreground hover:opacity-90"
                      }`}
                    >
                      {isJoined ? "Joined" : "Join"}
                    </button>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                      <span>Your progress</span>
                      <span className="tabular-nums">{c.progress}%</span>
                    </div>
                    <MiniBar
                      value={c.progress}
                      max={100}
                      color={MODE_META[c.mode].color}
                      height={6}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Leaderboard */}
        <Card>
          <SectionTitle hint="Top 5">Leaderboard</SectionTitle>
          <div className="space-y-1.5">
            {LEADERBOARD.map((row) => (
              <div
                key={row.rank}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/20 transition"
              >
                <div
                  className={`w-7 text-center text-xs font-bold ${
                    row.rank <= 3 ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {row.rank}
                </div>
                <div className="w-9 h-9 rounded-full bg-secondary text-xs font-bold grid place-items-center shrink-0">
                  {getInitials(row.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{row.name}</div>
                  <div className="mt-1">
                    <Pill color={MODE_META[row.mode].color}>{MODE_META[row.mode].name}</Pill>
                  </div>
                </div>
                <div className="text-stat text-sm tabular-nums shrink-0">
                  {row.points.toLocaleString()}
                </div>
              </div>
            ))}
            <div className="my-2 border-t border-dashed border-border" />
            <div className="flex items-center gap-3 p-2 rounded-md border border-primary bg-primary/10">
              <div className="w-7 text-center text-xs font-bold text-primary">{myRank}</div>
              <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground text-xs font-bold grid place-items-center shrink-0">
                {getInitials(myName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">
                  {myName} <span className="text-xs text-muted-foreground">(you)</span>
                </div>
              </div>
              <div className="text-stat text-sm tabular-nums text-primary shrink-0">
                {myPoints.toLocaleString()}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Activity feed */}
        <Card className="lg:col-span-2">
          <SectionTitle hint="Last 48h">Activity feed</SectionTitle>
          <div className="space-y-2">
            {ACTIVITY.map((a) => {
              const Icon = a.icon;
              return (
                <div
                  key={a.id}
                  className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-secondary/20 transition"
                >
                  <div
                    className="w-9 h-9 rounded-full bg-secondary grid place-items-center shrink-0"
                    style={{ color: a.color }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span className="font-semibold">{a.name}</span>{" "}
                      <span className="text-muted-foreground">{a.action}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {a.time}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Privacy */}
        <Card>
          <SectionTitle hint="Your data">Privacy</SectionTitle>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-secondary text-info grid place-items-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-sm text-muted-foreground">
              Your workout and performance sharing is configurable. Default
              visibility is{" "}
              <span className="text-foreground font-medium">friends</span>. You
              can change this in Settings.
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            HYBRID never shares data with competition organizers unless you
            explicitly publish a result.
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
