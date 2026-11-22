"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/store/app-store";
import {
  Card,
  PageHeader,
  SectionTitle,
  StatCard,
  Pill,
  MiniBar,
} from "@/components/hybrid/blocks/ui";
import { MODE_META, TrainingMode } from "@/types";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  UserPlus,
  Search,
  Award,
  Trophy,
  BarChart3,
  Download,
  Plus,
  Dumbbell,
  Calendar,
  TrendingUp,
  MapPin,
} from "lucide-react";

interface MemberRow {
  id: string;
  name: string;
  tier: "Free" | "Pro" | "Coach";
  mode: TrainingMode;
  lastSession: string;
  status: "active" | "paused" | "injured";
}

const MEMBERS: MemberRow[] = [
  { id: "m1", name: "L. Petrova",   tier: "Pro",    mode: "hyrox",       lastSession: "2025-04-12", status: "active"  },
  { id: "m2", name: "M. Hristov",    tier: "Pro",    mode: "crossfit",    lastSession: "2025-04-11", status: "active"  },
  { id: "m3", name: "S. Ivanova",    tier: "Free",   mode: "athx",        lastSession: "2025-04-09", status: "active"  },
  { id: "m4", name: "D. Kostov",     tier: "Pro",    mode: "hyrox",       lastSession: "2025-03-28", status: "paused"  },
  { id: "m5", name: "P. Vasileva",   tier: "Coach",  mode: "crossfit",    lastSession: "2025-04-12", status: "active"  },
  { id: "m6", name: "N. Todorov",    tier: "Free",   mode: "maintenance", lastSession: "2025-04-10", status: "active"  },
  { id: "m7", name: "E. Apostolov",  tier: "Pro",    mode: "athx",        lastSession: "2025-04-02", status: "injured" },
  { id: "m8", name: "R. Mitova",     tier: "Free",   mode: "hyrox",       lastSession: "2025-04-11", status: "active"  },
];

interface CoachRow {
  id: string;
  name: string;
  role: "Lead coach" | "Assistant coach";
  specialties: string;
  athletes: number;
  verified: boolean;
}

const COACHES: CoachRow[] = [
  { id: "co1", name: "I. Dimitrov",  role: "Lead coach",      specialties: "HYROX, Strength",      athletes: 24, verified: true  },
  { id: "co2", name: "K. Nikolova",  role: "Lead coach",      specialties: "CrossFit, Endurance",  athletes: 18, verified: true  },
  { id: "co3", name: "V. Stoyanov",  role: "Assistant coach", specialties: "Mobility, Recovery",   athletes: 6,  verified: false },
];

interface ChallengeRow {
  id: string;
  name: string;
  joined: number;
  daysLeft: number;
  progress: number;
  mode: TrainingMode;
}

const CHALLENGES: ChallengeRow[] = [
  { id: "ch1", name: "Box-wide 30-day running challenge", joined: 47, daysLeft: 12, progress: 35, mode: "hyrox"    },
  { id: "ch2", name: "HYROX station challenge",            joined: 32, daysLeft: 21, progress: 8,  mode: "hyrox"    },
];

interface GroupProgram {
  id: string;
  name: string;
  weeks: number;
  enrolled: number;
  coach: string;
  mode: TrainingMode;
}

const PROGRAMS: GroupProgram[] = [
  { id: "p1", name: "HYROX Open Prep",       weeks: 8, enrolled: 24, coach: "I. Dimitrov", mode: "hyrox"       },
  { id: "p2", name: "CrossFit Open Prep",    weeks: 6, enrolled: 18, coach: "K. Nikolova", mode: "crossfit"    },
  { id: "p3", name: "Beginner Foundations",  weeks: 4, enrolled: 12, coach: "V. Stoyanov", mode: "maintenance" },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const firstInitial = (parts[0]?.[0] ?? "").toUpperCase();
  const lastInitial = parts.length > 1
    ? (parts[parts.length - 1]?.[0] ?? "").toUpperCase()
    : "";
  return `${firstInitial}${lastInitial}` || "?";
}

const STATUS_STYLES: Record<MemberRow["status"], { text: string; dot: string; label: string }> = {
  active:  { text: "text-success",    dot: "bg-success",    label: "Active"  },
  paused:  { text: "text-warning",    dot: "bg-warning",    label: "Paused"  },
  injured: { text: "text-destructive", dot: "bg-destructive", label: "Injured" },
};

const TIER_STYLES: Record<MemberRow["tier"], string> = {
  Free:   "text-muted-foreground",
  Pro:    "text-primary",
  Coach:  "text-info",
};

