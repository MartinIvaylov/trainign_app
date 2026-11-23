// =============================================================================
// HYBRID Performance Platform — Stripe webhook handler
// =============================================================================
//
//   1. Every event is cryptographically verified with
//      `stripe.webhooks.constructEventAsync` against `STRIPE_WEBHOOK_SECRET`.
//      There is NO unverified mode: without both `STRIPE_SECRET_KEY` and
//      `STRIPE_WEBHOOK_SECRET` the endpoint answers 503 and writes nothing.
//   2. Idempotency: the event id is claimed in `WebhookEvent` before
//      processing; replays are acknowledged and skipped. If applying the
//      entitlement fails because the DB is down, the claim is released and a
//      500 is returned so Stripe retries.
//   3. Entitlements (via `applyEntitlement()`), resolved by Stripe metadata
//      `user_id` / `client_reference_id`, then by the stored subscription id.
//      Webhooks never create user rows.
//        checkout.session.completed        → activate tier
//        customer.subscription.updated     → update tier / status / period end
//        customer.subscription.deleted     → downgrade to free, cancelled
//        invoice.payment_failed            → mark past_due (tier unchanged)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getStripe, tierFromPrice, type Tier } from "@/lib/stripe";
import { applyEntitlement, claimWebhookEvent, releaseWebhookEvent } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Minimal shape of the events we inspect. Real Stripe events are far richer;
// these interfaces keep the handler decoupled from the SDK's typings.
interface StripeItem {
  price?: { id?: string } | null;
  current_period_end?: number;
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
  parent?: { subscription_details?: { subscription?: string | null } | null } | null;
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
  if (!userId && !email && !obj.id) return null; // resolved via stored subscription id
  return {
    userId,
    email,
    tier: tier ?? undefined,
    status,
    providerRef: obj.id ?? null,
    // Newer Stripe API versions report the period end per subscription item.
    currentPeriodEnd: toDate(obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end) ?? undefined,
  };
}

function processSubscriptionDeleted(event: ScaffoldStripeEvent): PendingEntitlement | null {
  const obj = event.data?.object as StripeSubscriptionObject | undefined;
  if (!obj) return null;
  const { userId, email } = extractUserRef(obj);
  if (!userId && !email && !obj.id) return null; // resolved via stored subscription id
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
  const subscriptionRef = obj.subscription ?? obj.parent?.subscription_details?.subscription ?? null;
  if (!userId && !email && !subscriptionRef) return null;
  return {
    userId,
    email,
    // No tier: `applyEntitlement` keeps the existing tier on update.
    status: "past_due",
    providerRef: subscriptionRef,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Raw body — signature verification needs the original bytes.
  const rawBody = await req.text();

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 401 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();
  if (!webhookSecret || !stripe) {
    console.error("[stripe-webhook] STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhooks are not configured" }, { status: 503 });
  }

  // 2. Verify + parse.
  let event: ScaffoldStripeEvent;
  try {
    // Async variant: works on both Node crypto and WebCrypto (Bun / edge
    // runtimes, where the synchronous verifier throws).
    event = (await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret)) as unknown as ScaffoldStripeEvent;
  } catch {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  const type = event.type ?? "unknown";

  // 3. Idempotency.
  if (event.id) {
    const claimed = await claimWebhookEvent("stripe", event.id, type);
    if (!claimed) {
      return NextResponse.json({ received: true, type, processed: false, duplicate: true });
    }
  }

  // 4. Route the event to its processor.
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
    if (result.dbUnavailable) {
      if (event.id) await releaseWebhookEvent("stripe", event.id);
      return NextResponse.json({ error: "Temporarily unavailable" }, { status: 500 });
    }
    processed = result.ok;
    tier = result.tier ?? null;
  }

  // 5. 200 for every verified event (including unhandled types) so Stripe
  //    does not retry-storm.
  return NextResponse.json({ received: true, type, processed, tier });
}
