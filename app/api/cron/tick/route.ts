/**
 * /api/cron/tick
 * 
 * Scheduled task endpoint - called by external cron service
 * (GitHub Actions, cron-job.org, UptimeRobot, etc.)
 * OR triggered automatically by the client-side autonomous preload
 * when an authenticated user opens the app.
 * 
 * Handles:
 * - Daily reminder emails
 * - Push notifications
 * - Cleanup tasks
 */

import { NextResponse } from 'next/server';
import { processReminderTick } from '@/lib/services/notification-service';
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

    // Process reminders
    const reminderResult = await processReminderTick();

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      reminders: reminderResult,
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
