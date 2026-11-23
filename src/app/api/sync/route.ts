// =============================================================================
// HYBRID Performance Platform — /api/sync (write-through cache endpoint)
// =============================================================================
//
// The web client keeps its Zustand store in localStorage (offline-first) and
// mirrors it to the server through this endpoint:
//
//   POST /api/sync { email, revision, state }
//     Upserts the snapshot for the email. Last-write-wins: a push is only
//     accepted when its `revision` (ISO timestamp of the last local
//     mutation) is newer than the stored one; otherwise `conflict: true` is
//     returned and the client should pull.
//
//   GET /api/sync?email=athlete@example.com
//     Returns the stored snapshot `{ email, revision, state }` (or
//     `revision: null` when nothing is stored yet) so a freshly signed-in
//     client can adopt the newest state.
//
// Payload cap: 1.5 MB of JSON. 503 when the database is unreachable.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_STATE_BYTES = 1_500_000;

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidRevision(revision: unknown): revision is string {
  if (typeof revision !== "string") return false;
  const ms = Date.parse(revision);
  return !Number.isNaN(ms);
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "A valid email query param is required" }, { status: 400 });
  }
  const normalised = email.trim().toLowerCase();

  try {
    const snapshot = await db.stateSnapshot.findUnique({ where: { email: normalised } });
    if (!snapshot) {
      return NextResponse.json({ email: normalised, revision: null, state: null });
    }
    return NextResponse.json({
      email: normalised,
      revision: snapshot.revision,
      state: JSON.parse(snapshot.data) as unknown,
    });
  } catch {
    return NextResponse.json(
      { error: "Sync database unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: { email?: unknown; revision?: unknown; state?: unknown };
    try {
      body = (await req.json()) as { email?: unknown; revision?: unknown; state?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!isValidEmail(body.email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }
    if (!isValidRevision(body.revision)) {
      return NextResponse.json({ error: "revision must be an ISO timestamp" }, { status: 400 });
    }
    if (typeof body.state !== "object" || body.state === null || Array.isArray(body.state)) {
      return NextResponse.json({ error: "state must be a JSON object" }, { status: 400 });
    }

    const email = (body.email as string).trim().toLowerCase();
    const revision = body.revision as string;
    const serialised = JSON.stringify(body.state);
    if (serialised.length > MAX_STATE_BYTES) {
      return NextResponse.json({ error: "state exceeds the 1.5 MB cap" }, { status: 413 });
    }

    try {
      const existing = await db.stateSnapshot.findUnique({ where: { email } });

      // Last-write-wins: reject stale pushes so a lagging tab can never
      // clobber a newer snapshot from another device.
      if (existing && Date.parse(existing.revision) > Date.parse(revision)) {
        return NextResponse.json({
          ok: false,
          conflict: true,
          revision: existing.revision,
        });
      }

      const saved = await db.stateSnapshot.upsert({
        where: { email },
        create: { email, revision, data: serialised },
        update: { revision, data: serialised },
      });
      return NextResponse.json({ ok: true, revision: saved.revision });
    } catch {
      return NextResponse.json(
        { error: "Sync database unavailable" },
        { status: 503 },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
