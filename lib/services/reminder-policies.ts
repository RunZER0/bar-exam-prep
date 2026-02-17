/**
 * Reminder Policies
 * 
 * Defines and implements notification policies for user engagement.
 * Works with the notification service to schedule context-aware reminders.
 */

import { db } from '@/lib/db';
import { users, userProfiles, studyStreaks, studySessions, notificationLog } from '@/lib/db/schema';
import { masteryState } from '@/lib/db/mastery-schema';
import { eq, and, gte, lte, desc, sql, isNull, or } from 'drizzle-orm';
import {
  sendNotificationEmail,
  sendPushNotification,
  type NotificationPayload,
  type InAppNudge,
} from './notification-service';

// ============================================
// TYPES
// ============================================

export interface ReminderPolicy {
  id: string;
  name: string;
  description: string;
  triggerCondition: (ctx: UserContext) => boolean;
  priority: number; // Higher = more important
  cooldownHours: number; // Min hours between sends
  emailTemplate?: string;
  pushPayload?: (ctx: UserContext) => {
    title: string;
    body: string;
    url?: string;
  };
  nudgeContent?: (ctx: UserContext) => InAppNudge | null;
}

export interface UserContext {
  userId: string;
  email: string;
  displayName?: string;
  // Activity
  lastSessionAt: Date | null;
  hoursSinceLastSession: number;
  sessionsThisWeek: number;
  // Streaks
  currentStreak: number;
  longestStreak: number;
  streakAtRisk: boolean;
  // Progress
  overallMastery: number;
  weakSkillCount: number;
  pendingSessionsCount: number;
  // Exam
  daysUntilExam: number | null;
  examPhase: 'distant' | 'approaching' | 'critical' | null;
  // Notes
  hasUnreadNotes: boolean;
}

export interface PolicyEvaluationResult {
  userId: string;
  triggeredPolicies: {
    policyId: string;
    policyName: string;
    priority: number;
    shouldEmail: boolean;
    shouldPush: boolean;
    shouldNudge: boolean;
  }[];
  nudges: InAppNudge[];
  notificationsSent: {
    emailsSent: number;
    pushSent: number;
  };
}

// ============================================
// REMINDER POLICIES DEFINITIONS
// ============================================

