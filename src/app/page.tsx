"use client";

import { useApp } from "@/store/app-store";
import { LandingPage } from "@/components/hybrid/landing";
import { AuthScreen } from "@/components/hybrid/auth";
import { OnboardingFlow } from "@/components/hybrid/onboarding";
import { AppShell } from "@/components/hybrid/app-shell";
import { Toasts } from "@/components/hybrid/toasts";
import { PrivacyPage } from "@/components/hybrid/legal";
import { TermsPage } from "@/components/hybrid/legal";

export default function Home() {
  const view = useApp((s) => s.view);
  const authed = useApp((s) => s.authed);
  const onboarded = useApp((s) => s.onboarded);

  return (
    <>
      {view === "privacy" && <PrivacyPage />}
      {view === "terms" && <TermsPage />}
      {view !== "privacy" && view !== "terms" && !authed && view === "landing" && <LandingPage />}
      {view !== "privacy" && view !== "terms" && !authed && view === "auth" && <AuthScreen />}
      {view !== "privacy" && view !== "terms" && authed && !onboarded && <OnboardingFlow />}
      {view !== "privacy" && view !== "terms" && authed && onboarded && <AppShell />}
      <Toasts />
    </>
  );
}
