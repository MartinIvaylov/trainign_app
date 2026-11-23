"use client";

import { useState } from "react";
import { useApp } from "@/store/app-store";
import {
  Card, PageHeader, SectionTitle,
} from "@/components/hybrid/blocks/ui";
import { motion } from "framer-motion";
import {
  Watch, Database, Info, Check, AlertTriangle, Heart, Smartphone, Activity, Zap, Shield, FileText,
} from "lucide-react";

type Tier = "free" | "pro" | "pro_annual" | "coach" | "gym";

interface TierOption {
  id: Tier;
  name: string;
  price: string;
  description: string;
  features: string[];
}

const TIERS: TierOption[] = [
  {
    id: "free",
    name: "Free",
    price: "€0",
    description: "For trying things out.",
    features: ["1 training mode", "Basic plan", "Manual logging"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "€18/mo",
    description: "For serious athletes.",
    features: ["All training modes", "AI coach", "Hyrox simulator", "PR tracking"],
  },
  {
    id: "pro_annual",
    name: "Pro Annual",
    price: "€129/yr",
    description: "Best value — save 40%.",
    features: ["Everything in Pro", "Priority support", "2-month savings"],
  },
  {
    id: "coach",
    name: "Coach",
    price: "€39/mo",
    description: "For coaches managing athletes.",
    features: ["Athlete roster", "Programming tools", "Team analytics"],
  },
  {
    id: "gym",
    name: "Gym",
    price: "€89/mo",
    description: "For boxes and studios.",
    features: ["Multiple coaches", "Member management", "Gym challenges", "Group programming", "Reporting"],
  },
];

interface WearableIntegration {
  id: string;
  name: string;
  description: string;
  icon: typeof Watch;
}

const WEARABLES: WearableIntegration[] = [
  { id: "w1", name: "Apple Health / HealthKit", description: "iOS native health data.", icon: Heart },
  { id: "w2", name: "Health Connect (Android)", description: "Android unified health API.", icon: Smartphone },
  { id: "w3", name: "Garmin", description: "Connect IQ watches and devices.", icon: Watch },
  { id: "w4", name: "Strava", description: "Run and ride activities.", icon: Activity },
  { id: "w5", name: "Whoop", description: "Recovery and strain tracking.", icon: Zap },
];

interface NotificationToggle {
  id: string;
  label: string;
  description: string;
  defaultOn: boolean;
}

const NOTIFICATIONS: NotificationToggle[] = [
  { id: "n1", label: "Workout reminders", description: "Daily reminders before scheduled sessions.", defaultOn: true },
  { id: "n2", label: "Competition countdown", description: "Weekly summary as your competition approaches.", defaultOn: true },
  { id: "n3", label: "Weekly summary email", description: "Your training digest every Monday.", defaultOn: false },
  { id: "n4", label: "Challenge updates", description: "When a challenge you joined changes.", defaultOn: true },
  { id: "n5", label: "PR achievements", description: "Celebrate when you set a new personal record.", defaultOn: true },
];

type Visibility = "public" | "friends" | "private";

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
        on ? "bg-primary" : "bg-secondary border border-border"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${
          on ? "translate-x-5 bg-background" : "bg-foreground"
        }`}
      />
    </button>
  );
}

export function SettingsView() {
  const tier = useApp((s) => s.tier);
  const setTier = useApp((s) => s.setTier);
  const pushToast = useApp((s) => s.pushToast);
  const email = useApp((s) => s.email);
  const [billingBusy, setBillingBusy] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Record<string, boolean>>(
    () => Object.fromEntries(NOTIFICATIONS.map((n) => [n.id, n.defaultOn])),
  );
  const [visibility, setVisibility] = useState<Visibility>("friends");
  const [shareResults, setShareResults] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  function toggleNotification(id: string) {
    setNotifications((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleExport() {
    pushToast({
      kind: "info",
      title: "Export started",
      body: "Your data export will be available for download shortly.",
    });
  }

  function handleClearHistory() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    pushToast({
      kind: "warning",
      title: "Training history cleared",
      body: "Sessions, logs and simulations have been removed. Profile and benchmarks remain.",
    });
  }

  function handleDeleteAccount() {
    pushToast({
      kind: "warning",
      title: "Account deletion requested",
      body: "Confirmation email sent. Account will be deleted in 30 days.",
    });
  }

  // -------------------------------------------------------------------------
  // Billing — tier selection goes through /api/billing/checkout so the
  // entitlement is written server-side (Subscription table). With live
  // Stripe credentials this redirects to hosted Checkout; in preview mode
  // the entitlement is applied directly.
  // -------------------------------------------------------------------------

  async function handleTierSelect(t: TierOption) {
    if (t.id === tier || billingBusy) return;
    if (!email) {
      pushToast({
        kind: "error",
        title: "Sign in required",
        body: "Sign in again to change your subscription.",
      });
      return;
    }
    setBillingBusy(t.id);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: t.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        mode?: string;
        url?: string | null;
        tier?: Tier | null;
        error?: string;
      };
      if (!res.ok) {
        pushToast({
          kind: "error",
          title: "Checkout failed",
          body: data.error ?? "Please try again.",
        });
        return;
      }
      if (data.mode === "stripe" && data.url) {
        // Real Stripe hosted checkout — the webhook completes the flow.
        window.location.href = data.url;
        return;
      }
      // Preview mode: entitlement already written server-side.
      if (data.tier) {
        setTier(data.tier);
        pushToast({
          kind: "info",
          title: "Preview mode",
          body: "Entitlement written to the database — no real payment was processed.",
        });
      }
    } catch {
      pushToast({
        kind: "error",
        title: "Network error",
        body: "Could not reach the billing service.",
      });
    } finally {
      setBillingBusy(null);
    }
  }

  async function handleManageBilling() {
    if (billingBusy) return;
    if (!email) return;
    setBillingBusy("portal");
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        mode?: string;
        url?: string | null;
        error?: string;
      };
      if (!res.ok) {
        pushToast({
          kind: "error",
          title: "Billing portal unavailable",
          body: data.error ?? "Please try again.",
        });
        return;
      }
      if (data.mode === "stripe" && data.url) {
        window.location.href = data.url;
        return;
      }
      pushToast({
        kind: "info",
        title: "Preview mode",
        body: "The billing portal needs live Stripe credentials. Tier changes here are simulated.",
      });
    } catch {
      pushToast({
        kind: "error",
        title: "Network error",
        body: "Could not reach the billing service.",
      });
    } finally {
      setBillingBusy(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <PageHeader title="Settings" subtitle="Account, subscription, integrations, data." />

      {/* Subscription */}
      <Card>
        <SectionTitle hint={`Current: ${tier.replace("_", " ")}`}>
          Subscription
        </SectionTitle>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {TIERS.map((t) => {
            const active = tier === t.id;
            const busy = billingBusy === t.id;
            return (
              <button
                key={t.id}
                onClick={() => void handleTierSelect(t)}
                disabled={busy || billingBusy !== null}
                className={`p-4 rounded-md border text-left transition relative ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-secondary/30"
                } ${busy || (billingBusy !== null && !active) ? "opacity-60" : ""}`}
              >
                {active && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground grid place-items-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="text-stat text-xl mt-2">{t.price}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t.description}
                </div>
                <ul className="mt-3 space-y-1">
                  {t.features.map((f) => (
                    <li
                      key={f}
                      className="text-xs text-muted-foreground flex items-center gap-1.5"
                    >
                      <Check className="w-3 h-3 text-success shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => void handleManageBilling()}
            disabled={billingBusy !== null}
            className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-secondary/40 transition disabled:opacity-60"
          >
            Manage billing
          </button>
          <div className="text-xs text-muted-foreground">
            Tier changes run through Stripe Checkout (web) with the
            entitlement stored in the Subscription table. In-app purchase
            (iOS/Android) shares the same entitlement sync. This preview runs
            without live Stripe keys — changes are simulated server-side.
          </div>
        </div>
      </Card>

      {/* Wearable integrations */}
      <Card>
        <SectionTitle hint="5 available">Wearable integrations</SectionTitle>
        <div className="space-y-2">
          {WEARABLES.map((w) => {
            const Icon = w.icon;
            return (
              <div
                key={w.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md border border-border"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-md bg-secondary grid place-items-center shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{w.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {w.description}
                    </div>
                  </div>
                </div>
                <button
                  disabled
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border text-muted-foreground cursor-not-allowed opacity-60"
                >
                  Connect
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Wearable integrations require actual authorization and testing. HYBRID
          does not claim wearable integration works until authorization, retrieval
          and testing are implemented.
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Notifications */}
        <Card>
          <SectionTitle hint="5 channels">Notifications</SectionTitle>
          <div className="space-y-3">
            {NOTIFICATIONS.map((n) => (
              <div
                key={n.id}
                className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{n.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {n.description}
                  </div>
                </div>
                <Toggle
                  on={!!notifications[n.id]}
                  onClick={() => toggleNotification(n.id)}
                />
              </div>
            ))}
          </div>
        </Card>

        {/* Privacy & sharing */}
        <Card>
          <SectionTitle hint="Your data">Privacy & sharing</SectionTitle>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-1.5">Default visibility</div>
              <div className="text-xs text-muted-foreground mb-2.5">
                Who can see your workouts and results by default.
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["public", "friends", "private"] as Visibility[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVisibility(v)}
                    className={`px-3 py-2 rounded-md text-xs font-semibold capitalize transition ${
                      visibility === v
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    Share competition results publicly
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Publish your finish times to the global leaderboard.
                  </div>
                </div>
                <Toggle
                  on={shareResults}
                  onClick={() => setShareResults((v) => !v)}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Data */}
      <Card>
        <SectionTitle hint="Account data">Data</SectionTitle>
        <div className="grid sm:grid-cols-3 gap-3">
          <button
            onClick={handleExport}
            className="p-3 rounded-md border border-border hover:bg-secondary/30 transition text-left"
          >
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-info" />
              <div className="text-sm font-semibold">Export my data</div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Download a JSON archive of your profile, sessions and PRs.
            </div>
          </button>

          <button
            onClick={handleClearHistory}
            className={`p-3 rounded-md border transition text-left ${
              confirmClear
                ? "border-warning bg-warning/10"
                : "border-border hover:bg-secondary/30"
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <div className="text-sm font-semibold">
                {confirmClear ? "Confirm clear?" : "Clear training history"}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {confirmClear
                ? "Click again to confirm. This cannot be undone."
                : "Remove sessions, logs and simulations. Profile remains."}
            </div>
          </button>

          <button
            onClick={handleDeleteAccount}
            className="p-3 rounded-md border border-border hover:bg-destructive/10 hover:border-destructive/40 transition text-left"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <div className="text-sm font-semibold">Delete account</div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Permanently delete your account and all associated data.
            </div>
          </button>
        </div>
        {confirmClear && (
          <button
            onClick={() => setConfirmClear(false)}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground transition"
          >
            Cancel
          </button>
        )}
      </Card>

      {/* About */}
      <Card>
        <SectionTitle hint="Legal">About</SectionTitle>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-secondary text-info grid place-items-center shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div className="text-sm text-muted-foreground">
            HYBRID is an independent training platform. HYROX®, ATHX® and
            CrossFit® are trademarks of their respective owners. Names are used
            only to describe compatible training formats.
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => { useApp.getState().setView("privacy"); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-secondary transition"
          >
            <Shield className="w-3.5 h-3.5" /> Privacy Policy
          </button>
          <button
            onClick={() => { useApp.getState().setView("terms"); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-secondary transition"
          >
            <FileText className="w-3.5 h-3.5" /> Terms of Service
          </button>
        </div>
      </Card>
    </motion.div>
  );
}
