/**
 * Notification Service
 * 
 * Handles all outbound notifications:
 * - Email via Brevo HTTP API (no SMTP needed)
 * - Web Push via VAPID
 * - In-app notifications
 */

import { db } from '@/lib/db';
import { notificationLog, pushSubscriptions, users, userProfiles } from '@/lib/db/schema';
import { eq, and, lte, gte, isNull, or } from 'drizzle-orm';
import webpush from 'web-push';

// ============================================
// TYPES
// ============================================

export type NotificationChannel = 'EMAIL' | 'PUSH' | 'IN_APP';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'BOUNCED';

export interface NotificationPayload {
  userId: string;
  channel: NotificationChannel;
  template: string;
  variables: Record<string, string>;
}

export interface BrevoEmailPayload {
  to: Array<{ email: string; name?: string }>;
  templateId?: number;
  subject: string;
  htmlContent?: string;
  textContent?: string;
  params?: Record<string, string>;
}

// ============================================
// CONFIG
// ============================================

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@barexamprep.co.ke';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Bar Exam Prep';

// VAPID keys for web push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@barexamprep.co.ke';

// Initialize web-push if keys are available
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// ============================================
// EMAIL TEMPLATES
// ============================================

export const EMAIL_TEMPLATES = {
  DAILY_REMINDER: {
    subject: 'Your study session is ready! 📚',
    html: `
      <h2>Hi {{userName}},</h2>
      <p>Your next study session is ready and waiting for you!</p>
      <p><strong>Today's focus:</strong> {{sessionTopic}}</p>
      <p><strong>Estimated time:</strong> {{estimatedMinutes}} minutes</p>
      <p><a href="{{sessionUrl}}" style="background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Start Studying</a></p>
      <p>Keep up the great work! 💪</p>
      <p>— Bar Exam Prep Team</p>
    `,
  },
  MISSED_DAY: {
    subject: 'We missed you yesterday! Quick comeback plan 🎯',
    html: `
      <h2>Hi {{userName}},</h2>
      <p>We noticed you missed your study session yesterday - no worries, it happens!</p>
      <p>Here's a quick <strong>15-minute comeback plan</strong> to get back on track:</p>
      <ul>
        <li>Quick review of {{lastTopic}}</li>
        <li>5 key flashcards</li>
        <li>One practice question</li>
      </ul>
      <p><a href="{{comebackUrl}}" style="background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Start 15-min Comeback</a></p>
      <p>You've got this! 🚀</p>
      <p>— Bar Exam Prep Team</p>
    `,
  },
  SESSION_READY: {
    subject: 'Your next session is ready! ✨',
    html: `
      <h2>Hi {{userName}},</h2>
      <p>Great news! Your next study session has been prepared:</p>
      <p><strong>Topic:</strong> {{sessionTopic}}</p>
      <p><strong>Skills covered:</strong> {{skillsList}}</p>
      <p><a href="{{sessionUrl}}" style="background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">View Session</a></p>
      <p>— Bar Exam Prep Team</p>
    `,
  },
  EXAM_COUNTDOWN: {
    subject: '{{daysRemaining}} days until your exam! 📆',
    html: `
      <h2>Hi {{userName}},</h2>
      <p>Your exam is in <strong>{{daysRemaining}} days</strong>.</p>
      <p>Current progress: {{masteryPercent}}% mastery</p>
      <p>Focus areas this week:</p>
      <ul>{{focusAreas}}</ul>
      <p><a href="{{dashboardUrl}}" style="background: #4F46E5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">View Your Dashboard</a></p>
      <p>— Bar Exam Prep Team</p>
    `,
  },
};

// ============================================
// BREVO EMAIL (HTTP API)
// ============================================

/**
 * Send email via Brevo HTTP API (no SMTP needed)
 */
