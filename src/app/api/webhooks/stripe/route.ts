// =============================================================================
// HYBRID Performance Platform — Stripe webhook handler
// =============================================================================
//
// Full implementation (Stripe SDK installed):
//
//   1. When `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` are configured, the
//      raw body is verified with `stripe.webhooks.constructEvent` — the only
//      safe way to trust a webhook (401/400 on missing/invalid signature).
//   2. Idempotency: the event id is claimed in the `WebhookEvent` table before
//      processing. Replayed events (Stripe retries) are acknowledged with 200
//      and skipped — the entitlement is never double-applied.
//   3. Entitlements: each event maps to an upsert on the `Subscription` table
//      via `applyEntitlement()` (see `src/lib/entitlements.ts`):
//        checkout.session.completed        → activate tier
//        customer.subscription.updated     → update tier / status / period end
//        customer.subscription.deleted     → downgrade to free, cancelled
//        invoice.payment_failed            → mark past_due (tier unchanged)
//
// Preview mode (no `STRIPE_SECRET_KEY`, e.g. this sandbox / local dev):
// the signature header must be present and `STRIPE_WEBHOOK_SECRET` set, but
// the payload is trusted as-is so the full event → database flow can be
// exercised end-to-end without live Stripe credentials. Signature-only trust
// is gated on the absence of a real secret key, so production always verifies
// cryptographically.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getStripe, isStripeConfigured, tierFromPrice, type Tier } from "@/lib/stripe";
import { applyEntitlement, claimWebhookEvent } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Minimal shape of the events we inspect. Real Stripe events are far richer;
// these interfaces keep the handler decoupled from the SDK types so preview
// mode (plain JSON) and production (verified events) share one code path.
interface StripeItem {
  price?: { id?: string } | null;
}

interface StripeSubscriptionObject {
  id?: string;
  customer?: string;
  status?: string;
  current_period_end?: number;
  items?: { data?: StripeItem[] };
  metadata?: Record<string, string | undefined>;
}

interface StripeCheckoutObject {
  id?: string;
  customer?: string;
  subscription?: string;
  client_reference_id?: string;
  metadata?: Record<string, string | undefined>;
}

interface StripeInvoiceObject {
  id?: string;
  customer?: string;
  subscription?: string;
  parent?: { subscription_item?: string | null };
  lines?: { data?: StripeItem[] };
  metadata?: Record<string, string | undefined>;
}

