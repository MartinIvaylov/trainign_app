// =============================================================================
// HYBRID Performance Platform — Weekly summary cron (SCAFFOLD)
// =============================================================================
//
// Invoked by Vercel Cron every Monday at 08:00 UTC (see `vercel.json`).
//
// Production responsibilities (NOT yet implemented here):
//   1. Query users with an active `Subscription` (tier in pro|pro_annual|coach|gym).
//   2. For each such user, load their `AthleteProfile` and the last 7 days of
//      `WorkoutLog` rows.
//   3. Compute a per-athlete summary: sessions completed, total load, PRs hit,
//      readiness trend, recommended focus for next week.
//   4. Render the summary to an email template and send via Resend or Postmark.
//   5. Write an `AiRecommendation` row of type "weekly_summary" so the in-app
//      feed mirrors the email.
//   6. Return a small report for observability.
//
// This scaffold only verifies the shared `CRON_SECRET` (if set) and returns a
// timestamped acknowledgement so the cron pipeline is wired up end-to-end.
// =============================================================================

import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticate the cron invocation. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET` automatically when CRON_SECRET is set
 * on the project. Production fails closed without it; local development
 * allows unauthenticated calls for convenience.
 */
function authenticate(req: NextRequest): { ok: boolean; status?: number; reason?: string } {
  const configured = process.env.CRON_SECRET;
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      console.error("[cron] CRON_SECRET is not set — refusing to run");
      return { ok: false, status: 503, reason: "Cron is not configured" };
    }
    return { ok: true, reason: "CRON_SECRET not set (development mode)" };
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!token) return { ok: false, status: 401, reason: "Missing Authorization Bearer token" };
  // Constant-time comparison (hash both sides so lengths always match).
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(configured).digest();
  if (!timingSafeEqual(a, b)) return { ok: false, status: 401, reason: "Invalid bearer token" };
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.reason ?? "Unauthorized" },
      { status: auth.status ?? 401 },
    );
  }

  const triggeredAt = new Date().toISOString();

  return NextResponse.json({
    ok: true,
    message: `Weekly summary cron triggered at ${triggeredAt}`,
    notes:
      "Production: query users with active subscriptions, compute their last 7 days of sessions, send email via Resend/Postmark",
    authWarning: auth.reason ?? null,
  });
}

export async function POST(req: NextRequest) {
  // Support POST as well — some cron schedulers prefer it.
  return GET(req);
}