export const REMINDER_POLICIES: ReminderPolicy[] = [
  // ============================================
  // INACTIVITY REMINDERS
  // ============================================
  {
    id: 'inactivity_24h',
    name: 'Inactivity Reminder (24h)',
    description: 'User has not studied in 24 hours',
    triggerCondition: (ctx) => ctx.hoursSinceLastSession >= 24 && ctx.hoursSinceLastSession < 48,
    priority: 70,
    cooldownHours: 24,
    emailTemplate: 'MISSED_DAY',
    pushPayload: (ctx) => ({
      title: '📚 We missed you!',
      body: `Hey ${ctx.displayName || 'there'}, let's get back on track with a quick session.`,
      url: '/dashboard',
    }),
    nudgeContent: (ctx) => ({
      type: 'BEHIND_SCHEDULE',
      title: 'Missed Yesterday',
      message: 'A quick 15-minute session can get you back on track!',
      actionUrl: '/dashboard',
      actionLabel: 'Quick Session',
    }),
  },
  {
    id: 'inactivity_48h',
    name: 'Urgent Inactivity Reminder (48h)',
    description: 'User has not studied in 48 hours',
    triggerCondition: (ctx) => ctx.hoursSinceLastSession >= 48 && ctx.hoursSinceLastSession < 168, // up to 7 days
    priority: 85,
    cooldownHours: 48,
    emailTemplate: 'MISSED_DAY',
    pushPayload: (ctx) => ({
      title: '⚠️ Don\'t break your momentum!',
      body: 'It\'s been 2 days. Even 10 minutes helps maintain progress.',
      url: '/dashboard',
    }),
    nudgeContent: (ctx) => ({
      type: 'BEHIND_SCHEDULE',
      title: 'Comeback Time',
      message: `It's been ${Math.floor(ctx.hoursSinceLastSession / 24)} days. Let's get you back on track!`,
      actionUrl: '/dashboard',
      actionLabel: '10-Min Comeback',
    }),
  },

  // ============================================
  // STREAK PROTECTION
  // ============================================
  {
    id: 'streak_at_risk',
    name: 'Streak At Risk',
    description: 'User will lose their streak if they don\'t study today',
    triggerCondition: (ctx) => ctx.streakAtRisk && ctx.currentStreak >= 3,
    priority: 90,
    cooldownHours: 12,
    pushPayload: (ctx) => ({
      title: `🔥 ${ctx.currentStreak}-day streak at risk!`,
      body: 'A quick session will keep your streak alive.',
      url: '/dashboard',
    }),
    nudgeContent: (ctx) => ({
      type: 'STREAK_AT_RISK',
      title: `${ctx.currentStreak}-Day Streak!`,
      message: 'Study today to keep your streak alive 🔥',
      actionUrl: '/dashboard',
      actionLabel: 'Protect Streak',
    }),
  },

  // ============================================
  // SESSION READY
  // ============================================
  {
    id: 'session_ready',
    name: 'Study Session Ready',
    description: 'A new study session has been prepared',
    triggerCondition: (ctx) => ctx.pendingSessionsCount > 0,
    priority: 60,
    cooldownHours: 24,
    emailTemplate: 'SESSION_READY',
    pushPayload: (ctx) => ({
      title: '✨ Session Ready!',
      body: 'Your personalized study session is waiting.',
      url: '/dashboard',
    }),
    nudgeContent: (ctx) => ({
      type: 'SESSION_READY',
      title: 'Session Ready',
      message: 'Your next study session has been prepared!',
      actionUrl: '/dashboard',
      actionLabel: 'Start Studying',
    }),
  },

  // ============================================
  // NOTES PENDING
  // ============================================
  {
    id: 'notes_pending',
    name: 'Reading Notes Pending',
    description: 'User has unread notes to review',
    triggerCondition: (ctx) => ctx.hasUnreadNotes,
    priority: 50,
    cooldownHours: 48,
    pushPayload: () => ({
      title: '📖 Notes waiting for you',
      body: 'New study notes are ready to review.',
      url: '/study',
    }),
    nudgeContent: () => ({
      type: 'SESSION_READY',
      title: 'Notes Ready',
      message: 'You have new study notes waiting to be reviewed.',
      actionUrl: '/study',
      actionLabel: 'Review Notes',
    }),
  },

  // ============================================
  // EXAM COUNTDOWN
  // ============================================
  {
    id: 'exam_countdown_30d',
    name: 'Exam Countdown (30 days)',
    description: 'User is 30 days from exam',
    triggerCondition: (ctx) => ctx.daysUntilExam === 30,
    priority: 95,
    cooldownHours: 168, // Weekly
    emailTemplate: 'EXAM_COUNTDOWN',
    pushPayload: (ctx) => ({
      title: '⏰ 30 Days Until Exam!',
      body: `Current mastery: ${Math.round(ctx.overallMastery * 100)}%. Let's intensify!`,
      url: '/dashboard',
    }),
  },
  {
    id: 'exam_countdown_7d',
    name: 'Exam Countdown (7 days)',
    description: 'User is 7 days from exam',
    triggerCondition: (ctx) => ctx.daysUntilExam === 7,
    priority: 100,
    cooldownHours: 24,
    emailTemplate: 'EXAM_COUNTDOWN',
    pushPayload: (ctx) => ({
      title: '🚨 1 Week Remaining!',
      body: 'Final push time. Focus on your weak areas!',
      url: '/dashboard',
    }),
  },

  // ============================================
  // WEAK SKILL ALERT
  // ============================================
  {
    id: 'weak_skill_alert',
    name: 'Weak Skills Need Attention',
    description: 'User has multiple weak skills',
    triggerCondition: (ctx) => ctx.weakSkillCount >= 3 && ctx.examPhase === 'approaching',
    priority: 80,
    cooldownHours: 72,
    pushPayload: (ctx) => ({
      title: '📉 Skills Need Attention',
      body: `You have ${ctx.weakSkillCount} skills that need work before the exam.`,
      url: '/mastery',
    }),
    nudgeContent: (ctx) => ({
      type: 'BEHIND_SCHEDULE',
      title: `${ctx.weakSkillCount} Weak Skills`,
      message: 'Focus sessions have been prepared for your challenging areas.',
      actionUrl: '/mastery',
      actionLabel: 'View Skills',
    }),
  },
];

