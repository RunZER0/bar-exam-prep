/**
 * Pacing Engine
 * 
 * Monitors study sessions in real-time to:
 * 1. Track continuous study time
 * 2. Detect performance drops (fatigue signal)
 * 3. Suggest breaks at optimal intervals
 * 4. Record pacing events for analytics
 * 
 * Research-backed defaults:
 * - Pomodoro intervals: 25 min study, 5 min break
 * - Performance drop: 2+ consecutive wrong answers
 * - Extended session: suggest longer break after 90 min
 */

import { db } from '@/lib/db';
import { sessionEvents, studySessions, studyStreaks } from '@/lib/db/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

// Pacing thresholds
export const PACING_CONFIG = {
  // Time thresholds (minutes)
  shortBreakAfter: 25,      // Suggest 5-min break
  longBreakAfter: 90,       // Suggest 15-min break
  maxContinuousStudy: 120,  // Strongly suggest break
  
  // Performance thresholds
  consecutiveWrongTrigger: 2,  // Suggest break after 2 wrong
  performanceDropThreshold: 0.3, // 30% drop from rolling avg
  consecutiveWrongForSwitch: 3,  // M2: Suggest switch after 3 consecutive wrong on same skill
  
  // Break durations (minutes)
  shortBreakDuration: 5,
  longBreakDuration: 15,
  extendedBreakDuration: 30,
};

export type BreakSuggestion = {
  shouldBreak: boolean;
  reason: 'time_threshold' | 'performance_drop' | 'consecutive_wrong' | 'extended_session' | null;
  suggestedDuration: number;
  message: string;
  urgency: 'low' | 'medium' | 'high';
};

// M2: Switch suggestion type
export type SwitchSuggestion = {
  shouldSwitch: boolean;
  reason: 'consecutive_wrong' | 'performance_drop' | 'fatigue' | null;
  currentSkillId: string | null;
  suggestedSkillId: string | null;
  message: string;
  urgency: 'low' | 'medium' | 'high';
};

export type SessionPacingState = {
  sessionId: string;
  startedAt: Date;
  minutesStudied: number;
  recentPerformance: number[];  // Last 5 scores (0-1)
  consecutiveWrong: number;
  breaksTaken: number;
  lastBreakAt: Date | null;
};

/**
 * Analyze current session and determine if a break is needed
 */
export function analyzePacing(state: SessionPacingState): BreakSuggestion {
  const { minutesStudied, consecutiveWrong, recentPerformance, lastBreakAt } = state;

  // Calculate minutes since last break
  const minutesSinceBreak = lastBreakAt
    ? Math.round((Date.now() - lastBreakAt.getTime()) / 60000)
    : minutesStudied;

  // Check for extended session (strongest signal)
  if (minutesSinceBreak >= PACING_CONFIG.maxContinuousStudy) {
    return {
      shouldBreak: true,
      reason: 'extended_session',
      suggestedDuration: PACING_CONFIG.extendedBreakDuration,
      message: `You've been studying for ${minutesSinceBreak} minutes! Your brain needs a longer rest to consolidate what you've learned.`,
      urgency: 'high',
    };
  }

  // Check for consecutive wrong answers (fatigue signal)
  if (consecutiveWrong >= PACING_CONFIG.consecutiveWrongTrigger) {
    return {
      shouldBreak: true,
      reason: 'consecutive_wrong',
      suggestedDuration: PACING_CONFIG.shortBreakDuration,
      message: `Let's take a quick break. A fresh mind will help you tackle these questions better.`,
      urgency: 'medium',
    };
  }

  // Check for performance drop
  if (recentPerformance.length >= 3) {
    const recentAvg = recentPerformance.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const previousAvg = recentPerformance.length >= 5
      ? recentPerformance.slice(0, -3).reduce((a, b) => a + b, 0) / (recentPerformance.length - 3)
      : recentAvg;

    if (previousAvg - recentAvg >= PACING_CONFIG.performanceDropThreshold) {
      return {
        shouldBreak: true,
        reason: 'performance_drop',
        suggestedDuration: PACING_CONFIG.shortBreakDuration,
        message: `Your accuracy has dipped. A short break can help you refocus.`,
        urgency: 'medium',
      };
    }
  }

  // Check for time-based break (long session)
  if (minutesSinceBreak >= PACING_CONFIG.longBreakAfter) {
    return {
      shouldBreak: true,
      reason: 'time_threshold',
      suggestedDuration: PACING_CONFIG.longBreakDuration,
      message: `Great progress! After ${minutesSinceBreak} minutes, a 15-minute break will help you retain more.`,
      urgency: 'low',
    };
  }

  // Check for Pomodoro interval
  if (minutesSinceBreak >= PACING_CONFIG.shortBreakAfter) {
    return {
      shouldBreak: true,
      reason: 'time_threshold',
      suggestedDuration: PACING_CONFIG.shortBreakDuration,
      message: `One Pomodoro complete! Take a quick 5-minute break.`,
      urgency: 'low',
    };
  }

  // No break needed
  return {
    shouldBreak: false,
    reason: null,
    suggestedDuration: 0,
    message: '',
    urgency: 'low',
  };
}

