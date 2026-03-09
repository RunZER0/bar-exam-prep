/**
 * ═══════════════════════════════════════════════════════════════
 * AI Email Agent — Dynamic, Context-Aware Email Generation
 * ═══════════════════════════════════════════════════════════════
 *
 * Replaces static templates with an AI agent that writes every email.
 * Uses gpt-5.2-mini (floor model) to generate personalized copy,
 * then wraps it in the branded base template for visual consistency.
 *
 * Every email is unique, contextual, and deeply personalized.
 */

import OpenAI from 'openai';
import { MINI_MODEL, getOpenAIKey } from '@/lib/ai/model-config';
import { wrapInBaseTemplate } from './email-templates';

// ── Types ──

export type EmailEvent =
  | 'WELCOME'
  | 'DAILY_REMINDER'
  | 'MISSED_DAY'
  | 'SESSION_READY'
  | 'EXAM_COUNTDOWN'
  | 'WEEKLY_REPORT'
  | 'FUN_FACT'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'TIER_UPGRADED'
  | 'TRIAL_EXPIRING'
  | 'ADDON_PURCHASED'
  | 'PAYMENT_RECEIPT'
  | 'MASTERY_MILESTONE'
  | 'STREAK_MILESTONE';

export interface EmailContext {
  event: EmailEvent;
  userName: string;
  data: Record<string, any>;
}

export interface GeneratedEmail {
  subject: string;
  preheader: string;
  html: string;
}

// ── Brand constants for AI to reference ──

const BRAND = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldLight: '#d1fae5',
  emeraldBg: '#ecfdf5',
  dark: '#111827',
  text: '#1f2937',
  muted: '#6b7280',
  white: '#ffffff',
  gold: '#f59e0b',
  red: '#ef4444',
  border: '#e5e7eb',
  light: '#f9fafb',
} as const;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ynai.co.ke';

// ── System Prompt ──

