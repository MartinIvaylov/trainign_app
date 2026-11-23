// Integration tests for API route handlers.
// Run with: `bun test src/app/api/__tests__/api.test.ts`
import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";

// Import route handlers
import { POST as coachPOST } from "@/app/api/coach/route";
import { GET as cronGET, POST as cronPOST } from "@/app/api/cron/weekly-summary/route";
import { POST as stripePOST } from "@/app/api/webhooks/stripe/route";

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

describe("POST /api/coach", () => {
  it("returns 400 for invalid JSON body", async () => {
    const req = makeRequest("http://localhost:3000/api/coach", {
      method: "POST",
      body: "not valid json{{{",
      headers: { "Content-Type": "application/json" },
    });
    const res = await coachPOST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON");
  });

  it("returns 400 for missing question", async () => {
    const req = makeRequest("http://localhost:3000/api/coach", {
      method: "POST",
      body: JSON.stringify({ context: { activeMode: "hyrox" } }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await coachPOST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid question");
  });

  it("returns 400 for question longer than 500 chars", async () => {
    const req = makeRequest("http://localhost:3000/api/coach", {
      method: "POST",
      body: JSON.stringify({
        question: "a".repeat(501),
        context: { activeMode: "hyrox" },
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await coachPOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with an answer for a valid question", async () => {
    const req = makeRequest("http://localhost:3000/api/coach", {
      method: "POST",
      body: JSON.stringify({
        question: "What is my weakest HYROX station?",
        context: {
          profile: { displayName: "Test Athlete", trainingAge: "intermediate" },
          preferences: { daysPerWeek: 4, sessionMinutes: 60 },
          benchmarks: { fiveKmSec: 1350, backSquatKg: 100, deadliftKg: 140 },
          activeMode: "hyrox",
        },
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await coachPOST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.answer).toBeDefined();
    expect(typeof data.answer).toBe("string");
    expect(data.answer.length).toBeGreaterThan(0);
    expect(data.toolsUsed).toBeDefined();
  });

  it("includes toolsUsed array in response", async () => {
    const req = makeRequest("http://localhost:3000/api/coach", {
      method: "POST",
      body: JSON.stringify({
        question: "Test question",
        context: { activeMode: "maintenance" },
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await coachPOST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.toolsUsed)).toBe(true);
    expect(data.toolsUsed.length).toBeGreaterThan(0);
  });
});

describe("GET/POST /api/cron/weekly-summary", () => {
  it("returns 401 when CRON_SECRET is set but Authorization header is missing", async () => {
    const prevSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret-12345";
    try {
      const req = makeRequest("http://localhost:3000/api/cron/weekly-summary");
      const res = await cronGET(req);
      expect(res.status).toBe(401);
    } finally {
      process.env.CRON_SECRET = prevSecret;
    }
  });

  it("returns 401 when Authorization header does not match CRON_SECRET", async () => {
    const prevSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret-12345";
    try {
      const req = makeRequest("http://localhost:3000/api/cron/weekly-summary", {
        headers: { Authorization: "Bearer wrong-secret" },
      });
      const res = await cronGET(req);
      expect(res.status).toBe(401);
    } finally {
      process.env.CRON_SECRET = prevSecret;
    }
  });

  it("returns 200 when Authorization matches CRON_SECRET", async () => {
    const prevSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret-12345";
    try {
      const req = makeRequest("http://localhost:3000/api/cron/weekly-summary", {
        headers: { Authorization: "Bearer test-secret-12345" },
      });
      const res = await cronGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.message).toContain("Weekly summary cron triggered");
    } finally {
      process.env.CRON_SECRET = prevSecret;
    }
  });

  it("POST also works with correct auth", async () => {
    const prevSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret-67890";
    try {
      const req = makeRequest("http://localhost:3000/api/cron/weekly-summary", {
        method: "POST",
        headers: { Authorization: "Bearer test-secret-67890" },
      });
      const res = await cronPOST(req);
      expect(res.status).toBe(200);
    } finally {
      process.env.CRON_SECRET = prevSecret;
    }
  });
});

describe("POST /api/webhooks/stripe", () => {
  it("returns 401 when stripe-signature header is missing", async () => {
    const req = makeRequest("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify({ type: "checkout.session.completed" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await stripePOST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 500 when STRIPE_WEBHOOK_SECRET is not configured (server misconfiguration)", async () => {
    const prevSecret = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    try {
      const req = makeRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({ type: "checkout.session.completed" }),
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": "some-signature",
        },
      });
      const res = await stripePOST(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain("STRIPE_WEBHOOK_SECRET");
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = prevSecret;
    }
  });

  it("returns 400 for invalid JSON body", async () => {
    const prevSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    try {
      const req = makeRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: "not json {{{",
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": "some-signature",
        },
      });
      const res = await stripePOST(req);
      expect(res.status).toBe(400);
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = prevSecret;
    }
  });

  it("returns 200 for valid checkout.session.completed event", async () => {
    const prevSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    try {
      const req = makeRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({
          id: "evt_test_123",
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_test_123",
              metadata: { user_id: "user-123" },
            },
          },
        }),
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": "some-signature",
        },
      });
      const res = await stripePOST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.received).toBe(true);
      expect(data.type).toBe("checkout.session.completed");
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = prevSecret;
    }
  });

  it("returns 200 for customer.subscription.deleted event", async () => {
    const prevSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    try {
      const req = makeRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({
          id: "evt_test_456",
          type: "customer.subscription.deleted",
          data: {
            object: {
              id: "sub_test_456",
              metadata: { user_id: "user-456" },
            },
          },
        }),
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": "some-signature",
        },
      });
      const res = await stripePOST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.received).toBe(true);
      expect(data.type).toBe("customer.subscription.deleted");
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = prevSecret;
    }
  });

  it("returns 200 for unhandled event types (acknowledged but not processed)", async () => {
    const prevSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    try {
      const req = makeRequest("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({
          id: "evt_test_789",
          type: "some.other.event",
          data: { object: {} },
        }),
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": "some-signature",
        },
      });
      const res = await stripePOST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.received).toBe(true);
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = prevSecret;
    }
  });
});
