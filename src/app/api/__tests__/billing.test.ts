// Integration tests for billing, sync and Stripe webhooks — focused on the
// security properties from the audit (C2–C5):
//   * every user-data route requires a session and ignores identities sent
//     in the request body / query;
//   * paid tiers are never granted without a verified Stripe event (preview
//     billing only with an explicit dev flag);
//   * webhooks are always signature-verified and never create users.
//
// Run with: `bun test src/app/api/__tests__/billing.test.ts`
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { POST as checkoutPOST } from "@/app/api/billing/checkout/route";
import { POST as portalPOST } from "@/app/api/billing/portal/route";
import { GET as syncGET, POST as syncPOST } from "@/app/api/sync/route";
import { POST as stripePOST } from "@/app/api/webhooks/stripe/route";
import { db } from "@/lib/db";
import { RUN, WEBHOOK_SECRET, createSessionUser, postJson, req, signedWebhook, withEnv } from "./helpers";

const CHECKOUT = "http://localhost:3000/api/billing/checkout";
const PORTAL = "http://localhost:3000/api/billing/portal";
const SYNC = "http://localhost:3000/api/sync";

const NO_STRIPE = { STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined };
const PREVIEW = { ...NO_STRIPE, BILLING_PREVIEW_MODE: "true" };

// ---------------------------------------------------------------------------
// POST /api/billing/checkout
// ---------------------------------------------------------------------------

