"use client";

import { useApp } from "@/store/app-store";
import { signOut } from "@/lib/session";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, CalendarDays, Dumbbell, Trophy, BarChart3,
  Brain, Users, Settings, LogOut, ChevronRight, Bell, ClipboardList, Building2,
} from "lucide-react";
import { DashboardView } from "@/components/hybrid/views/dashboard";
import { PlanView } from "@/components/hybrid/views/plan";
import { WorkoutsView } from "@/components/hybrid/views/workouts";
import { TrainView } from "@/components/hybrid/views/train";
import { CompeteView } from "@/components/hybrid/views/compete";
import { PerformanceView } from "@/components/hybrid/views/performance";
import { CoachView } from "@/components/hybrid/views/coach";
import { CommunityView } from "@/components/hybrid/views/community";
import { ProfileView } from "@/components/hybrid/views/profile";
import { SettingsView } from "@/components/hybrid/views/settings";
import { CoachDashboardView } from "@/components/hybrid/views/coach-dashboard";
import { GymView } from "@/components/hybrid/views/gym";
import { MODE_META } from "@/types";

const NAV = [
  { slug: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { slug: "plan", label: "Plan", icon: CalendarDays },
  { slug: "workouts", label: "Workouts", icon: Dumbbell },
  { slug: "train", label: "Train", icon: Trophy },
  { slug: "compete", label: "Compete", icon: Trophy },
  { slug: "performance", label: "Performance", icon: BarChart3 },
  { slug: "coach", label: "Coach", icon: Brain },
  { slug: "community", label: "Community", icon: Users },
] as const;

const SECONDARY_NAV = [
  { slug: "coach_dashboard", label: "Coach Dashboard", icon: ClipboardList, tierRequired: ["coach", "gym"] as const },
  { slug: "gym", label: "Gym", icon: Building2, tierRequired: ["gym"] as const },
  { slug: "profile", label: "Profile", icon: Users },
  { slug: "settings", label: "Settings", icon: Settings },
] as const;

export function AppShell() {
  const appView = useApp((s) => s.appView);
  const setAppView = useApp((s) => s.setAppView);
  const activeMode = useApp((s) => s.activeMode);
  const profile = useApp((s) => s.profile);
  const upcoming = useApp((s) => s.upcomingCompetition);
  const tier = useApp((s) => s.tier);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-border bg-secondary/20 flex-col sticky top-0 h-screen">
        <div className="px-5 h-16 flex items-center gap-2.5 border-b border-border">
          <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold text-sm">H</div>
          <div>
            <div className="font-bold tracking-tight">HYBRID</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Performance OS</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
          {NAV.map((item) => {
            const active = appView === item.slug;
            const Icon = item.icon;
            return (
              <button
                key={item.slug}
                onClick={() => setAppView(item.slug as any)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
          <div className="my-3 border-t border-border" />
          {SECONDARY_NAV.map((item) => {
            // Gate coach dashboard behind coach/gym tiers
            if ("tierRequired" in item && item.tierRequired && !item.tierRequired.includes(tier as never)) return null;
            const active = appView === item.slug;
            const Icon = item.icon;
            return (
              <button
                key={item.slug}
                onClick={() => setAppView(item.slug as any)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          <div className="px-3 py-2 rounded-md border border-border text-xs">
            <div className="text-muted-foreground">Active mode</div>
            <div className="font-semibold mt-0.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: MODE_META[activeMode].color }} />
              {MODE_META[activeMode].name}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 capitalize">
              Tier: {tier.replace("_", " ")}
            </div>
          </div>
          <button
            onClick={() => void signOut()}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center px-4 sm:px-6 gap-3">
          <div className="md:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-primary text-primary-foreground grid place-items-center font-bold text-xs">H</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold capitalize">{appView === "dashboard" ? "Dashboard" : appView}</div>
            <div className="text-xs text-muted-foreground truncate">
              {profile?.displayName ? `Welcome back, ${profile.displayName}` : "Welcome back"}
              {upcoming && ` · ${upcoming.format.toUpperCase()}: ${upcoming.name}`}
            </div>
          </div>
          <button className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-secondary transition">
            <Bell className="w-3.5 h-3.5" />
            <span>3</span>
          </button>
          <div className="w-8 h-8 rounded-full bg-secondary grid place-items-center text-xs font-bold">
            {(profile?.displayName ?? "A").slice(0, 1).toUpperCase()}
          </div>
        </header>

        {/* Mobile nav */}
        <div className="md:hidden border-b border-border bg-background/90 backdrop-blur-md overflow-x-auto scrollbar-thin sticky top-16 z-20">
          <div className="flex p-2 gap-1 min-w-max">
            {NAV.map((item) => {
              const active = appView === item.slug;
              const Icon = item.icon;
              return (
                <button
                  key={item.slug}
                  onClick={() => setAppView(item.slug as any)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition whitespace-nowrap ${
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={appView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {appView === "dashboard" && <DashboardView />}
              {appView === "plan" && <PlanView />}
              {appView === "workouts" && <WorkoutsView />}
              {appView === "train" && <TrainView />}
              {appView === "compete" && <CompeteView />}
              {appView === "performance" && <PerformanceView />}
              {appView === "coach" && <CoachView />}
              {appView === "community" && <CommunityView />}
              {appView === "profile" && <ProfileView />}
              {appView === "settings" && <SettingsView />}
              {appView === "coach_dashboard" && <CoachDashboardView />}
              {appView === "gym" && <GymView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
