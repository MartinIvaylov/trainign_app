"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/store/app-store";
import { Card, PageHeader, SectionTitle } from "@/components/hybrid/blocks/ui";
import { motion } from "framer-motion";
import { Brain, Send, User, Sparkles, RotateCcw, AlertCircle } from "lucide-react";

const SUGGESTED = [
  "What is my weakest HYROX station?",
  "Why has my running pace plateaued?",
  "How has my squat progressed?",
  "Am I ready for my next competition?",
  "What should I focus on this week?",
  "How should I adapt my training after missing two sessions?",
];

interface Msg {
  role: "user" | "assistant";
  content: string;
  fallback?: boolean;
}

export function CoachView() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const profile = useApp((s) => s.profile);
  const prefs = useApp((s) => s.preferences);
  const benchmarks = useApp((s) => s.benchmarks);
  const activeMode = useApp((s) => s.activeMode);
  const upcoming = useApp((s) => s.upcomingCompetition);
  const logs = useApp((s) => s.logs);
  const prs = useApp((s) => s.prs);
  const hyroxSims = useApp((s) => s.hyroxSimulations);
  const pushToast = useApp((s) => s.pushToast);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function ask(q: string) {
    if (loading || !q.trim()) return;
    const userMsg: Msg = { role: "user", content: q };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          context: {
            profile: profile ? {
              displayName: profile.displayName,
              trainingAge: profile.trainingAge,
              background: profile.background,
              weightKg: profile.weightKg,
            } : null,
            preferences: prefs ? {
              daysPerWeek: prefs.daysPerWeek,
              sessionMinutes: prefs.sessionMinutes,
              equipment: prefs.equipment,
            } : null,
            benchmarks,
            activeMode,
            upcoming,
            recentLogs: logs.slice(0, 5),
            recentPRs: prs.slice(0, 10),
            hyroxFinishSim: hyroxSims[0]?.totalSec,
          },
          history: messages,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Coach error");
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.answer, fallback: data.fallback },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "I'm having trouble reaching the coaching service. Try rephrasing or retry in a moment.",
        },
      ]);
      pushToast({ kind: "error", title: "Coach unavailable", body: "Showing fallback." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="AI Coach"
        subtitle="Reads your data, explains recommendations, never modifies your plan without confirmation."
      />

      <Card>
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          Ask about anything the coach can read from your profile, benchmarks, logs and simulations.
        </div>

        {/* Suggested prompts */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {SUGGESTED.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={loading}
              className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-secondary transition disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Chat scroll */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto scrollbar-thin p-1">
          {messages.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <div>No conversation yet. Try one of the prompts above or ask anything about your training.</div>
            </div>
          )}

          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                    <Brain className="w-3 h-3" /> Coach
                    {m.fallback && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-warning/15 text-warning">offline fallback</span>
                    )}
                  </div>
                )}
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              </div>
            </motion.div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="mt-4 flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the coach..."
            disabled={loading}
            className="flex-1 px-3 py-2.5 rounded-md border border-border bg-secondary/30 text-sm outline-none focus:border-foreground/40"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </Card>

      <Card>
        <SectionTitle>How the coach reads your data</SectionTitle>
        <ul className="text-xs text-muted-foreground space-y-1.5">
          <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-primary mt-1.5" /> Reads your profile, benchmarks, preferences and active training mode.</li>
          <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-primary mt-1.5" /> Reads your recent workout logs, PRs and HYROX simulations.</li>
          <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-primary mt-1.5" /> Answers are constrained to training-related topics. The coach never diagnoses injuries or medical conditions.</li>
          <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-primary mt-1.5" /> Never silently modifies a training plan. Recommendations require your confirmation.</li>
          <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-primary mt-1.5" /> Distinguishes measured results from estimates (Estimated Performance Score is not the official ATHX FitScore).</li>
        </ul>
      </Card>
    </div>
  );
}
