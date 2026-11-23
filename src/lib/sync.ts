// =============================================================================
// HYBRID Performance Platform — Write-through cache client (browser only)
// =============================================================================
//
// The Zustand store remains the single app-side state container and keeps
// working fully offline via localStorage. This module mirrors it to the
// server (`/api/sync`) so state follows the athlete across devices:
//
//   initSync(email)   — pull the server snapshot on login / app start and
//                       reconcile: newest `revision` wins. If the server is
//                       newer, the local store is hydrated from it; if the
//                       local store is newer, it is pushed immediately.
//   subscribe(...)    — installed once by initSync; watches the persisted
//                       slice of the store. Every mutation bumps the local
//                       revision and schedules a debounced push (2 s). Toasts,
//                       navigation and other transient state never sync.
//
// Failure behaviour: if the server is unreachable or returns 503, pushes
// retry with exponential backoff (5 tries, capped at 30 s) and then give up
// silently — localStorage keeps working as the offline source of truth, and
// the next app start retries the pull.
//
// The only writes the module performs on the store are full-slice hydration
// (`setState` with a server snapshot), which is flagged so the subscription
// does not echo it back to the server.
// =============================================================================

import { useApp, syncedState, type SyncedState } from "@/store/app-store";
import { pickSynced } from "@/lib/sync-keys";

const REVISION_KEY = "hybrid-sync-local-revision";
const PUSH_DEBOUNCE_MS = 2_000;
const MAX_RETRIES = 5;
const RETRY_CAP_MS = 30_000;

export interface SyncStatus {
  email: string | null;
  localRevision: number;
  lastPushAt: number | null;
  lastPullAt: number | null;
  pending: boolean;
}

// ---------------------------------------------------------------------------
// Module state (singletons — the browser has one app instance per tab)
// ---------------------------------------------------------------------------

let currentEmail: string | null = null;
let localRevision = 0;
let lastPushAt: number | null = null;
let lastPullAt: number | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let subscribed = false;
let suppressEcho = false;
let baselineSlice = "";

function readStoredRevision(): number {
  try {
    const raw = window.localStorage.getItem(REVISION_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeStoredRevision(ms: number): void {
  try {
    window.localStorage.setItem(REVISION_KEY, String(ms));
  } catch {
    /* private browsing — keep the in-memory value */
  }
}

function sliceOf(state: ReturnType<typeof useApp.getState>): SyncedState {
  return syncedState(state);
}

async function fetchJson(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch(url, init);
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON body */
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

async function pushNow(): Promise<void> {
  if (!currentEmail) return;
  const email = currentEmail;
  const state = sliceOf(useApp.getState());
  const revision = new Date(localRevision).toISOString();

  const res = await fetchJson("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ revision, state }),
  });

  // Signed out / switched accounts mid-flight — drop the push.
  if (currentEmail !== email) return;

  if (res.status === 401) {
    handleSessionExpired();
    return;
  }

  if (res.ok && res.data?.ok) {
    retryCount = 0;
    lastPushAt = Date.now();
    return;
  }

  if (res.status === 409 || res.data?.conflict) {
    // Another device pushed a newer snapshot — adopt it instead of fighting.
    await pullAndReconcile();
    return;
  }

  scheduleRetry();
}

function scheduleRetry(): void {
  if (retryCount >= MAX_RETRIES || retryTimer) return;
  const delay = Math.min(1_000 * 2 ** retryCount, RETRY_CAP_MS);
  retryCount += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void pushNow();
  }, delay);
}

function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushNow();
  }, PUSH_DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// Pull + reconcile
// ---------------------------------------------------------------------------

