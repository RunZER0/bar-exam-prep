'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image
              src="/favicon-32x32.png"
              alt="Ynai Logo"
              width={28}
              height={28}
              className="shrink-0"
            />
            <span className="font-bold text-lg">Ynai</span>
          </Link>
          <div className="flex-1" />
          <Link 
            href="/" 
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: March 19, 2026</p>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8">

          {/* ── 1. Introduction & Legal Basis ── */}
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ynai (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates the bar exam preparation platform accessible at <strong>ynai.co.ke</strong>. We are committed to protecting the personal data of every user in compliance with the <strong>Kenya Data Protection Act, 2019</strong> (the &ldquo;DPA&rdquo;), the <strong>Data Protection (General) Regulations, 2021</strong>, and all guidance issued by the <strong>Office of the Data Protection Commissioner (ODPC)</strong>.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              This Privacy Policy explains what data we collect, why we collect it, how we process and protect it, with whom we share it, and the rights you hold as a data subject under Kenyan law.
            </p>
          </section>

          {/* ── 2. Data Controller ── */}
          <section>
            <h2 className="text-xl font-semibold mb-4">2. Data Controller &amp; Data Protection Officer</h2>
            <p className="text-muted-foreground leading-relaxed">
              The data controller responsible for your personal data is:
            </p>
            <div className="bg-muted/30 rounded-lg p-4 mt-4 text-muted-foreground text-sm space-y-1">
              <p><strong>Ynai</strong></p>
              <p>Nairobi, Kenya</p>
              <p>Email: <a href="mailto:privacy@ynai.co.ke" className="text-primary hover:underline">privacy@ynai.co.ke</a></p>
            </div>
            <p className="text-muted-foreground leading-relaxed mt-4">
              For any data protection inquiries, requests, or complaints, you may contact our Data Protection Officer at <a href="mailto:dpo@ynai.co.ke" className="text-primary hover:underline">dpo@ynai.co.ke</a>.
            </p>
          </section>

          {/* ── 3. Information We Collect ── */}
          <section>
            <h2 className="text-xl font-semibold mb-4">3. Personal Data We Collect</h2>

            <h3 className="text-lg font-medium mb-2">3.1 Account Information</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              When you register, we collect:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Full name and email address</li>
              <li>Profile photograph (if you upload one or sign in via Google)</li>
              <li>Community username you choose</li>
              <li>Kenya School of Law enrollment status and target exam sitting (e.g., November 2026)</li>
              <li>Authentication credentials managed via Google Firebase (we never see or store your Google password)</li>
            </ul>

            <h3 className="text-lg font-medium mb-2 mt-6">3.2 Study &amp; Performance Data</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Study progress, quiz scores, mastery phase completion, and spaced-repetition metrics</li>
              <li>Oral examination audio recordings and AI-graded scores</li>
              <li>Legal drafting documents you create on the platform</li>
              <li>Study streak history and session durations</li>
            </ul>

            <h3 className="text-lg font-medium mb-2 mt-6">3.3 AI Interaction Data</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              When you use our AI Tutor, Clarification, Research, or Oral Examination features, we process <strong>anonymised snapshots</strong> of your interaction — for example, the legal question you asked and the AI-generated response. <strong>We do not send your name, email, student number, or any personally identifiable information to AI providers.</strong> See Section 6 below for full details.
            </p>

            <h3 className="text-lg font-medium mb-2 mt-6">3.4 Payment Data</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Subscription plan, billing period, and transaction reference numbers</li>
              <li>Payment channel used (M-Pesa, card, etc.)</li>
              <li><strong>We do not store your M-Pesa PIN, credit/debit card number, or CVV.</strong> All card and mobile-money details are processed directly by our payment provider (Paystack) and never touch our servers.</li>
            </ul>

            <h3 className="text-lg font-medium mb-2 mt-6">3.5 Community Data</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Posts, replies, and votes you submit to community discussion threads</li>
              <li>Direct messages exchanged with other users (encrypted at rest)</li>
              <li>Challenge submissions and scores</li>
            </ul>

            <h3 className="text-lg font-medium mb-2 mt-6">3.6 Technical Data</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Browser type, operating system, and device category</li>
              <li>Push notification subscription tokens (for web push notifications)</li>
              <li>IP address (logged transiently for security; not stored long-term)</li>
            </ul>
          </section>

          {/* ── 4. Legal Basis for Processing ── */}
          <section>
            <h2 className="text-xl font-semibold mb-4">4. Legal Basis for Processing</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Under Section 30 of the Data Protection Act, 2019, we process your personal data on the following lawful bases:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-3">
              <li>
                <strong>Performance of a contract</strong> (Section 30(a)) — Processing is necessary to provide you the study platform services you signed up for, including personalised study plans, AI tutoring, progress tracking, and subscription management.
              </li>
              <li>
                <strong>Consent</strong> (Section 30(b)) — For optional processing such as sending you engagement emails (daily reminders, weekly reports, fun facts). You may withdraw consent at any time via your notification settings or by contacting us.
              </li>
              <li>
                <strong>Legitimate interest</strong> (Section 30(f)) — For platform security, fraud prevention, and aggregate analytics that improve the service for all users. We conduct a balancing assessment to ensure our interests do not override your rights.
              </li>
              <li>
                <strong>Legal obligation</strong> (Section 30(c)) — Where we are required by Kenyan law to retain certain records, for example, payment receipts under the Kenya Revenue Authority regulations.
              </li>
            </ul>
          </section>

          {/* ── 5. How We Use Your Data ── */}
          <section>
            <h2 className="text-xl font-semibold mb-4">5. How We Use Your Personal Data</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Deliver personalised study sessions, quizzes, and mastery assessments across the 9 ATP units</li>
              <li>Power AI tutoring, oral examinations, legal research, and document drafting features</li>
              <li>Track your progress, study streaks, and weak-area identification</li>
              <li>Process subscription payments and issue receipts</li>
              <li>Send transactional emails (payment confirmations, subscription changes) and, with your consent, engagement emails (study reminders, weekly reports)</li>
              <li>Enable community features: discussion threads, direct messaging, challenges, and leaderboard rankings</li>
              <li>Improve platform quality, fix bugs, and develop new features through aggregated, anonymised analytics</li>
              <li>Ensure platform security and prevent misuse</li>
            </ul>
          </section>

          {/* ── 6. Third-Party Processors & Cross-Border Transfers ── */}
          <section>
            <h2 className="text-xl font-semibold mb-4">6. Third-Party Data Processors &amp; Cross-Border Transfers</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We share limited data with carefully selected third-party processors to deliver our services. Under Section 48 of the DPA, we ensure each provider offers adequate data protection safeguards:
            </p>

            <ul className="list-disc pl-6 text-muted-foreground space-y-3">
              <li>
                <strong>Authentication Provider</strong> — We use a trusted identity platform to securely manage your login credentials and account verification. Data shared: email address, display name, and profile photo URL. <strong>We never see or store your password.</strong>
              </li>
              <li>
                <strong>AI Processing Provider</strong> — Our AI-powered features (tutoring, quizzes, oral examinations, legal research, and drafting assistance) are powered by a leading AI service. <strong>Only anonymised interaction snapshots are sent</strong> — the text of your legal question or prompt and relevant study context. <strong>Your name, email, student number, and account identifiers are never transmitted.</strong> The AI provider does not use API-submitted data to train its models.
              </li>
              <li>
                <strong>Payment Processor</strong> — Subscription payments (M-Pesa and card) are processed by a PCI-compliant payment provider. Data shared: email address, payment amount, and transaction reference. <strong>Your M-Pesa PIN, card number, and CVV never touch our servers</strong> — they go directly to the payment provider.
              </li>
              <li>
                <strong>Email Delivery Provider</strong> — Transactional and engagement emails are dispatched through a professional email delivery service. Data shared: email address, display name, and email content generated on our servers.
              </li>
              <li>
                <strong>Cloud Database Provider</strong> — Your data is stored in a managed, encrypted-at-rest cloud database hosted by a reputable infrastructure provider.
              </li>
            </ul>

            <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 mt-6">
              <h4 className="text-sm font-semibold text-foreground mb-2">How AI Processing Works</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">
                When you interact with any AI feature on Ynai, we send a <strong>snapshot</strong> of your interaction to our AI provider for processing. A snapshot contains only the academic content — for example: <em>&ldquo;Explain the doctrine of privity of contract under Kenyan law&rdquo;</em> or a legal drafting prompt. <strong>Your personal identifiers (name, email, student number, subscription details) are never included in any request to the AI provider.</strong> Our AI provider does not use data submitted via its API to train its models. We do not permit it to retain your interaction data beyond the period necessary to generate and return a response.
              </p>
            </div>

            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong>Cross-border transfers:</strong> Some of our processors are located outside Kenya (primarily the United States and European Union). In accordance with Section 48 of the DPA, we ensure transfers are only made to jurisdictions or entities that provide adequate data protection safeguards, including through binding contractual terms (Data Processing Agreements) that obligate each provider to protect your data to a standard no less stringent than the DPA.
            </p>
          </section>

          {/* ── 7. Data Security ── */}
          <section>
            <h2 className="text-xl font-semibold mb-4">7. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We implement technical and organisational measures to protect your personal data, including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Encryption in transit (TLS/HTTPS for all connections)</li>
              <li>Encryption at rest (database-level encryption via our cloud provider)</li>
              <li>Secure authentication via Firebase with support for multi-factor authentication</li>
              <li>Role-based access controls limiting staff access to personal data on a need-to-know basis</li>
              <li>Regular security reviews and dependency audits</li>
              <li>Push notification tokens stored securely and deactivated automatically when expired</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              In the event of a data breach that poses a real risk to your rights and freedoms, we will notify the ODPC within 72 hours and inform affected data subjects without undue delay, as required by Section 43 of the DPA.
            </p>
          </section>

          {/* ── 8. Data Retention ── */}
          <section>
            <h2 className="text-xl font-semibold mb-4">8. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We retain your personal data only for as long as necessary to fulfil the purposes for which it was collected:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Account data:</strong> Retained for the duration of your active account</li>
              <li><strong>Study progress &amp; mastery data:</strong> Retained while your account is active; deleted within 30 days of account deletion</li>
              <li><strong>Payment records:</strong> Retained for 7 years to comply with Kenya Revenue Authority requirements</li>
              <li><strong>AI interaction snapshots:</strong> Processed in real time and not stored beyond the session; only the final AI-generated output is saved to your study history</li>
              <li><strong>Community posts &amp; messages:</strong> Retained while your account is active; anonymised or deleted upon account deletion</li>
              <li><strong>Email notification logs:</strong> Retained for 90 days for delivery monitoring, then deleted</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              If you delete your account, we will erase your personal data within <strong>30 days</strong>, except where retention is required by law (e.g., payment records).
            </p>
          </section>

          {/* ── 9. Your Rights Under the DPA ── */}
          <section>
            <h2 className="text-xl font-semibold mb-4">9. Your Rights as a Data Subject</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Under Part IV of the Data Protection Act, 2019, you have the following rights:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-3">
              <li><strong>Right of access (Section 26(a)):</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Right to rectification (Section 26(c)):</strong> Request correction of inaccurate or incomplete personal data</li>
              <li><strong>Right to deletion (Section 26(d)):</strong> Request erasure of your personal data where processing is no longer necessary or consent is withdrawn</li>
              <li><strong>Right to restrict processing:</strong> Request limitation of processing in certain circumstances</li>
              <li><strong>Right to data portability (Section 26(g)):</strong> Receive your personal data in a structured, commonly used, machine-readable format</li>
              <li><strong>Right to object (Section 26(e)):</strong> Object to processing based on legitimate interest, including profiling and direct marketing</li>
              <li><strong>Right to withdraw consent:</strong> Withdraw consent at any time for processing based on consent, without affecting the lawfulness of prior processing</li>
              <li><strong>Right not to be subject to automated decision-making (Section 35):</strong> Our AI features provide study assistance only and do not make legally binding decisions about you</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              To exercise any of these rights, email <a href="mailto:dpo@ynai.co.ke" className="text-primary hover:underline">dpo@ynai.co.ke</a>. We will respond within <strong>30 days</strong>.
            </p>
          </section>

          {/* ── 10. Email Communications ── */}
          <section>
            <h2 className="text-xl font-semibold mb-4">10. Email Communications</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We send two categories of email:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-3">
              <li>
                <strong>Transactional emails</strong> — Payment receipts, subscription confirmations, account security alerts. These are essential to the service and cannot be opted out of while your account is active.
              </li>
              <li>
                <strong>Engagement emails</strong> — Daily study reminders, weekly progress reports, legal fun facts, streak milestones, and mastery achievements. You can opt out of these at any time via your Settings page or by clicking the unsubscribe link in any email.
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We limit engagement emails to a maximum of <strong>one per day</strong> per user to prevent email fatigue.
            </p>
          </section>

          {/* ── 11. Cookies & Local Storage ── */}
          <section>
            <h2 className="text-xl font-semibold mb-4">11. Cookies &amp; Local Storage</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ynai uses essential browser storage (cookies and localStorage) for authentication session management, theme preferences, and notification state. We do not use third-party tracking cookies or advertising pixels. No data stored in your browser is shared with external advertising networks.
            </p>
          </section>

          {/* ── 12. Children ── */}
          <section>
            <h2 className="text-xl font-semibold mb-4">12. Children&apos;s Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our platform is designed exclusively for law students and legal professionals, typically adults enrolled at the Kenya School of Law. We do not knowingly collect personal data from children under 18 years of age. If we become aware that a child&apos;s data has been collected, we will delete it promptly and notify the ODPC as appropriate.
            </p>
          </section>

          {/* ── 13. Automated Decision-Making ── */}
          <section>
            <h2 className="text-xl font-semibold mb-4">13. Automated Decision-Making &amp; AI</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our platform uses AI models to generate study content, grade practice questions, simulate oral examinations, and provide legal research assistance. These AI outputs are <strong>educational aids only</strong> and do not constitute legal advice or make binding determinations about your academic standing. Your mastery scores and study recommendations are derived from algorithmic analysis of your quiz performance and study patterns — you may request a human review of any AI-generated assessment by contacting our support team.
            </p>
          </section>

          {/* ── 14. Complaints ── */}
          <section>
            <h2 className="text-xl font-semibold mb-4">14. Complaints</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you believe your data protection rights have been violated, you have the right to lodge a complaint with the <strong>Office of the Data Protection Commissioner (ODPC)</strong>:
            </p>
            <div className="bg-muted/30 rounded-lg p-4 mt-4 text-muted-foreground text-sm space-y-1">
              <p><strong>Office of the Data Protection Commissioner</strong></p>
              <p>Immaculate Conception Catholic Church Grounds, Upper Hill</p>
              <p>P.O. Box 7943-5200, Nairobi, Kenya</p>
              <p>Email: <a href="mailto:complaints@odpc.go.ke" className="text-primary hover:underline">complaints@odpc.go.ke</a></p>
              <p>Website: <a href="https://www.odpc.go.ke" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.odpc.go.ke</a></p>
            </div>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We encourage you to contact us first at <a href="mailto:dpo@ynai.co.ke" className="text-primary hover:underline">dpo@ynai.co.ke</a> so we can attempt to resolve your concern directly.
            </p>
          </section>

          {/* ── 15. Changes ── */}
          <section>
            <h2 className="text-xl font-semibold mb-4">15. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. Material changes will be communicated via email and an in-app notification at least <strong>14 days</strong> before they take effect. The &ldquo;Last updated&rdquo; date at the top of this page reflects the most recent revision. Continued use of the platform after the effective date constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* ── 16. Contact ── */}
          <section>
            <h2 className="text-xl font-semibold mb-4">16. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              For general privacy inquiries:
            </p>
            <div className="bg-muted/30 rounded-lg p-4 mt-4 text-muted-foreground text-sm space-y-1">
              <p><strong>Privacy Team:</strong> <a href="mailto:privacy@ynai.co.ke" className="text-primary hover:underline">privacy@ynai.co.ke</a></p>
              <p><strong>Data Protection Officer:</strong> <a href="mailto:dpo@ynai.co.ke" className="text-primary hover:underline">dpo@ynai.co.ke</a></p>
              <p><strong>Legal:</strong> <a href="mailto:legal@ynai.co.ke" className="text-primary hover:underline">legal@ynai.co.ke</a></p>
            </div>
          </section>

          {/* ── Governing Law ── */}
          <section>
            <p className="text-muted-foreground leading-relaxed text-sm mt-8 border-t border-border/50 pt-6">
              This Privacy Policy is governed by and construed in accordance with the laws of the Republic of Kenya, including the Data Protection Act, 2019. Any disputes arising from this policy shall be subject to the exclusive jurisdiction of the courts of Kenya.
            </p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Ynai. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
