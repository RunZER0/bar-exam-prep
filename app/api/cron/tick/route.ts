/**
 * /api/cron/tick
 * 
 * Scheduled task endpoint - called by external cron service
 * (GitHub Actions, cron-job.org, UptimeRobot, etc.)
 * 
 * Handles:
 * - Daily reminder emails
 * - Push notifications
 * - Cleanup tasks
 */

import { NextResponse } from 'next/server';
import { processReminderTick } from '@/lib/services/notification-service';
import { headers } from 'next/headers';

// Security: Require a secret token for cron calls
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  // Verify cron secret
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  const cronToken = authHeader?.replace('Bearer ', '');
  
  // Also check query param for simpler cron services
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token');
  
  const providedToken = cronToken || queryToken;
  
  if (CRON_SECRET && providedToken !== CRON_SECRET) {
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