const SYSTEM_PROMPT = `You are the email copywriter for Ynai (ynai.co.ke) — an AI-powered Kenya Bar Exam preparation platform for KSL (Kenya School of Law) students.

YOUR JOB: Write the inner HTML body for transactional/engagement emails. You'll receive context about what happened, and you craft a warm, motivating, personalized email.

TONE:
- Warm, professional, encouraging — like a supportive senior advocate writing to a pupil
- Concise — 3-6 short paragraphs max, never rambling
- Use the student's first name naturally
- Occasional Swahili phrases where natural (Karibu, Hongera, Kila la heri, Tuko pamoja)
- Reference Kenyan legal context when relevant (ATP units, KSL, CLE exams, Kenyan cases/statutes)
- Sign off as "— The Ynai Team"
- Use emoji sparingly but effectively (1-3 per email, in headings)

PLATFORM CONTEXT:
- Ynai covers 9 ATP units for the Kenya Bar Exam
- Mastery Hub has 4 phases: Note → Exhibit → Diagnosis → Mastery
- 297 syllabus nodes across 9 units (ATP100-ATP108)
- Features: Mastery Hub, Oral Exams, Legal Drafting, Quizzes, Study Notes, Legal Research, AI Tutor
- Tiers: Light, Standard, Premium (weekly/monthly/annual billing)
- Payments via Paystack (M-Pesa + card)
- Consistency beats cramming — reinforce this message

HTML OUTPUT RULES:
Return valid JSON with exactly these fields:
{
  "subject": "email subject line (include 1 emoji, be specific not generic)",
  "preheader": "short preview text for email clients (max 90 chars)",
  "bodyHtml": "the inner HTML content"
}

For bodyHtml, you have these inline-styled HTML building blocks available:

1. HEADING (use exactly once at the top):
<h1 style="margin: 0 0 8px; font-size: 22px; color: ${BRAND.text};">Greeting text</h1>

2. PARAGRAPH:
<p style="color: ${BRAND.muted}; margin: 0 0 16px; font-size: 15px; line-height: 1.6;">Text here</p>

3. CTA BUTTON (use 1-2 per email):
<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;"><tr><td style="border-radius: 8px; background: ${BRAND.emerald};"><a href="URL_HERE" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: ${BRAND.white}; text-decoration: none; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Button Label →</a></td></tr></table>

4. HIGHLIGHT BOX (for key info — amounts, plans, streaks, milestones):
<div style="background: ${BRAND.emeraldBg}; border-radius: 12px; padding: 20px; margin: 16px 0; border: 1px solid ${BRAND.emeraldLight};">content</div>

5. STAT (big number display):
<div style="text-align: center; margin: 16px 0;">
  <div style="font-size: 48px; font-weight: 800; color: ${BRAND.emeraldDark}; line-height: 1;">VALUE</div>
  <div style="font-size: 14px; color: ${BRAND.muted}; margin-top: 4px;">label</div>
</div>

6. INFO CARD (tips, notes, warnings):
<div style="background: ${BRAND.light}; border-left: 4px solid ${BRAND.emerald}; padding: 16px 20px; border-radius: 0 10px 10px 0; margin: 16px 0;">
  <div style="font-weight: 600; color: ${BRAND.text}; margin-bottom: 6px;">Title</div>
  <div style="color: ${BRAND.muted}; font-size: 14px; line-height: 1.6;">Body text</div>
</div>

7. RECEIPT TABLE (for payment-related emails):
<div style="background: ${BRAND.light}; border-radius: 12px; padding: 24px; margin: 16px 0; border: 1px solid ${BRAND.border};">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr><td style="padding: 8px 0; font-size: 14px; color: ${BRAND.muted}; border-bottom: 1px solid ${BRAND.border};">Label</td><td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: ${BRAND.text}; text-align: right; border-bottom: 1px solid ${BRAND.border};">Value</td></tr>
    <!-- more rows -->
    <tr><td style="padding: 12px 0; font-size: 16px; font-weight: 700; color: ${BRAND.text};">Total</td><td style="padding: 12px 0; font-size: 18px; font-weight: 700; color: ${BRAND.emeraldDark}; text-align: right;">KES amount</td></tr>
  </table>
</div>

8. WARNING BOX (urgent/time-sensitive):
<div style="background: #fef2f2; border-radius: 12px; padding: 20px; margin: 16px 0; border: 1px solid #fecaca;">content</div>

9. GRADIENT BANNER (for celebrations/milestones):
<div style="background: linear-gradient(135deg, ${BRAND.emerald}, #0d9488); border-radius: 12px; padding: 28px; margin: 16px 0; text-align: center; color: white;">content</div>

10. DIVIDER:
<hr style="border: none; border-top: 1px solid ${BRAND.border}; margin: 24px 0;">

IMPORTANT:
- Use the building blocks above with their EXACT inline styles — email clients strip <style> tags
- All links must use target="_blank"
- No <img> tags (images don't render reliably in email clients)
- Use HTML entities for special chars if needed
- For amounts: always show "KES X,XXX" format
- For dates: use "March 15, 2026" format, not ISO
- Make content specific to the context data provided — NEVER use placeholder/generic text
- Every data point I give you must appear in the email — don't omit facts`;

// ── Event-specific prompt builders ──

