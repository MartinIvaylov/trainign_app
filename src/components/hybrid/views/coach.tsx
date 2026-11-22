"use client";

import { useEffect, useRef, useState } from "react";
import { useApp, CoachRecommendation } from "@/store/app-store";
import { Card, PageHeader, SectionTitle, EmptyState } from "@/components/hybrid/blocks/ui";
import { motion } from "framer-motion";
import { Brain, Send, User, Sparkles, RotateCcw, AlertCircle, Bookmark, Check, X, Trash2, Clock } from "lucide-react";

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
  // Track which messages have been saved as recommendations
  savedAsRec?: boolean;
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
  const recommendations = useApp((s) => s.recommendations);
  const addRecommendation = useApp((s) => s.addRecommendation);
  const applyRecommendation = useApp((s) => s.applyRecommendation);
  const dismissRecommendation = useApp((s) => s.dismissRecommendation);
  const clearApplied = useApp((s) => s.clearAppliedRecommendations);

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

  function saveAsRecommendation(msgIndex: number) {
    const msg = messages[msgIndex];
    if (!msg || msg.role !== "assistant") return;
    // Derive a title from the first sentence of the answer
    const firstSentence = msg.content.split(/[.!?]\s/)[0].slice(0, 80);
    const title = firstSentence.length > 0 ? firstSentence + (msg.content.length > firstSentence.length ? "…" : "") : "Coach recommendation";
    addRecommendation({
      title,
      body: msg.content,
      severity: "info",
      source: "ai_coach",
      // Find the user question that triggered this answer
      originalQuestion: messages[msgIndex - 1]?.role === "user" ? messages[msgIndex - 1].content : undefined,
    });
    setMessages((prev) => prev.map((m, i) => i === msgIndex ? { ...m, savedAsRec: true } : m));
    pushToast({ kind: "success", title: "Saved as recommendation", body: "Review it in the Recommendations panel below." });
  }

  function applyRec(id: string) {
    applyRecommendation(id);
    pushToast({ kind: "success", title: "Recommendation applied", body: "Marked as applied. Apply the suggested changes in your Plan tab." });
  }

  function dismissRec(id: string) {
    dismissRecommendation(id);
    pushToast({ kind: "info", title: "Recommendation dismissed" });
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
                {m.role === "assistant" && !m.fallback && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    {m.savedAsRec ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-success font-medium">
                        <Check className="w-3 h-3" /> Saved as recommendation
                      </span>
                    ) : (
                      <button
                        onClick={() => saveAsRecommendation(i)}
                        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition"
                      >
                        <Bookmark className="w-3 h-3" /> Save as recommendation
                      </button>
                    )}
                  </div>
                )}
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

      {/* Recommendations panel */}
      <RecommendationsPanel
        recommendations={recommendations}
        onApply={applyRec}
        onDismiss={dismissRec}
        onClearApplied={() => {
          clearApplied();
          pushToast({ kind: "info", title: "Applied recommendations cleared" });
        }}
      />

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

// ---------------------------------------------------------------------------
// Recommendations panel — shows stored AI Coach / engine recommendations
// with Apply / Dismiss / Clear actions.
// ---------------------------------------------------------------------------

function RecommendationsPanel({
  recommendations,
  onApply,
  onDismiss,
  onClearApplied,
}: {
  recommendations: CoachRecommendation[];
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
  onClearApplied: () => void;
}) {
  const pending = recommendations.filter((r) => r.status === "pending");
  const applied = recommendations.filter((r) => r.status === "applied");
  const dismissed = recommendations.filter((r) => r.status === "dismissed");

  const severityIcon = {
    info: { icon: Sparkles, color: "var(--info)" },
    positive: { icon: Check, color: "var(--success)" },
    warning: { icon: AlertCircle, color: "var(--warning)" },
    critical: { icon: AlertCircle, color: "var(--destructive)" },
  };

  return (
    <Card>
      <SectionTitle hint={`${pending.length} pending · ${applied.length} applied`}>
        Saved recommendations
      </SectionTitle>

      {recommendations.length === 0 ? (
        <EmptyState
          title="No saved recommendations yet"
          body="When the AI Coach suggests something, click 'Save as recommendation' on the message to store it here for review and apply."
        />
      ) : (
        <div className="space-y-3">
          {pending.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Pending</div>
              {pending.map((r) => {
                const sev = severityIcon[r.severity];
                const Icon = sev.icon;
                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-md border border-border bg-secondary/20"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-md grid place-items-center shrink-0" style={{ background: `color-mix(in oklch, ${sev.color} 15%, transparent)`, color: sev.color }}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{r.title}</div>
                        {r.originalQuestion && (
                          <div className="text-[10px] text-muted-foreground italic mt-0.5">Q: {r.originalQuestion}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1.5 line-clamp-3">{r.body}</div>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground capitalize">{r.source.replace("_", " ")}</span>
                          <div className="flex-1" />
                          <button
                            onClick={() => onApply(r.id)}
                            className="text-xs px-2.5 py-1 rounded-md bg-primary text-primary-foreground font-semibold hover:opacity-90 transition inline-flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Apply
                          </button>
                          <button
                            onClick={() => onDismiss(r.id)}
                            className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-secondary transition inline-flex items-center gap-1 text-muted-foreground"
                          >
                            <X className="w-3 h-3" /> Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {applied.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Applied ({applied.length})</div>
                <button
                  onClick={onClearApplied}
                  className="text-[10px] text-muted-foreground hover:text-destructive transition inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Clear applied
                </button>
              </div>
              {applied.slice(0, 5).map((r) => (
                <div key={r.id} className="p-2.5 rounded-md border border-success/30 bg-success/5 opacity-70">
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-success shrink-0" />
                    <div className="text-xs font-medium truncate flex-1">{r.title}</div>
                    {r.appliedAt && (
                      <div className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(r.appliedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {applied.length > 5 && (
                <div className="text-[10px] text-muted-foreground text-center">+ {applied.length - 5} more</div>
              )}
            </div>
          )}

          {dismissed.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Dismissed ({dismissed.length})</div>
              {dismissed.slice(0, 3).map((r) => (
                <div key={r.id} className="p-2.5 rounded-md border border-border opacity-40">
                  <div className="flex items-center gap-2">
                    <X className="w-3 h-3 text-muted-foreground shrink-0" />
                    <div className="text-xs truncate flex-1">{r.title}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
