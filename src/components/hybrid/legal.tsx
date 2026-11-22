"use client";

import { useApp } from "@/store/app-store";
import { ArrowLeft, Shield } from "lucide-react";

export function PrivacyPage() {
  const setView = useApp((s) => s.setView);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border sticky top-0 z-40 bg-background/90 backdrop-blur">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center gap-3">
          <button
            onClick={() => setView("landing")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold text-xs">H</div>
            <span className="font-bold tracking-tight">HYBRID</span>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-5 py-10">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground tracking-widest uppercase mb-2">
          <Shield className="w-3.5 h-3.5" /> Legal
        </div>
        <h1 className="text-display text-4xl mb-2">Privacy Policy</h1>
        <div className="text-sm text-muted-foreground">Last updated: November 2026</div>

        <div className="prose prose-sm dark:prose-invert max-w-none mt-8 space-y-6 text-sm leading-relaxed">
          <Section title="1. Who we are">
            <p>HYBRID is an independent training platform operated by HYBRID Performance. HYROX®, ATHX®, and CrossFit® are trademarks of their respective owners. HYBRID is not affiliated with, endorsed by, or sponsored by those organisations. We use their names only to describe compatible training formats.</p>
          </Section>
          <Section title="2. What we collect">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account information</strong> — email address, hashed password, display name you choose to share.</li>
              <li><strong>Athlete profile</strong> — age, height, weight, training background, training age — most fields optional.</li>
              <li><strong>Training data</strong> — workout logs, personal records, benchmark results, race simulations, competition results you enter.</li>
              <li><strong>Health and recovery</strong> — sleep, resting heart rate, HRV, fatigue scores you optionally provide. Wearable data is only retrieved after explicit authorization from you.</li>
              <li><strong>Usage data</strong> — anonymized analytics about how you use the app, collected via Vercel Analytics.</li>
            </ul>
          </Section>
          <Section title="3. How we use your data">
            <ul className="list-disc pl-5 space-y-1">
              <li>To generate personalized training plans, adaptations, and AI coaching insights.</li>
              <li>To compute analytics and performance trends you see in the app.</li>
              <li>To send notifications and summaries you have explicitly enabled.</li>
              <li>To provide community features (challenges, leaderboards, activity feed) — only when you choose to share.</li>
              <li>To improve the platform via aggregated, anonymized analytics. We never sell your personal data.</li>
            </ul>
          </Section>
          <Section title="4. Data sharing">
            <p>We do not sell, rent, or share your personal data with third parties for advertising. We share data only:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>With infrastructure providers (Supabase for database, Vercel for hosting, Stripe for payments) under their respective data processing agreements.</li>
              <li>With the AI inference provider to answer your coaching questions. Your athlete data is sent as context for that single request and is not retained by the provider beyond what is necessary to serve the response.</li>
              <li>With competition organizers only if you explicitly publish a result (e.g., share a HYROX finish time on the public leaderboard).</li>
              <li>With a coach you have authorized through a Coach-Athlete relationship. The coach only sees data for athletes who have authorized them.</li>
            </ul>
          </Section>
          <Section title="5. Your rights">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Access</strong> — you can export all your data from Settings → Data → Export my data at any time.</li>
              <li><strong>Correction</strong> — you can edit your profile, benchmarks, and logs at any time.</li>
              <li><strong>Deletion</strong> — you can clear training history or permanently delete your account from Settings → Data.</li>
              <li><strong>Portability</strong> — exports are provided in standard JSON format.</li>
              <li><strong>Withdrawal of consent</strong> — disable notifications, disconnect wearables, or change visibility to "private" at any time.</li>
            </ul>
            <p>If you are an EU or California resident, you have additional rights under GDPR and CCPA respectively. Contact <span className="font-mono">privacy@hybridperformance.app</span> to exercise them.</p>
          </Section>
          <Section title="6. Data security">
            <p>All data is encrypted in transit (TLS) and at rest (Supabase Postgres encryption). Authentication tokens are stored via secure HTTP-only cookies. Wearable tokens are encrypted at rest. Row Level Security (RLS) policies ensure users can only access their own data unless explicit sharing permissions exist.</p>
          </Section>
          <Section title="7. Children">
            <p>HYBRID is intended for athletes 16 years and older. We do not knowingly collect data from children under 16. If you believe a minor has registered, contact us and we will remove the account.</p>
          </Section>
          <Section title="8. International transfers">
            <p>Your data may be processed in the EU, US, or other jurisdictions where our infrastructure providers operate. We rely on Standard Contractual Clauses and adequacy decisions for lawful transfers.</p>
          </Section>
          <Section title="9. Changes to this policy">
            <p>We will update this policy as the platform evolves. Material changes will be announced in-app and via email at least 14 days before they take effect.</p>
          </Section>
          <Section title="10. Contact">
            <p>Questions? Email <span className="font-mono">privacy@hybridperformance.app</span>. We respond within 30 days.</p>
          </Section>
        </div>
      </article>
    </div>
  );
}