function buildUserPrompt(ctx: EmailContext): string {
  const d = ctx.data;
  const baseUrl = d.dashboardUrl || `${APP_URL}/dashboard`;

  switch (ctx.event) {
    case 'WELCOME':
      return `EVENT: New user just signed up.
USER: ${ctx.userName}
CONTEXT:
- They get a 3-day free trial
- Trial includes: Unlimited Mastery Hub, AI Study Notes, 2 Oral Exam sessions, 3 Legal Drafting docs, Quizzes & Progress tracking
- CTA button should link to: ${baseUrl}
- Make them feel excited to start their bar exam prep journey
- Mention the mastery system's 4 phases briefly`;

    case 'DAILY_REMINDER':
      return `EVENT: Daily study reminder — their session for today is ready.
USER: ${ctx.userName}
CONTEXT:
- Today's unit: ${d.unitName}
- Today's topic: ${d.sessionTopic}
- Estimated session time: ~${d.estimatedMinutes || 25} minutes
- ${d.progressSection ? `Progress info: ${d.progressSection}` : 'No progress data available'}
- CTA button should link to: ${d.sessionUrl || baseUrl}
- Keep it short and action-oriented — they should feel pulled to start studying`;

    case 'MISSED_DAY':
      return `EVENT: User missed their study session yesterday.
USER: ${ctx.userName}
CONTEXT:
- Last topic they were working on: ${d.lastTopic || 'their previous topic'}
- Their current streak: ${d.currentStreak || 0} days
- Their overall mastery: ${d.masteryPercent || 0}%
- CTA button should link to: ${d.comebackUrl || baseUrl}
- Tone: empathetic, not guilt-tripping. Suggest a quick 15-minute comeback session
- Include a simple 3-step comeback plan`;

    case 'SESSION_READY':
      return `EVENT: A new study session has been prepared and is waiting.
USER: ${ctx.userName}
CONTEXT:
- Session topic: ${d.sessionTopic || 'Next topic'}
- Skills to be covered: ${d.skillsList || 'Various skills'}
- CTA button should link to: ${d.sessionUrl || baseUrl}
- Keep it brief and exciting — their session is literally waiting`;

    case 'EXAM_COUNTDOWN':
      return `EVENT: Exam countdown alert.
USER: ${ctx.userName}
CONTEXT:
- Days until exam: ${d.daysRemaining}
- Their overall mastery: ${d.masteryPercent || 0}%
- Focus areas this week: ${d.focusAreas || 'Continue current study plan'}
- CTA button should link to: ${d.dashboardUrl || baseUrl}
- Use a big stat display for the days remaining
- Tone depends on urgency: >30 days = encouraging, 15-30 = focused, <15 = urgent but supportive`;

    case 'WEEKLY_REPORT':
      return `EVENT: Weekly progress report.
USER: ${ctx.userName}
CONTEXT:
- Report period: ${d.weekRange}
- Topics completed this week: ${d.topicsCompleted}
- Total nodes mastered: ${d.nodesMastered}
- Overall mastery: ${d.masteryPercent}%
- Study streak: ${d.streakDays} days
- ${d.weakAreasSection ? `Weak areas note: ${d.weakAreasSection}` : ''}
- Next week's focus: ${d.nextWeekFocus || 'Continue study plan'}
- CTA button should link to: ${d.dashboardUrl || baseUrl}
- Use stat displays for the key numbers
- Include a mastery progress bar visualization`;

    case 'FUN_FACT':
      return `EVENT: Fun Kenyan law fact email (light engagement).
USER: ${ctx.userName}
CONTEXT:
- Fact title: ${d.factTitle}
- Fact body: ${d.factBody}
- Source: ${d.factSource || 'Not specified'}
- CTA button should link to: ${d.dashboardUrl || baseUrl} with label "Continue Studying →"
- Wrap the fun fact in a visually appealing highlight box
- Keep the surrounding copy minimal — let the fact shine`;

    case 'SUBSCRIPTION_ACTIVATED':
      return `EVENT: User just subscribed (new paying customer!).
USER: ${ctx.userName}
CONTEXT:
- Plan: ${d.tierName}
- Billing period: ${d.billingPeriod}
- Amount paid: KES ${d.amount}
- Next renewal: ${d.nextRenewal || 'N/A'}
- Features included: ${d.features || 'Full access'}
- CTA button should link to: ${d.dashboardUrl || baseUrl}
- This is a celebration moment — make them feel great about their investment
- Show plan details in a clean table/card`;

    case 'TIER_UPGRADED':
      return `EVENT: User upgraded their subscription tier.
USER: ${ctx.userName}
CONTEXT:
- Previous plan: ${d.previousTier}
- New plan: ${d.tierName}
- New benefits unlocked: ${d.newBenefits || 'Enhanced limits and features'}
- CTA button should link to: ${d.dashboardUrl || baseUrl}
- Celebrate the upgrade, highlight what's new`;

    case 'TRIAL_EXPIRING':
      return `EVENT: User's free trial expires tomorrow.
USER: ${ctx.userName}
CONTEXT:
- Trial expiry date: ${d.expiryDate}
- Their progress so far: ${d.progressSummary || 'No data'}
- Subscribe link: ${d.subscribeUrl || `${APP_URL}/subscribe`}
- Plans start from KES 500/week
- Tone: urgency without pressure. Emphasize what they'll lose (progress, streak, AI access)
- Use a warning box for the expiry notice
- CTA button should link to the subscribe page`;

    case 'ADDON_PURCHASED':
      return `EVENT: User purchased add-on passes.
USER: ${ctx.userName}
CONTEXT:
- Feature: ${d.featureName}
- Passes added: +${d.quantity}
- Amount paid: KES ${d.amount}
- Payment reference: ${d.reference}
- CTA button should link to: ${d.dashboardUrl || baseUrl}
- Brief confirmation — show details in a clean card`;

    case 'PAYMENT_RECEIPT':
      return `EVENT: Payment receipt/confirmation.
USER: ${ctx.userName}
CONTEXT:
- Amount: KES ${d.amount}
- Description: ${d.description}
- Payment method: ${d.channel || 'M-Pesa'}
- Reference: ${d.reference}
- Date: ${d.date}
- This is a formal receipt — use the receipt table format
- Keep surrounding copy minimal and professional
- Mention this is their official payment receipt to keep for records`;

    case 'MASTERY_MILESTONE':
      return `EVENT: User fully mastered a topic (completed all 4 phases)!
USER: ${ctx.userName}
CONTEXT:
- Topic mastered: ${d.topicName}
- Unit: ${d.unitName}
- Total mastered: ${d.masteredCount} out of ${d.totalCount} topics
- Overall mastery: ${d.masteryPercent}%
- Next topic: ${d.nextTopicName || 'Check your dashboard'}
- CTA button should link to: ${d.dashboardUrl || baseUrl}
- This is a BIG celebration — use the gradient banner
- Show progress stats (mastered/total)`;

    case 'STREAK_MILESTONE':
      return `EVENT: User hit a study streak milestone!
USER: ${ctx.userName}
CONTEXT:
- Streak: ${d.streakDays} consecutive study days
- Milestone message: ${d.streakMessage}
- CTA button should link to: ${d.dashboardUrl || baseUrl}
- Use a big stat display for the streak number
- Make them feel like a champion — this is hard-earned discipline`;

    default:
      return `EVENT: ${ctx.event}
USER: ${ctx.userName}
CONTEXT: ${JSON.stringify(d)}
CTA button should link to: ${baseUrl}`;
  }
}

