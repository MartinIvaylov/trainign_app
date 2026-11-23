"use client";

import { useApp } from "@/store/app-store";
import { motion } from "framer-motion";
import { ArrowRight, Activity, Calendar, Timer, Trophy, Brain, Layers, ChevronRight, Zap, BarChart3, Users, Star } from "lucide-react";
import { HYROX_STATIONS } from "@/lib/competition-rules/hyrox";
import { ATHX_DISCIPLINES } from "@/lib/competition-rules/athx";
import { CROSSFIT_BENCHMARKS } from "@/lib/competition-rules/crossfit";

const PRICING = [
  {
    name: "Free",
    price: "€0",
    period: "forever",
    features: ["Athlete profile", "Basic workout logging", "Timers", "Race countdown", "Limited plan preview"],
    cta: "Start free",
    tier: "free" as const,
    highlight: false,
  },
  {
    name: "PRO",
    price: "€18",
    period: "/month",
    features: ["Adaptive training engine", "Full performance analytics", "HYROX + ATHX preparation", "Race simulations", "AI coaching", "Competition readiness"],
    cta: "Start 14-day trial",
    tier: "pro" as const,
    highlight: true,
  },
  {
    name: "PRO Annual",
    price: "€129",
    period: "/year",
    features: ["Everything in PRO", "Save 40%", "Priority support", "Early access features"],
    cta: "Go annual",
    tier: "pro_annual" as const,
    highlight: false,
  },
  {
    name: "Coach",
    price: "€39",
    period: "/month",
    features: ["Coach dashboard", "Athlete management", "Custom programming", "Performance reports", "Group programming"],
    cta: "Become a coach",
    tier: "coach" as const,
    highlight: false,
  },
];