interface ScaffoldStripeEvent {
  id?: string;
  type?: string;
  data?: {
    object?:
      | StripeSubscriptionObject
      | StripeCheckoutObject
      | StripeInvoiceObject
      | Record<string, unknown>;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pull a user reference out of any of the common Stripe metadata locations. */
function extractUserRef(
  obj: StripeSubscriptionObject | StripeCheckoutObject | StripeInvoiceObject | Record<string, unknown>,
): { userId: string | null; email: string | null } {
  const metadata = (obj as { metadata?: Record<string, string | undefined> }).metadata;
  const userId =
    metadata && typeof metadata.user_id === "string" && metadata.user_id.length > 0
      ? metadata.user_id
      : null;
  const email =
    metadata && typeof metadata.email === "string" && metadata.email.includes("@")
      ? metadata.email
      : null;
  const clientRef = (obj as StripeCheckoutObject).client_reference_id;
  const fromClientRef =
    typeof clientRef === "string" && clientRef.length > 0 ? clientRef : null;
  return { userId: userId ?? fromClientRef, email };
}

/** Find the first price id on a subscription or invoice line item. */
function extractPriceId(
  obj: StripeSubscriptionObject | StripeInvoiceObject | Record<string, unknown>,
): string | null {
  const items = (obj as StripeSubscriptionObject).items?.data;
  if (Array.isArray(items)) {
    for (const it of items) {
      const pid = it?.price?.id;
      if (typeof pid === "string" && pid.length > 0) return pid;
    }
  }
  const lines = (obj as StripeInvoiceObject).lines?.data;
  if (Array.isArray(lines)) {
    for (const it of lines) {
      const pid = it?.price?.id;
      if (typeof pid === "string" && pid.length > 0) return pid;
    }
  }
  return null;
}

/** Convert a unix epoch (seconds) to a Date, or null if missing. */
function toDate(epochSeconds: number | undefined): Date | null {
  if (typeof epochSeconds !== "number" || !Number.isFinite(epochSeconds)) return null;
  return new Date(epochSeconds * 1000);
}

/** Map a Stripe subscription status onto our internal status vocabulary. */
function mapStatus(status: string | undefined): "active" | "cancelled" | "past_due" | "trialing" | null {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "cancelled":
      return "cancelled";
    default:
      return null; // incomplete / paused / unknown — leave the row untouched
  }
}

// ---------------------------------------------------------------------------
// Event processors — each returns the entitlement to apply (or null)
// ---------------------------------------------------------------------------

interface PendingEntitlement {
  userId: string | null;
  email: string | null;
  tier?: Tier;
  status: "active" | "cancelled" | "past_due" | "trialing";
  providerRef: string | null;
  currentPeriodEnd?: Date | null;
}

function processCheckoutCompleted(event: ScaffoldStripeEvent): PendingEntitlement | null {
  const obj = event.data?.object as StripeCheckoutObject | undefined;
  if (!obj) return null;
  const { userId, email } = extractUserRef(obj);
  const priceId = obj.metadata?.price_id ?? null;
  const tier = priceId ? tierFromPrice(priceId) : null;
  if (!userId && !email) return null;
  if (priceId && !tier) return null; // unknown price — do not guess
  return {
    userId,
    email,
    tier: tier ?? undefined,
    status: "active",
    providerRef: obj.subscription ?? obj.id ?? null,
  };
}

function processSubscriptionUpdated(event: ScaffoldStripeEvent): PendingEntitlement | null {
  const obj = event.data?.object as StripeSubscriptionObject | undefined;
  if (!obj) return null;
  const { userId, email } = extractUserRef(obj);
  const priceId = extractPriceId(obj);
  const tier = priceId ? tierFromPrice(priceId) : null;
  const status = mapStatus(obj.status) ?? "active";
  if (!userId && !email) return null;
  return {
    userId,
    email,
    tier: tier ?? undefined,
    status,
    providerRef: obj.id ?? null,
    currentPeriodEnd: toDate(obj.current_period_end) ?? undefined,
  };
}

function processSubscriptionDeleted(event: ScaffoldStripeEvent): PendingEntitlement | null {
  const obj = event.data?.object as StripeSubscriptionObject | undefined;
  if (!obj) return null;
  const { userId, email } = extractUserRef(obj);
  if (!userId && !email) return null;
  return {
    userId,
    email,
    tier: "free",
    status: "cancelled",
    providerRef: obj.id ?? null,
  };
}

function processInvoicePaymentFailed(event: ScaffoldStripeEvent): PendingEntitlement | null {
  const obj = event.data?.object as StripeInvoiceObject | undefined;
  if (!obj) return null;
  const { userId, email } = extractUserRef(obj);
  if (!userId && !email) return null;
  return {
    userId,
    email,
    // No tier: `applyEntitlement` keeps the existing tier on update.
    status: "past_due",
    providerRef: obj.subscription ?? null,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // 1. Read the raw body — signature verification needs the original bytes.
    const rawBody = await req.text();

    // 2. A stripe-signature header is always required.
    const signature = req.headers.get("stripe-signature");
    if (!signature || signature.length === 0) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 401 },
      );
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "STRIPE_WEBHOOK_SECRET is not configured" },
        { status: 500 },
      );
    }

    // 3. Verify + parse the event.
    //    Production (STRIPE_SECRET_KEY set): cryptographically verified via
    //    the SDK. Preview mode: JSON-parsed and trusted (see file header).
    let event: ScaffoldStripeEvent;
    if (isStripeConfigured()) {
      const stripe = getStripe();
      if (!stripe) {
        return NextResponse.json({ error: "Stripe client unavailable" }, { status: 500 });
      }
      try {
        event = stripe.webhooks.constructEvent(
          rawBody,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET,
        ) as unknown as ScaffoldStripeEvent;
      } catch {
        return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
      }
    } else {
      try {
        event = JSON.parse(rawBody) as ScaffoldStripeEvent;
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
    }

    const type = event.type ?? "unknown";

    // 4. Idempotency: claim the event id before processing. A replay (Stripe
    //    retry) or an unreachable DB both short-circuit to "do not process".
    let duplicate = false;
    if (event.id) {
      const claimed = await claimWebhookEvent("stripe", event.id, type);
      if (!claimed) duplicate = true;
    }
    if (duplicate) {
      return NextResponse.json({ received: true, type, processed: false, duplicate: true });
    }

    // 5. Route the event to its processor and apply the entitlement.
    let pending: PendingEntitlement | null = null;
    switch (type) {
      case "checkout.session.completed":
        pending = processCheckoutCompleted(event);
        break;
      case "customer.subscription.updated":
        pending = processSubscriptionUpdated(event);
        break;
      case "customer.subscription.deleted":
        pending = processSubscriptionDeleted(event);
        break;
      case "invoice.payment_failed":
        pending = processInvoicePaymentFailed(event);
        break;
      default:
        pending = null;
        break;
    }

    let processed = false;
    let tier: Tier | null = null;
    if (pending) {
      const result = await applyEntitlement({
        userId: pending.userId,
        email: pending.email,
        tier: pending.tier,
        status: pending.status,
        provider: "stripe",
        providerRef: pending.providerRef,
        currentPeriodEnd: pending.currentPeriodEnd ?? null,
      });
      processed = result.ok;
      tier = result.tier ?? pending.tier ?? null;
    }

    // 6. Acknowledge receipt with 200 for every parseable event — including
    //    unhandled types — so Stripe does not retry-storm. `processed` tells
    //    the caller whether an entitlement row was actually written.
    return NextResponse.json({
      received: true,
      type,
      processed,
      tier,
      userId: pending?.userId ?? pending?.email ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
