/**
 * Notification Service
 * 
 * Handles all outbound notifications:
 * - Email via Brevo HTTP API (no SMTP needed)
 * - Web Push via VAPID
 * - In-app notifications
 * 
 * All emails use the aesthetic template system from email-templates.ts
 */

import { db } from '@/lib/db';
import { notificationLog, pushSubscriptions, users, userProfiles, syllabusNodes, nodeProgress, studyStreaks } from '@/lib/db/schema';
import { eq, and, lte, gte, isNull, or, sql, count, asc, desc } from 'drizzle-orm';
import webpush from 'web-push';
import { ATP_UNITS } from '@/lib/constants/legal-content';
import { EMAIL_TEMPLATES, type EmailTemplateName } from '@/lib/services/email-templates';
import { generateEmail, type EmailEvent } from '@/lib/services/email-agent';

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
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@ynai.co.ke';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Ynai';

// VAPID keys for web push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@ynai.co.ke';

// Initialize web-push if keys are available
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Re-export templates for backward compat
export { EMAIL_TEMPLATES } from '@/lib/services/email-templates';

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
 * Send templated notification email using the AI email agent.
 * The agent generates personalized copy dynamically, then wraps it in the branded base template.
 * Falls back to a clean minimal email if the AI call fails.
 */
export async function sendNotificationEmail(
  userId: string,
  template: EmailTemplateName,
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

  const userName = variables.userName || user.displayName || 'Student';

  // Generate email via AI agent
  const generated = await generateEmail({
    event: template as EmailEvent,
    userName,
    data: { ...variables },
  });

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
    subject: generated.subject,
    htmlContent: generated.html,
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

// Fun facts about Kenyan law — rotated one per send, not excessive
const KENYAN_LAW_FUN_FACTS = [
  {
    title: 'Kenya\'s Constitution is one of the longest in the world',
    body: 'The 2010 Constitution of Kenya has 264 Articles spread across 18 Chapters, plus 6 Schedules. It replaced the Independence Constitution of 1963 and was approved by 67% of voters in a national referendum on August 4, 2010.',
    source: 'Constitution of Kenya, 2010',
  },
  {
    title: 'Advocates must serve pupillage before admission',
    body: 'Under the Advocates Act (Cap 16), every person seeking admission as an advocate must first serve a period of pupillage under a practising advocate of at least 5 years\' standing. This tradition mirrors the English system of barristers\' chambers.',
    source: 'Advocates Act, Cap 16, Section 12',
  },
  {
    title: 'The Kadhi\'s Courts have constitutional protection',
    body: 'Kenya is one of few countries where Islamic courts (Kadhi\'s Courts) are constitutionally entrenched. Article 170 of the Constitution establishes Kadhi\'s Courts with jurisdiction over personal status matters where all parties profess Islam.',
    source: 'Constitution of Kenya, Article 170',
  },
  {
    title: 'Kenya pioneered the Environmental Court in Africa',
    body: 'The Environment and Land Court, established under Article 162(2)(b) of the Constitution, was one of the first specialized environmental courts in Africa. It has original and appellate jurisdiction on all environmental and land disputes.',
    source: 'Environment and Land Court Act, 2011',
  },
  {
    title: 'The "Two-Thirds Gender Rule" is uniquely Kenyan',
    body: 'Article 27(8) of the Constitution provides that not more than two-thirds of members of elective or appointive bodies shall be of the same gender. This progressive provision has been the subject of numerous court decisions and remains a work in progress.',
    source: 'Constitution of Kenya, Article 27(8)',
  },
  {
    title: 'Kenya uses a hybrid legal system',
    body: 'Kenya\'s legal system blends English Common Law, Islamic Law (for personal matters), Hindu customary law, and African Customary Law. The Judicature Act (Cap 8) establishes this hierarchy, with the Constitution supreme above all.',
    source: 'Judicature Act, Cap 8, Section 3',
  },
  {
    title: 'The LSK was established in 1948',
    body: 'The Law Society of Kenya (LSK), established in 1948, is one of the oldest professional bodies in East Africa. Under the LSK Act, every advocate must be a member and pay annual practicing fees to maintain their practicing certificate.',
    source: 'Law Society of Kenya Act, Cap 18',
  },
  {
    title: 'Plea bargaining was formalized in 2018',
    body: 'Plea bargaining in Kenya was formally introduced by the Criminal Procedure Code (Amendment) through the Statute Law (Miscellaneous Amendments) Act, 2018. Before this, the concept existed informally but had no statutory framework.',
    source: 'Criminal Procedure Code, Sections 137A-137O',
  },
  {
    title: 'The Supreme Court only started in 2011',
    body: 'Despite Kenya\'s independence in 1963, the Supreme Court was only established under the 2010 Constitution and became operational in 2011. Before this, the Court of Appeal was the highest court — a legacy of the colonial judicial structure.',
    source: 'Supreme Court Act, 2011',
  },
  {
    title: 'Trust accounts are heavily regulated',
    body: 'Under the Advocates (Accounts) Rules, advocates must maintain a separate client account (trust account) at a bank approved by the LSK. Misappropriation of client funds is one of the top reasons for striking advocates off the Roll.',
    source: 'Advocates (Accounts) Rules, Rule 3',
  },
];

/**
 * Get the user's next study unit and topic from the mastery system
 */
async function getUserNextStudyInfo(userId: string): Promise<{
  unitName: string;
  topicName: string;
  progress: { mastered: number; total: number };
} | null> {
  try {
    // Get total syllabus nodes
    const allNodes = await db.select({ id: syllabusNodes.id, unitCode: syllabusNodes.unitCode, topicName: syllabusNodes.topicName })
      .from(syllabusNodes)
      .orderBy(asc(syllabusNodes.weekNumber));

    if (allNodes.length === 0) return null;

    // Get user's mastered nodes
    const userProgress = await db.select({
      nodeId: nodeProgress.nodeId,
      phase: nodeProgress.phase,
      masteryPassed: nodeProgress.masteryPassed,
    })
      .from(nodeProgress)
      .where(eq(nodeProgress.userId, userId));

    const masteredIds = new Set(
      userProgress.filter(p => p.phase === 'MASTERY' && p.masteryPassed).map(p => p.nodeId)
    );
    const inProgressIds = new Set(userProgress.map(p => p.nodeId));

    // Find next unmastered node (prefer nodes already in-progress, then untouched)
    const inProgressNode = allNodes.find(n => inProgressIds.has(n.id) && !masteredIds.has(n.id));
    const nextNode = inProgressNode || allNodes.find(n => !masteredIds.has(n.id));

    if (!nextNode) return null;

    // Resolve unit name
    const unit = ATP_UNITS.find(u => 
      u.id === nextNode.unitCode.toLowerCase().replace(' ', '-') ||
      u.code === nextNode.unitCode ||
      u.id === nextNode.unitCode.toLowerCase()
    );

    return {
      unitName: unit?.name || nextNode.unitCode,
      topicName: nextNode.topicName,
      progress: {
        mastered: masteredIds.size,
        total: allNodes.length,
      },
    };
  } catch (err) {
    console.error('[notification] Failed to get user study info:', err);
    return null;
  }
}

/**
 * Get user's current study streak (consecutive days with activity)
 */
async function getUserCurrentStreak(userId: string): Promise<number> {
  try {
    const streakRows = await db
      .select({ date: studyStreaks.date })
      .from(studyStreaks)
      .where(eq(studyStreaks.userId, userId))
      .orderBy(desc(studyStreaks.date))
      .limit(120);

    if (streakRows.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (let i = 0; i < streakRows.length; i++) {
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);
      const rowDate = new Date(streakRows[i].date);
      rowDate.setUTCHours(0, 0, 0, 0);

      if (rowDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else if (i === 0) {
        // Allow if they haven't studied today yet — check yesterday
        expectedDate.setDate(expectedDate.getDate() - 1);
        if (rowDate.getTime() === expectedDate.getTime()) {
          streak++;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    return streak;
  } catch (err) {
    console.error('[notification] Failed to get streak:', err);
    return 0;
  }
}

/**
 * Get user's mastery stats for weekly report
 */
async function getUserWeeklyStats(userId: string): Promise<{
  topicsCompleted: number;
  nodesMastered: number;
  totalNodes: number;
  masteryPercent: number;
} | null> {
  try {
    const [totalResult] = await db.select({ count: count() }).from(syllabusNodes);
    const totalNodes = totalResult?.count || 0;

    const [masteredResult] = await db.select({ count: count() })
      .from(nodeProgress)
      .where(and(
        eq(nodeProgress.userId, userId),
        eq(nodeProgress.phase, 'MASTERY'),
        eq(nodeProgress.masteryPassed, true),
      ));
    const nodesMastered = masteredResult?.count || 0;

    // Topics completed this week (nodes that moved to a new phase in the last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [weekResult] = await db.select({ count: count() })
      .from(nodeProgress)
      .where(and(
        eq(nodeProgress.userId, userId),
        gte(nodeProgress.updatedAt, weekAgo),
      ));
    const topicsCompleted = weekResult?.count || 0;

    return {
      topicsCompleted,
      nodesMastered,
      totalNodes,
      masteryPercent: totalNodes > 0 ? Math.round((nodesMastered / totalNodes) * 100) : 0,
    };
  } catch (err) {
    console.error('[notification] Failed to get weekly stats:', err);
    return null;
  }
}

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
  
  // Find users due for reminders
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

  // Use a stable "start of today" timestamp for idempotency check
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ynai.co.ke';

  for (const user of usersToNotify) {
    // Check if already notified today (idempotency)
    const alreadySent = await db
      .select()
      .from(notificationLog)
      .where(and(
        eq(notificationLog.userId, user.userId),
        eq(notificationLog.template, 'DAILY_REMINDER'),
        gte(notificationLog.createdAt, startOfDay)
      ))
      .limit(1);

    if (alreadySent.length > 0) {
      continue;
    }

    processed++;

    // Fetch personalized study info for this user
    const studyInfo = await getUserNextStudyInfo(user.userId);

    const unitName = studyInfo?.unitName || 'Your next unit';
    const topicName = studyInfo?.topicName || 'Continue where you left off';
    const progressSection = studyInfo?.progress
      ? `<p style="color: #6b7280; font-size: 13px; margin: 12px 0;">📊 Progress: <strong>${studyInfo.progress.mastered}</strong> of <strong>${studyInfo.progress.total}</strong> topics mastered (${studyInfo.progress.total > 0 ? Math.round((studyInfo.progress.mastered / studyInfo.progress.total) * 100) : 0}%)</p>`
      : '';

    // Send email reminder
    const emailResult = await sendNotificationEmail(user.userId, 'DAILY_REMINDER', {
      unitName,
      sessionTopic: topicName,
      estimatedMinutes: '25',
      sessionUrl: `${appUrl}/dashboard`,
      progressSection,
    });
    if (emailResult.success) emailsSent++;

    // Send push notification
    const pushResult = await sendPushNotification(user.userId, {
      title: `📚 ${unitName}`,
      body: `Today's topic: ${topicName}`,
      icon: '/icons/icon-192x192.png',
      url: '/dashboard',
      tag: 'daily-reminder',
    });
    if (pushResult.success) pushSent += pushResult.sent;
  }

  return { processed, emailsSent, pushSent };
}

/**
 * Check for users whose trials are expiring within 24 hours and send warning emails.
 * Called by /api/cron/tick alongside processReminderTick.
 */
export async function processTrialExpiryCheck(): Promise<{
  processed: number;
  emailsSent: number;
}> {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);

  // Find users with trial ending within next 24 hours who are still on free_trial
  const expiringUsers = await db
    .select({ userId: users.id, trialEndsAt: users.trialEndsAt })
    .from(users)
    .where(and(
      eq(users.isActive, true),
      eq(users.subscriptionStatus, 'trialing'),
      gte(users.trialEndsAt, now),
      lte(users.trialEndsAt, tomorrow),
    ))
    .limit(100);

  let processed = 0;
  let emailsSent = 0;

  for (const user of expiringUsers) {
    // Idempotency: only one trial-expiring email per user
    const alreadySent = await db
      .select()
      .from(notificationLog)
      .where(and(
        eq(notificationLog.userId, user.userId),
        eq(notificationLog.template, 'TRIAL_EXPIRING'),
      ))
      .limit(1);

    if (alreadySent.length > 0) continue;

    processed++;
    const result = await sendTrialExpiringEmail(user.userId);
    if (result.success) emailsSent++;
  }

  return { processed, emailsSent };
}

/**
 * Process weekly report emails (called once a week, typically Sunday/Monday)
 */
export async function processWeeklyReports(): Promise<{
  processed: number;
  emailsSent: number;
}> {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const weekRange = `${startOfWeek.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}`;

  // Find active users
  const activeUsers = await db
    .select({ userId: users.id, email: users.email, displayName: users.displayName })
    .from(users)
    .where(eq(users.isActive, true))
    .limit(200);

  let processed = 0;
  let emailsSent = 0;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ynai.co.ke';

  // Idempotency: check if weekly report already sent this week
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of current week (Sunday)
  weekStart.setUTCHours(0, 0, 0, 0);

  for (const user of activeUsers) {
    const alreadySent = await db
      .select()
      .from(notificationLog)
      .where(and(
        eq(notificationLog.userId, user.userId),
        eq(notificationLog.template, 'WEEKLY_REPORT'),
        gte(notificationLog.createdAt, weekStart)
      ))
      .limit(1);

    if (alreadySent.length > 0) continue;

    processed++;

    const stats = await getUserWeeklyStats(user.userId);
    const studyInfo = await getUserNextStudyInfo(user.userId);
    const streakDays = await getUserCurrentStreak(user.userId);

    const weakAreasSection = (stats && stats.masteryPercent < 100)
      ? 'Focus on your lowest-mastery topics to maximize exam readiness.'
      : '';

    const result = await sendNotificationEmail(user.userId, 'WEEKLY_REPORT', {
      weekRange,
      topicsCompleted: String(stats?.topicsCompleted || 0),
      nodesMastered: String(stats?.nodesMastered || 0),
      masteryPercent: String(stats?.masteryPercent || 0),
      streakDays: String(streakDays),
      weakAreasSection,
      nextWeekFocus: studyInfo?.topicName || studyInfo?.unitName || 'Continue your study plan',
      dashboardUrl: `${appUrl}/dashboard`,
    });

    if (result.success) emailsSent++;
  }

  return { processed, emailsSent };
}

/**
 * Send a fun fact email to a random subset of active users (not excessive — max once per week per user)
 */
export async function processFunFactEmails(): Promise<{
  processed: number;
  emailsSent: number;
}> {
  const now = new Date();
  
  // Only send fun facts on Wednesday or Saturday to keep it light
  const dayOfWeek = now.getDay();
  if (dayOfWeek !== 3 && dayOfWeek !== 6) {
    return { processed: 0, emailsSent: 0 };
  }

  const activeUsers = await db
    .select({ userId: users.id })
    .from(users)
    .where(eq(users.isActive, true))
    .limit(200);

  let processed = 0;
  let emailsSent = 0;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ynai.co.ke';

  // Get a deterministic fun fact based on the week number
  const weekNum = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
  const fact = KENYAN_LAW_FUN_FACTS[weekNum % KENYAN_LAW_FUN_FACTS.length];

  // Idempotency: no more than one fun fact per week per user
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  for (const user of activeUsers) {
    const alreadySent = await db
      .select()
      .from(notificationLog)
      .where(and(
        eq(notificationLog.userId, user.userId),
        eq(notificationLog.template, 'FUN_FACT'),
        gte(notificationLog.createdAt, weekStart)
      ))
      .limit(1);

    if (alreadySent.length > 0) continue;

    processed++;

    const result = await sendNotificationEmail(user.userId, 'FUN_FACT', {
      factTitle: fact.title,
      factBody: fact.body,
      factSource: fact.source || '',
      dashboardUrl: `${appUrl}/dashboard`,
    });

    if (result.success) emailsSent++;
  }

  return { processed, emailsSent };
}

/**
 * Send welcome email to a newly created user
 */
export async function sendWelcomeEmail(userId: string): Promise<{ success: boolean }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ynai.co.ke';
  
  const result = await sendNotificationEmail(userId, 'WELCOME', {
    dashboardUrl: `${appUrl}/dashboard`,
  });

  return { success: result.success };
}

// ============================================
// EVENT-DRIVEN EMAIL TRIGGERS
// ============================================

const TIER_DISPLAY_NAMES: Record<string, string> = {
  light: 'Light',
  standard: 'Standard',
  premium: 'Premium',
  free_trial: 'Free Trial',
};

const PERIOD_DISPLAY_NAMES: Record<string, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  annual: 'Annual',
};

const FEATURE_DISPLAY_NAMES: Record<string, string> = {
  drafting: 'Legal Drafting',
  oral_exam: 'Oral Exam (Panel)',
  oral_devil: 'Oral Exam (Devil\'s Advocate)',
  cle_exam: 'CLE Exam',
  research: 'Deep Research',
  clarify: 'AI Clarification',
};

/**
 * EVENT: Subscription activated (new subscriber)
 * Triggered from: /api/payments/verify after successful payment
 */
export async function sendSubscriptionActivatedEmail(
  userId: string,
  tier: string,
  period: string,
  amount: number,
): Promise<{ success: boolean }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ynai.co.ke';
  const tierName = TIER_DISPLAY_NAMES[tier] || tier;
  const billingPeriod = PERIOD_DISPLAY_NAMES[period] || period;

  // Calculate next renewal
  const daysMap: Record<string, number> = { weekly: 7, monthly: 30, annual: 365 };
  const renewalDate = new Date();
  renewalDate.setDate(renewalDate.getDate() + (daysMap[period] || 30));

  const features = tier === 'premium'
    ? '✅ Unlimited Mastery Hub & AI Tutor<br>✅ 15 Drafting docs/week<br>✅ 10 Oral Exams/week<br>✅ Unlimited CLE Exams<br>✅ Deep Research & Clarify<br>✅ Priority support'
    : tier === 'standard'
    ? '✅ Unlimited Mastery Hub & AI Tutor<br>✅ 8 Drafting docs/week<br>✅ 6 Oral Exams/week<br>✅ 5 CLE Exams/week<br>✅ Deep Research'
    : '✅ Unlimited Mastery Hub & AI Tutor<br>✅ 4 Drafting docs/week<br>✅ 3 Oral Exams/week<br>✅ 2 CLE Exams/week';

  const result = await sendNotificationEmail(userId, 'SUBSCRIPTION_ACTIVATED', {
    tierName,
    billingPeriod,
    amount: amount.toLocaleString(),
    nextRenewal: renewalDate.toLocaleDateString('en-KE', { month: 'long', day: 'numeric', year: 'numeric' }),
    features,
    dashboardUrl: `${appUrl}/dashboard`,
  });

  return { success: result.success };
}