export async function sendEmailViaBrevo(
  payload: BrevoEmailPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!BREVO_API_KEY) {
    console.error('[notification] BREVO_API_KEY not configured');
    return { success: false, error: 'Brevo API key not configured' };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME },
        to: payload.to,
        subject: payload.subject,
        htmlContent: payload.htmlContent,
        textContent: payload.textContent,
        params: payload.params,
        templateId: payload.templateId,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[notification] Brevo API error:', response.status, errorBody);
      return { success: false, error: `Brevo API error: ${response.status}` };
    }

    const result = await response.json();
    return { success: true, messageId: result.messageId };
  } catch (err) {
    console.error('[notification] Brevo request failed:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Send templated notification email
 */
export async function sendNotificationEmail(
  userId: string,
  template: keyof typeof EMAIL_TEMPLATES,
  variables: Record<string, string>
): Promise<{ success: boolean; logId: string }> {
  // Get user info
  const [user] = await db
    .select({ email: users.email, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    console.error(`[notification] User not found: ${userId}`);
    return { success: false, logId: '' };
  }

  const templateData = EMAIL_TEMPLATES[template];
  
  // Replace variables in content
  let htmlContent = templateData.html;
  let subject = templateData.subject;
  
  variables.userName = variables.userName || user.displayName || 'Student';
  
  for (const [key, value] of Object.entries(variables)) {
    htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
    subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  // Create log entry
  const [logEntry] = await db
    .insert(notificationLog)
    .values({
      userId,
      channel: 'EMAIL',
      template,
      payloadJson: variables,
      status: 'PENDING',
    })
    .returning();

  // Send via Brevo
  const result = await sendEmailViaBrevo({
    to: [{ email: user.email, name: user.displayName || undefined }],
    subject,
    htmlContent,
    params: variables,
  });

  // Update log
  await db
    .update(notificationLog)
    .set({
      status: result.success ? 'SENT' : 'FAILED',
      providerMessageId: result.messageId,
      errorMessage: result.error,
      sentAt: result.success ? new Date() : undefined,
    })
    .where(eq(notificationLog.id, logEntry.id));

  return { success: result.success, logId: logEntry.id };
}

// ============================================
// WEB PUSH
// ============================================

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, any>;
}

/**
 * Register a push subscription
 */
export async function registerPushSubscription(
  userId: string,
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  },
  userAgent?: string
): Promise<{ success: boolean; subscriptionId?: string }> {
  try {
    // Check if endpoint already exists
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      await db
        .update(pushSubscriptions)
        .set({
          userId,
          keysJson: subscription.keys,
          userAgent,
          isActive: true,
          lastUsedAt: new Date(),
        })
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

      return { success: true, subscriptionId: existing[0].id };
    }

    // Create new
    const [sub] = await db
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint: subscription.endpoint,
        keysJson: subscription.keys,
        userAgent,
        isActive: true,
      })
      .returning();

    return { success: true, subscriptionId: sub.id };
  } catch (err) {
    console.error('[notification] Push subscription registration failed:', err);
    return { success: false };
  }
}

/**
 * Send push notification to a user
 */
export async function sendPushNotification(
  userId: string,
  payload: PushPayload
): Promise<{ success: boolean; sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[notification] VAPID keys not configured');
    return { success: false, sent: 0, failed: 0 };
  }

  // Get user's active subscriptions
  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(and(
      eq(pushSubscriptions.userId, userId),
      eq(pushSubscriptions.isActive, true)
    ));

  if (subscriptions.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  // Create log entry
  const [logEntry] = await db
    .insert(notificationLog)
    .values({
      userId,
      channel: 'PUSH',
      template: payload.tag || 'PUSH_NOTIFICATION',
      payloadJson: payload,
      status: 'PENDING',
    })
    .returning();

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keysJson as { p256dh: string; auth: string },
        },
        JSON.stringify(payload)
      );

      // Update last used
      await db
        .update(pushSubscriptions)
        .set({ lastUsedAt: new Date() })
        .where(eq(pushSubscriptions.id, sub.id));

      sent++;
    } catch (err: any) {
      console.error(`[notification] Push send failed to ${sub.endpoint}:`, err);
      
      // If subscription is expired/invalid, deactivate it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db
          .update(pushSubscriptions)
          .set({ isActive: false })
          .where(eq(pushSubscriptions.id, sub.id));
      }
      
      failed++;
    }
  }

  // Update log
  await db
    .update(notificationLog)
    .set({
      status: sent > 0 ? 'SENT' : 'FAILED',
      sentAt: sent > 0 ? new Date() : undefined,
      errorMessage: failed > 0 ? `${failed} of ${subscriptions.length} failed` : undefined,
    })
    .where(eq(notificationLog.id, logEntry.id));

  return { success: sent > 0, sent, failed };
}

