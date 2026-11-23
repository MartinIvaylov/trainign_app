// Shared helpers for the API integration tests (not a test file itself).
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";

export const RUN = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

export function req(url: string, init: ConstructorParameters<typeof NextRequest>[1] = {}): NextRequest {
  return new NextRequest(url, init);
}

export function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return req(url, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Create a user row and return a Cookie header for an authenticated session. */
export async function createSessionUser(tag: string): Promise<{ id: string; email: string; cookie: string }> {
  const email = `${tag}-${RUN}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const user = await db.user.create({ data: { email }, select: { id: true, email: true } });
  return { ...user, cookie: `${SESSION_COOKIE}=${createSessionToken(user.id)}` };
}

/** Run `fn` with env vars temporarily set (undefined = deleted). */
export async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const backup: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    backup[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(backup)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

export const WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests";

/** A correctly signed Stripe webhook request (as Stripe itself would send). */
export async function signedWebhook(event: unknown, secret = WEBHOOK_SECRET): Promise<NextRequest> {
  const payload = JSON.stringify(event);
  const signature = await Stripe.webhooks.generateTestHeaderStringAsync({ payload, secret });
  return postJson("http://localhost:3000/api/webhooks/stripe", payload, { "stripe-signature": signature });
}
