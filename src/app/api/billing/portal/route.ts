// =============================================================================
// HYBRID Performance Platform — POST /api/billing/portal
// =============================================================================
//
// Creates a Stripe Customer Portal session so subscribers can manage their
// payment method, swap tiers, or cancel (which ends in a
// `customer.subscription.deleted` webhook → tier "free").
//
//   Request:  { "email": "athlete@example.com" }
//   Response: { "mode": "stripe", "url": "https://billing.stripe.com/..." }
//          or { "mode": "preview", "url": null }
//
// The Stripe customer is resolved by email (`stripe.customers.list`) because
// the checkout flow sets `customer_email` — this avoids storing a Stripe
// customer id per user. 404 when the email has no Stripe customer yet.
//
// Preview mode (no Stripe keys): returns `{ mode: "preview", url: null }` so
// the UI can explain that the portal needs live credentials.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function POST(req: NextRequest) {
  try {
    let body: { email?: unknown };
    try {
      body = (await req.json()) as { email?: unknown };
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

    const stripe = getStripe();
    if (!stripe) {
      // Preview mode — no live credentials, nothing to manage.
      return NextResponse.json({ mode: "preview", url: null });
    }

    // Resolve the Stripe customer by email.
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];
    if (!customer) {
      return NextResponse.json(
        { error: "No Stripe customer found for this email" },
        { status: 404 },
      );
    }

    const origin = req.nextUrl.origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${origin}/?checkout=portal`,
    });
    return NextResponse.json({ mode: "stripe", url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
