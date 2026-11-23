// =============================================================================
// HYBRID Performance Platform — /api/sync (write-through cache endpoint)
// =============================================================================
//
// Requires a signed-in session. The snapshot is always the session user's —
// the request cannot name another account.
//
//   POST /api/sync { revision, state }
//     Upserts the caller's snapshot. Last-write-wins: accepted only when
//     `revision` (ISO timestamp of the last local mutation) is newer than the
//     stored one, otherwise `{ conflict: true }`. Revisions more than 5 min in
//     the future are rejected so a skewed clock can't freeze the snapshot.
//   GET /api/sync
//     Returns `{ revision, state }` (revision null when nothing stored).
//
// Only the keys in SYNCED_KEYS are stored or returned; identity and tier
// fields are stripped. Payload cap 1.5 MB. 503 when the DB is unreachable.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, isSameOrigin } from "@/lib/auth";
import { pickSynced } from "@/lib/sync-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_STATE_BYTES = 1_500_000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function unauthorized() {
  return NextResponse.json({ error: "Not signed in" }, { status: 401 });
}

function parseRevision(revision: unknown): number | null {
  if (typeof revision !== "string") return null;
  const ms = Date.parse(revision);
  return Number.isNaN(ms) ? null : ms;
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  try {
    const snapshot = await db.stateSnapshot.findUnique({ where: { email: user.email } });
    if (!snapshot) return NextResponse.json({ revision: null, state: null });
    let state: unknown = null;
    try {
      state = pickSynced(JSON.parse(snapshot.data));
    } catch {
      state = null;
    }
    return NextResponse.json(
      { revision: snapshot.revision, state },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Sync database unavailable" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getSessionUser(req);
  if (!user) return unauthorized();

  let body: { revision?: unknown; state?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const revisionMs = parseRevision(body.revision);
  if (revisionMs === null) {
    return NextResponse.json({ error: "revision must be an ISO timestamp" }, { status: 400 });
  }
  if (revisionMs > Date.now() + MAX_CLOCK_SKEW_MS) {
    return NextResponse.json({ error: "revision is in the future" }, { status: 400 });
  }
  if (typeof body.state !== "object" || body.state === null || Array.isArray(body.state)) {
    return NextResponse.json({ error: "state must be a JSON object" }, { status: 400 });
  }

  const serialised = JSON.stringify(pickSynced(body.state));
  if (serialised.length > MAX_STATE_BYTES) {
    return NextResponse.json({ error: "state exceeds the 1.5 MB cap" }, { status: 413 });
  }
  const revision = new Date(revisionMs).toISOString();

  try {
    const existing = await db.stateSnapshot.findUnique({ where: { email: user.email } });
    if (existing && Date.parse(existing.revision) > revisionMs) {
      return NextResponse.json({ ok: false, conflict: true, revision: existing.revision });
    }
    const saved = await db.stateSnapshot.upsert({
      where: { email: user.email },
      create: { email: user.email, revision, data: serialised },
      update: { revision, data: serialised },
    });
    return NextResponse.json({ ok: true, revision: saved.revision });
  } catch {
    return NextResponse.json({ error: "Sync database unavailable" }, { status: 503 });
  }
}
