// =============================================================================
// HYBRID Performance Platform — Stripe utility (server-only)
// =============================================================================
//
// Real Stripe integration (SDK installed: `stripe` npm package).
//
//   * `getStripe()` — returns an initialised Stripe client, or `null` when
//     `STRIPE_SECRET_KEY` is not configured (preview build). Callers must
//     handle the null case with a preview-mode fallback.
//   * `isStripeConfigured()` — cheap check used by routes to pick between the
//     real Checkout flow and the simulated entitlement flow.
//   * `PRICE_TO_TIER` / `tierFromPrice` / `tierToPrice` — price id ↔ internal
//     subscription tier mapping, sourced from `STRIPE_PRICE_*` env vars.
//
// The client is created lazily and cached on `globalThis` so hot reloads and
// repeated route invocations reuse a single instance (Stripe SDK guidance:
// avoid instantiating a new client per request in dev).
// =============================================================================

import Stripe from "stripe";

// Server-only guard: importing this module from a client component will fail
// at build time because `stripe` and the `STRIPE_*` env vars are server-side.
const _serverOnly = typeof window === "undefined";
void _serverOnly;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type Tier = "free" | "pro" | "pro_annual" | "coach" | "gym";

// -----------------------------------------------------------------------------
// Price → tier mapping
// -----------------------------------------------------------------------------
// Price ids resolve from `STRIPE_PRICE_*` environment variables (set in the
// Stripe Dashboard → Products → Pricing). "free" is not a real Stripe price —
// it is the absence of a paid subscription.

const ENV = process.env as Record<string, string | undefined>;
const PRICE_PRO_MONTHLY = ENV.STRIPE_PRICE_PRO_MONTHLY ?? "price_pro_monthly";
const PRICE_PRO_ANNUAL = ENV.STRIPE_PRICE_PRO_ANNUAL ?? "price_pro_annual";
const PRICE_COACH = ENV.STRIPE_PRICE_COACH ?? "price_coach";
const PRICE_GYM = ENV.STRIPE_PRICE_GYM ?? "price_gym";
const PRICE_FREE = "price_free";

/** Map a Stripe price id to an internal subscription tier. */
export const PRICE_TO_TIER = {
  [PRICE_FREE]: "free",
  [PRICE_PRO_MONTHLY]: "pro",
  [PRICE_PRO_ANNUAL]: "pro_annual",
  [PRICE_COACH]: "coach",
  [PRICE_GYM]: "gym",
} as const satisfies Record<string, Tier>;

/**
 * Reverse lookup: tier → Stripe price id. Built once from PRICE_TO_TIER so
 * the two maps can never drift apart.
 */
export const TIER_TO_PRICE = (Object.entries(PRICE_TO_TIER) as [string, Tier][]).reduce(
  (acc, [priceId, tier]) => {
    acc[tier] = priceId;
    return acc;
  },
  {} as Record<Tier, string>,
);

/**
 * Look up the internal tier for a Stripe price id.
 * Returns `null` for unknown price ids (including `null` / `undefined`).
 */
export function tierFromPrice(priceId: string | null | undefined): Tier | null {
  if (!priceId || typeof priceId !== "string") return null;
  return (PRICE_TO_TIER as Record<string, Tier>)[priceId] ?? null;
}

/**
 * Reverse lookup: internal tier → Stripe price id.
 * Returns `null` for unknown tiers.
 */
export function tierToPrice(tier: Tier | null | undefined): string | null {
  if (!tier) return null;
  return TIER_TO_PRICE[tier] ?? null;
}

// -----------------------------------------------------------------------------
// Stripe client
// -----------------------------------------------------------------------------

const globalForStripe = globalThis as unknown as {
  __hybridStripe?: Stripe;
};

/** True when a real Stripe secret key is configured. */
export function isStripeConfigured(): boolean {
  return typeof process.env.STRIPE_SECRET_KEY === "string" && process.env.STRIPE_SECRET_KEY.length > 0;
}

/**
 * Simulated billing (entitlements applied without payment). Opt-in for local
 * development only — never active in production builds.
 */
export function isBillingPreviewEnabled(): boolean {
  return process.env.BILLING_PREVIEW_MODE === "true" && process.env.NODE_ENV !== "production";
}

/**
 * Get the shared Stripe client, or `null` when Stripe is not configured
 * (preview build / tests). Never throws.
 */
export function getStripe(): Stripe | null {
  if (!isStripeConfigured()) return null;
  if (globalForStripe.__hybridStripe) return globalForStripe.__hybridStripe;
  try {
    const client = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      // No `apiVersion` override: the SDK ships pinned to the API version it
      // was built against (see node_modules/stripe/cjs/apiVersion.js).
      appInfo: {
        name: "HYBRID Performance Platform",
        version: "0.6.0",
      },
    });
    globalForStripe.__hybridStripe = client;
    return client;
  } catch {
    return null;
  }
}
