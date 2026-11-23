// POST /api/auth/signup { email, password, name? } → 201 { user, tier }
// Creates an account and sets the session cookie.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  hashPassword,
  isSameOrigin,
  normaliseEmail,
  setSessionCookie,
} from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getEntitlementForUser } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!rateLimit(`signup:${clientIp(req)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body: { email?: unknown; password?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = normaliseEmail(body.email);
  if (!email) return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  const password = body.password;
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters` },
      { status: 400 },
    );
  }
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : null;

  try {
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
    }
    const user = await db.user.create({
      data: { email, name, passwordHash: await hashPassword(password) },
      select: { id: true, email: true, name: true },
    });
    const entitlement = await getEntitlementForUser(user.id);
    const res = NextResponse.json({ user, ...entitlement }, { status: 201 });
    setSessionCookie(res, user.id);
    return res;
  } catch {
    return NextResponse.json({ error: "Account service unavailable" }, { status: 503 });
  }
}