// ── Fallback subjects if AI fails ──

const FALLBACK_SUBJECTS: Record<EmailEvent, string> = {
  WELCOME: `Welcome to Ynai, {{userName}}! 🎓`,
  DAILY_REMINDER: `📚 Your study session is ready`,
  MISSED_DAY: `We missed you! Here's a quick comeback plan 🎯`,
  SESSION_READY: `Your next session is ready ✨`,
  EXAM_COUNTDOWN: `📆 Exam countdown update`,
  WEEKLY_REPORT: `📊 Your weekly progress report`,
  FUN_FACT: `⚖️ Did you know? A fun Kenyan law fact`,
  SUBSCRIPTION_ACTIVATED: `🎉 Your subscription is active!`,
  TIER_UPGRADED: `🚀 Upgrade complete!`,
  TRIAL_EXPIRING: `⏰ Your free trial ends tomorrow`,
  ADDON_PURCHASED: `✅ Add-on passes confirmed`,
  PAYMENT_RECEIPT: `✅ Payment confirmed`,
  MASTERY_MILESTONE: `🏆 You mastered a topic!`,
  STREAK_MILESTONE: `🔥 Streak milestone reached!`,
};

// ── Main Agent Function ──

/**
 * Generate a fully personalized email using the AI agent.
 * Falls back to a minimal but clean email if the AI call fails.
 */
export async function generateEmail(ctx: EmailContext): Promise<GeneratedEmail> {
  try {
    const apiKey = getOpenAIKey();
    if (!apiKey) {
      console.warn('[email-agent] No OpenAI API key — using fallback');
      return buildFallbackEmail(ctx);
    }

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: MINI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(ctx) },
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      console.warn('[email-agent] Empty AI response — using fallback');
      return buildFallbackEmail(ctx);
    }

    const parsed = JSON.parse(raw) as {
      subject?: string;
      preheader?: string;
      bodyHtml?: string;
    };

    if (!parsed.bodyHtml) {
      console.warn('[email-agent] AI returned no bodyHtml — using fallback');
      return buildFallbackEmail(ctx);
    }

    return {
      subject: parsed.subject || FALLBACK_SUBJECTS[ctx.event].replace('{{userName}}', ctx.userName),
      preheader: parsed.preheader || '',
      html: wrapInBaseTemplate(parsed.bodyHtml, parsed.preheader || ''),
    };
  } catch (err) {
    console.error('[email-agent] AI generation failed:', err);
    return buildFallbackEmail(ctx);
  }
}

// ── Fallback (if AI is down) ──

