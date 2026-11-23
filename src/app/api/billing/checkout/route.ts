// =============================================================================
// HYBRID Performance Platform — POST /api/billing/checkout
// =============================================================================
//
// Starts a subscription checkout for the SIGNED-IN user.
//
//   Request:  { "tier": "pro" }
//   Response: { "mode": "stripe", "url": "https://checkout.stripe.com/..." }
//          or { "mode": "preview", "tier": "pro", ... }   (dev only)
//
// Modes:
//   * Stripe (`STRIPE_SECRET_KEY` set): creates a Checkout Session whose
//     `client_reference_id` and metadata carry the internal user id. The
//     entitlement is written only by the verified `checkout.session.completed`
//     webhook — never by this route.
//   * Preview: applies the entitlement directly WITHOUT payment. Only enabled
//     when `BILLING_PREVIEW_MODE=true` AND `NODE_ENV !== "production"`.
//     Anything else without Stripe keys is a 503 — a misconfigured deploy
//     must never hand out free paid tiers.
//
// "free" is a downgrade: Customer Portal in Stripe mode, direct in preview.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getStripe, isBillingPreviewEnabled, type Tier } from "@/lib/stripe";
import { applyEntitlement, getEntitlementForUser, getSubscriptionRow } from "@/lib/entitlements";
import { getSessionUser, isSameOrigin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAID_TIERS: Tier[] = ["pro", "pro_annual", "coach", "gym"];

const PRICE_ENV: Record<Exclude<Tier, "free">, string> = {
  pro: "STRIPE_PRICE_PRO_MONTHLY",
  pro_annual: "STRIPE_PRICE_PRO_ANNUAL",
  coach: "STRIPE_PRICE_COACH",
  gym: "STRIPE_PRICE_GYM",
};

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { tier?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const tier = body.tier;
  if (tier !== "free" && (typeof tier !== "string" || !PAID_TIERS.includes(tier as Tier))) {
    return NextResponse.json(
      { error: `tier must be one of: ${PAID_TIERS.join(", ")} (or "free" to downgrade)` },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  if (!stripe && !isBillingPreviewEnabled()) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }

  // ---- Stripe mode ----------------------------------------------------------
  if (stripe) {
    if (tier === "free") {
      return NextResponse.json(
        { error: "Downgrade to Free happens in the billing portal (cancel subscription)" },
        { status: 400 },
      );
    }
    const existing = await getSubscriptionRow(user.id);
    if (existing?.provider === "stripe" && existing.tier !== "free" && existing.status !== "cancelled") {
      return NextResponse.json(
        { error: "You already have a subscription. Change plans in the billing portal." },
        { status: 409 },
      );
    }
    const priceId = process.env[PRICE_ENV[tier as Exclude<Tier, "free">]];
    if (!priceId) {
      console.error(`[billing] ${PRICE_ENV[tier as Exclude<Tier, "free">]} is not set`);
      return NextResponse.json({ error: "This plan is not available right now" }, { status: 503 });
    }
    const origin = req.nextUrl.origin;
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: user.email,
        client_reference_id: user.id,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { user_id: user.id, price_id: priceId },
        subscription_data: { metadata: { user_id: user.id } },
        success_url: `${origin}/?checkout=success`,
        cancel_url: `${origin}/?checkout=cancel`,
      });
      return NextResponse.json({ mode: "stripe", url: session.url, sessionId: session.id });
    } catch (err) {
      console.error("[billing] checkout session failed", err);
      return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
    }
  }

  // ---- Preview mode (development only) --------------------------------------
  const sessionId = `cs_test_preview_${Date.now()}`;
  const result = await applyEntitlement({
    userId: user.id,
    tier: tier as Tier,
    status: tier === "free" ? "cancelled" : "active",
    provider: "stripe_test",
    providerRef: tier === "free" ? undefined : sessionId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "Could not apply entitlement" }, { status: 503 });
  }
  const view = await getEntitlementForUser(user.id);
  return NextResponse.json({ mode: "preview", ...view, sessionId, processed: true });
}
