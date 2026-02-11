'use client';

import Link from 'next/link';
import { Scale, ArrowLeft, ChevronDown, Users, Target, Heart, Zap, BookOpen, Brain } from 'lucide-react';
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
    answer: "Ynai was created by KSL graduates who understand the journey intimately. We're advocates who've walked the same path, felt the same anxiety, and wished for a better way to prepare. Our team combines legal expertise with technology to create something we wished existed when we were students. We're not a distant corporation – we're your seniors in the profession who genuinely want to see you succeed."
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

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl font-bold mb-6">
          Built by KSL Graduates, <br />
          <span className="text-emerald-500">For KSL Students</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          We know the sleepless nights. The uncertainty. The weight of expectations. 
          Ynai exists because we believe no student should face the bar exam alone, 
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
              It started with frustration. As KSL students, we had brilliant lecturers, dedicated classmates, and burning ambition. But when it came to actually preparing for the bar exam – the one test that would determine our careers – we felt lost.
            </p>
            <p>
              Where do you focus when everything seems important? How do you know if you're actually ready? What do you do at 2 AM when a concept just won't click and there's no one to ask?
            </p>
            <p>
              We scraped through, some of us barely. But we never forgot that feeling of uncertainty, that wish for something better. Years later, with careers established and technology advanced enough to make our vision possible, we built what we wished we had.
            </p>
            <p className="font-medium text-foreground">
              Ynai isn't just an app. It's our answer to a question every KSL student asks: "Am I truly prepared?" Now you can be.
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
