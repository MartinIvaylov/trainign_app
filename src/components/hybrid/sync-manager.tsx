"use client";

// =============================================================================
// HYBRID Performance Platform — SyncManager
// =============================================================================
//
// Mounted once for the whole app. After the persisted Zustand store has
// rehydrated from localStorage it:
//   1. verifies the cookie session with /api/auth/me — the cached `authed` /
//      `email` / `tier` are only a display cache and are corrected (or the
//      user signed out) from the server's answer;
//   2. starts the write-through cache (src/lib/sync.ts) for that account.
//
// Ordering matters: syncing before hydration would push an empty store over
// a newer server snapshot.
// =============================================================================

import { useEffect, useRef } from "react";
import { useApp } from "@/store/app-store";
import { initSync } from "@/lib/sync";
import { refreshSession } from "@/lib/session";

export function SyncManager() {
  const authed = useApp((s) => s.authed);
  const email = useApp((s) => s.email);
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!authed || !email) {
      startedFor.current = null;
      return;
    }

    let cancelled = false;
    const begin = async () => {
      if (startedFor.current === email) return;
      startedFor.current = email;
      const verified = await refreshSession();
      if (cancelled || verified === null) return;
      const account = verified === "offline" ? email : verified;
      void initSync(account);
    };

    if (useApp.persist.hasHydrated()) {
      void begin();
      return () => {
        cancelled = true;
      };
    }
    const unsub = useApp.persist.onFinishHydration(() => void begin());
    return () => {
      cancelled = true;
      unsub();
    };
  }, [authed, email]);

  return null;
}
