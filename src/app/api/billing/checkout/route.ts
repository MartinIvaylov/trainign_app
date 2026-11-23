// =============================================================================
// HYBRID Performance Platform — POST /api/billing/checkout
// =============================================================================
//
// Starts a subscription checkout for a paid tier.
//
//   Request:  { "email": "athlete@example.com", "tier": "pro" }
//   Response: { "mode": "stripe", "url": "https://checkout.stripe.com/..." }
//          or { "mode": "preview", "tier": "pro", "sessionId": "..." }
//
// Modes:
//   * Stripe mode (`STRIPE_SECRET_KEY` configured): creates a real Stripe
//     Checkout Session (subscription mode, price resolved from the tier via
//     `tierToPrice`) and returns the hosted checkout URL. The entitlement is
//     written later by the `checkout.session.completed` webhook.
//   * Preview mode (no Stripe keys — sandbox/local): applies the entitlement
//     directly via `applyEntitlement()` with provider `stripe_test`, so the
//     full request → database → store flow works without live credentials.
//
// Tier "free" is a downgrade, not a checkout:
//   * Preview mode: applies tier=free (status cancelled) directly.
//   * Stripe mode: 400 — downgrades happen by cancelling in the Customer
//     Portal, which ends in a `customer.subscription.deleted` webhook.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getStripe, tierToPrice, type Tier } from "@/lib/stripe";
import { applyEntitlement, getEntitlement } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAID_TIERS: Tier[] = ["pro", "pro_annual", "coach", "gym"];

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function POST(req: NextRequest) {
  try {
    let body: { email?: unknown; tier?: unknown };
    try {
      body = (await req.json()) as { email?: unknown; tier?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!isValidEmail(body.email)) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 },
      );
    }
    const email = (body.email as string).trim().toLowerCase();
    const tier = body.tier;

    // ---- Downgrade to free -------------------------------------------------
    if (tier === "free") {
      if (getStripe()) {
        return NextResponse.json(
          { error: "Downgrade to Free happens in the billing portal (cancel subscription)" },
          { status: 400 },
        );
      }
      const result = await applyEntitlement({
        email,
        tier: "free",
        status: "cancelled",
        provider: "stripe_test",
      });
      return NextResponse.json({
        mode: "preview",
        tier: result.ok ? "free" : null,
        processed: result.ok,
      });
    }

    // ---- Paid tier checkout ------------------------------------------------
    if (typeof tier !== "string" || !PAID_TIERS.includes(tier as Tier)) {
      return NextResponse.json(
        { error: `tier must be one of: ${PAID_TIERS.join(", ")} (or "free" to downgrade)` },
        { status: 400 },
      );
    }
    const priceId = tierToPrice(tier as Tier);
    if (!priceId) {
      return NextResponse.json({ error: "No Stripe price configured for this tier" }, { status: 500 });
    }

    const stripe = getStripe();
    if (stripe) {
      // Real Stripe Checkout Session.
      const origin = req.nextUrl.origin;
      try {
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer_email: email,
          client_reference_id: email,
          line_items: [{ price: priceId, quantity: 1 }],
          // The webhook resolves the user from these metadata fields.
          metadata: { email, price_id: priceId },
          success_url: `${origin}/?checkout=success`,
          cancel_url: `${origin}/?checkout=cancel`,
        });
        return NextResponse.json({ mode: "stripe", url: session.url, sessionId: session.id });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stripe checkout failed";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    // Preview mode: apply the entitlement directly so the flow is testable.
    const sessionId = `cs_test_preview_${Date.now()}`;
    const result = await applyEntitlement({
      email,
      tier: tier as Tier,
      status: "active",
      provider: "stripe_test",
      providerRef: sessionId,
    });
    if (!result.ok && !result.dbUnavailable) {
      return NextResponse.json({ error: "Could not apply entitlement" }, { status: 500 });
    }
    const check = await getEntitlement(email);
    return NextResponse.json({
      mode: "preview",
      tier: check?.tier ?? (tier as Tier),
      status: check?.status ?? "active",
      sessionId,
      processed: result.ok,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
