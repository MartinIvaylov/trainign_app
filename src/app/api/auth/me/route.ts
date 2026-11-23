// GET /api/auth/me → 200 { user, tier, status } for the signed-in user, else 401.
// The tier returned here is the only source the client should trust.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getEntitlementForUser } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const entitlement = await getEntitlementForUser(user.id);
  return NextResponse.json({ user, ...entitlement }, { headers: { "Cache-Control": "no-store" } });
}
