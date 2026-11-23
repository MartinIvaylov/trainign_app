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

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticate the cron invocation. Vercel Cron sends the request from a
 * trusted internal network, but we still verify a shared secret to prevent
 * abuse if the endpoint is ever hit from the public internet. If
 * `CRON_SECRET` is unset we allow the call — useful in local dev — but log
 * a warning so the operator remembers to set it in production.
 */
function authenticate(req: NextRequest): { ok: boolean; reason?: string } {
  const configured = process.env.CRON_SECRET;
  if (!configured) {
    // Local dev convenience. Production MUST set CRON_SECRET.
    return { ok: true, reason: "CRON_SECRET not set (development mode)" };
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!token) return { ok: false, reason: "Missing Authorization Bearer token" };
  if (token !== configured) return { ok: false, reason: "Invalid bearer token" };
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.reason ?? "Unauthorized" },
      { status: 401 },
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
