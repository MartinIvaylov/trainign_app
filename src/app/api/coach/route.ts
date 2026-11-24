import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isSameOrigin } from "@/lib/auth";
import { getEntitlementForUser, tierAtLeast } from "@/lib/entitlements";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Server-side AI coach. The z-ai-web-dev-sdk MUST remain on the server —
// no API keys are exposed to the client. The model is given the athlete's
// real data as context and constrained to training-related answers.
//
// Abuse controls (each call costs money):
//   * signed-in users only;
//   * per-user daily quota — AI coaching is a PRO feature, free accounts get
//     a small taster allowance; plus a per-IP burst limit;
//   * every field of the client-supplied context/history is type-checked
//     and length-capped, history roles are restricted to user/assistant so
//     a client can't inject "system" instructions.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const FREE_DAILY_QUESTIONS = 5;
const PAID_DAILY_QUESTIONS = 100;
const MAX_QUESTION = 500;
const MAX_HISTORY = 6;
const MAX_HISTORY_CONTENT = 2_000;

interface CoachRequest {
  question: string;
  context: {
    profile: { displayName?: string; trainingAge?: string; background?: string; weightKg?: number } | null;
    preferences: { daysPerWeek?: number; sessionMinutes?: number; equipment?: string[] } | null;
    benchmarks: Record<string, number | undefined> | null;
    activeMode: string;
    upcoming?: { format: string; name: string; date: string; division?: string } | null;
    recentLogs?: { title: string; result?: string; rpe?: number; date: string }[];
    recentPRs?: { movement: string; value: number; unit: string; context?: string }[];
    hyroxFinishSim?: number;
  };
  history?: { role: "user" | "assistant"; content: string }[];
}

const SYSTEM_PROMPT = `You are the HYBRID AI Coach — a serious, data-driven assistant for hybrid athletes preparing for HYROX, ATHX Games and CrossFit competitions.

STRICT RULES:
- Use ONLY the athlete's real data provided in the user message. Never invent statistics, splits, weights or race results.
- When asked "what is my weakest station/skill", compute from the provided benchmarks or simulations. If data is missing, say so explicitly.
- Distinguish measured results from estimates. The Estimated Performance Score (EPS) is HYBRID's internal estimate, NOT the official ATHX FitScore.
- Never diagnose injuries or medical conditions. Refer athletes to a qualified professional for medical issues.
- Never silently modify a training plan. If you suggest changes, say "ask me to apply" and let the athlete confirm.
- Respect coach-created plans. If a coach has assigned programming, say so and recommend discussing with the coach.
- Keep answers concise (max 4-6 sentences) unless asked for detail. Use bullet points sparingly.
- Use plain language. Avoid hype. Be specific.

DATA SOURCES YOU CAN REFERENCE:
- Athlete profile, preferences and benchmarks
- Active training mode (HYROX / ATHX / CrossFit / Maintenance)
- Upcoming competition (if any)
- Recent workout logs and personal records
- HYROX simulation results

If a question is outside training (medical, financial, etc.), politely redirect to the scope of training and performance.`;

// ---------------------------------------------------------------------------
// Input sanitising — the context is user-controlled; bound every field.
// ---------------------------------------------------------------------------

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  // Collapse newlines so a field can't fake extra prompt sections.
  const clean = v.replace(/[\r\n]+/g, " ").trim();
  return clean ? clean.slice(0, max) : undefined;
}

function num(v: unknown, min = 0, max = 1e6): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
}

function arr(v: unknown, max: number): unknown[] {
  return Array.isArray(v) ? v.slice(0, max) : [];
}