/**
 * EVENT: Tier upgraded
 * Triggered from: /api/payments/verify on upgrade purchase
 */
export async function sendTierUpgradedEmail(
  userId: string,
  previousTier: string,
  newTier: string,
): Promise<{ success: boolean }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ynai.co.ke';

  const newBenefits = newTier === 'premium'
    ? 'Unlimited CLE exams, 15 drafting docs/week, 10 oral exams/week, deep research, priority AI clarification.'
    : newTier === 'standard'
    ? '8 drafting docs/week, 6 oral exams/week, 5 CLE exams/week, deep research access.'
    : 'Enhanced limits on drafting, oral exams, and CLE practice.';

  const result = await sendNotificationEmail(userId, 'TIER_UPGRADED', {
    tierName: TIER_DISPLAY_NAMES[newTier] || newTier,
    previousTier: TIER_DISPLAY_NAMES[previousTier] || previousTier,
    newBenefits,
    dashboardUrl: `${appUrl}/dashboard`,
  });

  return { success: result.success };
}

/**
 * EVENT: Add-on passes purchased
 * Triggered from: /api/payments/verify on addon purchase
 */
export async function sendAddonPurchasedEmail(
  userId: string,
  feature: string,
  quantity: number,
  amount: number,
  reference: string,
): Promise<{ success: boolean }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ynai.co.ke';

  const result = await sendNotificationEmail(userId, 'ADDON_PURCHASED', {
    featureName: FEATURE_DISPLAY_NAMES[feature] || feature,
    quantity: String(quantity),
    amount: amount.toLocaleString(),
    reference,
    dashboardUrl: `${appUrl}/dashboard`,
  });

  return { success: result.success };
}

