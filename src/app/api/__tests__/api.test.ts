// Integration tests for API route handlers.
// Run with: `bun test src/app/api/__tests__/api.test.ts`
import { describe, expect, it } from "bun:test";
import { NextRequest } from "next/server";

// Import route handlers
import { POST as coachPOST } from "@/app/api/coach/route";
import { GET as cronGET, POST as cronPOST } from "@/app/api/cron/weekly-summary/route";

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

// Stripe webhook tests (signed events) live in billing.test.ts.
