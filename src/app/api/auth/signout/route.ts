// POST /api/auth/signout → clears the session cookie.

import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, isSameOrigin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