/**
 * EVENT: Payment receipt
 * Triggered from: /api/payments/verify after any successful payment
 */
export async function sendPaymentReceiptEmail(
  userId: string,
  amount: number,
  description: string,
  reference: string,
  channel?: string,
): Promise<{ success: boolean }> {
  const result = await sendNotificationEmail(userId, 'PAYMENT_RECEIPT', {
    amount: amount.toLocaleString(),
    description,
    reference,
    channel: channel || 'M-Pesa',
    date: new Date().toLocaleDateString('en-KE', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
  });

  return { success: result.success };
}

/**
 * EVENT: Trial expiring (24 hours before)
 * Triggered from: processReminderTick when trial has ≤24h remaining
 */
export async function sendTrialExpiringEmail(userId: string): Promise<{ success: boolean }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ynai.co.ke';

  // Get user's progress for personalization
  const stats = await getUserWeeklyStats(userId);
  const progressSummary = stats
    ? `📊 ${stats.nodesMastered} topics mastered (${stats.masteryPercent}% overall)<br>📚 ${stats.topicsCompleted} topics studied this week`
    : '';

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 1);

  const result = await sendNotificationEmail(userId, 'TRIAL_EXPIRING', {
    expiryDate: trialEnd.toLocaleDateString('en-KE', { month: 'long', day: 'numeric', year: 'numeric' }),
    progressSummary,
    subscribeUrl: `${appUrl}/subscribe`,
  });

  return { success: result.success };
}

