'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ChevronDown, Users, Target, Heart, Zap, BookOpen, Brain } from 'lucide-react';
import { useState } from 'react';

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
}

function FAQItem({ question, answer, isOpen, onClick }: FAQItemProps) {
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="font-medium pr-4">{question}</span>
        <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
        <div className="px-5 pb-5 text-muted-foreground leading-relaxed">
          {answer}
        </div>
      </div>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    question: "Why did we build Ynai?",
    answer: "We built Ynai because we saw firsthand the struggles KSL students face. The endless nights questioning if you're studying the right topics, the anxiety of not knowing if you're truly prepared, the overwhelm of trying to master vast amounts of legal content with limited resources. We experienced the fear of failure, the pressure of expectations, and the frustration of outdated study methods. Ynai was born from a simple belief: every KSL student deserves access to intelligent, personalized preparation that actually works."
  },
  {
    question: "Who is behind Ynai?",
    answer: "Ynai was created by a current KSL student who is going through the exact same journey you are. Not a distant corporation, not a group of former students looking back - someone who is right now preparing for the bar exam alongside you. The platform combines firsthand understanding of what you're facing with AI technology to create something that genuinely works. Think of it as a fellow student who happens to be really good with technology, building the tools we all wish we had."
  },
  {
    question: "How is Ynai different from traditional study methods?",
    answer: "Traditional methods leave you guessing. Did you cover everything? Are you focusing on the right areas? Ynai uses AI to adapt to YOUR learning patterns. It identifies your weak spots, reinforces your strengths, and provides instant clarification when you're stuck. It's like having a tutor available 24/7 who knows exactly what you need to work on – without the judgment or the scheduling hassles."
  },
  {
    question: "Will Ynai really help me pass the bar?",
    answer: "While we can't guarantee results (no one honestly can), Ynai is designed based on what actually works. Spaced repetition, active recall, practice under exam conditions, and understanding concepts deeply rather than surface-level memorization. Our students report feeling more confident, more prepared, and less anxious going into exams. We give you the tools – your effort plus our platform creates the results."
  },
  {
    question: "What makes your questions and content reliable?",
    answer: "Our content is developed by practising advocates and reviewed by legal educators. We stay updated with changes in Kenyan law and bar exam formats. Our AI is fine-tuned specifically for Kenyan legal context – it's not generic legal content from other jurisdictions. Every explanation, every question, every practice scenario is crafted with the Kenya bar exam in mind."
  },
  {
    question: "I'm struggling and feeling overwhelmed. Can Ynai help?",
    answer: "Absolutely. Ynai was built specifically for students who feel overwhelmed. Our platform breaks down complex topics into digestible pieces, tracks your progress so you can see how far you've come, and provides encouragement along the way. You're not alone in this journey. The very fact that you're seeking resources shows your determination – and Ynai is here to channel that determination into results."
  },
  {
    question: "How does the AI tutoring work?",
    answer: "Our AI understands Kenyan law deeply. You can ask it to explain any concept, clarify confusing topics, or help you understand how laws apply in practical scenarios. It's not about getting answers to cheat – it's about genuine understanding. The AI adapts its explanations to your level, offers multiple perspectives, and helps you think like a lawyer rather than just memorize like a student."
  },
  {
    question: "Is my data and progress secure?",
    answer: "Your privacy and data security are paramount. We use industry-standard encryption, and your study data is never shared with third parties. Your progress, your struggles, your scores – they're yours alone. We only use anonymized, aggregate data to improve our platform for all students."
  }
];

const VALUES = [
  {
    icon: Heart,
    title: "Empathy First",
    description: "We remember the stress and uncertainty. Every feature is built with your emotional wellbeing in mind."
  },
  {
    icon: Target,
    title: "Focused Results",
    description: "No fluff, no distractions. Everything on Ynai is designed to move you closer to passing the bar."
  },
  {
    icon: Brain,
    title: "Smart Learning",
    description: "Evidence-based learning techniques powered by AI that adapts to how YOU learn best."
  },
  {
    icon: Zap,
    title: "Accessible Excellence",
    description: "Premium preparation shouldn't only be for the privileged. We're making quality affordable for every student."
  }
];

export default function AboutPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

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

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl font-bold mb-6">
          Built by a KSL Student, <br />
          <span className="text-emerald-500">For KSL Students</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          I know the sleepless nights. The uncertainty. The weight of expectations.
          Ynai exists because I believe no student should face the bar exam alone,
          unprepared, or overwhelmed.
        </p>
      </section>

      {/* Story Section */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-2xl p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <BookOpen className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-1">Our Story</h2>
              <p className="text-muted-foreground text-sm">The journey that led to Ynai</p>
            </div>
          </div>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              There&apos;s a moment every KSL student knows. It&apos;s 2 AM. You&apos;re staring at the same provision you&apos;ve read four times. Your highlighter is running dry, your eyes are burning, and somewhere deep in your chest there&apos;s a tight knot of dread that whispers: <em>&quot;What if I&apos;m not doing enough?&quot;</em>
            </p>
            <p>
              That moment happened to me. Not years ago — it happened last week. I&apos;m a current KSL student. Right now. I sit in the same lectures you sit in. I stress over the same revision timetables. I feel the same weight of a 50% failure rate pressing down on my shoulders every single day. I haven&apos;t crossed the finish line yet — I&apos;m running the same race you are.
            </p>
            <p>
              When the 2025 bar results came out, they hit close to home. Seniors I admired, people who studied harder than anyone I knew, didn&apos;t make it. Not because they weren&apos;t brilliant — they were. But brilliance alone isn&apos;t enough when the system gives you mountains of content, minimal feedback, and no way to know if you&apos;re actually ready until the day your results drop and it&apos;s too late.
            </p>
            <p>
              That broke something in me. Not my spirit — my patience. I refused to accept that the only strategy was &quot;read more, sleep less, hope for the best.&quot; There had to be a way to study smarter. To know <em>exactly</em> what you don&apos;t know. To practice drafting at midnight and get real feedback. To have someone — or something — that never sleeps, never judges, and always knows the right provision to point you to.
            </p>
            <p>
              So I built Ynai. Not from a corner office after graduating. Not with a team of 50. From my own study desk, between revision sessions, fuelled by the same instant coffee you&apos;re probably drinking right now. Every single feature exists because I needed it first. The mastery engine that tracks your weak spots? I built it because I was tired of guessing mine. The AI tutor that explains concepts at 3 AM? I built it because no lecturer picks up at that hour. The community? Because the loneliest exam in Kenya shouldn&apos;t be faced alone.
            </p>
            <p className="font-medium text-foreground italic">
              I&apos;m not a founder looking down from the other side. I&apos;m a fellow student reaching out my hand from the same trench. Ynai is our tool, our edge, our refusal to accept that half of us have to fail. We&apos;re going to change that number — together.
            </p>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-center mb-8">What We Stand For</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {VALUES.map((value, index) => (
            <div key={index} className="bg-card border border-border/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <value.icon className="h-5 w-5 text-emerald-500" />
                </div>
                <h3 className="font-semibold">{value.title}</h3>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{value.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-center mb-2">Frequently Asked Questions</h2>
        <p className="text-muted-foreground text-center mb-8">Everything you need to know about Ynai</p>
        
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, index) => (
            <FAQItem
              key={index}
              question={item.question}
              answer={item.answer}
              isOpen={openIndex === index}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to Start Your Journey?</h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          Join thousands of KSL students who are preparing smarter, not just harder. 
          Your bar exam success story starts here.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-6 py-3 rounded-xl transition-colors"
        >
          Get Started Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Ynai. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