export function TermsPage() {
  const setView = useApp((s) => s.setView);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border sticky top-0 z-40 bg-background/90 backdrop-blur">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center gap-3">
          <button
            onClick={() => setView("landing")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold text-xs">H</div>
            <span className="font-bold tracking-tight">HYBRID</span>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-5 py-10">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground tracking-widest uppercase mb-2">
          <Shield className="w-3.5 h-3.5" /> Legal
        </div>
        <h1 className="text-display text-4xl mb-2">Terms of Service</h1>
        <div className="text-sm text-muted-foreground">Last updated: November 2026</div>

        <div className="prose prose-sm dark:prose-invert max-w-none mt-8 space-y-6 text-sm leading-relaxed">
          <Section title="1. Acceptance of terms">
            <p>By creating an account or using HYBRID, you agree to these Terms. If you do not agree, do not use the platform. You must be 16 or older to create an account.</p>
          </Section>
          <Section title="2. Description of service">
            <p>HYBRID is a hybrid fitness platform providing training plans, workout logging, performance analytics, AI coaching, and competition preparation tools for HYROX, ATHX, and CrossFit athletes. A free tier is available with limited features; paid subscriptions unlock the full product.</p>
          </Section>
          <Section title="3. Not medical advice">
            <p><strong>HYBRID is not a medical device.</strong> Training plans, AI coaching insights, and analytics are informational only and are not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified professional before starting a new training program, especially if you have injuries or medical conditions. The AI Coach will refuse to diagnose injuries or medical conditions and will redirect you to a qualified professional.</p>
          </Section>
          <Section title="4. Subscriptions and billing">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Free tier</strong> — basic profile, logging, timers. No charge.</li>
              <li><strong>Pro</strong> — €18/month or €129/year. Billed via Stripe (web) or in-app purchase (iOS/Android).</li>
              <li><strong>Coach</strong> — €39/month. Includes athlete management and custom programming.</li>
              <li><strong>Gym</strong> — pricing per gym. Contact sales.</li>
            </ul>
            <p>Subscriptions renew automatically. You can cancel anytime from Settings; access continues until the end of the current billing period. Refunds are handled per Stripe/App Store/Play Store policies. Entitlements are synchronized across web and mobile.</p>
          </Section>
          <Section title="5. Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use HYBRID for any illegal activity or to violate others' rights.</li>
              <li>Submit content that is hateful, harassing, or unlawful.</li>
              <li>Attempt to access another user's data without authorization.</li>
              <li>Reverse engineer, scrape, or abuse the platform or its APIs.</li>
              <li>Claim affiliation with HYROX, ATHX, or CrossFit when sharing HYBRID-generated content publicly.</li>
            </ul>
          </Section>
          <Section title="6. User content">
            <p>You retain ownership of content you submit (workouts, logs, posts). You grant HYBRID a worldwide, non-exclusive license to use, store, and process your content solely to operate the platform and provide features you have enabled (e.g., sharing workouts with the community).</p>
          </Section>
          <Section title="7. Intellectual property">
            <p>HYBRID, its design, code, training engine, and documentation are the property of HYBRID Performance. HYROX®, ATHX®, and CrossFit® are trademarks of their respective owners and are used here only to describe compatible training formats. HYBRID does not imply affiliation, endorsement, or sponsorship.</p>
          </Section>
          <Section title="8. Disclaimer of warranties">
            <p>HYBRID is provided "as is" without warranties of any kind. We do not guarantee that training plans will produce specific results, that you will avoid injury, or that the platform will be uninterrupted or error-free.</p>
          </Section>
          <Section title="9. Limitation of liability">
            <p>To the maximum extent permitted by law, HYBRID will not be liable for any indirect, incidental, or consequential damages, or for any injury arising from your use of the platform. Our total liability for any claim is limited to the amount you paid us in the past 12 months.</p>
          </Section>
          <Section title="10. Termination">
            <p>You can delete your account anytime from Settings. We can suspend or terminate accounts that violate these Terms. Upon termination, your data is deleted within 30 days except where retention is required by law.</p>
          </Section>
          <Section title="11. Governing law">
            <p>These Terms are governed by the laws of Ireland. Disputes are resolved in the courts of Dublin, Ireland.</p>
          </Section>
          <Section title="12. Changes to terms">
            <p>We may update these Terms. Material changes will be announced in-app and via email at least 14 days before they take effect. Continued use after that period constitutes acceptance.</p>
          </Section>
          <Section title="13. Contact">
            <p>Questions? Email <span className="font-mono">legal@hybridperformance.app</span>.</p>
          </Section>
        </div>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <div className="text-muted-foreground space-y-2">{children}</div>
    </section>
  );
}