async function pullAndReconcile(): Promise<void> {
  if (!currentEmail) return;
  const email = currentEmail;

  const res = await fetchJson("/api/sync", { cache: "no-store" });
  if (currentEmail !== email) return;
  if (res.status === 401) {
    handleSessionExpired();
    return;
  }

  if (!res.ok) return; // offline / 503 — localStorage stays authoritative
  lastPullAt = Date.now();
  retryCount = 0;

  const serverRevisionMs = res.data?.revision ? Date.parse(res.data.revision) : 0;
  if (!Number.isFinite(serverRevisionMs)) return;

  if (serverRevisionMs > localRevision && res.data?.state && typeof res.data.state === "object") {
    // Server is newer — hydrate the local store from the snapshot.
    suppressEcho = true;
    // Only whitelisted data keys — a snapshot can never change identity,
    // tier, navigation or store actions.
    useApp.setState(pickSynced(res.data.state) as Partial<ReturnType<typeof useApp.getState>>);
    localRevision = serverRevisionMs;
    writeStoredRevision(localRevision);
    baselineSlice = JSON.stringify(sliceOf(useApp.getState()));
    useApp.getState().pushToast({
      kind: "info",
      title: "Synced",
      body: "Latest data loaded from your account.",
    });
  } else if (localRevision > serverRevisionMs) {
    // Local is newer (e.g. mutations made offline) — push up.
    void pushNow();
  }
}

// ---------------------------------------------------------------------------
// Subscription (installs once per page load)
// ---------------------------------------------------------------------------

function ensureSubscribed(): void {
  if (subscribed || typeof window === "undefined") return;
  subscribed = true;
  baselineSlice = JSON.stringify(sliceOf(useApp.getState()));

  useApp.subscribe((state) => {
    if (!currentEmail || !state.authed || state.email !== currentEmail) return;
    if (suppressEcho) {
      suppressEcho = false;
      baselineSlice = JSON.stringify(sliceOf(state));
      return;
    }
    const slice = JSON.stringify(sliceOf(state));
    if (slice === baselineSlice) return;
    baselineSlice = slice;
    localRevision = Date.now();
    writeStoredRevision(localRevision);
    schedulePush();
  });

  // Coming back online after being offline — flush a pending push.
  window.addEventListener("online", () => {
    if (currentEmail && localRevision > 0) void pushNow();
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start (or restart) syncing for the signed-in email. Safe to call on every
 * app start and on account switches; a repeated call for the same email is a
 * no-op. Must run AFTER the persisted store has hydrated from localStorage
 * (the SyncManager component handles that ordering).
 */
export async function initSync(email: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (currentEmail === email) return;

  // Cancel any in-flight work for the previous account.
  currentEmail = email;
  if (pushTimer) clearTimeout(pushTimer);
  if (retryTimer) clearTimeout(retryTimer);
  pushTimer = null;
  retryTimer = null;
  retryCount = 0;
  localRevision = readStoredRevision();

  // First run on this device with existing local data: treat it as the
  // newest local state (it has never been synced, so nothing to compare).
  const hasLocalData = useApp.getState().onboarded || useApp.getState().sessions.length > 0;
  if (localRevision === 0 && hasLocalData) {
    localRevision = Date.now();
    writeStoredRevision(localRevision);
  }

  ensureSubscribed();
  await pullAndReconcile();
}

/** Stop syncing (sign-out / expired session) and forget this device's revision. */
export function stopSync(): void {
  currentEmail = null;
  if (pushTimer) clearTimeout(pushTimer);
  if (retryTimer) clearTimeout(retryTimer);
  pushTimer = null;
  retryTimer = null;
  retryCount = 0;
  localRevision = 0;
  try {
    window.localStorage.removeItem(REVISION_KEY);
  } catch {
    /* ignore */
  }
}

function handleSessionExpired(): void {
  stopSync();
  const store = useApp.getState();
  if (store.authed) {
    store.signOut();
    store.pushToast({ kind: "warning", title: "Signed out", body: "Your session expired. Please sign in again." });
  }
}

/** Readable sync status for UI surfaces (settings, diagnostics). */
export function getSyncStatus(): SyncStatus {
  return {
    email: currentEmail,
    localRevision,
    lastPushAt,
    lastPullAt,
    pending: pushTimer !== null || retryTimer !== null,
  };
}
