// =============================================================================
// HYBRID Performance Platform — Browser session helpers
// =============================================================================
//
// Thin client for /api/auth/*. The session itself lives in an httpOnly
// cookie the browser cannot read; these helpers keep the Zustand display
// cache (`authed`, `email`, `tier`) in step with what the server says.
// =============================================================================

import { useApp } from "@/store/app-store";
import { stopSync } from "@/lib/sync";

type Tier = ReturnType<typeof useApp.getState>["tier"];

interface AuthResponse {
  user?: { id: string; email: string; name: string | null };
  tier?: Tier;
  error?: string;
}

export type AuthResult = { ok: true } | { ok: false; error: string };

export async function authenticate(
  mode: "signin" | "signup",
  input: { email: string; password: string; name?: string },
): Promise<AuthResult> {
  let res: Response;
  try {
    res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again." };
  }
  const data = (await res.json().catch(() => ({}))) as AuthResponse;
  if (!res.ok || !data.user) {
    return { ok: false, error: data.error ?? "Something went wrong. Please try again." };
  }
  const store = useApp.getState();
  // A different account than the one cached on this device: drop the old
  // account's local data before adopting the new session.
  if (store.email && store.email !== data.user.email) {
    stopSync();
    store.signOut();
  }
  useApp.getState().applySession({ email: data.user.email, tier: data.tier ?? "free" });
  return { ok: true };
}

/**
 * Verify the cookie session with the server. Returns the verified email, or
 * null (and clears local identity) when there is no valid session. Network
 * failures keep the cached session so the app still works offline.
 */
export async function refreshSession(): Promise<string | null | "offline"> {
  let res: Response;
  try {
    res = await fetch("/api/auth/me", { cache: "no-store" });
  } catch {
    return "offline";
  }
  if (res.status === 401) {
    stopSync();
    useApp.getState().signOut();
    return null;
  }
  if (!res.ok) return "offline";
  const data = (await res.json().catch(() => ({}))) as AuthResponse;
  if (!data.user) return "offline";
  const store = useApp.getState();
  if (store.email && store.email !== data.user.email) {
    stopSync();
    store.signOut();
  }
  useApp.getState().applySession({ email: data.user.email, tier: data.tier ?? "free" });
  return data.user.email;
}

export async function signOut(): Promise<void> {
  stopSync();
  useApp.getState().signOut();
  try {
    await fetch("/api/auth/signout", { method: "POST" });
  } catch {
    /* cookie will expire on its own; local state is already cleared */
  }
}
