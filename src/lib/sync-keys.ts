// Keys of the client store that are mirrored to the server via /api/sync.
//
// Shared by the client store and the server route (kept out of the
// "use client" store module so the server can import it). Identity and
// entitlement fields — `authed`, `email`, `tier` — are deliberately NOT
// here: they come from the session (`/api/auth/me`), never from a snapshot.
export const SYNCED_KEYS = [
  "onboarded",
  "profile",
  "preferences",
  "benchmarks",
  "activeMode",
  "activeGoal",
  "upcomingCompetition",
  "sessions",
  "logs",
  "prs",
  "hyroxSimulations",
  "raceResults",
  "coachAthletes",
  "coachWorkouts",
  "checkins",
  "recommendations",
] as const;

export type SyncedKey = (typeof SYNCED_KEYS)[number];

/** Keep only whitelisted keys of a plain object. */
export function pickSynced(state: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof state !== "object" || state === null || Array.isArray(state)) return out;
  const src = state as Record<string, unknown>;
  for (const key of SYNCED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(src, key)) out[key] = src[key];
  }
  return out;
}
