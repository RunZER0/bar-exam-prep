'use client';

import Link from 'next/link';
import { Scale, ArrowLeft, AlertTriangle } from 'lucide-react';

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <Scale className="h-5 w-5 text-emerald-500" />
            </div>
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
        <h1 className="text-3xl font-bold mb-2">Disclaimer</h1>
        <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

        {/* Important Notice Box */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-amber-600 dark:text-amber-400 mb-2">Important Notice</h2>
              <p className="text-muted-foreground leading-relaxed">
                Ynai is an educational platform designed to assist with bar exam preparation. Our platform does not provide legal advice, and content should not be construed as such.
              </p>
            </div>
          </div>
        </div>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">Educational Purpose Only</h2>
            <p className="text-muted-foreground leading-relaxed">
              All content provided on Ynai, including study materials, practice questions, AI-generated explanations, and legal drafting exercises, is strictly for educational purposes. This content is designed to help Kenya School of Law students prepare for bar examinations and should be used as a supplement to your formal legal education.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Not Legal Advice</h2>
            <p className="text-muted-foreground leading-relaxed">
              Nothing on this platform constitutes legal advice. The information provided:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
              <li>Should not be relied upon for actual legal matters</li>
              <li>Does not create an attorney-client relationship</li>
              <li>May not reflect the most current legal developments</li>
              <li>Should be independently verified before application</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              For legal advice, please consult a qualified, licensed advocate in Kenya.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">AI-Generated Content Disclaimer</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our platform utilizes artificial intelligence to provide explanations, tutoring, and study assistance. Please be aware that:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
              <li>AI-generated content may contain inaccuracies or errors</li>
              <li>AI responses should be cross-referenced with authoritative legal sources</li>
              <li>The AI is designed to assist learning, not replace legal education</li>
              <li>Complex legal issues require human judgment and expertise</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">No Guarantee of Results</h2>
            <p className="text-muted-foreground leading-relaxed">
              While we strive to provide high-quality study materials and preparation tools, we cannot and do not guarantee:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
              <li>That you will pass the bar examination</li>
              <li>Any specific exam score or outcome</li>
              <li>That our content covers all possible exam topics</li>
              <li>That practice questions will appear on actual exams</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Success in the bar examination depends on many factors including individual effort, understanding of the material, exam preparation strategy, and performance on exam day.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Content Accuracy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We make reasonable efforts to ensure our content is accurate and up-to-date. However:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
              <li>Laws and regulations may change after content is published</li>
              <li>There may be inadvertent errors or omissions</li>
              <li>Court decisions may alter legal interpretations</li>
              <li>Content may not cover every jurisdiction-specific variation</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Always verify information with current statutes, cases, and official Kenya School of Law materials.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Third-Party Content and Links</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our platform may contain links to external websites or reference third-party materials. We are not responsible for the accuracy, legality, or content of external sites. Links do not imply endorsement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">User Responsibility</h2>
            <p className="text-muted-foreground leading-relaxed">
              You acknowledge that:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
              <li>You are responsible for your own learning and exam preparation</li>
              <li>Our platform is one of many tools available for preparation</li>
              <li>You should use multiple study resources and methods</li>
              <li>You accept the risks inherent in using educational technology</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the fullest extent permitted by law, Ynai, its founders, employees, and affiliates shall not be liable for any direct, indirect, incidental, special, or consequential damages arising from your use of this platform, including but not limited to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
              <li>Exam results or outcomes</li>
              <li>Reliance on platform content</li>
              <li>Loss of study time or data</li>
              <li>Any decisions made based on platform content</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this disclaimer or our content, please contact us at:
            </p>
            <p className="text-muted-foreground mt-4">
              <strong>Email:</strong> support@ynai.co.ke
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
