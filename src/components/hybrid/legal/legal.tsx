"use client";

import { Card, PageHeader, SectionTitle } from "@/components/hybrid/blocks/ui";
import { Shield, FileText, Lock, Eye, Trash2, Mail, RefreshCw, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";

export function PrivacyView() {
  const profile = useApp((s) => s.profile);
  const authed = useApp((s) => s.authed);
  const setView = useApp((s) => s.setView);
  const setAppView = useApp((s) => s.setAppView);

  function back() {
    if (authed) {
      setAppView("settings");
      setView("app");
    } else {
      setView("landing");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-3xl mx-auto px-4 sm:px-6 relative"
    >
      <button
        onClick={back}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mt-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to {authed ? "settings" : "home"}
      </button>
      <PageHeader
        title="Privacy"
        subtitle="How HYBRID collects, uses and protects your data."
        actions={
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5" /> Effective: November 2026
          </div>
        }
      />

      <Card>
        <SectionTitle>1. Data we collect</SectionTitle>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            <span className="text-foreground font-medium">Account data.</span> Email address, hashed password (bcrypt), display name, avatar URL. We never store passwords in plaintext.
          </p>
          <p>
            <span className="text-foreground font-medium">Athlete profile.</span> Age, height, weight (optional), sex (optional), training age, training background, primary goal, equipment, training availability. All athlete profile data is voluntary.
          </p>
          <p>
            <span className="text-foreground font-medium">Training data.</span> Workout logs, scheduled sessions, personal records, benchmarks, HYROX simulations, ATHX estimates, competition results you log.
          </p>
          <p>
            <span className="text-foreground font-medium">Recovery & wearable data (when you connect).</span> Sleep, resting HR, HRV, fatigue, plus any data synced via Apple Health, Health Connect, Garmin, Strava or Whoop. We only sync data you explicitly authorise.
          </p>
          <p>
            <span className="text-foreground font-medium">Usage data.</span> Aggregated, anonymised telemetry (page views, feature usage, crash reports). No personal identifiers.
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle>2. How we use your data</SectionTitle>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-primary mt-2" /> To generate your adaptive training plan and AI coaching insights.</li>
          <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-primary mt-2" /> To compute performance analytics, weakness detection and Estimated Performance Scores.</li>
          <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-primary mt-2" /> To send you workout reminders, competition countdowns, and weekly summaries (if you enable them).</li>
          <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-primary mt-2" /> To allow your coach (if you have one) to view your training data, only after you authorise the relationship.</li>
          <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-primary mt-2" /> To show you on leaderboards and in challenges, only if you opt in to public visibility.</li>
        </ul>
      </Card>

      <Card>
        <SectionTitle>3. Data we never share</SectionTitle>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><Lock className="w-4 h-4 text-destructive shrink-0 mt-0.5" /> We never sell your personal data.</li>
          <li className="flex items-start gap-2"><Lock className="w-4 h-4 text-destructive shrink-0 mt-0.5" /> We never share your training data with HYROX, ATHX, CrossFit, or any competition organiser.</li>
          <li className="flex items-start gap-2"><Lock className="w-4 h-4 text-destructive shrink-0 mt-0.5" /> We never share your data with advertisers.</li>
          <li className="flex items-start gap-2"><Lock className="w-4 h-4 text-destructive shrink-0 mt-0.5" /> We never use your data to train AI models that other users interact with.</li>
        </ul>
      </Card>

      <Card>
        <SectionTitle>4. Your controls</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-3">
          <ControlTile
            icon={Eye}
            title="Visibility"
            body="Default is 'friends'. Change to public, friends or private in Settings."
          />
          <ControlTile
            icon={RefreshCw}
            title="Export"
            body="Download a JSON archive of your profile, sessions, PRs and simulations from Settings → Data."
          />
          <ControlTile
            icon={Trash2}
            title="Delete"
            body="Permanently delete your account and all associated data. Deletion is final and irreversible."
          />
          <ControlTile
            icon={Mail}
            title="Notifications"
            body="Toggle workout reminders, countdowns, weekly emails, PR achievements individually."
          />
        </div>
      </Card>

      <Card>
        <SectionTitle>5. Security</SectionTitle>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>All data is encrypted in transit (TLS 1.2+) and at rest (Supabase Postgres with AES-256).</li>
          <li>Row Level Security (RLS) policies enforce that you can only read your own private data. Coaches can only read athlete data after the athlete authorises the relationship.</li>
          <li>API keys (OpenAI, Stripe, Apple, Google) live only on the server. No keys are ever shipped to the client.</li>
          <li>We do not store credit card numbers. Stripe handles all payment data.</li>
        </ul>
      </Card>

      <Card>
        <SectionTitle>6. Data retention</SectionTitle>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Active accounts: data is retained as long as your account is active.</li>
          <li>Cancelled subscriptions: your data is retained for 90 days in case you return, then deleted on request.</li>
          <li>Account deletion: data is permanently deleted within 30 days of your request, except where we have a legal obligation to retain (e.g. tax records for transactions).</li>
        </ul>
      </Card>

      <Card>
        <SectionTitle>7. International users (GDPR / UK GDPR)</SectionTitle>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>You have the right to access, rectify, erase, restrict processing, and port your data.</li>
          <li>To exercise these rights, email <span className="text-foreground">privacy@hybrid.app</span> from the email registered on your account.</li>
          <li>We respond within 30 days. There is no charge for any data request.</li>
          <li>If we cannot resolve your complaint, you have the right to lodge a complaint with your local supervisory authority (e.g. ICO in the UK, DPC in Ireland).</li>
        </ul>
      </Card>

      <Card>
        <SectionTitle>8. Children</SectionTitle>
        <p className="text-sm text-muted-foreground">
          HYBRID is not directed to children under 16. We do not knowingly collect data from anyone under 16. If you believe we have collected data from a child under 16, contact us and we will delete it immediately.
        </p>
      </Card>

      <Card>
        <SectionTitle>9. Changes to this policy</SectionTitle>
        <p className="text-sm text-muted-foreground">
          We will notify you 30 days before any material change to this privacy policy via email and in-app notification. Continued use after the effective date constitutes acceptance.
        </p>
      </Card>

      <Card>
        <SectionTitle>10. Contact</SectionTitle>
        <p className="text-sm text-muted-foreground">
          Questions? Email <span className="text-foreground">privacy@hybrid.app</span> or write to:
        </p>
        <div className="text-sm text-muted-foreground mt-3">
          HYBRID Performance Ltd<br />
          Privacy Officer<br />
          [Registered office address]<br />
          [Country]
        </div>
      </Card>

      {profile && (
        <div className="text-xs text-muted-foreground text-center pb-4">
          Logged in as {profile.displayName}. Your data is yours — export or delete it from Settings.
        </div>
      )}
    </motion.div>
  );
}

function ControlTile({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="p-3 rounded-md border border-border bg-secondary/20">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="text-xs text-muted-foreground">{body}</div>
    </div>
  );
}

export function TermsView() {
  const authed = useApp((s) => s.authed);
  const setView = useApp((s) => s.setView);
  const setAppView = useApp((s) => s.setAppView);

  function back() {
    if (authed) {
      setAppView("settings");
      setView("app");
    } else {
      setView("landing");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-3xl mx-auto px-4 sm:px-6"
    >
      <button
        onClick={back}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mt-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to {authed ? "settings" : "home"}
      </button>
      <PageHeader
        title="Terms of Service"
        subtitle="The agreement between you and HYBRID Performance."
        actions={
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="w-3.5 h-3.5" /> Effective: November 2026
          </div>
        }
      />

      <Card>
        <SectionTitle>1. Acceptance of terms</SectionTitle>
        <p className="text-sm text-muted-foreground">
          By creating a HYBRID account or using any HYBRID product (web, iOS, Android), you agree to these Terms. If you do not agree, do not use HYBRID.
        </p>
      </Card>

      <Card>
        <SectionTitle>2. Eligibility</SectionTitle>
        <p className="text-sm text-muted-foreground">
          You must be at least 16 years old to use HYBRID. By registering, you confirm you meet this requirement. If you are under 18, you confirm your parent or legal guardian has read and accepted these Terms on your behalf.
        </p>
      </Card>

      <Card>
        <SectionTitle>3. Your account</SectionTitle>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>You are responsible for keeping your password confidential and for all activity under your account.</li>
          <li>You must provide accurate profile and benchmark data. The AI Coach and training engine rely on it.</li>
          <li>You may not share your account with others or create accounts for non-existent people.</li>
        </ul>
      </Card>

      <Card>
        <SectionTitle>4. Acceptable use</SectionTitle>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>You will not use HYBRID to abuse, harass, or discriminate against other athletes or coaches.</li>
          <li>You will not attempt to reverse-engineer, scrape, or overload our APIs.</li>
          <li>You will not submit false or misleading training data, competition results, or PR claims.</li>
          <li>You will not use HYBRID to train AI models for other products.</li>
        </ul>
      </Card>

      <Card>
        <SectionTitle>5. Subscriptions and billing</SectionTitle>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>PRO subscriptions auto-renew at the end of each billing period unless cancelled.</li>
          <li>You can cancel anytime via the platform where you subscribed (Stripe on web, App Store / Play Store on mobile).</li>
          <li>Refunds are handled by the platform's refund policy (Apple, Google, Stripe). We do not issue refunds directly.</li>
          <li>Annual subscriptions are non-refundable once the 14-day cancellation window has passed, except where required by law.</li>
          <li>Entitlements sync across web and mobile: if you subscribe on iOS, your PRO access is automatically available on web and Android, and vice versa.</li>
        </ul>
      </Card>

      <Card>
        <SectionTitle>6. AI coach and training engine</SectionTitle>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li><span className="text-foreground font-medium">Not medical advice.</span> The AI Coach and adaptive training engine provide training-related recommendations only. They do not diagnose injuries, medical conditions, or mental health issues. Always consult a qualified professional for medical advice.</li>
          <li><span className="text-foreground font-medium">Not a guarantee.</span> HYBRID does not guarantee competition results. Performance depends on many factors outside our control.</li>
          <li><span className="text-foreground font-medium">Coach precedence.</span> If you have a coach who has assigned a program, the coach's program takes precedence over the AI engine. You can override individual sessions, but the engine will not silently replace coach-assigned programming.</li>
          <li><span className="text-foreground font-medium">Estimates vs measured.</span> The Estimated Performance Score (EPS) is HYBRID's internal estimate, not the official ATHX FitScore. We display the official score where you have entered one.</li>
        </ul>
      </Card>

      <Card>
        <SectionTitle>7. Competition results and trademark disclaimer</SectionTitle>
        <p className="text-sm text-muted-foreground mb-3">
          HYBRID is an independent training platform. HYROX®, ATHX Games®, and CrossFit® are trademarks of their respective owners. HYBRID is not affiliated with, endorsed by, or sponsored by these organisations. We use their names only to describe compatible training formats.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Competition results you log are user-submitted. We do not verify them against official sources.</li>
          <li>We do not scrape official event websites or assume API availability for any competition organiser.</li>
          <li>HYROX station standards shown in the app are based on publicly documented rules at time of implementation. They may change — refer to the official HYROX rules for current standards.</li>
          <li>ATHX FitScore is computed by the official ATHX scoring system. HYBRID's EPS is a clearly-labeled estimate.</li>
        </ul>
      </Card>

      <Card>
        <SectionTitle>8. Intellectual property</SectionTitle>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>HYBRID, the HYBRID logo, and all software are © HYBRID Performance Ltd. All rights reserved.</li>
          <li>You retain ownership of your training data. We license it from you only for the purpose of providing HYBRID (per the Privacy Policy).</li>
          <li>CrossFit benchmark workout names (Fran, Murph, etc.) are part of CrossFit's public benchmark library and are referenced for compatibility only.</li>
        </ul>
      </Card>

      <Card>
        <SectionTitle>9. Termination</SectionTitle>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>You can delete your account at any time from Settings → Data → Delete account. All your data is permanently deleted within 30 days.</li>
          <li>We may suspend or terminate your account if you violate these Terms. We will notify you by email before suspension unless there is a legal or safety reason not to.</li>
        </ul>
      </Card>

      <Card>
        <SectionTitle>10. Limitation of liability</SectionTitle>
        <p className="text-sm text-muted-foreground">
          To the maximum extent permitted by law, HYBRID's liability for any claim arising out of these Terms is limited to the amount you paid us in the 12 months before the claim. We are not liable for indirect or consequential damages.
        </p>
      </Card>

      <Card>
        <SectionTitle>11. Governing law</SectionTitle>
        <p className="text-sm text-muted-foreground">
          These Terms are governed by the laws of [Country]. Any dispute will be resolved in the courts of [City], [Country], unless you are a consumer in the EU/UK/EEA in which case you may bring proceedings in your local courts.
        </p>
      </Card>

      <Card>
        <SectionTitle>12. Changes to terms</SectionTitle>
        <p className="text-sm text-muted-foreground">
          We will notify you 30 days before any material change via email and in-app notification. Continued use after the effective date constitutes acceptance. Material changes include price changes, changes to subscription terms, and changes to data handling.
        </p>
      </Card>

      <Card>
        <SectionTitle>13. Contact</SectionTitle>
        <p className="text-sm text-muted-foreground">
          Questions about these Terms? Email <span className="text-foreground">legal@hybrid.app</span>.
        </p>
      </Card>
    </motion.div>
  );
}