function obj(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

const BENCHMARK_KEYS = [
  "fiveKmSec", "tenKmSec", "oneKmPaceSec", "backSquatKg", "deadliftKg", "strictPressKg",
  "row2kSec", "skierg1kSec", "franSec", "graceSec", "priorHyroxFinishSec",
] as const;

function sanitizeContext(raw: unknown): CoachRequest["context"] {
  const c = obj(raw) ?? {};
  const profile = obj(c.profile);
  const prefs = obj(c.preferences);
  const bench = obj(c.benchmarks);
  const upcoming = obj(c.upcoming);
  const date = (v: unknown) => {
    const s = str(v, 40);
    return s && !Number.isNaN(Date.parse(s)) ? s : undefined;
  };
  return {
    profile: profile
      ? {
          displayName: str(profile.displayName, 60),
          trainingAge: str(profile.trainingAge, 30),
          background: str(profile.background, 30),
          weightKg: num(profile.weightKg, 20, 400),
        }
      : null,
    preferences: prefs
      ? {
          daysPerWeek: num(prefs.daysPerWeek, 0, 14),
          sessionMinutes: num(prefs.sessionMinutes, 0, 600),
          equipment: arr(prefs.equipment, 30).map((e) => str(e, 40)).filter((e): e is string => !!e),
        }
      : null,
    benchmarks: bench
      ? Object.fromEntries(BENCHMARK_KEYS.map((k) => [k, num(bench[k], 0, 1e5)]))
      : null,
    activeMode: str(c.activeMode, 20) ?? "hyrox",
    upcoming:
      upcoming && str(upcoming.name, 100) && date(upcoming.date)
        ? {
            format: str(upcoming.format, 20) ?? "hyrox",
            name: str(upcoming.name, 100) as string,
            date: date(upcoming.date) as string,
            division: str(upcoming.division, 40),
          }
        : null,
    recentLogs: arr(c.recentLogs, 5)
      .map(obj)
      .filter((l): l is Record<string, unknown> => !!l && !!str(l.title, 100) && !!date(l.date))
      .map((l) => ({ title: str(l.title, 100) as string, result: str(l.result, 60), rpe: num(l.rpe, 0, 10), date: date(l.date) as string })),
    recentPRs: arr(c.recentPRs, 10)
      .map(obj)
      .filter((p): p is Record<string, unknown> => !!p && !!str(p.movement, 60) && num(p.value) !== undefined)
      .map((p) => ({ movement: str(p.movement, 60) as string, value: num(p.value) as number, unit: str(p.unit, 15) ?? "", context: str(p.context, 30) })),
    hyroxFinishSim: num(c.hyroxFinishSim, 0, 86_400),
  };
}

function sanitizeHistory(raw: unknown): { role: "user" | "assistant"; content: string }[] {
  return arr(raw, 100)
    .slice(-MAX_HISTORY)
    .map(obj)
    .filter((m): m is Record<string, unknown> => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role as "user" | "assistant", content: (m.content as string).slice(0, MAX_HISTORY_CONTENT) }));
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Sign in to use the AI coach" }, { status: 401 });

  let body: { question?: unknown; context?: unknown; history?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > MAX_QUESTION) {
    return NextResponse.json({ error: "Invalid question" }, { status: 400 });
  }

  // Quotas: burst per IP, daily per user (higher for paid tiers).
  if (!rateLimit(`coach-ip:${clientIp(req)}`, 30, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Slow down a little." }, { status: 429 });
  }
  const { tier } = await getEntitlementForUser(user.id);
  const paid = tierAtLeast(tier, "pro");
  const dailyLimit = paid ? PAID_DAILY_QUESTIONS : FREE_DAILY_QUESTIONS;
  if (!rateLimit(`coach-user:${user.id}`, dailyLimit, DAY_MS)) {
    return NextResponse.json(
      {
        error: paid
          ? "You've reached today's AI coach limit. It resets within 24 hours."
          : `Free accounts include ${FREE_DAILY_QUESTIONS} AI coach questions per day. Upgrade to PRO for more.`,
        limitReached: true,
      },
      { status: 429 },
    );
  }

  const context = sanitizeContext(body.context);
  const history = sanitizeHistory(body.history);
  const contextBlock = buildContextBlock(context);

  try {
    const ZaiModule = await import("z-ai-web-dev-sdk");
    const Zai = (ZaiModule as any).default;
    const ai = await Zai.create();

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user",
        content: `ATHLETE DATA:\n${contextBlock}\n\nQUESTION:\n${question}\n\nAnswer using only the data above.`,
      },
    ];

    const completion = await ai.chat.completions.create({
      messages,
      temperature: 0.4,
      max_tokens: 500,
    });

    const answer = completion.choices?.[0]?.message?.content ?? "I couldn't generate a response. Please try again.";

    return NextResponse.json({ answer, toolsUsed: ["athlete_context"] });
  } catch {
    const fallback = deterministicFallback(question, context);
    return NextResponse.json({ answer: fallback, toolsUsed: ["deterministic_fallback"], fallback: true });
  }
}

