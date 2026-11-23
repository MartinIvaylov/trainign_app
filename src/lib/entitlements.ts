// =============================================================================
// HYBRID Performance Platform — Entitlements (server-only)
// =============================================================================
//
// The single write path for subscription state. The Stripe webhook handler
// and the (development-only) preview checkout both funnel through
// `applyEntitlement()`, so `Subscription` rows cannot drift depending on
// which surface changed the tier.
//
// Security model:
//   * The server is the only authority on a user's tier. Clients read it
//     from `/api/auth/me`; anything the browser stores is a display cache.
//   * Users are resolved, in order, by internal id (session / Stripe
//     metadata `user_id`), by the provider reference already stored on their
//     subscription (Stripe subscription id), and finally by email — but only
//     for an EXISTING account. Webhook payloads never create users.
// =============================================================================

import { db } from "@/lib/db";
import type { Tier } from "@/lib/stripe";

export type SubscriptionStatus = "active" | "cancelled" | "past_due" | "trialing";

export interface EntitlementInput {
  /** Internal user id (session or Stripe metadata user_id). */
  userId?: string | null;
  /** Email of an existing account (fallback only — never creates a user). */
  email?: string | null;
  /** Target tier. Omitted → an existing row keeps its tier. */
  tier?: Tier;
  status?: SubscriptionStatus;
  provider?: "stripe" | "app_store" | "play_store" | "stripe_test" | null;
  /** Stripe subscription id (or equivalent provider reference). */
  providerRef?: string | null;
  currentPeriodEnd?: Date | null;
}

export interface EntitlementResult {
  ok: boolean;
  tier?: Tier;
  status?: string;
  /** True when the DB is unreachable and the call was a no-op. */
  dbUnavailable?: boolean;
}

export interface EntitlementView {
  /** Tier the user is entitled to right now (cancelled → free). */
  tier: Tier;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
}

const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, pro_annual: 1, coach: 2, gym: 3 };

function normaliseEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.includes("@") && trimmed.length >= 3 ? trimmed : null;
}

async function resolveUserId(input: EntitlementInput): Promise<string | null> {
  if (input.userId) {
    const user = await db.user.findUnique({ where: { id: input.userId }, select: { id: true } });
    if (user) return user.id;
  }
  if (input.providerRef) {
    const sub = await db.subscription.findFirst({
      where: { providerRef: input.providerRef },
      select: { userId: true },
    });
    if (sub) return sub.userId;
  }
  const email = normaliseEmail(input.email);
  if (email) {
    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (user) return user.id;
  }
  return null;
}

/**
 * Upsert the subscription for an existing user. Returns `{ ok: false }` when
 * no user can be resolved, `{ ok: false, dbUnavailable: true }` when the DB
 * is unreachable.
 */
export async function applyEntitlement(input: EntitlementInput): Promise<EntitlementResult> {
  try {
    const userId = await resolveUserId(input);
    if (!userId) return { ok: false };

    const subscription = await db.subscription.upsert({
      where: { userId },
      create: {
        userId,
        tier: input.tier ?? "free",
        status: input.status ?? "active",
        provider: input.provider ?? null,
        providerRef: input.providerRef ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
      },
      update: {
        tier: input.tier ?? undefined,
        status: input.status ?? undefined,
        provider: input.provider ?? undefined,
        providerRef: input.providerRef ?? undefined,
        currentPeriodEnd: input.currentPeriodEnd ?? undefined,
      },
    });

    return { ok: true, tier: subscription.tier as Tier, status: subscription.status };
  } catch {
    return { ok: false, dbUnavailable: true };
  }
}

/** The user's current entitlement. Defaults to free when no row / DB error. */
export async function getEntitlementForUser(userId: string): Promise<EntitlementView> {
  try {
    const sub = await db.subscription.findUnique({ where: { userId } });
    if (!sub) return { tier: "free", status: "active", currentPeriodEnd: null };
    const status = sub.status as SubscriptionStatus;
    const tier = status === "cancelled" ? "free" : (sub.tier as Tier);
    return { tier, status, currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null };
  } catch {
    return { tier: "free", status: "active", currentPeriodEnd: null };
  }
}

/** Raw subscription row for a user (provider ref is needed by the portal). */
export async function getSubscriptionRow(userId: string) {
  try {
    return await db.subscription.findUnique({ where: { userId } });
  } catch {
    return null;
  }
}

/** Server-side feature gate: does `tier` include `required`? */
export function tierAtLeast(tier: Tier, required: Tier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[required];
}

/**
 * Record a webhook event for idempotency. Returns false when the event was
 * already recorded (a replay) or the DB is unreachable.
 */
export async function claimWebhookEvent(provider: string, externalId: string, type: string): Promise<boolean> {
  try {
    await db.webhookEvent.create({ data: { provider, externalId, type } });
    return true;
  } catch {
    return false;
  }
}

/** Release a claim when processing failed, so the provider's retry is processed. */
export async function releaseWebhookEvent(provider: string, externalId: string): Promise<void> {
  try {
    await db.webhookEvent.delete({ where: { provider_externalId: { provider, externalId } } });
  } catch {
    /* already gone / DB down */
  }
}