describe("POST /api/billing/checkout", () => {
  it("returns 401 without a session", async () => {
    const res = await withEnv(PREVIEW, () => checkoutPOST(postJson(CHECKOUT, { tier: "pro" })));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a cross-origin request", async () => {
    const u = await createSessionUser("xorigin");
    const res = await checkoutPOST(
      postJson(CHECKOUT, { tier: "pro" }, { cookie: u.cookie, origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid JSON and unknown tiers", async () => {
    const u = await createSessionUser("checkout-bad");
    const bad = await withEnv(PREVIEW, () => checkoutPOST(postJson(CHECKOUT, "nope {{", { cookie: u.cookie })));
    expect(bad.status).toBe(400);
    const unknown = await withEnv(PREVIEW, () =>
      checkoutPOST(postJson(CHECKOUT, { tier: "platinum" }, { cookie: u.cookie })),
    );
    expect(unknown.status).toBe(400);
  });

  it("refuses to grant tiers without Stripe unless preview billing is explicitly enabled", async () => {
    const u = await createSessionUser("checkout-nostripe");
    const res = await withEnv({ ...NO_STRIPE, BILLING_PREVIEW_MODE: undefined }, () =>
      checkoutPOST(postJson(CHECKOUT, { tier: "gym" }, { cookie: u.cookie })),
    );
    expect(res.status).toBe(503);
    expect(await db.subscription.findUnique({ where: { userId: u.id } })).toBeNull();
  });

  it("never enables preview billing in production, even with the flag", async () => {
    const u = await createSessionUser("checkout-prod");
    const res = await withEnv({ ...PREVIEW, NODE_ENV: "production", AUTH_SECRET: "x".repeat(40) }, async () => {
      // AUTH_SECRET changes the signing key, so mint the cookie inside.
      const { createSessionToken, SESSION_COOKIE } = await import("@/lib/auth");
      return checkoutPOST(
        postJson(CHECKOUT, { tier: "gym" }, { cookie: `${SESSION_COOKIE}=${createSessionToken(u.id)}` }),
      );
    });
    expect(res.status).toBe(503);
    expect(await db.subscription.findUnique({ where: { userId: u.id } })).toBeNull();
  });

  it("applies the tier to the SESSION user in preview mode, ignoring any email in the body", async () => {
    const attacker = await createSessionUser("attacker");
    const victim = await createSessionUser("victim");
    const res = await withEnv(PREVIEW, () =>
      checkoutPOST(postJson(CHECKOUT, { tier: "pro", email: victim.email }, { cookie: attacker.cookie })),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("preview");
    expect(data.tier).toBe("pro");
    expect((await db.subscription.findUnique({ where: { userId: attacker.id } }))?.tier).toBe("pro");
    expect(await db.subscription.findUnique({ where: { userId: victim.id } })).toBeNull();
  });

  it("downgrades to free in preview mode", async () => {
    const u = await createSessionUser("downgrade");
    await withEnv(PREVIEW, () => checkoutPOST(postJson(CHECKOUT, { tier: "coach" }, { cookie: u.cookie })));
    const res = await withEnv(PREVIEW, () => checkoutPOST(postJson(CHECKOUT, { tier: "free" }, { cookie: u.cookie })));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tier).toBe("free");
    expect((await db.subscription.findUnique({ where: { userId: u.id } }))?.status).toBe("cancelled");
  });
});

// ---------------------------------------------------------------------------
// POST /api/billing/portal
// ---------------------------------------------------------------------------

describe("POST /api/billing/portal", () => {
  it("returns 401 without a session (an email in the body is not enough)", async () => {
    const victim = await createSessionUser("portal-victim");
    const res = await withEnv(PREVIEW, () => portalPOST(postJson(PORTAL, { email: victim.email })));
    expect(res.status).toBe(401);
  });

  it("returns preview mode (url null) for a signed-in user without Stripe", async () => {
    const u = await createSessionUser("portal");
    const res = await withEnv(PREVIEW, () => portalPOST(postJson(PORTAL, {}, { cookie: u.cookie })));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("preview");
    expect(data.url).toBeNull();
  });

  it("returns 404 in Stripe mode when the user has no Stripe subscription", async () => {
    const u = await createSessionUser("portal-nosub");
    const res = await withEnv({ STRIPE_SECRET_KEY: "sk_test_dummy_key" }, () =>
      portalPOST(postJson(PORTAL, {}, { cookie: u.cookie })),
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// /api/sync
// ---------------------------------------------------------------------------

describe("/api/sync", () => {
  it("GET and POST return 401 without a session", async () => {
    const victim = await createSessionUser("sync-victim");
    expect((await syncGET(req(`${SYNC}?email=${encodeURIComponent(victim.email)}`))).status).toBe(401);
    const push = await syncPOST(
      postJson(SYNC, { email: victim.email, revision: new Date().toISOString(), state: { onboarded: true } }),
    );
    expect(push.status).toBe(401);
  });

  it("returns 400 for invalid JSON / revision / state", async () => {
    const u = await createSessionUser("sync-bad");
    expect((await syncPOST(postJson(SYNC, "nope {{", { cookie: u.cookie }))).status).toBe(400);
    for (const body of [
      { revision: "not-a-date", state: {} },
      { revision: new Date().toISOString(), state: "string" },
      { revision: new Date().toISOString(), state: [1, 2] },
    ]) {
      expect((await syncPOST(postJson(SYNC, body, { cookie: u.cookie }))).status).toBe(400);
    }
  });

  it("rejects revisions far in the future (snapshot-locking attack)", async () => {
    const u = await createSessionUser("sync-future");
    const revision = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    const res = await syncPOST(postJson(SYNC, { revision, state: { onboarded: true } }, { cookie: u.cookie }));
    expect(res.status).toBe(400);
  });

  it("round-trips the session user's snapshot and strips identity/tier fields", async () => {
    const u = await createSessionUser("sync-rt");
    const revision = new Date().toISOString();
    const state = {
      onboarded: true,
      activeMode: "crossfit",
      logs: [{ id: "l1" }],
      // Must never be stored or returned:
      authed: true,
      email: "someone-else@example.com",
      tier: "gym",
      signOut: "boom",
    };
    const push = await syncPOST(postJson(SYNC, { revision, state }, { cookie: u.cookie }));
    expect(push.status).toBe(200);
    expect((await push.json()).ok).toBe(true);

    const pull = await syncGET(req(SYNC, { headers: { cookie: u.cookie } }));
    const data = await pull.json();
    expect(data.revision).toBe(revision);
    expect(data.state).toEqual({ onboarded: true, activeMode: "crossfit", logs: [{ id: "l1" }] });
  });

  it("isolates users: one account can neither read nor overwrite another's snapshot", async () => {
    const a = await createSessionUser("sync-a");
    const b = await createSessionUser("sync-b");
    await syncPOST(postJson(SYNC, { revision: new Date().toISOString(), state: { activeMode: "hyrox" } }, { cookie: a.cookie }));

    // B asks for A's data by email and pushes with A's email in the body.
    const readAttempt = await syncGET(req(`${SYNC}?email=${encodeURIComponent(a.email)}`, { headers: { cookie: b.cookie } }));
    expect((await readAttempt.json()).state).toBeNull();
    await syncPOST(
      postJson(SYNC, { email: a.email, revision: new Date().toISOString(), state: { activeMode: "athx" } }, { cookie: b.cookie }),
    );

    const aData = await (await syncGET(req(SYNC, { headers: { cookie: a.cookie } }))).json();
    expect(aData.state.activeMode).toBe("hyrox");
  });

  it("rejects a stale push with conflict (last write wins)", async () => {
    const u = await createSessionUser("sync-stale");
    const newer = new Date().toISOString();
    const older = new Date(Date.now() - 60_000).toISOString();
    await syncPOST(postJson(SYNC, { revision: newer, state: { activeMode: "athx" } }, { cookie: u.cookie }));
    const res = await syncPOST(postJson(SYNC, { revision: older, state: { activeMode: "hyrox" } }, { cookie: u.cookie }));
    const data = await res.json();
    expect(data.conflict).toBe(true);
    expect(data.revision).toBe(newer);
  });

  it("GET returns revision null when nothing is stored", async () => {
    const u = await createSessionUser("sync-empty");
    const data = await (await syncGET(req(SYNC, { headers: { cookie: u.cookie } }))).json();
    expect(data.revision).toBeNull();
    expect(data.state).toBeNull();
  });

  it("rejects a state payload over the 1.5 MB cap with 413", async () => {
    const u = await createSessionUser("sync-big");
    const res = await syncPOST(
      postJson(SYNC, { revision: new Date().toISOString(), state: { logs: ["x".repeat(1_600_000)] } }, { cookie: u.cookie }),
    );
    expect(res.status).toBe(413);
  });
});

// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/stripe", () => {
  const STRIPE_ENV = { STRIPE_SECRET_KEY: "sk_test_dummy_key", STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET };
  let evtCounter = 0;
  let user: { id: string; email: string };

  function event(type: string, object: Record<string, unknown>) {
    evtCounter += 1;
    return { id: `evt_${RUN}_${evtCounter}`, type, data: { object } };
  }
  const send = (e: unknown) => withEnv(STRIPE_ENV, async () => stripePOST(await signedWebhook(e)));

  beforeAll(async () => {
    user = await createSessionUser("webhook");
  });

  it("returns 401 without a stripe-signature header", async () => {
    const res = await withEnv(STRIPE_ENV, () =>
      stripePOST(postJson("http://localhost:3000/api/webhooks/stripe", { type: "checkout.session.completed" })),
    );
    expect(res.status).toBe(401);
  });

  it("returns 503 and writes nothing when Stripe keys are not configured (no unverified mode)", async () => {
    const forged = event("checkout.session.completed", {
      metadata: { user_id: user.id, price_id: "price_gym" },
    });
    for (const env of [
      { STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET },
      { STRIPE_SECRET_KEY: "sk_test_dummy_key", STRIPE_WEBHOOK_SECRET: undefined },
    ]) {
      const res = await withEnv(env, async () => stripePOST(await signedWebhook(forged)));
      expect(res.status).toBe(503);
    }
    expect(await db.subscription.findUnique({ where: { userId: user.id } })).toBeNull();
  });

  it("rejects forged or wrongly signed events with 400", async () => {
    const forged = event("checkout.session.completed", { metadata: { user_id: user.id, price_id: "price_gym" } });
    const unsigned = await withEnv(STRIPE_ENV, () =>
      stripePOST(postJson("http://localhost:3000/api/webhooks/stripe", forged, { "stripe-signature": "t=1,v1=fake" })),
    );
    expect(unsigned.status).toBe(400);
    const wrongKey = await withEnv(STRIPE_ENV, async () => stripePOST(await signedWebhook(forged, "whsec_attacker")));
    expect(wrongKey.status).toBe(400);
    expect(await db.subscription.findUnique({ where: { userId: user.id } })).toBeNull();
  });

  it("does not create users for unknown emails / ids", async () => {
    const ghost = `ghost-${RUN}@example.com`;
    const res = await send(
      event("checkout.session.completed", { metadata: { email: ghost, user_id: "nope", price_id: "price_pro_monthly" } }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).processed).toBe(false);
    expect(await db.user.findUnique({ where: { email: ghost } })).toBeNull();
  });

  it("checkout.session.completed activates the tier for metadata.user_id", async () => {
    const res = await send(
      event("checkout.session.completed", {
        id: `cs_${RUN}`,
        subscription: `sub_${RUN}`,
        client_reference_id: user.id,
        metadata: { user_id: user.id, price_id: "price_pro_monthly" },
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.processed).toBe(true);
    expect(data.tier).toBe("pro");
    const sub = await db.subscription.findUnique({ where: { userId: user.id } });
    expect(sub?.tier).toBe("pro");
    expect(sub?.provider).toBe("stripe");
    expect(sub?.providerRef).toBe(`sub_${RUN}`);
  });

  it("replays the same event id without re-applying (idempotency)", async () => {
    const original = event("customer.subscription.updated", {
      id: `sub_${RUN}`,
      status: "active",
      items: { data: [{ price: { id: "price_coach" } }] },
    });
    expect((await (await send(original)).json()).processed).toBe(true);
    await send(
      event("customer.subscription.updated", {
        id: `sub_${RUN}`,
        status: "active",
        items: { data: [{ price: { id: "price_pro_annual" } }] },
      }),
    );
    const replay = await (await send(original)).json();
    expect(replay.duplicate).toBe(true);
    expect((await db.subscription.findUnique({ where: { userId: user.id } }))?.tier).toBe("pro_annual");
  });

  it("customer.subscription.updated resolves the user via the stored subscription id and sets period end", async () => {
    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
    const res = await send(
      event("customer.subscription.updated", {
        id: `sub_${RUN}`,
        status: "active",
        items: { data: [{ price: { id: "price_pro_annual" }, current_period_end: periodEnd }] },
      }),
    );
    expect((await res.json()).tier).toBe("pro_annual");
    const sub = await db.subscription.findUnique({ where: { userId: user.id } });
    expect(sub?.currentPeriodEnd?.getTime()).toBe(periodEnd * 1000);
  });

  it("invoice.payment_failed marks past_due without changing tier", async () => {
    const res = await send(
      event("invoice.payment_failed", {
        id: `in_${RUN}`,
        parent: { subscription_details: { subscription: `sub_${RUN}` } },
      }),
    );
    expect((await res.json()).processed).toBe(true);
    const sub = await db.subscription.findUnique({ where: { userId: user.id } });
    expect(sub?.status).toBe("past_due");
    expect(sub?.tier).toBe("pro_annual");
  });

  it("customer.subscription.deleted downgrades to free", async () => {
    const res = await send(event("customer.subscription.deleted", { id: `sub_${RUN}` }));
    expect((await res.json()).tier).toBe("free");
    const sub = await db.subscription.findUnique({ where: { userId: user.id } });
    expect(sub?.tier).toBe("free");
    expect(sub?.status).toBe("cancelled");
  });

  it("acknowledges unhandled event types without processing", async () => {
    const res = await send(event("some.other.event", {}));
    expect(res.status).toBe(200);
    expect((await res.json()).processed).toBe(false);
  });
});

afterAll(async () => {
  await db.$disconnect();
});
