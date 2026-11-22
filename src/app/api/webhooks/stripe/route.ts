// =============================================================================
// HYBRID Performance Platform — Stripe webhook handler (SCAFFOLD)
// =============================================================================
//
// This is a scaffold implementation. In production you MUST:
//
//   1. Install the Stripe SDK:
//        bun add stripe
//
//   2. Initialise the Stripe client at the top of this file:
//        import Stripe from "stripe";
//        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
//
//   3. Verify the event signature using the SDK instead of trusting the body:
//        const event = stripe.webhooks.constructEvent(
//          rawBody,
//          signature,
//          process.env.STRIPE_WEBHOOK_SECRET!
//        );
//
//   4. After verifying, update the Supabase `Subscription` table via Prisma:
//        await db.subscription.upsert({
//          where: { userId },
//          create: { userId, tier, status, provider: "stripe", providerRef: subscriptionId, currentPeriodEnd },
//          update: { tier, status, currentPeriodEnd, providerRef: subscriptionId },
//        });
//
// Until then, this handler reads the raw body, requires a `stripe-signature`
// header to be present (returning 401 if missing), then inspects the parsed
// JSON to map Stripe price IDs to internal tiers. It DOES NOT cryptographically
// verify the signature — that is only safe to ship once the Stripe SDK is
// installed and the `constructEvent` call is wired up.
//
// Event handling (scaffold):
//   - checkout.session.completed  → create/activate subscription
//   - customer.subscription.updated → update tier
//   - customer.subscription.deleted  → downgrade to free
//   - invoice.payment_failed        → mark subscription past_due
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { tierFromPrice, type Tier } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Minimal shape of the events we inspect in this scaffold. Real Stripe events
// are far richer; once the SDK is installed, replace `any` with
// `Stripe.Event` and delete these interfaces.
interface StripeItem {
  price?: { id?: string } | null;
}

interface StripeSubscriptionObject {
  id?: string;
  customer?: string;
  status?: string;
  current_period_end?: number;
  items?: { data?: StripeItem[] };
  metadata?: { user_id?: string } | Record<string, string | undefined>;
}

interface StripeCheckoutObject {
  id?: string;
  customer?: string;
  subscription?: string;
  client_reference_id?: string;
  metadata?: { user_id?: string; price_id?: string } | Record<string, string | undefined>;
}

interface StripeInvoiceObject {
  id?: string;
  customer?: string;
  subscription?: string;
  parent?: { subscription_item?: string | null };
  lines?: { data?: StripeItem[] };
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

/** Pull a user id out of any of the common Stripe metadata locations. */
function extractUserId(
  obj: StripeSubscriptionObject | StripeCheckoutObject | StripeInvoiceObject | Record<string, unknown>,
): string | null {
  const metadata = (obj as { metadata?: Record<string, string | undefined> }).metadata;
  if (metadata && typeof metadata.user_id === "string" && metadata.user_id.length > 0) {
    return metadata.user_id;
  }
  const clientRef = (obj as StripeCheckoutObject).client_reference_id;
  if (typeof clientRef === "string" && clientRef.length > 0) {
    return clientRef;
  }
  return null;
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

/** Convert a unix epoch (seconds) to an ISO string, or null if missing. */
function toIso(epochSeconds: number | undefined): string | null {
  if (typeof epochSeconds !== "number" || !Number.isFinite(epochSeconds)) return null;
  return new Date(epochSeconds * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Event processors (scaffold — no DB writes yet)
// ---------------------------------------------------------------------------

function handleCheckoutCompleted(event: ScaffoldStripeEvent): { processed: boolean; tier: Tier | null; userId: string | null } {
  const obj = event.data?.object as StripeCheckoutObject | undefined;
  if (!obj) return { processed: false, tier: null, userId: null };
  const userId = extractUserId(obj);
  const priceId = (obj.metadata as { price_id?: string } | undefined)?.price_id ?? null;
  const tier = priceId ? tierFromPrice(priceId) : null;
  // Production: upsert Subscription row with tier, status="active",
  // provider="stripe", providerRef=obj.subscription, currentPeriodEnd from invoice.
  return { processed: Boolean(userId && tier), tier, userId };
}

function handleSubscriptionUpdated(event: ScaffoldStripeEvent): { processed: boolean; tier: Tier | null; userId: string | null } {
  const obj = event.data?.object as StripeSubscriptionObject | undefined;
  if (!obj) return { processed: false, tier: null, userId: null };
  const userId = extractUserId(obj);
  const priceId = extractPriceId(obj);
  const tier = priceId ? tierFromPrice(priceId) : null;
  const _periodEnd = toIso(obj.current_period_end);
  // Production: update Subscription.tier + currentPeriodEnd.
  return { processed: Boolean(userId && tier), tier, userId };
}

function handleSubscriptionDeleted(event: ScaffoldStripeEvent): { processed: boolean; tier: Tier; userId: string | null } {
  const obj = event.data?.object as StripeSubscriptionObject | undefined;
  const userId = obj ? extractUserId(obj) : null;
  // Production: set Subscription.tier="free", status="cancelled".
  return { processed: Boolean(userId), tier: "free", userId };
}

function handleInvoicePaymentFailed(event: ScaffoldStripeEvent): { processed: boolean; userId: string | null } {
  const obj = event.data?.object as StripeInvoiceObject | undefined;
  const userId = obj ? extractUserId(obj) : null;
  // Production: set Subscription.status="past_due".
  return { processed: Boolean(userId), userId };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // 1. Read the raw body. Stripe requires the original bytes for signature
    //    verification — do not use req.json() before verifying in production.
    const rawBody = await req.text();

    // 2. Require a stripe-signature header. This is NOT cryptographic
    //    verification — see the file header for the production upgrade path.
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

    // 3. Parse the body. In production replace this with
    //    `stripe.webhooks.constructEvent(rawBody, signature, secret)`.
    let event: ScaffoldStripeEvent;
    try {
      event = JSON.parse(rawBody) as ScaffoldStripeEvent;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const type = event.type ?? "unknown";

    // 4. Route the event to the appropriate scaffold handler.
    let processed = false;
    let tier: Tier | null = null;
    let userId: string | null = null;

    switch (type) {
      case "checkout.session.completed": {
        const r = handleCheckoutCompleted(event);
        processed = r.processed;
        tier = r.tier;
        userId = r.userId;
        break;
      }
      case "customer.subscription.updated": {
        const r = handleSubscriptionUpdated(event);
        processed = r.processed;
        tier = r.tier;
        userId = r.userId;
        break;
      }
      case "customer.subscription.deleted": {
        const r = handleSubscriptionDeleted(event);
        processed = r.processed;
        tier = r.tier;
        userId = r.userId;
        break;
      }
      case "invoice.payment_failed": {
        const r = handleInvoicePaymentFailed(event);
        processed = r.processed;
        userId = r.userId;
        break;
      }
      default:
        processed = false;
        break;
    }

    // 5. Acknowledge receipt. Vercel/Stripe will retry on non-2xx, so we only
    //    return 200 — even for unhandled event types — to avoid retry storms.
    //    The `processed` flag tells the caller whether we mapped the event to
    //    an internal tier transition.
    return NextResponse.json({
      received: true,
      type,
      processed,
      tier,
      userId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
