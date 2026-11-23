// =============================================================================
// HYBRID Performance Platform — Entitlements (server-only)
// =============================================================================
//
// The single write path for subscription state. Both the Stripe webhook
// handler (`/api/webhooks/stripe`) and the preview-mode checkout route
// (`/api/billing/checkout`) funnel through `applyEntitlement()` so the
// `Subscription` (and backing `User`) rows can never drift depending on which
// surface changed the tier.
//
// Keying strategy:
//   * Preview build: auth is mocked and the client only has an email, so the
//     user row is upserted by email.
//   * Production (Supabase Auth): Stripe metadata carries the internal
//     user id, so events resolve the existing user by id — never creating
//     shadow users from webhook payloads.
// =============================================================================

import { db } from "@/lib/db";
import type { Tier } from "@/lib/stripe";

export interface EntitlementInput {
  /** Internal user id (production / Stripe metadata user_id). */
  userId?: string | null;
  /** User email (preview build / checkout request). */
  email?: string | null;
  /** Target tier. When omitted, an existing row keeps its tier (used by
   * `invoice.payment_failed`, which only flips status to past_due). */
  tier?: Tier;
  status?: "active" | "cancelled" | "past_due" | "trialing";
  provider?: "stripe" | "app_store" | "play_store" | "stripe_test" | null;
  /** Stripe subscription id (or equivalent provider reference). */
  providerRef?: string | null;
  currentPeriodEnd?: Date | null;
}

export interface EntitlementResult {
  ok: boolean;
  /** Present when a database row was written. */
  tier?: Tier;
  status?: string;
  /** True when the DB is unreachable and the call was a no-op. */
  dbUnavailable?: boolean;
}

function normaliseEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.includes("@") && trimmed.length >= 3 ? trimmed : null;
}

/**
 * Upsert the subscription for a user. Resolves the user by id first (Stripe
 * metadata), then by email (preview checkout). Creates the user row when only
 * an email is known (preview build — real auth creates users upstream).
 *
 * Safe to call when the DB is unreachable: returns `{ ok: false,
 * dbUnavailable: true }` instead of throwing, so route handlers can degrade
 * gracefully.
 */
export async function applyEntitlement(input: EntitlementInput): Promise<EntitlementResult> {
  try {
    // 1. Resolve the backing user row (only the id is needed downstream).
    let user: { id: string } | null = null;
    if (input.userId) {
      user = await db.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      });
    }
    if (!user) {
      const email = normaliseEmail(input.email);
      if (email) {
        user = await db.user.upsert({
          where: { email },
          create: { email },
          update: {},
          select: { id: true },
        });
      }
    }
    if (!user) {
      // No resolvable user (e.g. webhook for an unknown id) — nothing to do.
      return { ok: false };
    }

    // 2. Upsert the subscription row.
    const subscription = await db.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        tier: input.tier ?? "free",
        status: input.status ?? "active",
        provider: input.provider ?? null,
        providerRef: input.providerRef ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
      },
      update: {
        // `undefined` keeps the existing column value on update.
        tier: input.tier ?? undefined,
        status: input.status ?? undefined,
        provider: input.provider ?? undefined,
        providerRef: input.providerRef ?? undefined,
        currentPeriodEnd: input.currentPeriodEnd ?? undefined,
      },
    });

    return { ok: true, tier: subscription.tier as Tier, status: subscription.status };
  } catch {
    // Database unreachable (preview build without a provisioned Supabase
    // project, SQLite file missing, etc.). Degrade to a no-op.
    return { ok: false, dbUnavailable: true };
  }
}

/**
 * Read the current entitlement for a user by email. Returns null when there
 * is no row or the DB is unreachable.
 */
export async function getEntitlement(
  email: string | null | undefined,
): Promise<{ tier: Tier; status: string; currentPeriodEnd: Date | null } | null> {
  const normalised = normaliseEmail(email);
  if (!normalised) return null;
  try {
    const user = await db.user.findUnique({
      where: { email: normalised },
      include: { subscription: true },
    });
    if (!user?.subscription) return null;
    return {
      tier: user.subscription.tier as Tier,
      status: user.subscription.status,
      currentPeriodEnd: user.subscription.currentPeriodEnd,
    };
  } catch {
    return null;
  }
}

/**
 * Record a processed webhook event for idempotency. Returns false when the
 * event was already recorded (a replay) or the DB is unreachable — callers
 * should skip processing in both cases rather than risk double-applying.
 */
export async function claimWebhookEvent(
  provider: string,
  externalId: string,
  type: string,
): Promise<boolean> {
  try {
    await db.webhookEvent.create({
      data: { provider, externalId, type },
    });
    return true;
  } catch {
    // Unique-constraint violation (replay) or DB unavailable — either way,
    // do not process.
    return false;
  }
}
