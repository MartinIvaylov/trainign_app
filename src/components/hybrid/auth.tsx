"use client";

import { useState } from "react";
import { useApp } from "@/store/app-store";
import { authenticate } from "@/lib/session";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Mail, Lock, User } from "lucide-react";

type Mode = "signin" | "signup";

export function AuthScreen() {
  const setView = useApp((s) => s.setView);
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || loading) return;
    if (mode === "signup" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError(null);
    setLoading(true);
    const result = await authenticate(mode, { email, password, name: name || undefined });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      setPassword("");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground grid lg:grid-cols-2">
      {/* LEFT: brand panel */}
      <div className="hidden lg:block relative overflow-hidden bg-secondary/40 border-r border-border">
        <div className="absolute inset-0 grid-bg opacity-20" />
        <div className="absolute -top-32 -left-32 w-[420px] h-[420px] bg-[color:var(--hyrox)] opacity-10 blur-[120px] rounded-full" />
        <div className="relative h-full flex flex-col p-10">
          <button
            onClick={() => setView("landing")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to home
          </button>
          <div className="mt-auto space-y-6">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold">H</div>
              <div>
                <div className="text-lg font-bold tracking-tight">HYBRID</div>
                <div className="text-xs text-muted-foreground">Performance OS</div>
              </div>
            </div>
            <div>
              <h2 className="text-display text-3xl">Train. Benchmark. Compete. Evolve.</h2>
              <p className="text-muted-foreground mt-3 max-w-md">
                One athlete profile across HYROX, ATHX and CrossFit. Build yours in 5 minutes.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-md border border-border bg-card">
                <div className="text-stat text-2xl text-primary">8</div>
                <div className="text-muted-foreground mt-1">HYROX stations</div>
              </div>
              <div className="p-3 rounded-md border border-border bg-card">
                <div className="text-stat text-2xl text-primary">3</div>
                <div className="text-muted-foreground mt-1">ATHX disciplines</div>
              </div>
              <div className="p-3 rounded-md border border-border bg-card">
                <div className="text-stat text-2xl text-primary">10+</div>
                <div className="text-muted-foreground mt-1">WOD benchmarks</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <button
            onClick={() => setView("landing")}
            className="lg:hidden inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <div className="text-xs font-medium text-muted-foreground tracking-widest uppercase">
            {mode === "signup" ? "Create account" : "Welcome back"}
          </div>
          <h1 className="text-display text-3xl mt-2">
            {mode === "signup" ? "Build your athlete profile" : "Sign in to HYBRID"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {mode === "signup"
              ? "5-minute onboarding. No credit card required."
              : "Continue training where you left off."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <Field icon={User} label="Display name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Carter"
                  className="w-full bg-transparent outline-none text-sm"
                />
              </Field>
            )}
            <Field icon={Mail} label="Email">
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-transparent outline-none text-sm"
              />
            </Field>
            <Field icon={Lock} label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={mode === "signup" ? 8 : undefined}
                maxLength={200}
                required
                className="w-full bg-transparent outline-none text-sm"
              />
            </Field>

            {error && (
              <div role="alert" className="text-sm text-destructive border border-destructive/40 bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? "Loading…" : mode === "signup" ? "Create account" : "Sign in"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New to HYBRID?"}{" "}
            <button
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setError(null);
              }}
              className="text-foreground font-medium hover:underline"
            >
              {mode === "signup" ? "Sign in" : "Create account"}
            </button>
          </div>

        </motion.div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted-foreground mb-1.5">{label}</div>
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-border bg-secondary/30 focus-within:border-foreground/40 transition">
        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
        {children}
      </div>
    </label>
  );
}