function buildFallbackEmail(ctx: EmailContext): GeneratedEmail {
  const d = ctx.data;
  const baseUrl = d.dashboardUrl || d.sessionUrl || d.subscribeUrl || `${APP_URL}/dashboard`;
  const subject = FALLBACK_SUBJECTS[ctx.event].replace('{{userName}}', ctx.userName);

  // Build a simple but clean fallback body
  const bodyHtml = `
    <h1 style="margin: 0 0 8px; font-size: 22px; color: ${BRAND.text};">
      Hi ${ctx.userName} 👋
    </h1>
    <p style="color: ${BRAND.muted}; margin: 0 0 16px; font-size: 15px; line-height: 1.6;">
      ${getFallbackMessage(ctx)}
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="border-radius: 8px; background: ${BRAND.emerald};">
          <a href="${baseUrl}" target="_blank"
             style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600;
                    color: ${BRAND.white}; text-decoration: none; border-radius: 8px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            Go to Ynai →
          </a>
        </td>
      </tr>
    </table>
    <p style="color: ${BRAND.muted}; font-size: 14px; margin: 20px 0 0;">
      Kila la heri,<br>
      <strong style="color: ${BRAND.text};">— The Ynai Team</strong>
    </p>`;

  return {
    subject,
    preheader: subject,
    html: wrapInBaseTemplate(bodyHtml, subject),
  };
}

function getFallbackMessage(ctx: EmailContext): string {
  const d = ctx.data;
  switch (ctx.event) {
    case 'WELCOME':
      return 'Welcome to Ynai — your AI-powered companion for the Kenya Bar Exam. Your 3-day free trial is active. Jump in and start mastering your first topic!';
    case 'DAILY_REMINDER':
      return `Your study session on <strong>${d.sessionTopic || 'your next topic'}</strong> is ready. Consistency beats cramming — even 20 minutes today moves the needle.`;
    case 'MISSED_DAY':
      return 'We noticed you missed your session yesterday — no worries! A quick 15-minute comeback session is all it takes to stay on track.';
    case 'SESSION_READY':
      return `Great news — your next study session on <strong>${d.sessionTopic || 'your upcoming topic'}</strong> is ready to go!`;
    case 'EXAM_COUNTDOWN':
      return `<strong>${d.daysRemaining || '?'}</strong> days until your exam. Your overall mastery is at <strong>${d.masteryPercent || 0}%</strong>. Keep pushing!`;
    case 'WEEKLY_REPORT':
      return `This week you completed <strong>${d.topicsCompleted || 0}</strong> topics and your overall mastery is at <strong>${d.masteryPercent || 0}%</strong>. Keep going!`;
    case 'FUN_FACT':
      return `<strong>${d.factTitle || 'Fun fact'}</strong> — ${d.factBody || 'Check out this interesting legal tidbit.'}`;
    case 'SUBSCRIPTION_ACTIVATED':
      return `Your <strong>${d.tierName || ''}</strong> plan is now active! Amount: <strong>KES ${d.amount || ''}</strong>. All your features are unlocked.`;
    case 'TIER_UPGRADED':
      return `You've been upgraded from <strong>${d.previousTier || ''}</strong> to <strong>${d.tierName || ''}</strong>. Enjoy your new benefits!`;
    case 'TRIAL_EXPIRING':
      return `Your free trial ends <strong>tomorrow</strong>. Subscribe now to keep your progress, streak, and full AI access. Plans start from KES 500/week.`;
    case 'ADDON_PURCHASED':
      return `<strong>+${d.quantity || ''}</strong> ${d.featureName || ''} passes added to your account. Amount: <strong>KES ${d.amount || ''}</strong>.`;
    case 'PAYMENT_RECEIPT':
      return `Payment of <strong>KES ${d.amount || ''}</strong> confirmed. Reference: <code>${d.reference || ''}</code>. This is your official receipt.`;
    case 'MASTERY_MILESTONE':
      return `You've fully mastered <strong>${d.topicName || 'a topic'}</strong>! That's <strong>${d.masteredCount || '?'}/${d.totalCount || '?'}</strong> topics complete.`;
    case 'STREAK_MILESTONE':
      return `<strong>${d.streakDays || '?'}-day streak!</strong> ${d.streakMessage || 'Incredible consistency. Keep it going!'}`;
    default:
      return 'You have an update on Ynai. Check your dashboard for details.';
  }
}
