// =============================================================================
// HYBRID Performance Platform — Stripe utility (server-only, SCAFFOLD)
// =============================================================================
//
// This is a scaffold. To use, run `bun add stripe` and uncomment the Stripe
// client initialization below. The actual Stripe SDK is not installed in this
// preview build to avoid bundling unused code.
//
// What this module already provides:
//   - `PRICE_TO_TIER`: map from Stripe price id → internal subscription tier
//   - `tierFromPrice(priceId)`: price id → tier (or null)
//   - `tierToPrice(tier)`: tier → price id (or null)
//
// The price id keys below are placeholders. In production, replace them with
// the real Stripe price ids from your Stripe Dashboard (or — preferably —
// read them from `process.env.STRIPE_PRICE_*` at startup so the mapping can
// be rotated without a code change).
// =============================================================================

// Server-only guard. Importing this module from a client component will fail
// at build time because the file references `process.env.STRIPE_*` keys that
// are not exposed to the client. (Next.js tree-shakes unused server modules,
// so this is a hint, not a hard boundary. Always call this from a route
// handler, server action or lib used by one.)
const _serverOnly = typeof window === "undefined";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type Tier = "free" | "pro" | "pro_annual" | "coach" | "gym";

// -----------------------------------------------------------------------------
// Price → tier mapping
// -----------------------------------------------------------------------------
// Placeholder price ids. In production these should resolve to the real
// Stripe price ids (e.g. `price_1PabcDEF...`). Either edit this map or
// (better) source them from environment variables at module load:

const ENV = process.env as Record<string, string | undefined>;
const PRICE_PRO_MONTHLY = ENV.STRIPE_PRICE_PRO_MONTHLY ?? "price_pro_monthly";
const PRICE_PRO_ANNUAL = ENV.STRIPE_PRICE_PRO_ANNUAL ?? "price_pro_annual";
const PRICE_COACH = ENV.STRIPE_PRICE_COACH ?? "price_coach";
const PRICE_GYM = ENV.STRIPE_PRICE_GYM ?? "price_gym";
// "free" is not a real Stripe price — it's the absence of a paid subscription.
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
// Stripe client (SCAFFOLD — uncomment in production)
// -----------------------------------------------------------------------------
//
// To enable the real Stripe SDK:
//
//   1. `bun add stripe`
//   2. Add `import Stripe from "stripe";` at the top of this file.
//   3. Uncomment the initialization below.
//   4. Export `stripe` and use it in route handlers (e.g. to construct
//      webhook events or to create checkout sessions).
//
// import Stripe from "stripe";
//
// export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: "2024-06-20", // pin to the API version you build & test against
//   appInfo: {
//     name: "HYBRID Performance Platform",
//     version: "0.1.0",
//   },
// });
