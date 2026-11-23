// Integration tests for the Phase 6 billing + sync surfaces:
//   * POST /api/billing/checkout  (preview mode entitlement flow)
//   * POST /api/billing/portal    (preview mode response)
//   * GET/POST /api/sync          (write-through cache endpoint)
//   * POST /api/webhooks/stripe   (event → Subscription table writes,
//                                  idempotency, signature verification)
//
// Run with: `bun test src/app/api/__tests__/billing.test.ts`
//
// Emails and event ids are unique per run so assertions never collide with
// rows left over from earlier runs against the dev SQLite database.
import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";

import { POST as checkoutPOST } from "@/app/api/billing/checkout/route";
import { POST as portalPOST } from "@/app/api/billing/portal/route";
import { GET as syncGET, POST as syncPOST } from "@/app/api/sync/route";
import { POST as stripePOST } from "@/app/api/webhooks/stripe/route";
import { db } from "@/lib/db";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const email = `billing-${RUN}@example.com`;

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

function postJson(url: string, body: unknown, headers: Record<string, string> = {}): NextRequest {
  return makeRequest(url, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

// ---------------------------------------------------------------------------
// POST /api/billing/checkout
// ---------------------------------------------------------------------------

describe("POST /api/billing/checkout", () => {
  it("returns 400 for invalid JSON", async () => {
    const res = await checkoutPOST(postJson("http://localhost:3000/api/billing/checkout", "not json {{{"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a missing or malformed email", async () => {
    for (const bad of [undefined, "not-an-email", "a@"]) {
      const res = await checkoutPOST(
        postJson("http://localhost:3000/api/billing/checkout", { email: bad, tier: "pro" }),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("email");
    }
  });

  it("returns 400 for an unknown tier", async () => {
    const res = await checkoutPOST(
      postJson("http://localhost:3000/api/billing/checkout", { email, tier: "platinum" }),
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("pro");
  });

  it("applies a Pro entitlement in preview mode and writes the Subscription row", async () => {
    const res = await checkoutPOST(
      postJson("http://localhost:3000/api/billing/checkout", { email, tier: "pro" }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("preview");
    expect(data.tier).toBe("pro");
    expect(data.status).toBe("active");
    expect(data.processed).toBe(true);

    // Verify the database row directly.
    const user = await db.user.findUnique({
      where: { email },
      include: { subscription: true },
    });
    expect(user).not.toBeNull();
    expect(user?.subscription?.tier).toBe("pro");
    expect(user?.subscription?.status).toBe("active");
    expect(user?.subscription?.provider).toBe("stripe_test");
  });

  it("downgrades to free in preview mode (tier free, status cancelled)", async () => {
    const res = await checkoutPOST(
      postJson("http://localhost:3000/api/billing/checkout", { email, tier: "free" }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("preview");
    expect(data.tier).toBe("free");

    const user = await db.user.findUnique({
      where: { email },
      include: { subscription: true },
    });
    expect(user?.subscription?.tier).toBe("free");
    expect(user?.subscription?.status).toBe("cancelled");
  });
});

// ---------------------------------------------------------------------------
// POST /api/billing/portal
// ---------------------------------------------------------------------------

describe("POST /api/billing/portal", () => {
  it("returns 400 for invalid JSON", async () => {
    const res = await portalPOST(postJson("http://localhost:3000/api/billing/portal", "{{{"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed email", async () => {
    const res = await portalPOST(
      postJson("http://localhost:3000/api/billing/portal", { email: "nope" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns preview mode (url null) without live Stripe credentials", async () => {
    const res = await portalPOST(
      postJson("http://localhost:3000/api/billing/portal", { email }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("preview");
    expect(data.url).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// /api/sync
// ---------------------------------------------------------------------------

describe("/api/sync", () => {
  const syncEmail = `sync-${RUN}@example.com`;

  it("POST returns 400 for invalid JSON", async () => {
    const res = await syncPOST(postJson("http://localhost:3000/api/sync", "not json"));
    expect(res.status).toBe(400);
  });

  it("POST returns 400 for a malformed email / revision / state", async () => {
    const base = "http://localhost:3000/api/sync";
    const bad1 = await syncPOST(postJson(base, { email: "bad", revision: "2026-01-01T00:00:00Z", state: {} }));
    const bad2 = await syncPOST(postJson(base, { email: syncEmail, revision: "not-a-date", state: {} }));
    const bad3 = await syncPOST(postJson(base, { email: syncEmail, revision: "2026-01-01T00:00:00Z", state: [1, 2] }));
    expect(bad1.status).toBe(400);
    expect(bad2.status).toBe(400);
    expect(bad3.status).toBe(400);
  });

  it("round-trips a snapshot: POST then GET returns the state", async () => {
    const state = { onboarded: true, activeMode: "hyrox", sessions: [{ id: "s1" }], tier: "free" };
    const push = await syncPOST(
      postJson("http://localhost:3000/api/sync", {
        email: syncEmail,
        revision: "2026-11-23T10:00:00.000Z",
        state,
      }),
    );
    expect(push.status).toBe(200);
    const pushData = await push.json();
    expect(pushData.ok).toBe(true);

    const pull = await syncGET(makeRequest(`http://localhost:3000/api/sync?email=${syncEmail}`));
    expect(pull.status).toBe(200);
    const pullData = await pull.json();
    expect(pullData.revision).toBe("2026-11-23T10:00:00.000Z");
    expect(pullData.state).toEqual(state);
  });

  it("rejects a stale push with conflict (last write wins)", async () => {
    const res = await syncPOST(
      postJson("http://localhost:3000/api/sync", {
        email: syncEmail,
        revision: "2026-11-23T09:00:00.000Z", // older than the pushed 10:00
        state: { onboarded: false },
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.conflict).toBe(true);

    // The stored snapshot is unchanged.
    const pull = await syncGET(makeRequest(`http://localhost:3000/api/sync?email=${syncEmail}`));
    const pullData = await pull.json();
    expect(pullData.state.onboarded).toBe(true);
  });

  it("GET returns revision null for an unknown email", async () => {
    const pull = await syncGET(
      makeRequest(`http://localhost:3000/api/sync?email=unknown-${RUN}@example.com`),
    );
    expect(pull.status).toBe(200);
    const data = await pull.json();
    expect(data.revision).toBeNull();
    expect(data.state).toBeNull();
  });

  it("GET returns 400 without a valid email param", async () => {
    const res = await syncGET(makeRequest("http://localhost:3000/api/sync"));
    expect(res.status).toBe(400);
  });

  it("POST rejects a state payload over the 1.5 MB cap with 413", async () => {
    const big = { blob: "x".repeat(1_600_000) };
    const res = await syncPOST(
      postJson("http://localhost:3000/api/sync", {
        email: syncEmail,
        revision: "2026-11-23T11:00:00.000Z",
        state: big,
      }),
    );
    expect(res.status).toBe(413);
  });
});

// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe — database writes + idempotency
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/stripe (entitlement writes)", () => {
  const whSecretBackup = process.env.STRIPE_WEBHOOK_SECRET;
  const keyBackup = process.env.STRIPE_SECRET_KEY;
  const whEmail = `webhook-${RUN}@example.com`;
  let evtCounter = 0;

  function webhookEvent(type: string, object: Record<string, unknown>) {
    evtCounter += 1;
    return {
      id: `evt_${RUN}_${evtCounter}`,
      type,
      data: { object },
    };
  }

  function post(event: unknown) {
    return stripePOST(
      postJson("http://localhost:3000/api/webhooks/stripe", event, {
        "stripe-signature": "t=1,v1=preview",
      }),
    );
  }

  it("checkout.session.completed creates an active pro subscription", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    delete process.env.STRIPE_SECRET_KEY; // preview mode — trust parsed JSON

    const res = await post(
      webhookEvent("checkout.session.completed", {
        id: `cs_${RUN}`,
        subscription: `sub_${RUN}`,
        metadata: { email: whEmail, price_id: "price_pro_monthly" },
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.processed).toBe(true);
    expect(data.tier).toBe("pro");

    const user = await db.user.findUnique({
      where: { email: whEmail },
      include: { subscription: true },
    });
    expect(user?.subscription?.tier).toBe("pro");
    expect(user?.subscription?.status).toBe("active");
    expect(user?.subscription?.provider).toBe("stripe");
    expect(user?.subscription?.providerRef).toBe(`sub_${RUN}`);
  });

  it("replays the same event id without re-applying (idempotency)", async () => {
    // 1. First delivery: coach tier.
    const event = webhookEvent("checkout.session.completed", {
      metadata: { email: whEmail, price_id: "price_coach" },
    });
    const first = await post(event);
    expect(first.status).toBe(200);
    expect((await first.json()).processed).toBe(true);

    // 2. A later event moves the tier to pro_annual.
    const update = await post(
      webhookEvent("customer.subscription.updated", {
        id: `sub_between_${RUN}`,
        status: "active",
        metadata: { email: whEmail },
        items: { data: [{ price: { id: "price_pro_annual" } }] },
      }),
    );
    expect((await update.json()).processed).toBe(true);

    // 3. Stripe retries the ORIGINAL event (same id). It must be skipped —
    //    if it were re-processed it would clobber the tier back to coach.
    const second = await post(event);
    expect(second.status).toBe(200);
    const data = await second.json();
    expect(data.duplicate).toBe(true);
    expect(data.processed).toBe(false);

    const user = await db.user.findUnique({
      where: { email: whEmail },
      include: { subscription: true },
    });
    expect(user?.subscription?.tier).toBe("pro_annual"); // replay did NOT win
    expect(
      await db.webhookEvent.count({ where: { externalId: (event as { id: string }).id } }),
    ).toBe(1);
  });

  it("customer.subscription.updated changes the tier and period end", async () => {
    const periodEnd = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
    const res = await post(
      webhookEvent("customer.subscription.updated", {
        id: `sub_upd_${RUN}`,
        status: "active",
        current_period_end: periodEnd,
        metadata: { email: whEmail },
        items: { data: [{ price: { id: "price_pro_annual" } }] },
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.processed).toBe(true);
    expect(data.tier).toBe("pro_annual");

    const user = await db.user.findUnique({
      where: { email: whEmail },
      include: { subscription: true },
    });
    expect(user?.subscription?.tier).toBe("pro_annual");
    expect(user?.subscription?.currentPeriodEnd).not.toBeNull();
  });

  it("invoice.payment_failed marks the subscription past_due without changing tier", async () => {
    const res = await post(
      webhookEvent("invoice.payment_failed", {
        id: `in_${RUN}`,
        subscription: `sub_upd_${RUN}`,
        metadata: { email: whEmail },
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.processed).toBe(true);

    const user = await db.user.findUnique({
      where: { email: whEmail },
      include: { subscription: true },
    });
    expect(user?.subscription?.status).toBe("past_due");
    expect(user?.subscription?.tier).toBe("pro_annual"); // unchanged
  });

  it("customer.subscription.deleted downgrades to free", async () => {
    const res = await post(
      webhookEvent("customer.subscription.deleted", {
        id: `sub_del_${RUN}`,
        metadata: { email: whEmail },
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.processed).toBe(true);
    expect(data.tier).toBe("free");

    const user = await db.user.findUnique({
      where: { email: whEmail },
      include: { subscription: true },
    });
    expect(user?.subscription?.tier).toBe("free");
    expect(user?.subscription?.status).toBe("cancelled");
  });

  it("returns 400 with a bad signature when STRIPE_SECRET_KEY is configured", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy_key"; // enables verification
    try {
      const res = await post(
        webhookEvent("checkout.session.completed", {
          metadata: { email: whEmail, price_id: "price_pro_monthly" },
        }),
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Signature verification failed");
    } finally {
      process.env.STRIPE_SECRET_KEY = keyBackup;
      process.env.STRIPE_WEBHOOK_SECRET = whSecretBackup;
    }
  });
});
