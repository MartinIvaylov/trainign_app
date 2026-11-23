// =============================================================================
// HYBRID Performance Platform — Server-side authentication (server-only)
// =============================================================================
//
// Email + password accounts backed by the `User` table, with a stateless,
// HMAC-signed session cookie. Every API route that touches user data calls
// `getSessionUser(req)` and derives the user's identity from the cookie —
// never from an email or id in the request body / query string.
//
//   * Passwords: scrypt (N=2^15, r=8, p=1) with a per-user 16-byte salt,
//     stored as `scrypt$<N>$<r>$<p>$<salt b64url>$<hash b64url>`.
//   * Session cookie `hybrid_session`: `<payload b64url>.<HMAC-SHA256 b64url>`
//     where payload = { uid, iat, exp }. httpOnly, SameSite=Lax, Secure in
//     production, 30-day lifetime.
//   * Signing secret: `AUTH_SECRET` (or `NEXTAUTH_SECRET`), >= 32 chars.
//     Required in production — the module refuses to sign or verify without
//     it. In development/test a random per-process secret is used (sessions
//     reset on server restart).
//
// The interface (`getSessionUser`, `setSessionCookie`, `clearSessionCookie`)
// is deliberately small so the provider can later be swapped for Supabase
// Auth without touching the route handlers.
// =============================================================================

import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "hybrid_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

// -----------------------------------------------------------------------------
// Secret
// -----------------------------------------------------------------------------

let devSecret: string | null = null;

function getSecret(): string {
  const configured = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (configured && configured.length >= 32 && !configured.startsWith("change-me")) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set (>= 32 random characters) in production");
  }
  devSecret ??= randomBytes(32).toString("hex");
  return devSecret;
}

// -----------------------------------------------------------------------------
// Passwords
// -----------------------------------------------------------------------------

const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, KEY_LEN, { N: n, r, p, maxmem: 128 * n * r * 2 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  try {
    const expected = Buffer.from(hashB64, "base64url");
    const actual = await scrypt(password, Buffer.from(saltB64, "base64url"), Number(n), Number(r), Number(p));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/**
 * A fixed hash used to run a dummy verification when the email is unknown,
 * so sign-in takes the same time whether or not the account exists.
 */
let dummyHash: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}

// -----------------------------------------------------------------------------
// Session tokens
// -----------------------------------------------------------------------------

interface SessionPayload {
  uid: string;
  iat: number;
  exp: number;
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function createSessionToken(userId: string, nowSec = Math.floor(Date.now() / 1000)): string {
  const payload: SessionPayload = { uid: userId, iat: nowSec, exp: nowSec + SESSION_TTL_SEC };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Returns the user id from a valid, unexpired token, else null. */
export function verifySessionToken(token: string | null | undefined): string | null {
  if (!token || typeof token !== "string" || token.length > 1024) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Request / response helpers
// -----------------------------------------------------------------------------

/**
 * Resolve the signed-in user from the session cookie. Returns null when the
 * cookie is missing, tampered with, expired, or the user no longer exists.
 */
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const userId = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  try {
    return await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
  } catch {
    return null;
  }
}

export function setSessionCookie(res: NextResponse, userId: string): void {
  res.cookies.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * CSRF defence for cookie-authenticated mutations: when the browser sends an
 * Origin header it must match the request host. (SameSite=Lax already blocks
 * cross-site POSTs carrying the cookie; this is defence in depth.)
 */
export function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients / same-origin GETs
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function normaliseEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}
