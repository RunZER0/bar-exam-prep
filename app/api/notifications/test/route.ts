import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/notifications/test
 * Sends test notifications — fires a custom event on the client
 * Also can test Brevo email delivery when BREVO_API_KEY is set
 */

const SAMPLE_NOTIFICATIONS = [
  {
    type: 'study_nudge' as const,
    title: 'Ready for a study session?',
    body: "You haven't practised Constitutional Law today. A 15-minute session keeps retention strong!",
    icon: '📚',
    action: { label: 'Start Session', href: '/mastery' },
  },
  {
    type: 'mastery_milestone' as const,
    title: 'Mastery milestone reached!',
    body: 'You just hit 80% mastery in Land Law — only 20% to go! Keep the momentum.',
    icon: '🎯',
    action: { label: 'View Progress', href: '/progress' },
  },
  {
    type: 'weekly_digest' as const,
    title: 'Your Weekly Report',
    body: 'This week: 42 items practised, 3 skills mastered, 87% average accuracy. Outstanding work!',
    icon: '📊',
    action: { label: 'See Details', href: '/progress' },
  },
  {
    type: 'tip' as const,
    title: 'Study Tip',
    body: 'Interleaving topics improves long-term retention. Try mixing Contract Law with Tort Law today.',
    icon: '💡',
  },
  {
    type: 'streak' as const,
    title: '🔥 5-day streak!',
    body: "You've studied 5 days in a row. Consistency is the key to exam success!",
    icon: '🔥',
    action: { label: 'Continue Streak', href: '/mastery' },
  },
  {
    type: 'exam_countdown' as const,
    title: 'Exam Countdown',
    body: '28 days until the bar exam. You are on track — keep going!',
    icon: '⏰',
  },
  {
    type: 'diagnosis' as const,
    title: 'Weak area detected',
    body: "I've noticed you struggle with Equity & Trusts — specifically Constructive Trusts. I've queued targeted practice for your next session.",
    icon: '🔍',
    action: { label: 'Practice Now', href: '/mastery' },
  },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'single'; // 'single' | 'burst' | 'email'

    if (mode === 'email') {
      // Test Brevo email delivery
      const brevoKey = process.env.BREVO_API_KEY;
      if (!brevoKey) {
        return NextResponse.json({
          success: false,
          message: 'BREVO_API_KEY not configured. Set it in your environment variables.',
          instructions: [
            '1. Sign up at https://app.brevo.com',
            '2. Go to SMTP & API → API Keys → Generate a new key',
            '3. Add to Render env vars: BREVO_API_KEY=your-key',
            '4. Also set: BREVO_SENDER_EMAIL=noreply@yourdomain.com',
            '5. Also set: BREVO_SENDER_NAME=Ynai Bar Exam Prep',
          ],
        }, { status: 400 });
      }

      const targetEmail = body.email;
      if (!targetEmail) {
        return NextResponse.json({ success: false, message: 'Provide "email" in request body' }, { status: 400 });
      }

      // Send test email via Brevo HTTP API
      const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@ynai.com';
      const senderName = process.env.BREVO_SENDER_NAME || 'Ynai Bar Exam Prep';

      const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: targetEmail }],
          subject: '🎓 Test Notification from Ynai',
          htmlContent: `
            <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #10b981;">✅ Ynai Notifications Working!</h2>
              <p>This is a test email from your Ynai Bar Exam Prep system.</p>
              <p>If you received this, your Brevo integration is set up correctly.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="color: #6b7280; font-size: 12px;">Sent from Ynai Bar Exam Prep</p>
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        const err = await emailRes.text();
        return NextResponse.json({ success: false, message: `Brevo API error: ${err}` }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: `Test email sent to ${targetEmail}` });
    }

    // In-app notification test
    if (mode === 'burst') {
      // Send 3 random notifications 1 second apart (client handles timing)
      const selected = [];
      const shuffled = [...SAMPLE_NOTIFICATIONS].sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(3, shuffled.length); i++) {
        selected.push({ ...shuffled[i], delay: i * 2000 });
      }
      return NextResponse.json({ success: true, notifications: selected });
    }

    // Single random notification
    const notif = SAMPLE_NOTIFICATIONS[Math.floor(Math.random() * SAMPLE_NOTIFICATIONS.length)];
    return NextResponse.json({ success: true, notifications: [{ ...notif, delay: 0 }] });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
