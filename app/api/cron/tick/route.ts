/**
 * /api/cron/tick
 * 
 * Scheduled task endpoint - called by external cron service
 * (GitHub Actions, cron-job.org, UptimeRobot, etc.)
 * OR triggered automatically by the client-side autonomous preload
 * when an authenticated user opens the app.
 * 
 * Handles:
 * - Daily reminder emails (personalized with AI-planned unit)
 * - Weekly progress report emails (Sundays)
 * - Fun fact emails (Wednesdays & Saturdays)
 * - Trial expiry warning emails (24h before expiry)
 * - Push notifications
 * - Cleanup tasks
 */

import { NextResponse } from 'next/server';
import { processReminderTick, processWeeklyReports, processFunFactEmails, processTrialExpiryCheck } from '@/lib/services/notification-service';
import { processRemindersWithPolicies } from '@/lib/services/reminder-policies';
import { verifyIdToken } from '@/lib/firebase/admin';
import { headers } from 'next/headers';

// Security: Require a secret token OR valid Firebase auth for cron calls
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  // Verify cron secret or Firebase auth
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  const bearerToken = authHeader?.replace('Bearer ', '');
  
  // Also check query param for simpler cron services
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token');
  
  const providedToken = bearerToken || queryToken;
  
  let authorized = false;

  // Method 1: CRON_SECRET match
  if (!CRON_SECRET) {
    // No secret configured — allow all (dev mode)
    authorized = true;
  } else if (providedToken === CRON_SECRET) {
    authorized = true;
  }

  // Method 2: Valid Firebase auth token (from autonomous preload)
  if (!authorized && bearerToken) {
    try {
      await verifyIdToken(bearerToken);
      authorized = true;
    } catch {
      // Token is neither CRON_SECRET nor valid Firebase token
    }
  }

  if (!authorized) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const startTime = Date.now();

    // 1. Process daily reminders (personalized with AI-planned units)
    let reminderResult: { processed: number; emailsSent: number; pushSent: number; error?: string } = { processed: 0, emailsSent: 0, pushSent: 0 };
    try {
      reminderResult = await processReminderTick();
    } catch (e) {
      console.error('[cron/tick] processReminderTick failed:', e);
      reminderResult.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // 2. Process weekly reports (idempotent — only sends once per week per user)
    let weeklyResult: { processed: number; emailsSent: number; error?: string } = { processed: 0, emailsSent: 0 };
    try {
      weeklyResult = await processWeeklyReports();
    } catch (e) {
      console.error('[cron/tick] processWeeklyReports failed:', e);
      weeklyResult.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // 3. Process fun fact emails (only on Wednesdays & Saturdays, max once/week)
    let funFactResult: { processed: number; emailsSent: number; error?: string } = { processed: 0, emailsSent: 0 };
    try {
      funFactResult = await processFunFactEmails();
    } catch (e) {
      console.error('[cron/tick] processFunFactEmails failed:', e);
      funFactResult.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // 4. Check for expiring trials and send warning emails (event-driven)
    let trialExpiryResult: { processed: number; emailsSent: number; error?: string } = { processed: 0, emailsSent: 0 };
    try {
      trialExpiryResult = await processTrialExpiryCheck();
    } catch (e) {
      console.error('[cron/tick] processTrialExpiryCheck failed:', e);
      trialExpiryResult.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // 5. Process policy-based reminders (MISSED_DAY, SESSION_READY, EXAM_COUNTDOWN)
    let policyResult: { usersProcessed: number; emailsSent: number; pushSent: number; error?: string } = { usersProcessed: 0, emailsSent: 0, pushSent: 0 };
    try {
      policyResult = await processRemindersWithPolicies();
    } catch (e) {
      console.error('[cron/tick] processRemindersWithPolicies failed:', e);
      policyResult.error = e instanceof Error ? e.message : 'Unknown error';
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      reminders: reminderResult,
      weeklyReports: weeklyResult,
      funFacts: funFactResult,
      trialExpiry: trialExpiryResult,
      policyReminders: policyResult,
    });
  } catch (error) {
    console.error('[cron/tick] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Cron tick failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST also supported for webhook-style cron
export async function POST(request: Request) {
  return GET(request);
}
