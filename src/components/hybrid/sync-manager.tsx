"use client";

// =============================================================================
// HYBRID Performance Platform — SyncManager
// =============================================================================
//
// Mounts the write-through cache (src/lib/sync.ts) into the React tree once,
// for the whole app (not just the shell — onboarding data should sync too).
//
// Ordering guarantee: initSync runs only after the persisted Zustand store
// has rehydrated from localStorage, otherwise an empty store would be pushed
// over a newer server snapshot on first paint.
// =============================================================================

import { useEffect, useRef } from "react";
import { useApp } from "@/store/app-store";
import { initSync } from "@/lib/sync";

export function SyncManager() {
  const authed = useApp((s) => s.authed);
  const email = useApp((s) => s.email);
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!authed || !email) return;

    const begin = () => {
      if (startedFor.current === email) return;
      startedFor.current = email;
      void initSync(email);
    };

    // Wait for the localStorage hydration to finish before touching the
    // server, so the reconciliation sees the full local state.
    if (useApp.persist.hasHydrated()) {
      begin();
      return;
    }
    const unsub = useApp.persist.onFinishHydration(begin);
    return unsub;
  }, [authed, email]);

  return null;
}