/**
 * EVENT: Mastery milestone
 * Triggered from: mastery progression endpoints when a topic is mastered
 */
export async function sendMasteryMilestoneEmail(
  userId: string,
  topicName: string,
  unitName: string,
): Promise<{ success: boolean }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ynai.co.ke';

  const stats = await getUserWeeklyStats(userId);
  const studyInfo = await getUserNextStudyInfo(userId);

  const result = await sendNotificationEmail(userId, 'MASTERY_MILESTONE', {
    topicName,
    unitName,
    masteredCount: String(stats?.nodesMastered || 0),
    totalCount: String(stats?.totalNodes || 0),
    masteryPercent: String(stats?.masteryPercent || 0),
    nextTopicName: studyInfo?.topicName || '',
    dashboardUrl: `${appUrl}/dashboard`,
  });

  return { success: result.success };
}

/**
 * EVENT: Streak milestone (7, 14, 30, 60, 100 days)
 * Triggered from: processReminderTick or study session tracking
 */
export async function sendStreakMilestoneEmail(
  userId: string,
  streakDays: number,
): Promise<{ success: boolean }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ynai.co.ke';

  const messages: Record<number, string> = {
    7: 'One full week of consistent study! Research shows that regular practice is the #1 predictor of exam success. You\'re building a winning habit.',
    14: 'Two weeks strong! You\'re in the top tier of consistent students. Your brain is forming deep neural pathways for legal reasoning.',
    30: 'A full month of daily study! This level of discipline puts you in the top 5% of bar exam candidates. The Bar doesn\'t stand a chance.',
    60: 'Two months of unwavering dedication! You\'re not just preparing — you\'re mastering. Your consistency is truly remarkable.',
    100: 'One hundred days! This is legendary-level commitment. You\'re setting a new standard for bar exam preparation.',
  };

  const streakMessage = messages[streakDays] || `${streakDays} days of consistent study! That's remarkable dedication. Keep pushing forward!`;

  const result = await sendNotificationEmail(userId, 'STREAK_MILESTONE', {
    streakDays: String(streakDays),
    streakMessage,
    dashboardUrl: `${appUrl}/dashboard`,
  });

  return { success: result.success };
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
  processTrialExpiryCheck,
  processWeeklyReports,
  processFunFactEmails,
  sendWelcomeEmail,
  getInAppNudges,
  sendEmailViaBrevo,
  EMAIL_TEMPLATES,
  // Event-driven email triggers
  sendSubscriptionActivatedEmail,
  sendTierUpgradedEmail,
  sendAddonPurchasedEmail,
  sendPaymentReceiptEmail,
  sendTrialExpiringEmail,
  sendMasteryMilestoneEmail,
  sendStreakMilestoneEmail,
};
