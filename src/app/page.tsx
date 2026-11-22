"use client";

import { useApp } from "@/store/app-store";
import { LandingPage } from "@/components/hybrid/landing";
import { AuthScreen } from "@/components/hybrid/auth";
import { OnboardingFlow } from "@/components/hybrid/onboarding";
import { AppShell } from "@/components/hybrid/app-shell";
import { Toasts } from "@/components/hybrid/toasts";

export default function Home() {
  const view = useApp((s) => s.view);
  const authed = useApp((s) => s.authed);
  const onboarded = useApp((s) => s.onboarded);

  return (
    <>
      {!authed && view === "landing" && <LandingPage />}
      {!authed && view === "auth" && <AuthScreen />}
      {authed && !onboarded && <OnboardingFlow />}
      {authed && onboarded && <AppShell />}
      <Toasts />
    </>
  );
}