function buildContextBlock(c: CoachRequest["context"]): string {
  const lines: string[] = [];
  if (c.profile) {
    lines.push(`- Display name: ${c.profile.displayName ?? "—"}`);
    lines.push(`- Training age: ${c.profile.trainingAge ?? "—"}`);
    lines.push(`- Background: ${c.profile.background ?? "—"}`);
    if (c.profile.weightKg) lines.push(`- Bodyweight: ${c.profile.weightKg} kg`);
  }
  if (c.preferences) {
    lines.push(`- Sessions per week: ${c.preferences.daysPerWeek ?? "—"}`);
    lines.push(`- Session length: ${c.preferences.sessionMinutes ?? "—"} min`);
    lines.push(`- Equipment: ${(c.preferences.equipment ?? []).join(", ") || "—"}`);
  }
  if (c.benchmarks) {
    const b = c.benchmarks;
    const f = (k: string, v?: number) => (v !== undefined && v !== null && !Number.isNaN(v) ? `${k}: ${v}` : null);
    const lines2 = [
      f("5km (sec)", b.fiveKmSec),
      f("10km (sec)", b.tenKmSec),
      f("1km pace (sec)", b.oneKmPaceSec),
      f("Back squat (kg)", b.backSquatKg),
      f("Deadlift (kg)", b.deadliftKg),
      f("Strict press (kg)", b.strictPressKg),
      f("2km row (sec)", b.row2kSec),
      f("1km SkiErg (sec)", b.skierg1kSec),
      f("Fran (sec)", b.franSec),
      f("Grace (sec)", b.graceSec),
      f("Prior HYROX finish (sec)", b.priorHyroxFinishSec),
    ].filter(Boolean);
    if (lines2.length) lines.push(...lines2.map((l) => `- ${l}`));
  }
  lines.push(`- Active training mode: ${c.activeMode}`);
  if (c.upcoming) {
    lines.push(`- Upcoming competition: ${c.upcoming.format.toUpperCase()} — ${c.upcoming.name} on ${c.upcoming.date}${c.upcoming.division ? ` (${c.upcoming.division})` : ""}`);
  }
  if (c.recentLogs && c.recentLogs.length) {
    lines.push(`- Recent workouts (last 5):`);
    c.recentLogs.slice(0, 5).forEach((l) => {
      lines.push(`  · ${l.title} — result: ${l.result ?? "—"}, RPE: ${l.rpe ?? "—"}, date: ${l.date.slice(0, 10)}`);
    });
  }
  if (c.recentPRs && c.recentPRs.length) {
    lines.push(`- Personal records:`);
    c.recentPRs.slice(0, 10).forEach((p) => {
      lines.push(`  · ${p.movement}${p.context ? ` (${p.context})` : ""}: ${p.value} ${p.unit}`);
    });
  }
  if (c.hyroxFinishSim !== undefined) {
    lines.push(`- Latest HYROX simulation predicted finish: ${Math.floor(c.hyroxFinishSim / 60)}m ${c.hyroxFinishSim % 60}s`);
  }

  return lines.length ? lines.join("\n") : "No athlete data available.";
}

function deterministicFallback(question: string, c: CoachRequest["context"]): string {
  const q = question.toLowerCase();
  if (q.includes("weakest") && q.includes("hyrox")) {
    // Don't guess — the fallback has no per-station data to compare.
    return c.hyroxFinishSim !== undefined
      ? "I can't analyse your station splits in fallback mode. Open Performance → HYROX simulation to compare each station against your target split, then ask me again once the AI service is back."
      : "I don't have HYROX station data for you yet. Run a HYROX simulation (Compete tab) so I can compare your station splits — then ask again.";
  }
  if (q.includes("running pace") && q.includes("plateau")) {
    return "Plateaus usually mean your easy days are too fast. If your 5 km pace is roughly your Z2 pace, you're not building aerobic base. Drop easy-day pace by 30–60 sec/km for the next 4 weeks and keep your interval pace where it is.";
  }
  if (q.includes("ready") && q.includes("competition")) {
    const days = c.upcoming ? Math.max(0, Math.ceil((new Date(c.upcoming.date).getTime() - Date.now()) / 86400000)) : null;
    if (days === null) return "You haven't set an upcoming competition. Add one in the Compete tab and I'll evaluate your readiness.";
    return days > 28
      ? `You have ${days} days — enough for one more build block plus a 1-week taper. Consistency over the next 3 weeks is the deciding factor.`
      : days > 7
      ? `You have ${days} days. Volume should start dropping this week. Keep intensity sharp, drop accessories, prioritise sleep.`
      : `${days} days out. Race-week mode: short sharp sessions, full recovery, no new stimuli.`;
  }
  if (q.includes("miss") || q.includes("missed")) {
    return "Don't stack missed sessions. Drop one accessory block this week and keep the key quality session. The engine will re-plan the rest of the week — confirm in the Plan tab.";
  }
  if (q.includes("focus") && q.includes("week")) {
    return `Your focus this week in ${c.activeMode.toUpperCase()} mode: hit every quality session, log RPE honestly, and add 1 mobility piece if you're over 7 RPE on average. Keep the long Z2 piece if scheduled.`;
  }
  if (q.includes("improve") && q.includes("squat")) {
    return `Your squat progress depends on consistency. 5×5 progressive overload + 1 accessory (RDL or front squat) per week. Add 2.5 kg every week if you hit all reps at RPE ≤ 8. Re-test 1RM in 4 weeks.`;
  }
  if (q.includes("fitscore") || q.includes("athx")) {
    return "HYBRID computes an Estimated Performance Score (EPS) from your benchmark inputs. It is not the official ATHX FitScore. If you have an official FitScore, add it in your profile and we'll display that instead.";
  }
  return "I'm operating in fallback mode (the AI service is unavailable right now). I can still read your data: ask about weakest stations, plateaus, missed sessions, or weekly focus and I'll give a deterministic answer. For full reasoning, retry in a moment.";
}