export function LandingPage() {
  const setView = useApp((s) => s.setView);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold text-sm tracking-tighter">H</div>
            <div className="text-lg font-bold tracking-tight">HYBRID</div>
            <div className="hidden sm:block text-xs text-muted-foreground ml-1 border-l border-border pl-2">PERFORMANCE OS</div>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm">
            <a href="#modes" className="text-muted-foreground hover:text-foreground transition">Modes</a>
            <a href="#engine" className="text-muted-foreground hover:text-foreground transition">Engine</a>
            <a href="#analytics" className="text-muted-foreground hover:text-foreground transition">Analytics</a>
            <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition">Stories</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("auth")}
              className="text-sm font-medium px-3 py-1.5 rounded-md hover:bg-secondary transition"
            >
              Sign in
            </button>
            <button
              onClick={() => setView("auth")}
              className="text-sm font-semibold px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] bg-[color:var(--hyrox)] opacity-10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-32 -left-32 w-[480px] h-[480px] bg-[color:var(--athx)] opacity-10 blur-[120px] rounded-full" />

        <div className="max-w-7xl mx-auto px-5 pt-20 pb-24 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full border border-border bg-secondary/50 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              HYROX · ATHX · CrossFit — one athlete, one platform
            </div>
            <h1 className="text-display text-5xl sm:text-6xl md:text-7xl">
              Train. Benchmark.<br />
              Compete. <span className="text-primary">Evolve.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
              The performance operating system for hybrid athletes. One profile, one training history, multiple competition formats. Built for athletes preparing for HYROX, ATHX Games and CrossFit — not a generic fitness tracker.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setView("auth")}
                className="group inline-flex items-center gap-2 px-5 py-3 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition"
              >
                Build your athlete profile
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
              </button>
              <a
                href="#modes"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-md border border-border hover:bg-secondary transition font-medium"
              >
                Explore the platform
              </a>
            </div>
            <div className="mt-10 flex items-center gap-8 text-xs text-muted-foreground">
              <div>
                <div className="text-2xl text-foreground text-stat">8</div>
                <div className="mt-1">HYROX stations tracked</div>
              </div>
              <div>
                <div className="text-2xl text-foreground text-stat">3</div>
                <div className="mt-1">ATHX disciplines</div>
              </div>
              <div>
                <div className="text-2xl text-foreground text-stat">10+</div>
                <div className="mt-1">CrossFit benchmarks</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* MODES */}
      <section id="modes" className="border-t border-border py-20">
        <div className="max-w-7xl mx-auto px-5">
          <div className="max-w-2xl">
            <div className="text-xs font-medium text-muted-foreground tracking-widest uppercase">Training modes</div>
            <h2 className="text-display text-3xl sm:text-4xl mt-3">Four modes. One athlete.</h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Switch focus without losing history. Finish HYROX in October, prep for ATHX in January, run maintenance between events. The engine preserves your benchmarks, logs and PRs.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ModeCard
              name="HYROX"
              tagline="8 × 1 km run + 8 functional stations"
              color="var(--hyrox)"
              icon={Trophy}
              points={["Race countdown", "Race simulation", "Station analytics", "Pace calculator"]}
            />
            <ModeCard
              name="ATHX"
              tagline="Strength · Endurance · MetCon-X"
              color="var(--athx)"
              icon={Layers}
              points={["FitScore tracking", "Pairs mode", "Competition simulations", "Taper planning"]}
            />
            <ModeCard
              name="CrossFit"
              tagline="Functional fitness, RX or Scaled"
              color="var(--crossfit)"
              icon={Activity}
              points={["Daily WOD", "Benchmark library", "AMRAP · EMOM · Tabata", "PR tracking"]}
            />
            <ModeCard
              name="Maintenance"
              tagline="General Physical Preparation"
              color="var(--maint)"
              icon={Zap}
              points={["Strength programming", "Zone 2 conditioning", "Mobility + recovery", "Flexible weekly plan"]}
            />
          </div>
        </div>
      </section>

      {/* ENGINE */}
      <section id="engine" className="border-t border-border py-20 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-5 grid md:grid-cols-2 gap-12 items-start">
          <div>
            <div className="text-xs font-medium text-muted-foreground tracking-widest uppercase">Adaptive training engine</div>
            <h2 className="text-display text-3xl sm:text-4xl mt-3">An intelligent plan, not random workouts.</h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              The engine reads your benchmarks, training history, recovery and equipment. It periodises blocks, distributes volume, detects weaknesses and adapts upcoming sessions. The AI Coach augments — but never overrides — the deterministic rules.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              <FeatureRow icon={Calendar} title="Periodisation" body="Base → build → specific → taper for each competition." />
              <FeatureRow icon={Activity} title="Weakness detection" body="Quantifies running, strength, erg and MetCon against benchmarks." />
              <FeatureRow icon={Brain} title="Adaptive scheduling" body="Re-plans the rest of the week when you miss sessions or report fatigue." />
              <FeatureRow icon={Layers} title="Mode switching" body="HYROX → ATHX → CrossFit → Maintenance without losing history." />
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success" />
              <div className="text-sm font-semibold">Live engine output (sample)</div>
            </div>
            <div className="p-5 space-y-4 text-sm font-mono">
              <div className="text-muted-foreground">{"// Analyzing athlete benchmarks..."}</div>
              <div><span className="text-info">running</span> score <span className="text-warning">62</span> — moderate</div>
              <div><span className="text-info">strength</span> score <span className="text-destructive">48</span> — high priority</div>
              <div><span className="text-info">erg</span>      score <span className="text-success">71</span> — low</div>
              <div><span className="text-info">metcon</span>   score <span className="text-warning">58</span> — moderate</div>
              <div className="text-muted-foreground pt-2">{"// Block 1 (4 weeks) — Strength focus"}</div>
              <div className="text-foreground">Squat 5×5 · RDL 4×6 · sled 4×20m × 2/wk</div>
              <div className="text-muted-foreground pt-2">{"// Adaptation check"}</div>
              <div className="text-success">avg RPE 7.1 — continue current plan</div>
            </div>
          </div>
        </div>
      </section>

      {/* STATIONS / DISCIPLINES / BENCHMARKS */}
      <section className="border-t border-border py-20">
        <div className="max-w-7xl mx-auto px-5">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs font-medium text-muted-foreground tracking-widest uppercase">Coverage</div>
            <h2 className="text-display text-3xl sm:text-4xl mt-3">Real competition formats, configurable rules.</h2>
            <p className="text-muted-foreground mt-4">
              Standards are stored in a configurable rules database — not hardcoded. As official rules update, the engine adapts. HYBRID is not affiliated with HYROX, ATHX or CrossFit; we only describe compatible training formats.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <CoverageCard title="HYROX — 8 stations" count={`${HYROX_STATIONS.length} stations`} items={HYROX_STATIONS.map((s) => s.name)} />
            <CoverageCard title="ATHX — 3 disciplines" count={`${ATHX_DISCIPLINES.length} disciplines`} items={ATHX_DISCIPLINES.map((d) => d.name)} />
            <CoverageCard title="CrossFit — benchmarks" count={`${CROSSFIT_BENCHMARKS.length} benchmarks`} items={CROSSFIT_BENCHMARKS.map((b) => b.name)} />
          </div>
        </div>
      </section>

      {/* ANALYTICS */}
      <section id="analytics" className="border-t border-border py-20 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-5 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs font-medium text-muted-foreground tracking-widest uppercase">Performance analytics</div>
            <h2 className="text-display text-3xl sm:text-4xl mt-3">Measurable improvement, not vanity stats.</h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Track run pace progression, station splits, lift PRs, MetCon times, race results and competition readiness. Charts use the data you actually record — no fabricated athlete statistics.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <MiniMetric icon={Timer} label="Run pace progression" />
              <MiniMetric icon={Activity} label="Station splits" />
              <MiniMetric icon={BarChart3} label="Strength progression" />
              <MiniMetric icon={Trophy} label="Competition results" />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="text-xs text-muted-foreground mb-3">Weekly training volume — last 8 weeks</div>
            <div className="flex items-end gap-1.5 h-40">
              {[40, 62, 50, 75, 68, 88, 70, 92].map((v, i) => (
                <div key={i} className="flex-1 bg-primary/80 hover:bg-primary transition rounded-t" style={{ height: `${v}%` }} />
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>W1</span><span>W4</span><span>W8</span>
            </div>
          </div>
        </div>
      </section>

      {/* AI COACH */}
      <section className="border-t border-border py-20">
        <div className="max-w-7xl mx-auto px-5 grid md:grid-cols-2 gap-12 items-start">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2 text-sm font-semibold">
              <Brain className="w-4 h-4 text-primary" />
              AI Coach
            </div>
            <div className="p-4 space-y-3 text-sm">
              <ChatBubble role="user">Why has my running pace plateaued?</ChatBubble>
              <ChatBubble role="assistant">
                Your 5 km pace has held at 4:30/km for 4 weeks. Your interval pace is 4:05/km but your Z2 runs average 4:50/km — too fast for aerobic adaptation. Recommendation: drop easy-day pace to 5:00–5:20/km for the next 4 weeks.
              </ChatBubble>
              <ChatBubble role="user">What is my weakest HYROX station?</ChatBubble>
              <ChatBubble role="assistant">
                Based on your last 3 simulations, Sled Pull is +18% slower than your average station. Adding 1 dedicated posterior-chain strength block is recommended.
              </ChatBubble>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground tracking-widest uppercase">AI Coach</div>
            <h2 className="text-display text-3xl sm:text-4xl mt-3">An assistant that reads your data.</h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              The AI Coach answers questions about your performance, explains recommendations, distinguishes measured results from estimates, and never silently modifies a training plan. Every recommendation stores its supporting evidence.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              <FeatureRow icon={Activity} title="Performance analysis" body="What is my weakest HYROX station?" />
              <FeatureRow icon={Calendar} title="Weekly summaries" body="What should I focus on this week?" />
              <FeatureRow icon={Brain} title="Adjustments" body="How should I adapt after missing two sessions?" />
            </ul>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <motion.div
        id="testimonials"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="border-t border-border py-20"
      >
        <div className="max-w-7xl mx-auto px-5">
          <div className="max-w-2xl mb-12">
            <div className="text-xs font-medium text-muted-foreground tracking-widest uppercase">Athlete stories</div>
            <h2 className="text-display text-3xl sm:text-4xl mt-3">Built by athletes, for athletes.</h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Real athletes training for HYROX, ATHX and CrossFit share how HYBRID fits their season, their box and their goals — from race-day pacing to shared programming and unified benchmark tracking.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TestimonialCard
              quote="The HYROX simulator changed how I pace. I went from 1:24 to 1:15 in 12 weeks just by targeting my weakest station."
              name="M. Lindqvist"
              mode="HYROX"
              modeColor="var(--hyrox)"
              meta="HYROX Open (Men) · Stockholm finisher, 2026"
            />
            <TestimonialCard
              quote="ATHX pairs mode lets me and my training partner share a plan. The Estimated Performance Score is honest — it tells me where I actually stand."
              name="S. Costa"
              mode="ATHX"
              modeColor="var(--athx)"
              meta="ATHX Individual · Dubai competitor, 2026"
            />
            <TestimonialCard
              quote="I track my CrossFit benchmarks and HYROX simulations in one app. No more switching between SugarWOD and a spreadsheet."
              name="A. Volkov"
              mode="CrossFit"
              modeColor="var(--crossfit)"
              meta="CrossFit + HYROX hybrid · London, 2026"
            />
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-border pt-10">
            <Stat value="4,200+" label="athletes" />
            <Stat value="180k" label="workouts logged" />
            <Stat value="12k+" label="PRs recorded" />
          </div>
        </div>
      </motion.div>

      {/* PRICING */}
      <section id="pricing" className="border-t border-border py-20 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-5">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs font-medium text-muted-foreground tracking-widest uppercase">Pricing</div>
            <h2 className="text-display text-3xl sm:text-4xl mt-3">Start free. Upgrade when you compete.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PRICING.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-lg border p-5 flex flex-col bg-card ${
                  p.highlight ? "border-primary glow-hyrox" : "border-border"
                }`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-5 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                    Most popular
                  </div>
                )}
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl text-display">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.period}</span>
                </div>
                <ul className="mt-5 space-y-2 text-sm text-muted-foreground flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <ChevronRight className="w-3 h-3 mt-1 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  // Plans are purchased after sign-up (Settings → Subscription);
                  // the tier is only ever granted by the server.
                  onClick={() => setView("auth")}
                  className={`mt-5 w-full py-2.5 rounded-md font-semibold text-sm transition ${
                    p.highlight
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "border border-border hover:bg-secondary"
                  }`}
                >
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMUNITY */}
      <section className="border-t border-border py-20">
        <div className="max-w-7xl mx-auto px-5 grid md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2">
            <div className="text-xs font-medium text-muted-foreground tracking-widest uppercase">Community & coaching</div>
            <h2 className="text-display text-3xl sm:text-4xl mt-3">Built for athletes, boxes and coaches.</h2>
            <p className="text-muted-foreground mt-4 leading-relaxed max-w-2xl">
              Athletes follow each other, share workouts and join challenges. Coaches build programs, assign them to athletes or groups, and review performance. Coach programming takes precedence over AI-generated programming unless the coach explicitly allows adaptation.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <Users className="w-8 h-8 text-primary mb-3" />
            <div className="text-sm font-semibold">For coaches & gyms</div>
            <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <li>Athlete management dashboard</li>
              <li>Custom programming & workout builder</li>
              <li>Group programming for boxes</li>
              <li>Performance reports & check-ins</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-24">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <h2 className="text-display text-4xl sm:text-5xl">One athlete. One platform.</h2>
          <p className="text-muted-foreground mt-4 text-lg">
            Build your profile in 5 minutes. Train with a real plan. Compete prepared.
          </p>
          <button
            onClick={() => setView("auth")}
            className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition"
          >
            Get started <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-10">
        <div className="max-w-7xl mx-auto px-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs text-muted-foreground">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded bg-primary text-primary-foreground grid place-items-center font-bold text-xs">H</div>
              <div className="font-semibold text-foreground text-sm">HYBRID</div>
            </div>
            <div>Performance operating system for hybrid athletes.</div>
          </div>
          <div>
            <div className="font-semibold text-foreground mb-2">Product</div>
            <div className="space-y-1.5">
              <div>HYROX mode</div>
              <div>ATHX mode</div>
              <div>CrossFit mode</div>
              <div>Maintenance</div>
              <div>AI Coach</div>
            </div>
          </div>
          <div>
            <div className="font-semibold text-foreground mb-2">Company</div>
            <div className="space-y-1.5">
              <div>About</div>
              <div>Pricing</div>
              <button
                onClick={() => setView("privacy")}
                className="hover:text-foreground transition text-left"
              >
                Privacy
              </button>
              <button
                onClick={() => setView("terms")}
                className="hover:text-foreground transition text-left"
              >
                Terms
              </button>
            </div>
          </div>
          <div>
            <div className="font-semibold text-foreground mb-2">Disclaimer</div>
            <div className="leading-relaxed">
              HYBRID is an independent training platform. HYROX®, ATHX®, and CrossFit® are trademarks of their respective owners. This product is not affiliated with, endorsed by or sponsored by those organisations. Names are used only to describe compatible training formats.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ModeCard({
  name,
  tagline,
  color,
  icon: Icon,
  points,
}: {
  name: string;
  tagline: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  points: string[];
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300 }}
      className="rounded-lg border border-border bg-card p-5 hover:border-foreground/30 transition"
      style={{ borderColor: undefined }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-md grid place-items-center" style={{ background: `color-mix(in oklch, ${color} 18%, transparent)`, color }}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      </div>
      <div className="text-lg font-bold">{name}</div>
      <div className="text-xs text-muted-foreground mt-1">{tagline}</div>
      <ul className="mt-4 space-y-1.5 text-sm">
        {points.map((p) => (
          <li key={p} className="flex items-center gap-2 text-foreground/80">
            <span className="w-1 h-1 rounded-full" style={{ background: color }} />
            {p}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function FeatureRow({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-md bg-secondary grid place-items-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground text-xs mt-0.5">{body}</div>
      </div>
    </li>
  );
}

function CoverageCard({ title, count, items }: { title: string; count: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground px-2 py-0.5 rounded-full border border-border">{count}</div>
      </div>
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        {items.map((i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-primary" />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MiniMetric({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-background">
      <Icon className="w-4 h-4 text-primary" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

function ChatBubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function TestimonialCard({
  quote,
  name,
  mode,
  modeColor,
  meta,
}: {
  quote: string;
  name: string;
  mode: string;
  modeColor: string;
  meta: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 flex flex-col hover:border-foreground/30 transition">
      <div className="flex items-center gap-0.5 mb-4" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-warning text-warning" />
        ))}
      </div>
      <p className="text-sm leading-relaxed text-foreground/90 flex-1">
        &ldquo;{quote}&rdquo;
      </p>
      <div className="mt-5 pt-4 border-t border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{name}</span>
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
            style={{ color: modeColor, borderColor: `color-mix(in oklch, ${modeColor} 35%, transparent)` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: modeColor }} />
            {mode}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-1.5">{meta}</div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-display text-3xl text-foreground text-stat">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