// ============================================
// POLICY EVALUATION
// ============================================

/**
 * Build user context from database for policy evaluation
 */
export async function buildUserContext(userId: string): Promise<UserContext | null> {
  // Get user info
  const [user] = await db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  // Get profile info
  const [profile] = await db
    .select({
      targetExamDate: userProfiles.targetExamDate,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  // Get last session
  const [lastSession] = await db
    .select({
      startedAt: studySessions.startedAt,
    })
    .from(studySessions)
    .where(eq(studySessions.userId, userId))
    .orderBy(desc(studySessions.startedAt))
    .limit(1);

  // Get sessions this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const sessionsThisWeek = await db
    .select({ count: sql<number>`count(*)` })
    .from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      gte(studySessions.startedAt, weekAgo)
    ));

  // Get streak info - compute from daily records
  // Get last 30 days of study activity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
  
  const streakRecords = await db
    .select({
      date: studyStreaks.date,
      minutesStudied: studyStreaks.minutesStudied,
    })
    .from(studyStreaks)
    .where(and(
      eq(studyStreaks.userId, userId),
      gte(studyStreaks.date, thirtyDaysAgoStr)
    ))
    .orderBy(desc(studyStreaks.date));

  // Calculate current streak from records
  let currentStreak = 0;
  const today = new Date().toISOString().split('T')[0];
  const sortedDates = streakRecords.map(r => r.date).sort().reverse();
  
  for (let i = 0; i < sortedDates.length; i++) {
    const expectedDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];
    if (sortedDates[i] === expectedDate) {
      currentStreak++;
    } else {
      break;
    }
  }

  const lastStudyDate = sortedDates[0] || null;

  // Get mastery info
  const masteryStats = await db
    .select({
      avgMastery: sql<number>`avg(p_mastery)`,
      weakCount: sql<number>`count(*) filter (where p_mastery < 0.4)`,
    })
    .from(masteryState)
    .where(eq(masteryState.userId, userId));

  // Get pending sessions
  const pendingSessions = await db
    .select({ count: sql<number>`count(*)` })
    .from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      eq(studySessions.status, 'READY')
    ));

  // Calculate derived values
  const lastSessionAt = lastSession?.startedAt || null;
  const hoursSinceLastSession = lastSessionAt
    ? (Date.now() - new Date(lastSessionAt).getTime()) / (1000 * 60 * 60)
    : 999;

  const todayStr = new Date().toISOString().split('T')[0];
  const streakAtRisk = lastStudyDate !== todayStr && currentStreak > 0;

  const daysUntilExam = profile?.targetExamDate
    ? Math.ceil((new Date(profile.targetExamDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const examPhase = daysUntilExam !== null
    ? (daysUntilExam <= 7 ? 'critical' : daysUntilExam <= 59 ? 'approaching' : 'distant')
    : null;

  return {
    userId: user.userId,
    email: user.email,
    displayName: user.displayName || undefined,
    lastSessionAt,
    hoursSinceLastSession,
    sessionsThisWeek: Number(sessionsThisWeek[0]?.count || 0),
    currentStreak,
    longestStreak: currentStreak, // Use current as longest for now
    streakAtRisk,
    overallMastery: Number(masteryStats[0]?.avgMastery || 0),
    weakSkillCount: Number(masteryStats[0]?.weakCount || 0),
    pendingSessionsCount: Number(pendingSessions[0]?.count || 0),
    daysUntilExam,
    examPhase,
    hasUnreadNotes: false, // TODO: Implement once notes tracking is added
  };
}

/**
 * Evaluate policies for a user and determine what notifications to send
 */
export async function evaluatePolicies(
  userId: string,
  sendNotifications = false
): Promise<PolicyEvaluationResult> {
  const ctx = await buildUserContext(userId);
  
  if (!ctx) {
    return {
      userId,
      triggeredPolicies: [],
      nudges: [],
      notificationsSent: { emailsSent: 0, pushSent: 0 },
    };
  }

  const triggeredPolicies: PolicyEvaluationResult['triggeredPolicies'] = [];
  const nudges: InAppNudge[] = [];
  let emailsSent = 0;
  let pushSent = 0;

  // Sort policies by priority (highest first)
  const sortedPolicies = [...REMINDER_POLICIES].sort((a, b) => b.priority - a.priority);

  for (const policy of sortedPolicies) {
    // Check if policy triggers
    if (!policy.triggerCondition(ctx)) {
      continue;
    }

    // Check cooldown
    const lastSent = await db
      .select({ createdAt: notificationLog.createdAt })
      .from(notificationLog)
      .where(and(
        eq(notificationLog.userId, userId),
        eq(notificationLog.template, policy.id)
      ))
      .orderBy(desc(notificationLog.createdAt))
      .limit(1);

    if (lastSent.length > 0) {
      const hoursSinceLastSend = (Date.now() - new Date(lastSent[0].createdAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastSend < policy.cooldownHours) {
        continue;
      }
    }

    // Policy triggered!
    const hasEmail = !!policy.emailTemplate;
    const hasPush = !!policy.pushPayload;
    const hasNudge = !!policy.nudgeContent;

    triggeredPolicies.push({
      policyId: policy.id,
      policyName: policy.name,
      priority: policy.priority,
      shouldEmail: hasEmail,
      shouldPush: hasPush,
      shouldNudge: hasNudge,
    });

    // Collect nudge
    if (hasNudge) {
      const nudge = policy.nudgeContent!(ctx);
      if (nudge) {
        nudges.push(nudge);
      }
    }

    // Send notifications if requested
    if (sendNotifications) {
      if (hasEmail && policy.emailTemplate) {
        const result = await sendNotificationEmail(userId, policy.emailTemplate as any, {
          userName: ctx.displayName || 'Student',
          sessionTopic: 'Your next topic',
          estimatedMinutes: '30',
          sessionUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://barexamprep.co.ke'}/dashboard`,
          lastTopic: 'Previous topic',
          comebackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://barexamprep.co.ke'}/dashboard`,
          daysRemaining: String(ctx.daysUntilExam || 30),
          masteryPercent: String(Math.round(ctx.overallMastery * 100)),
          focusAreas: '<li>Focus area 1</li><li>Focus area 2</li>',
          dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://barexamprep.co.ke'}/dashboard`,
        });
        if (result.success) emailsSent++;
      }

      if (hasPush && policy.pushPayload) {
        const payload = policy.pushPayload(ctx);
        const result = await sendPushNotification(userId, {
          title: payload.title,
          body: payload.body,
          url: payload.url,
          icon: '/icons/icon-192x192.png',
          tag: policy.id,
        });
        if (result.success) pushSent += result.sent;
      }
    }
  }

  return {
    userId,
    triggeredPolicies,
    nudges,
    notificationsSent: { emailsSent, pushSent },
  };
}

/**
 * Get in-app nudges for a user based on current policies
 */
export async function getNudgesForUser(userId: string): Promise<InAppNudge[]> {
  const result = await evaluatePolicies(userId, false);
  // Limit to top 3 nudges by priority
  return result.nudges.slice(0, 3);
}

/**
 * Process reminders for all eligible users (called by cron)
 */
export async function processRemindersWithPolicies(): Promise<{
  usersProcessed: number;
  emailsSent: number;
  pushSent: number;
}> {
  // Get active users
  const activeUsers = await db
    .select({ userId: users.id })
    .from(users)
    .where(eq(users.isActive, true))
    .limit(100);

  let usersProcessed = 0;
  let emailsSent = 0;
  let pushSent = 0;

  for (const user of activeUsers) {
    const result = await evaluatePolicies(user.userId, true);
    
    if (result.triggeredPolicies.length > 0) {
      usersProcessed++;
      emailsSent += result.notificationsSent.emailsSent;
      pushSent += result.notificationsSent.pushSent;
    }
  }

  return { usersProcessed, emailsSent, pushSent };
}

export default {
  REMINDER_POLICIES,
  buildUserContext,
  evaluatePolicies,
  getNudgesForUser,
  processRemindersWithPolicies,
};
