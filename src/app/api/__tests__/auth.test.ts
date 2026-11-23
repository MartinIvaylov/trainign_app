// Integration tests for /api/auth/* and the session primitives (audit C1).
// Run with: `bun test src/app/api/__tests__/auth.test.ts`
import { beforeEach, describe, expect, it } from "bun:test";

import { POST as signupPOST } from "@/app/api/auth/signup/route";
import { POST as signinPOST } from "@/app/api/auth/signin/route";
import { POST as signoutPOST } from "@/app/api/auth/signout/route";
import { GET as meGET } from "@/app/api/auth/me/route";
import { SESSION_COOKIE, createSessionToken, hashPassword, verifyPassword, verifySessionToken } from "@/lib/auth";
import { resetRateLimits } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { RUN, postJson, req } from "./helpers";

const BASE = "http://localhost:3000/api/auth";
const PASSWORD = "correct horse battery";

function cookieFrom(res: Response): string {
  const raw = res.headers.get("set-cookie") ?? "";
  const match = raw.match(new RegExp(`${SESSION_COOKIE}=([^;]*)`));
  return match ? `${SESSION_COOKIE}=${match[1]}` : "";
}

beforeEach(() => resetRateLimits());

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword(PASSWORD, null)).toBe(false);
    expect(await verifyPassword(PASSWORD, "garbage")).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips, and rejects tampered or expired tokens", () => {
    const token = createSessionToken("user_1");
    expect(verifySessionToken(token)).toBe("user_1");

    const [body, mac] = token.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ uid: "admin", iat: 0, exp: 9e9 })).toString("base64url");
    expect(verifySessionToken(`${forgedBody}.${mac}`)).toBeNull();
    expect(verifySessionToken(`${body}.AAAA`)).toBeNull();
    expect(verifySessionToken("not-a-token")).toBeNull();

    const expired = createSessionToken("user_1", Math.floor(Date.now() / 1000) - 31 * 24 * 3600);
    expect(verifySessionToken(expired)).toBeNull();
  });
});

describe("/api/auth", () => {
  const email = `auth-${RUN}@example.com`;

  it("signup validates input", async () => {
    expect((await signupPOST(postJson(`${BASE}/signup`, { email: "bad", password: PASSWORD }))).status).toBe(400);
    expect((await signupPOST(postJson(`${BASE}/signup`, { email, password: "short" }))).status).toBe(400);
    expect((await signupPOST(postJson(`${BASE}/signup`, "nope {{"))).status).toBe(400);
  });

  it("signup creates the account, hashes the password and sets an httpOnly session cookie", async () => {
    const res = await signupPOST(postJson(`${BASE}/signup`, { email: email.toUpperCase(), password: PASSWORD, name: "Alex" }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user.email).toBe(email);
    expect(data.tier).toBe("free");
    expect(data.user.passwordHash).toBeUndefined();
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");

    const row = await db.user.findUnique({ where: { email } });
    expect(row?.passwordHash?.startsWith("scrypt$")).toBe(true);
  });

  it("signup refuses a duplicate email", async () => {
    const res = await signupPOST(postJson(`${BASE}/signup`, { email, password: "another password" }));
    expect(res.status).toBe(409);
  });

  it("signin rejects a wrong password and unknown accounts with the same message", async () => {
    const wrong = await signinPOST(postJson(`${BASE}/signin`, { email, password: "wrong password" }));
    const unknown = await signinPOST(postJson(`${BASE}/signin`, { email: `nobody-${RUN}@example.com`, password: PASSWORD }));
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect((await wrong.json()).error).toBe((await unknown.json()).error);
    expect(wrong.headers.get("set-cookie")).toBeNull();
  });

  it("signin with the right password returns a working session; /me reflects it", async () => {
    const res = await signinPOST(postJson(`${BASE}/signin`, { email, password: PASSWORD }));
    expect(res.status).toBe(200);
    const cookie = cookieFrom(res);
    expect(cookie).not.toBe("");

    const me = await meGET(req(`${BASE}/me`, { headers: { cookie } }));
    expect(me.status).toBe(200);
    const data = await me.json();
    expect(data.user.email).toBe(email);
    expect(data.tier).toBe("free");
  });

  it("/me returns 401 without or with a forged cookie", async () => {
    expect((await meGET(req(`${BASE}/me`))).status).toBe(401);
    const forged = `${SESSION_COOKIE}=${Buffer.from('{"uid":"x","exp":9999999999}').toString("base64url")}.sig`;
    expect((await meGET(req(`${BASE}/me`, { headers: { cookie: forged } }))).status).toBe(401);
  });

  it("legacy accounts without a password cannot be signed into", async () => {
    const legacy = `legacy-${RUN}@example.com`;
    await db.user.create({ data: { email: legacy } });
    const res = await signinPOST(postJson(`${BASE}/signin`, { email: legacy, password: PASSWORD }));
    expect(res.status).toBe(401);
  });

  it("rate-limits repeated sign-in attempts for one account", async () => {
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (await signinPOST(postJson(`${BASE}/signin`, { email, password: `wrong-${i}` }))).status;
    }
    expect(last).toBe(429);
  });

  it("rejects cross-origin auth requests", async () => {
    const res = await signinPOST(
      postJson(`${BASE}/signin`, { email, password: PASSWORD }, { origin: "https://evil.example" }),
    );
    expect(res.status).toBe(403);
  });

  it("signout clears the cookie", async () => {
    const res = await signoutPOST(postJson(`${BASE}/signout`, {}));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);
    expect(setCookie).toContain("Max-Age=0");
  });
});
