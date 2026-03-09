/**
 * ═══════════════════════════════════════════════════════════════
 * Ynai Email Template System — Beautiful, Branded, Responsive
 * ═══════════════════════════════════════════════════════════════
 *
 * All emails use a consistent base layout with:
 * • Emerald green (#10b981) brand color
 * • Ynai logo header
 * • Mobile-responsive HTML tables
 * • Dark mode media query hints
 * • Rich typography and spacing
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ynai.co.ke';
const LOGO_URL = `${APP_URL}/icons/android-chrome-192x192.png`;

// ── Brand Palette ──
const C = {
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldLight: '#d1fae5',
  emeraldBg: '#ecfdf5',
  dark: '#111827',
  text: '#1f2937',
  muted: '#6b7280',
  light: '#f9fafb',
  border: '#e5e7eb',
  white: '#ffffff',
  gold: '#f59e0b',
  red: '#ef4444',
  blue: '#3b82f6',
} as const;

// ── Reusable Components ──

function ctaButton(label: string, url: string, color = C.emerald): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="border-radius: 8px; background: ${color};">
          <a href="${url}" target="_blank"
             style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600;
                    color: ${C.white}; text-decoration: none; border-radius: 8px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

function statBox(label: string, value: string, icon: string): string {
  return `
    <td style="padding: 8px; width: 50%;">
      <div style="background: ${C.emeraldBg}; border-radius: 10px; padding: 16px; text-align: center;">
        <div style="font-size: 24px; margin-bottom: 4px;">${icon}</div>
        <div style="font-size: 22px; font-weight: 700; color: ${C.emeraldDark};">${value}</div>
        <div style="font-size: 12px; color: ${C.muted}; margin-top: 2px;">${label}</div>
      </div>
    </td>`;
}

function infoCard(title: string, body: string, borderColor = C.emerald): string {
  return `
    <div style="background: ${C.light}; border-left: 4px solid ${borderColor}; padding: 16px 20px;
                border-radius: 0 10px 10px 0; margin: 20px 0;">
      <div style="font-weight: 600; color: ${C.text}; margin-bottom: 6px;">${title}</div>
      <div style="color: ${C.muted}; font-size: 14px; line-height: 1.6;">${body}</div>
    </div>`;
}

function divider(): string {
  return `<hr style="border: none; border-top: 1px solid ${C.border}; margin: 24px 0;">`;
}

// ── Base Template Wrapper ──

export function wrapInBaseTemplate(content: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Ynai</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; padding: 0 16px !important; }
      .stats-table td { display: block !important; width: 100% !important; padding: 6px 0 !important; }
    }
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: #0f172a !important; }
      .email-card { background-color: #1e293b !important; }
      .email-text { color: #e2e8f0 !important; }
      .email-heading { color: #f1f5f9 !important; }
      .email-muted { color: #94a3b8 !important; }
      .email-footer { border-color: #334155 !important; }
      .email-info-card { background-color: #1e3a2e !important; }
      .email-stat-box { background-color: #1e3a2e !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  ${preheader ? `<div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-body" style="background-color: #f1f5f9; padding: 32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="email-container" style="max-width: 600px; width: 100%;">

          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding: 0 0 24px;">
              <a href="${APP_URL}" target="_blank" style="text-decoration: none;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align: middle; padding-right: 10px;">
                      <img src="${LOGO_URL}" alt="Ynai" width="36" height="36" style="display: block; border-radius: 8px;">
                    </td>
                    <td style="vertical-align: middle;">
                      <span style="font-size: 22px; font-weight: 700; color: ${C.emerald}; letter-spacing: -0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Ynai</span>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-card"
                     style="background: ${C.white}; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                
                <!-- Emerald accent line -->
                <tr>
                  <td style="height: 4px; background: linear-gradient(90deg, ${C.emerald}, #14b8a6, ${C.emeraldDark});"></td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 36px 32px 28px;" class="email-text">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 16px 0; text-align: center;" class="email-footer">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <a href="${APP_URL}" target="_blank" style="text-decoration: none;">
                      <span style="font-size: 14px; font-weight: 600; color: ${C.emerald};">⚖️ Ynai</span>
                      <span style="font-size: 13px; color: ${C.muted};"> — Kenya Bar Exam Prep</span>
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size: 12px; color: ${C.muted}; line-height: 1.6; padding-bottom: 8px;">
                    AI-powered study platform for Kenya School of Law students
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size: 11px; color: #9ca3af; padding-bottom: 16px;">
                    <a href="${APP_URL}/settings" style="color: ${C.emerald}; text-decoration: none;">Manage preferences</a>
                    &nbsp;·&nbsp;
                    <a href="${APP_URL}" style="color: ${C.emerald}; text-decoration: none;">ynai.co.ke</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size: 10px; color: #d1d5db;">
                    © ${new Date().getFullYear()} Ynai. All rights reserved.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ═══════════════════════════════════════
// INDIVIDUAL EMAIL TEMPLATES
// ═══════════════════════════════════════

export const EMAIL_TEMPLATES = {

  // ── 1. Welcome ──
  WELCOME: {
    subject: 'Welcome to Ynai — your Bar Exam journey starts now! 🎓',
    build: (v: Record<string, string>) => wrapInBaseTemplate(`
      <h1 style="margin: 0 0 8px; font-size: 24px; color: ${C.text};" class="email-heading">
        Karibu, ${v.userName}! 🎉
      </h1>
      <p style="color: ${C.muted}; margin: 0 0 24px; font-size: 15px;">
        Welcome to <strong style="color: ${C.emerald};">Ynai</strong> — your AI-powered companion for the Kenya Bar Exam.
      </p>

      <div style="background: linear-gradient(135deg, ${C.emeraldBg}, #f0fdfa); border-radius: 12px; padding: 24px; margin: 0 0 24px;">
        <p style="font-weight: 600; color: ${C.text}; margin: 0 0 16px; font-size: 15px;">
          Your <strong style="color: ${C.emerald};">3-day free trial</strong> includes:
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${[
            ['📚', 'Unlimited Mastery Hub', 'All 9 ATP units'],
            ['🧠', 'AI Study Notes', 'Grounded in Kenyan law'],
            ['⚖️', '2 Oral Exam Sessions', 'Devil\'s Advocate & Panel'],
            ['📝', '3 Legal Drafting Docs', 'With AI feedback'],
            ['🎯', 'Quizzes & Tracking', 'Daily progress insights'],
          ].map(([icon, title, desc]) => `
            <tr>
              <td style="padding: 6px 0; vertical-align: top; width: 30px;">
                <span style="font-size: 18px;">${icon}</span>
              </td>
              <td style="padding: 6px 0 6px 8px;">
                <span style="font-weight: 600; color: ${C.text}; font-size: 14px;">${title}</span>
                <span style="color: ${C.muted}; font-size: 13px;"> — ${desc}</span>
              </td>
            </tr>
          `).join('')}
        </table>
      </div>

      ${ctaButton('Start Your First Session →', v.dashboardUrl)}

      ${infoCard(
        '💡 Pro Tip',
        'The Mastery Hub guides you through each topic in four phases — <strong>Note → Exhibit → Diagnosis → Mastery</strong>. Trust the process!'
      )}

      <p style="color: ${C.muted}; font-size: 14px; margin: 20px 0 0;">
        Kila la heri,<br>
        <strong style="color: ${C.text};">— The Ynai Team</strong>
      </p>
    `, 'Your AI-powered Kenya Bar Exam prep starts now'),
  },

  // ── 2. Daily Reminder ──
  DAILY_REMINDER: {
    subject: '📚 Today\'s focus: {{sessionTopic}} — your session is ready!',
    build: (v: Record<string, string>) => wrapInBaseTemplate(`
      <h1 style="margin: 0 0 8px; font-size: 22px; color: ${C.text};" class="email-heading">
        Hi ${v.userName} 👋
      </h1>
      <p style="color: ${C.muted}; margin: 0 0 20px; font-size: 15px;">
        Your AI tutor has prepared today's study session:
      </p>

      <div style="background: ${C.emeraldBg}; border-radius: 12px; padding: 20px; margin: 0 0 20px; border: 1px solid ${C.emeraldLight};">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="vertical-align: top; width: 40px;">
              <div style="width: 36px; height: 36px; background: ${C.emerald}; border-radius: 8px; text-align: center; line-height: 36px;">
                <span style="color: white; font-size: 18px;">📘</span>
              </div>
            </td>
            <td style="padding-left: 12px;">
              <div style="font-weight: 600; color: ${C.emeraldDark}; font-size: 14px;">${v.unitName}</div>
              <div style="font-size: 16px; font-weight: 700; color: ${C.text}; margin: 4px 0;">${v.sessionTopic}</div>
              <div style="color: ${C.muted}; font-size: 13px;">⏱ ~${v.estimatedMinutes} minutes</div>
            </td>
          </tr>
        </table>
      </div>

      ${v.progressSection || ''}

      ${ctaButton('Start Studying →', v.sessionUrl)}

      <p style="color: ${C.muted}; font-size: 13px; margin: 0; font-style: italic;">
        💡 Consistency beats intensity. Even 20 minutes today moves the needle.
      </p>
    `, `Today's topic: ${v.sessionTopic}`),
  },

  // ── 3. Missed Day ──
  MISSED_DAY: {
    subject: 'We missed you! Here\'s a quick comeback plan 🎯',
    build: (v: Record<string, string>) => wrapInBaseTemplate(`
      <h1 style="margin: 0 0 8px; font-size: 22px; color: ${C.text};" class="email-heading">
        Hi ${v.userName} 👋
      </h1>
      <p style="color: ${C.muted}; margin: 0 0 20px; font-size: 15px;">
        We noticed you missed your session yesterday — no worries, it happens to the best of us!
      </p>

      <div style="background: #fefce8; border-radius: 12px; padding: 20px; margin: 0 0 20px; border: 1px solid #fef08a;">
        <div style="font-weight: 700; color: ${C.text}; margin: 0 0 12px; font-size: 15px;">
          ⚡ 15-Minute Comeback Plan
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          ${[
            ['1️⃣', `Quick review of <strong>${v.lastTopic}</strong>`],
            ['2️⃣', '5 key flashcards to refresh memory'],
            ['3️⃣', 'One practice question to lock it in'],
          ].map(([num, text]) => `
            <tr>
              <td style="padding: 5px 0; vertical-align: top; width: 28px; font-size: 14px;">${num}</td>
              <td style="padding: 5px 0 5px 6px; color: ${C.text}; font-size: 14px; line-height: 1.5;">${text}</td>
            </tr>
          `).join('')}
        </table>
      </div>

      ${ctaButton('Start 15-min Comeback →', v.comebackUrl)}

      <p style="color: ${C.muted}; font-size: 13px; margin: 0; font-style: italic;">
        🚀 A 15-minute session today keeps the momentum alive!
      </p>
    `, 'Your 15-minute comeback plan is ready'),
  },

  // ── 4. Session Ready ──
  SESSION_READY: {
    subject: 'Your next session is ready! ✨',
    build: (v: Record<string, string>) => wrapInBaseTemplate(`
      <h1 style="margin: 0 0 8px; font-size: 22px; color: ${C.text};" class="email-heading">
        Hi ${v.userName} ✨
      </h1>
      <p style="color: ${C.muted}; margin: 0 0 20px; font-size: 15px;">
        Great news — your next study session has been prepared and is ready to go!
      </p>

      ${infoCard(
        `📚 ${v.sessionTopic}`,
        v.skillsList ? `<strong>Skills covered:</strong> ${v.skillsList}` : 'Jump in and continue your progress!'
      )}

      ${ctaButton('Start Session →', v.sessionUrl)}
    `, 'Your study session is waiting for you'),
  },

  // ── 5. Exam Countdown ──
  EXAM_COUNTDOWN: {
    subject: '{{daysRemaining}} days until your exam! 📆',
    build: (v: Record<string, string>) => wrapInBaseTemplate(`
      <h1 style="margin: 0 0 8px; font-size: 22px; color: ${C.text};" class="email-heading">
        Hi ${v.userName} 📆
      </h1>

      <!-- Countdown Banner -->
      <div style="background: linear-gradient(135deg, ${C.emerald}, #0d9488); border-radius: 12px; padding: 28px; margin: 0 0 24px; text-align: center;">
        <div style="font-size: 48px; font-weight: 800; color: ${C.white}; line-height: 1;">${v.daysRemaining}</div>
        <div style="font-size: 14px; color: rgba(255,255,255,0.85); margin-top: 4px; font-weight: 500;">days until your exam</div>
      </div>

      <!-- Progress -->
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="stats-table" style="margin: 0 0 20px;">
        <tr>
          ${statBox('Mastery', `${v.masteryPercent}%`, '📊')}
          ${statBox('Days Left', v.daysRemaining, '📅')}
        </tr>
      </table>

      ${v.focusAreas ? `
      <div style="margin: 0 0 20px;">
        <div style="font-weight: 600; color: ${C.text}; margin: 0 0 10px;">🎯 This week's focus areas:</div>
        <div style="color: ${C.muted}; font-size: 14px; line-height: 1.8;">${v.focusAreas}</div>
      </div>` : ''}

      ${ctaButton('View Dashboard →', v.dashboardUrl)}
    `, `${v.daysRemaining} days until your exam — stay on track!`),
  },

  // ── 6. Weekly Report ──
  WEEKLY_REPORT: {
    subject: 'Your weekly progress — {{weekRange}} 📊',
    build: (v: Record<string, string>) => wrapInBaseTemplate(`
      <h1 style="margin: 0 0 8px; font-size: 22px; color: ${C.text};" class="email-heading">
        Hi ${v.userName} 📊
      </h1>
      <p style="color: ${C.muted}; margin: 0 0 20px; font-size: 15px;">
        Here's your week at a glance <span style="color: ${C.emerald}; font-weight: 600;">(${v.weekRange})</span>:
      </p>

      <!-- Stats Grid -->
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="stats-table" style="margin: 0 0 8px;">
        <tr>
          ${statBox('Topics Completed', v.topicsCompleted, '📚')}
          ${statBox('Nodes Mastered', v.nodesMastered, '🏆')}
        </tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="stats-table" style="margin: 0 0 20px;">
        <tr>
          ${statBox('Overall Mastery', `${v.masteryPercent}%`, '📈')}
          ${statBox('Study Streak', `${v.streakDays}d`, '🔥')}
        </tr>
      </table>

      <!-- Mastery Bar -->
      <div style="margin: 0 0 20px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="font-size: 13px; color: ${C.muted};">Mastery Progress</span>
          <span style="font-size: 13px; font-weight: 600; color: ${C.emeraldDark};">${v.masteryPercent}%</span>
        </div>
        <div style="background: ${C.border}; border-radius: 100px; height: 10px; overflow: hidden;">
          <div style="background: linear-gradient(90deg, ${C.emerald}, #14b8a6); width: ${v.masteryPercent}%; height: 100%; border-radius: 100px;"></div>
        </div>
      </div>

      ${v.weakAreasSection || ''}

      ${infoCard('📌 Next week\'s focus', v.nextWeekFocus)}

      ${ctaButton('View Full Dashboard →', v.dashboardUrl)}

      <p style="color: ${C.muted}; font-size: 13px; margin: 0; font-style: italic;">
        ⚖️ Keep going — every session brings you closer to the Bar!
      </p>
    `, `Your weekly report: ${v.masteryPercent}% mastery`),
  },

  // ── 7. Fun Fact ──
  FUN_FACT: {
    subject: '⚖️ Did you know? {{factTitle}}',
    build: (v: Record<string, string>) => wrapInBaseTemplate(`
      <h1 style="margin: 0 0 20px; font-size: 22px; color: ${C.text};" class="email-heading">
        Hi ${v.userName} 🧠
      </h1>

      <div style="background: linear-gradient(135deg, ${C.emeraldBg}, #f0fdfa, #ecfeff); border-radius: 14px; padding: 28px; margin: 0 0 24px; border: 1px solid ${C.emeraldLight};">
        <div style="font-size: 12px; font-weight: 700; color: ${C.emerald}; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px;">
          ⚖️ Kenyan Law Fun Fact
        </div>
        <div style="font-size: 18px; font-weight: 700; color: ${C.text}; margin: 0 0 14px; line-height: 1.4;">
          ${v.factTitle}
        </div>
        <div style="color: ${C.text}; font-size: 14px; line-height: 1.7;">
          ${v.factBody}
        </div>
        ${v.factSource ? `
        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid ${C.emeraldLight};">
          <span style="font-size: 12px; color: ${C.muted};">📖 Source: ${v.factSource}</span>
        </div>` : ''}
      </div>

      <p style="color: ${C.muted}; font-size: 13px; margin: 0 0 4px; font-style: italic;">
        A little legal trivia to keep things interesting between study sessions. 🧠
      </p>

      ${ctaButton('Continue Studying →', v.dashboardUrl)}
    `, v.factTitle),
  },

  // ═══════════════════════════════════════
  // NEW EVENT-DRIVEN TEMPLATES
  // ═══════════════════════════════════════

  // ── 8. Subscription Activated ──
  SUBSCRIPTION_ACTIVATED: {
    subject: 'You\'re in! Your {{tierName}} plan is active 🎉',
    build: (v: Record<string, string>) => wrapInBaseTemplate(`
      <div style="text-align: center; margin: 0 0 24px;">
        <div style="font-size: 56px; margin-bottom: 8px;">🎉</div>
        <h1 style="margin: 0 0 8px; font-size: 24px; color: ${C.text};" class="email-heading">
          Welcome to ${v.tierName}!
        </h1>
        <p style="color: ${C.muted}; margin: 0; font-size: 15px;">
          Your subscription is now active, ${v.userName}.
        </p>
      </div>

      <div style="background: linear-gradient(135deg, ${C.emeraldBg}, #f0fdfa); border-radius: 12px; padding: 24px; margin: 0 0 24px; border: 1px solid ${C.emeraldLight};">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: ${C.muted};">Plan</td>
            <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: ${C.text}; text-align: right;">${v.tierName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: ${C.muted};">Billing</td>
            <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: ${C.text}; text-align: right;">${v.billingPeriod}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: ${C.muted};">Amount</td>
            <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: ${C.emeraldDark}; text-align: right;">KES ${v.amount}</td>
          </tr>
          ${v.nextRenewal ? `
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: ${C.muted};">Next renewal</td>
            <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: ${C.text}; text-align: right;">${v.nextRenewal}</td>
          </tr>` : ''}
        </table>
      </div>

      ${v.features ? `
      <div style="margin: 0 0 20px;">
        <div style="font-weight: 600; color: ${C.text}; margin: 0 0 10px; font-size: 15px;">Your plan includes:</div>
        <div style="color: ${C.muted}; font-size: 14px; line-height: 2;">${v.features}</div>
      </div>` : ''}

      ${ctaButton('Go to Dashboard →', v.dashboardUrl)}
    `, `Your ${v.tierName} subscription is now active`),
  },

  // ── 9. Tier Upgraded ──
  TIER_UPGRADED: {
    subject: 'Upgrade complete! You\'re now on {{tierName}} 🚀',
    build: (v: Record<string, string>) => wrapInBaseTemplate(`
      <div style="text-align: center; margin: 0 0 24px;">
        <div style="font-size: 56px; margin-bottom: 8px;">🚀</div>
        <h1 style="margin: 0 0 8px; font-size: 24px; color: ${C.text};" class="email-heading">
          Upgrade Successful!
        </h1>
        <p style="color: ${C.muted}; margin: 0; font-size: 15px;">
          You're now on the <strong style="color: ${C.emerald};">${v.tierName}</strong> plan, ${v.userName}.
        </p>
      </div>

      <div style="background: ${C.emeraldBg}; border-radius: 12px; padding: 20px; margin: 0 0 24px; text-align: center;">
        <span style="font-size: 14px; color: ${C.muted};">${v.previousTier}</span>
        <span style="font-size: 20px; margin: 0 12px;">→</span>
        <span style="font-size: 14px; font-weight: 700; color: ${C.emeraldDark};">${v.tierName}</span>
      </div>

      ${v.newBenefits ? `
      ${infoCard('✨ New benefits unlocked', v.newBenefits)}` : ''}

      ${ctaButton('Explore Your New Features →', v.dashboardUrl)}
    `, `You've been upgraded to ${v.tierName}`),
  },

  // ── 10. Trial Expiring ──
  TRIAL_EXPIRING: {
    subject: 'Your free trial ends tomorrow ⏰',
    build: (v: Record<string, string>) => wrapInBaseTemplate(`
      <h1 style="margin: 0 0 8px; font-size: 22px; color: ${C.text};" class="email-heading">
        Hi ${v.userName} ⏰
      </h1>
      <p style="color: ${C.muted}; margin: 0 0 20px; font-size: 15px;">
        Your 3-day free trial ends <strong style="color: ${C.red};">tomorrow</strong>. Don't lose your progress!
      </p>

      <div style="background: #fef2f2; border-radius: 12px; padding: 20px; margin: 0 0 24px; border: 1px solid #fecaca;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="vertical-align: top; width: 40px;">
              <div style="font-size: 28px;">⏳</div>
            </td>
            <td style="padding-left: 12px;">
              <div style="font-weight: 600; color: ${C.text}; font-size: 15px; margin-bottom: 4px;">Trial expires: ${v.expiryDate}</div>
              <div style="color: ${C.muted}; font-size: 13px;">Subscribe now to keep your study streak, progress, and AI access.</div>
            </td>
          </tr>
        </table>
      </div>

      ${v.progressSummary ? `
      <div style="margin: 0 0 20px;">
        <div style="font-weight: 600; color: ${C.text}; margin: 0 0 10px; font-size: 15px;">Your progress so far:</div>
        <div style="color: ${C.muted}; font-size: 14px; line-height: 1.8;">${v.progressSummary}</div>
      </div>` : ''}

      <div style="text-align: center;">
        ${ctaButton('Subscribe Now — Keep Your Progress →', v.subscribeUrl, C.emerald)}
      </div>

      <p style="color: ${C.muted}; font-size: 13px; margin: 16px 0 0; text-align: center;">
        Plans start from <strong>KES 500/week</strong>. Cancel anytime.
      </p>
    `, 'Your free trial ends tomorrow — subscribe to keep your progress'),
  },

  // ── 11. Add-on Purchased ──
  ADDON_PURCHASED: {
    subject: 'Add-on purchased! +{{quantity}} {{featureName}} passes ✅',
    build: (v: Record<string, string>) => wrapInBaseTemplate(`
      <div style="text-align: center; margin: 0 0 24px;">
        <div style="font-size: 48px; margin-bottom: 8px;">✅</div>
        <h1 style="margin: 0 0 8px; font-size: 22px; color: ${C.text};" class="email-heading">
          Add-on Confirmed!
        </h1>
        <p style="color: ${C.muted}; margin: 0; font-size: 15px;">
          ${v.userName}, your extra passes are ready to use.
        </p>
      </div>

      <div style="background: ${C.light}; border-radius: 12px; padding: 20px; margin: 0 0 24px; border: 1px solid ${C.border};">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: ${C.muted};">Feature</td>
            <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: ${C.text}; text-align: right;">${v.featureName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: ${C.muted};">Passes added</td>
            <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: ${C.emeraldDark}; text-align: right;">+${v.quantity}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: ${C.muted};">Amount paid</td>
            <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: ${C.text}; text-align: right;">KES ${v.amount}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: ${C.muted};">Reference</td>
            <td style="padding: 6px 0; font-size: 13px; color: ${C.muted}; text-align: right; font-family: monospace;">${v.reference}</td>
          </tr>
        </table>
      </div>

      ${ctaButton('Use Your Passes →', v.dashboardUrl)}
    `, `${v.quantity} ${v.featureName} passes added to your account`),
  },

  // ── 12. Payment Receipt ──
  PAYMENT_RECEIPT: {
    subject: 'Payment confirmed — KES {{amount}} ✅',
    build: (v: Record<string, string>) => wrapInBaseTemplate(`
      <h1 style="margin: 0 0 8px; font-size: 22px; color: ${C.text};" class="email-heading">
        Payment Confirmed ✅
      </h1>
      <p style="color: ${C.muted}; margin: 0 0 24px; font-size: 15px;">
        Hi ${v.userName}, here's your receipt:
      </p>

      <div style="background: ${C.light}; border-radius: 12px; padding: 24px; margin: 0 0 24px; border: 1px solid ${C.border};">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: ${C.muted}; border-bottom: 1px solid ${C.border};">Description</td>
            <td style="padding: 8px 0; font-size: 14px; font-weight: 600; color: ${C.text}; text-align: right; border-bottom: 1px solid ${C.border};">${v.description}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: ${C.muted}; border-bottom: 1px solid ${C.border};">Payment method</td>
            <td style="padding: 8px 0; font-size: 14px; color: ${C.text}; text-align: right; border-bottom: 1px solid ${C.border};">${v.channel || 'M-Pesa'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: ${C.muted}; border-bottom: 1px solid ${C.border};">Reference</td>
            <td style="padding: 8px 0; font-size: 13px; color: ${C.muted}; text-align: right; border-bottom: 1px solid ${C.border}; font-family: monospace;">${v.reference}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: ${C.muted}; border-bottom: 1px solid ${C.border};">Date</td>
            <td style="padding: 8px 0; font-size: 14px; color: ${C.text}; text-align: right; border-bottom: 1px solid ${C.border};">${v.date}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-size: 16px; font-weight: 700; color: ${C.text};">Total</td>
            <td style="padding: 12px 0; font-size: 18px; font-weight: 700; color: ${C.emeraldDark}; text-align: right;">KES ${v.amount}</td>
          </tr>
        </table>
      </div>

      <p style="color: ${C.muted}; font-size: 13px; margin: 0; text-align: center;">
        This is your official payment receipt from Ynai. Keep it for your records.
      </p>
    `, `Payment of KES ${v.amount} confirmed`),
  },

  // ── 13. Mastery Milestone ──
  MASTERY_MILESTONE: {
    subject: '🏆 Milestone! You\'ve mastered {{topicName}}!',
    build: (v: Record<string, string>) => wrapInBaseTemplate(`
      <div style="text-align: center; margin: 0 0 24px;">
        <div style="font-size: 64px; margin-bottom: 8px;">🏆</div>
        <h1 style="margin: 0 0 8px; font-size: 24px; color: ${C.text};" class="email-heading">
          Topic Mastered!
        </h1>
        <p style="color: ${C.muted}; margin: 0; font-size: 15px;">
          You've fully mastered a topic, ${v.userName}. 
        </p>
      </div>

      <div style="background: linear-gradient(135deg, #fef3c7, #fefce8); border-radius: 12px; padding: 24px; margin: 0 0 24px; border: 1px solid #fde68a; text-align: center;">
        <div style="font-size: 12px; font-weight: 700; color: ${C.gold}; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Completed</div>
        <div style="font-size: 18px; font-weight: 700; color: ${C.text}; margin: 0 0 4px;">${v.topicName}</div>
        <div style="font-size: 13px; color: ${C.muted};">${v.unitName}</div>
      </div>

      <!-- Progress -->
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="stats-table" style="margin: 0 0 20px;">
        <tr>
          ${statBox('Mastered', `${v.masteredCount}/${v.totalCount}`, '📊')}
          ${statBox('Overall', `${v.masteryPercent}%`, '🎯')}
        </tr>
      </table>

      ${v.nextTopicName ? infoCard('📚 Up next', `<strong>${v.nextTopicName}</strong> — keep the momentum going!`) : ''}

      ${ctaButton('Continue Learning →', v.dashboardUrl)}
    `, `You mastered ${v.topicName}! ${v.masteredCount}/${v.totalCount} complete`),
  },

  // ── 14. Streak Milestone ──
  STREAK_MILESTONE: {
    subject: '🔥 {{streakDays}}-day streak! You\'re on fire!',
    build: (v: Record<string, string>) => wrapInBaseTemplate(`
      <div style="text-align: center; margin: 0 0 24px;">
        <div style="font-size: 64px; margin-bottom: 8px;">🔥</div>
        <h1 style="margin: 0 0 8px; font-size: 28px; color: ${C.text};" class="email-heading">
          ${v.streakDays}-Day Streak!
        </h1>
        <p style="color: ${C.muted}; margin: 0; font-size: 15px;">
          Incredible consistency, ${v.userName}! You're unstoppable.
        </p>
      </div>

      <div style="background: linear-gradient(135deg, #fff7ed, #fef3c7); border-radius: 12px; padding: 28px; margin: 0 0 24px; text-align: center; border: 1px solid #fed7aa;">
        <div style="font-size: 56px; font-weight: 800; color: #ea580c; line-height: 1;">${v.streakDays}</div>
        <div style="font-size: 14px; color: ${C.muted}; margin-top: 6px;">consecutive study days</div>
      </div>

      <p style="color: ${C.text}; font-size: 14px; text-align: center; margin: 0 0 20px; line-height: 1.6;">
        ${v.streakMessage}
      </p>

      ${ctaButton('Keep the Streak Alive →', v.dashboardUrl)}
    `, `${v.streakDays}-day study streak! Keep it going!`),
  },
} as const;

// ── Template type helper ──
export type EmailTemplateName = keyof typeof EMAIL_TEMPLATES;