/**
 * Get current pacing state for a session from database
 */
export async function getSessionPacingState(sessionId: string): Promise<SessionPacingState | null> {
  const [session] = await db.select().from(studySessions)
    .where(eq(studySessions.id, sessionId))
    .limit(1);

  if (!session || !session.startedAt) {
    return null;
  }

  // Get session events
  const events = await db.select().from(sessionEvents)
    .where(eq(sessionEvents.sessionId, sessionId))
    .orderBy(desc(sessionEvents.createdAt));

  // Calculate performance from practice/checkpoint answers
  const performanceEvents = events.filter(e => 
    e.eventType === 'PRACTICE_ANSWER' || e.eventType === 'CHECKPOINT_ANSWER'
  );
  
  const recentPerformance = performanceEvents
    .slice(0, 10)
    .map(e => {
      const data = e.eventData as any;
      return data?.score ?? (data?.correct ? 1 : 0);
    })
    .reverse();

  // Count consecutive wrong answers
  let consecutiveWrong = 0;
  for (const event of performanceEvents) {
    const data = event.eventData as any;
    const correct = data?.score === 1 || data?.correct;
    if (!correct) {
      consecutiveWrong++;
    } else {
      break;
    }
  }

  // Find breaks taken
  const breakEvents = events.filter(e => e.eventType === 'SESSION_PAUSE');
  const lastBreakEvent = breakEvents[0];

  // Calculate minutes studied
  const minutesStudied = Math.round(
    (Date.now() - new Date(session.startedAt).getTime()) / 60000
  );

  return {
    sessionId,
    startedAt: new Date(session.startedAt),
    minutesStudied,
    recentPerformance,
    consecutiveWrong,
    breaksTaken: breakEvents.length,
    lastBreakAt: lastBreakEvent ? new Date(lastBreakEvent.createdAt) : null,
  };
}

/**
 * Record a pacing suggestion event
 */
export async function recordPacingSuggestion(
  sessionId: string,
  suggestion: BreakSuggestion
): Promise<void> {
  if (!suggestion.shouldBreak) return;

  await db.insert(sessionEvents).values({
    sessionId,
    eventType: 'PACING_SUGGESTION',
    eventData: {
      reason: suggestion.reason,
      suggestedDuration: suggestion.suggestedDuration,
      urgency: suggestion.urgency,
      message: suggestion.message,
    },
  });
}

/**
 * Record when user takes a break
 */
export async function recordBreakTaken(
  sessionId: string,
  duration: number,
  userInitiated: boolean
): Promise<void> {
  await db.insert(sessionEvents).values({
    sessionId,
    eventType: 'BREAK_TAKEN',
    eventData: {
      duration,
      userInitiated,
      takenAt: new Date().toISOString(),
    },
  });
}

/**
 * M2: Analyze if user should switch skills
 * Called after consecutive wrong answers
 */
export async function analyzeSwitchNeed(
  sessionId: string,
  currentSkillId: string,
  consecutiveWrong: number
): Promise<SwitchSuggestion> {
  // Check if consecutive wrong threshold reached
  if (consecutiveWrong >= PACING_CONFIG.consecutiveWrongForSwitch) {
    return {
      shouldSwitch: true,
      reason: 'consecutive_wrong',
      currentSkillId,
      suggestedSkillId: null, // To be filled by caller with next skill in plan
      message: `${consecutiveWrong} consecutive challenging questions. Switching topics can help reset your focus.`,
      urgency: 'medium',
    };
  }

  return {
    shouldSwitch: false,
    reason: null,
    currentSkillId,
    suggestedSkillId: null,
    message: '',
    urgency: 'low',
  };
}