// ============================================
// REMINDER SCHEDULING (Tick-based)
// ============================================

/**
 * Process pending reminders for users
 * Called by /api/cron/tick endpoint
 */
export async function processReminderTick(): Promise<{
  processed: number;
  emailsSent: number;
  pushSent: number;
}> {
  const now = new Date();
  const currentHour = now.getUTCHours();
  
  // Find users due for reminders
  // This is a simplified version - production would handle timezones properly
  const usersToNotify = await db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      reminderEnabled: userProfiles.reminderEnabled,
      reminderTime: userProfiles.reminderTime,
      reminderTimezone: userProfiles.reminderTimezone,
    })
    .from(users)
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(and(
      eq(users.isActive, true),
      or(
        eq(userProfiles.reminderEnabled, true),
        isNull(userProfiles.reminderEnabled) // Default to enabled
      )
    ))
    .limit(100);

  let processed = 0;
  let emailsSent = 0;
  let pushSent = 0;

  for (const user of usersToNotify) {
    // Check if already notified today (idempotency)
    const alreadySent = await db
      .select()
      .from(notificationLog)
      .where(and(
        eq(notificationLog.userId, user.userId),
        eq(notificationLog.template, 'DAILY_REMINDER'),
        gte(notificationLog.createdAt, new Date(now.setHours(0, 0, 0, 0)))
      ))
      .limit(1);

    if (alreadySent.length > 0) {
      continue;
    }

    // Check user's preferred time (simplified - assumes UTC)
    const preferredHour = parseInt(user.reminderTime?.split(':')[0] || '9', 10);
    if (currentHour !== preferredHour) {
      continue;
    }

    processed++;

    // Send email reminder
    const emailResult = await sendNotificationEmail(user.userId, 'DAILY_REMINDER', {
      sessionTopic: 'Your next study topic',
      estimatedMinutes: '30',
      sessionUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://barexamprep.co.ke'}/dashboard`,
    });
    if (emailResult.success) emailsSent++;

    // Send push notification
    const pushResult = await sendPushNotification(user.userId, {
      title: '📚 Time to study!',
      body: 'Your study session is ready and waiting.',
      icon: '/icons/icon-192x192.png',
      url: '/dashboard',
      tag: 'daily-reminder',
    });
    if (pushResult.success) pushSent += pushResult.sent;
  }

  return { processed, emailsSent, pushSent };
}

// ============================================
// IN-APP NUDGES
// ============================================

export interface InAppNudge {
  type: 'BEHIND_SCHEDULE' | 'STREAK_AT_RISK' | 'SESSION_READY' | 'ACHIEVEMENT';
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}

/**
 * Get in-app nudges for user (shown on dashboard)
 */
export async function getInAppNudges(userId: string): Promise<InAppNudge[]> {
  const nudges: InAppNudge[] = [];

  // Check if sessions are ready but not started
  // (Would check study_sessions table in production)
  
  // For now, return a generic nudge
  nudges.push({
    type: 'SESSION_READY',
    title: 'Session Ready',
    message: 'Your next study session has been prepared!',
    actionUrl: '/dashboard',
    actionLabel: 'Start Studying',
  });

  return nudges;
}

export default {
  sendNotificationEmail,
  sendPushNotification,
  registerPushSubscription,
  processReminderTick,
  getInAppNudges,
  sendEmailViaBrevo,
  EMAIL_TEMPLATES,
};
