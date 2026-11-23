// =============================================================================
// HYBRID Performance Platform — POST /api/billing/portal
// =============================================================================
//
// Creates a Stripe Customer Portal session for the SIGNED-IN user.
//
//   Request:  {}  (identity comes from the session cookie)
//   Response: { "mode": "stripe", "url": "https://billing.stripe.com/..." }
//          or { "mode": "preview", "url": null }   (dev preview billing)
//
// The Stripe customer is resolved from the subscription id stored on the
// user's own `Subscription` row (written by the verified webhook) — never by
// an email supplied in the request, which would let anyone open anyone's
// billing portal.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getStripe, isBillingPreviewEnabled } from "@/lib/stripe";
import { getSessionUser, isSameOrigin } from "@/lib/auth";
import { getSubscriptionRow } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const stripe = getStripe();
  if (!stripe) {
    if (isBillingPreviewEnabled()) return NextResponse.json({ mode: "preview", url: null });
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }

  const sub = await getSubscriptionRow(user.id);
  if (!sub || sub.provider !== "stripe" || !sub.providerRef?.startsWith("sub_")) {
    return NextResponse.json({ error: "No active billing account for this user" }, { status: 404 });
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(sub.providerRef);
    const customer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${req.nextUrl.origin}/?checkout=portal`,
    });
    return NextResponse.json({ mode: "stripe", url: session.url });
  } catch (err) {
    console.error("[billing] portal session failed", err);
    return NextResponse.json({ error: "Could not open the billing portal. Please try again." }, { status: 502 });
  }
}