/**
 * M2: Record switch suggestion event
 */
export async function recordSwitchSuggestion(
  sessionId: string,
  suggestion: SwitchSuggestion
): Promise<void> {
  if (!suggestion.shouldSwitch) return;

  await db.insert(sessionEvents).values({
    sessionId,
    eventType: 'SWITCH_SUGGESTED',
    eventData: {
      reason: suggestion.reason,
      currentSkillId: suggestion.currentSkillId,
      suggestedSkillId: suggestion.suggestedSkillId,
      urgency: suggestion.urgency,
      message: suggestion.message,
    },
  });
}

/**
 * M2: Record switch response (accepted or declined)
 */
export async function recordSwitchResponse(
  sessionId: string,
  accepted: boolean,
  newSkillId?: string
): Promise<void> {
  await db.insert(sessionEvents).values({
    sessionId,
    eventType: accepted ? 'SWITCH_ACCEPTED' : 'SWITCH_DECLINED',
    eventData: {
      accepted,
      newSkillId,
      respondedAt: new Date().toISOString(),
    },
  });
}

/**
 * Get today's cumulative study time for pacing across sessions
 */
export async function getTodayCumulativeStudy(userId: string): Promise<{
  totalMinutes: number;
  sessionsCompleted: number;
  breaksTaken: number;
  averageSessionMinutes: number;
}> {
  const today = new Date().toISOString().split('T')[0];

  // Get today's streak record
  const [streak] = await db.select().from(studyStreaks)
    .where(and(
      eq(studyStreaks.userId, userId),
      eq(studyStreaks.date, today)
    ))
    .limit(1);

  // Get today's completed sessions
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  
  const sessions = await db.select().from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      eq(studySessions.status, 'COMPLETED'),
      sql`${studySessions.createdAt} >= ${startOfDay}`,
      sql`${studySessions.createdAt} <= ${endOfDay}`
    ));

  // Count breaks across all sessions
  let totalBreaks = 0;
  for (const session of sessions) {
    const breaks = await db.select().from(sessionEvents)
      .where(and(
        eq(sessionEvents.sessionId, session.id),
        eq(sessionEvents.eventType, 'BREAK_TAKEN')
      ));
    totalBreaks += breaks.length;
  }

  const totalMinutes = streak?.minutesStudied || 0;
  const sessionsCompleted = sessions.length;

  return {
    totalMinutes,
    sessionsCompleted,
    breaksTaken: totalBreaks,
    averageSessionMinutes: sessionsCompleted > 0 
      ? Math.round(totalMinutes / sessionsCompleted) 
      : 0,
  };
}

/**
 * Generate pacing insights for analytics
 */
export async function generatePacingInsights(userId: string, daysBack: number = 7): Promise<{
  averageDailyMinutes: number;
  averageSessionLength: number;
  breakComplianceRate: number;
  performanceBeforeBreak: number;
  performanceAfterBreak: number;
  recommendations: string[];
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Get streak data for the period
  const streaks = await db.select().from(studyStreaks)
    .where(and(
      eq(studyStreaks.userId, userId),
      gte(studyStreaks.date, startDateStr)
    ));

  // Calculate averages
  const totalMinutes = streaks.reduce((sum, s) => sum + (s.minutesStudied || 0), 0);
  const totalSessions = streaks.reduce((sum, s) => sum + (s.sessionsCompleted || 0), 0);
  
  const averageDailyMinutes = streaks.length > 0 
    ? Math.round(totalMinutes / streaks.length) 
    : 0;
  
  const averageSessionLength = totalSessions > 0 
    ? Math.round(totalMinutes / totalSessions) 
    : 0;

  // TODO: Calculate break compliance from session events
  // For now, return placeholder values
  const breakComplianceRate = 0.75;
  const performanceBeforeBreak = 0.65;
  const performanceAfterBreak = 0.82;

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (averageDailyMinutes < 60) {
    recommendations.push('Try to study at least 60 minutes daily for better retention.');
  }
  
  if (averageSessionLength > 45) {
    recommendations.push('Your sessions are quite long. Consider more frequent short breaks.');
  }
  
  if (averageSessionLength < 15) {
    recommendations.push('Short sessions work better when combined with longer focus periods.');
  }

  return {
    averageDailyMinutes,
    averageSessionLength,
    breakComplianceRate,
    performanceBeforeBreak,
    performanceAfterBreak,
    recommendations,
  };
}