export function GymView() {
  const pushToast = useApp((s) => s.pushToast);

  const [gymProfile, setGymProfile] = useState({
    name: "Iron Foundation HYBRID Box",
    location: "Sofia, BG",
    description: "CrossFit box + HYROX training studio",
    capacity: 80,
  });

  const [memberFilter, setMemberFilter] = useState<"all" | "active" | "paused">("all");
  const [memberSearch, setMemberSearch] = useState("");

  const filteredMembers = useMemo(() => {
    return MEMBERS.filter((m) => {
      if (memberFilter === "active" && m.status !== "active") return false;
      if (memberFilter === "paused" && m.status !== "paused") return false;
      if (memberSearch && !m.name.toLowerCase().includes(memberSearch.toLowerCase())) return false;
      return true;
    });
  }, [memberFilter, memberSearch]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <PageHeader
        title="Gym"
        subtitle="Manage your facility, members, coaches, and challenges."
        actions={
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium">
            <Building2 className="w-3.5 h-3.5 text-primary" />
            Gym tier
          </span>
        }
      />

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active members"     value={64}   delta="+4 this month"       accent="var(--primary)"  />
        <StatCard label="Coaches"            value={3}    delta="2 lead, 1 assistant" accent="var(--athx)"     />
        <StatCard label="Active challenges"   value={2}    delta="1 gym-wide"          accent="var(--crossfit)"  />
        <StatCard label="Monthly retention"  value="92%"  delta="+3% vs last month"   deltaKind="up" accent="var(--success)" />
      </div>

      {/* Gym profile + Member roster */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Gym profile */}
        <Card className="lg:col-span-1">
          <SectionTitle hint="Editable">
            <span className="inline-flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Gym profile
            </span>
          </SectionTitle>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Gym name</label>
              <input
                value={gymProfile.name}
                onChange={(e) => setGymProfile({ ...gymProfile, name: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none focus:border-foreground/40 transition"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Location</label>
              <div className="mt-1 relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  value={gymProfile.location}
                  onChange={(e) => setGymProfile({ ...gymProfile, location: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none focus:border-foreground/40 transition"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Description</label>
              <textarea
                value={gymProfile.description}
                onChange={(e) => setGymProfile({ ...gymProfile, description: e.target.value })}
                rows={3}
                className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none focus:border-foreground/40 transition resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Member capacity</label>
              <input
                type="number"
                value={gymProfile.capacity}
                onChange={(e) => setGymProfile({ ...gymProfile, capacity: Number(e.target.value) })}
                className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-secondary/30 text-sm outline-none focus:border-foreground/40 transition"
              />
            </div>
            <button
              onClick={() => pushToast({ kind: "success", title: "Gym profile saved" })}
              className="w-full mt-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
            >
              Save profile
            </button>
          </div>
        </Card>

        {/* Member roster */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Member roster
            </h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search members..."
                className="pl-8 pr-3 py-1.5 rounded-md border border-border bg-secondary/30 text-xs outline-none focus:border-foreground/40 transition w-44 sm:w-56"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 mb-3">
            {(["all", "active", "paused"] as const).map((f) => (
              <Pill key={f} active={memberFilter === f} onClick={() => setMemberFilter(f)}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </Pill>
            ))}
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredMembers.length} of {MEMBERS.length}
            </span>
          </div>

          <div className="space-y-1.5 max-h-[440px] overflow-y-auto scrollbar-thin pr-1">
            {filteredMembers.map((m) => {
              const st = STATUS_STYLES[m.status];
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 p-2.5 rounded-md border border-border hover:bg-secondary/20 transition"
                >
                  <div className="w-9 h-9 rounded-full bg-secondary text-xs font-bold grid place-items-center shrink-0">
                    {getInitials(m.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{m.name}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] uppercase tracking-widest font-medium ${TIER_STYLES[m.tier]}`}>
                        {m.tier}
                      </span>
                      <Pill color={MODE_META[m.mode].color}>{MODE_META[m.mode].name}</Pill>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {m.lastSession}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-medium ${st.text}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                    <button
                      onClick={() => pushToast({ kind: "info", title: "Open athlete profile" })}
                      className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-secondary transition"
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredMembers.length === 0 && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No members match the current filter.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Coaches + Challenges */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Coaches */}
        <Card>
          <SectionTitle hint="3 active">
            <span className="inline-flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              Coaches
            </span>
          </SectionTitle>
          <div className="space-y-2">
            {COACHES.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-md border border-border hover:bg-secondary/20 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full bg-secondary text-xs font-bold grid place-items-center shrink-0">
                      {getInitials(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {c.role} · {c.specialties}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">
                          {c.athletes} athletes
                        </span>
                        {c.verified ? (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-medium text-success">
                            <span className="w-1.5 h-1.5 rounded-full bg-success" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-medium text-warning">
                            <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => pushToast({ kind: "info", title: "Manage coach", body: c.name })}
                    className="shrink-0 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-secondary transition"
                  >
                    Manage
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => pushToast({ kind: "info", title: "Coach invite sent" })}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md border border-border text-sm font-semibold hover:bg-secondary transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Invite coach
          </button>
        </Card>

        {/* Gym-wide challenges */}
        <Card>
          <SectionTitle hint="2 live">
            <span className="inline-flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              Gym-wide challenges
            </span>
          </SectionTitle>
          <div className="space-y-3">
            {CHALLENGES.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-md border border-border hover:bg-secondary/20 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold">{c.name}</div>
                      <Pill color={MODE_META[c.mode].color}>{MODE_META[c.mode].name}</Pill>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                      <Users className="w-3 h-3" />
                      {c.joined} joined
                      <span className="text-muted-foreground/50">·</span>
                      <Calendar className="w-3 h-3" />
                      {c.daysLeft} days left
                    </div>
                  </div>
                  <button
                    onClick={() => pushToast({ kind: "info", title: "Leaderboard", body: c.name })}
                    className="shrink-0 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-secondary transition"
                  >
                    View leaderboard
                  </button>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                    <span>Progress</span>
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
            ))}
          </div>
          <button
            onClick={() => pushToast({ kind: "info", title: "Challenge builder", body: "Coming soon" })}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md border border-border text-sm font-semibold hover:bg-secondary transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Create challenge
          </button>
        </Card>
      </div>

      {/* Group programming + Reporting */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Group programming */}
        <Card>
          <SectionTitle hint="3 programs">
            <span className="inline-flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-primary" />
              Group programming
            </span>
          </SectionTitle>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Create programming that applies to all athletes who opt in. Individual coach programs take precedence over gym programming, which takes precedence over the AI engine.
          </p>
          <div className="space-y-2">
            {PROGRAMS.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-md border border-border hover:bg-secondary/20 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium">{p.name}</div>
                      <span className="text-[10px] text-muted-foreground">({p.weeks} weeks)</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Pill color={MODE_META[p.mode].color}>{MODE_META[p.mode].name}</Pill>
                      <span className="text-[11px] text-muted-foreground">
                        {p.enrolled} athletes · Coach {p.coach}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => pushToast({ kind: "info", title: "Program builder", body: "Use the Coach Dashboard for full program builder" })}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md border border-border text-sm font-semibold hover:bg-secondary transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Create program
          </button>
        </Card>

        {/* Reporting */}
        <Card>
          <SectionTitle hint="Last 30 days">
            <span className="inline-flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Reporting
            </span>
          </SectionTitle>
          <div className="space-y-2">
            <div className="p-3 rounded-md border border-border hover:bg-secondary/20 transition">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Total sessions logged (gym-wide, last 30 days)
              </div>
              <div className="text-stat text-2xl mt-1.5 text-primary tabular-nums">412</div>
            </div>
            <div className="p-3 rounded-md border border-border hover:bg-secondary/20 transition">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Top movement
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <div className="font-semibold">Back Squat</div>
                <div className="text-xs text-muted-foreground">87 sessions</div>
              </div>
            </div>
            <div className="p-3 rounded-md border border-border hover:bg-secondary/20 transition">
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest inline-flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Most-improved member
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <div className="font-semibold">L. Petrova</div>
                <div className="text-xs text-muted-foreground">5 km pace +18 sec/km</div>
              </div>
            </div>
          </div>
          <button
            onClick={() => pushToast({ kind: "info", title: "Report export started" })}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md border border-border text-sm font-semibold hover:bg-secondary transition"
          >
            <Download className="w-3.5 h-3.5" />
            Export report
          </button>
        </Card>
      </div>

      {/* Disclaimer */}
      <Card className="border-warning/30 bg-warning/5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-warning/15 grid place-items-center shrink-0 text-warning">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            <div className="font-semibold text-foreground mb-1">Beta disclaimer</div>
            Gym platform is in beta. Member management and coach verification are mock in this preview. Production wires to Supabase RLS with <span className="font-mono text-foreground">gym_members</span> table; coach verification requires ID upload.
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
