// POST /api/auth/signin { email, password } → 200 { user, tier } + session cookie

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  MAX_PASSWORD_LENGTH,
  getDummyHash,
  isSameOrigin,
  normaliseEmail,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getEntitlementForUser } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVALID = "Incorrect email or password";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = normaliseEmail(body.email);
  const password = body.password;
  if (!email || typeof password !== "string" || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  // Per-IP and per-account limits slow down credential stuffing.
  const ip = clientIp(req);
  if (!rateLimit(`signin-ip:${ip}`, 30, 15 * 60 * 1000) || !rateLimit(`signin-acct:${email}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, passwordHash: true },
    });
    // Always run a verification so response time doesn't reveal whether the
    // account exists.
    const ok = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !user.passwordHash || !ok) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }
    const entitlement = await getEntitlementForUser(user.id);
    const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name }, ...entitlement });
    setSessionCookie(res, user.id);
    return res;
  } catch {
    return NextResponse.json({ error: "Account service unavailable" }, { status: 503 });
  }
}
