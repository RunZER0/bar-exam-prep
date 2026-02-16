/**
 * /api/admin/jobs
 * 
 * Admin API for viewing background job status
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { backgroundJobs, users } from '@/lib/db/schema';
import { desc, eq, and, or, gte } from 'drizzle-orm';

// GET: List recent jobs and statistics
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status'); // PENDING, PROCESSING, COMPLETED, FAILED
    const jobType = url.searchParams.get('type');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const includeOld = url.searchParams.get('includeOld') === 'true';

    // Build where conditions
    const conditions = [];
    
    if (status) {
      conditions.push(eq(backgroundJobs.status, status as any));
    }
    
    if (jobType) {
      conditions.push(eq(backgroundJobs.jobType, jobType));
    }
    
    // By default, only show jobs from last 24 hours
    if (!includeOld) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      conditions.push(gte(backgroundJobs.createdAt, oneDayAgo));
    }

    // Fetch jobs
    const jobs = await db
      .select({
        id: backgroundJobs.id,
        jobType: backgroundJobs.jobType,
        status: backgroundJobs.status,
        priority: backgroundJobs.priority,
        attempts: backgroundJobs.attempts,
        maxAttempts: backgroundJobs.maxAttempts,
        lastError: backgroundJobs.lastError,
        createdAt: backgroundJobs.createdAt,
        startedAt: backgroundJobs.startedAt,
        completedAt: backgroundJobs.completedAt,
        userId: backgroundJobs.userId,
      })
      .from(backgroundJobs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(backgroundJobs.createdAt))
      .limit(limit);

    // Get statistics
    const stats = await getJobStats();

    return NextResponse.json({
      success: true,
      jobs,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[admin/jobs] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

// POST: Retry failed job or cancel pending job
export async function POST(request: Request) {
  try {
    const { action, jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID required' },
        { status: 400 }
      );
    }

    const [job] = await db
      .select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.id, jobId))
      .limit(1);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'retry':
        if (job.status !== 'FAILED') {
          return NextResponse.json(
            { error: 'Can only retry failed jobs' },
            { status: 400 }
          );
        }

        await db
          .update(backgroundJobs)
          .set({
            status: 'PENDING',
            attempts: 0,
            lastError: null,
            startedAt: null,
            completedAt: null,
          })
          .where(eq(backgroundJobs.id, jobId));

        return NextResponse.json({ success: true, message: 'Job queued for retry' });

      case 'cancel':
        if (job.status !== 'PENDING') {
          return NextResponse.json(
            { error: 'Can only cancel pending jobs' },
            { status: 400 }
          );
        }

        await db
          .update(backgroundJobs)
          .set({ status: 'CANCELLED' })
          .where(eq(backgroundJobs.id, jobId));

        return NextResponse.json({ success: true, message: 'Job cancelled' });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[admin/jobs] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    );
  }
}

// Helper: Get job statistics
async function getJobStats() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Count by status
  const allJobs = await db
    .select({
      status: backgroundJobs.status,
      jobType: backgroundJobs.jobType,
    })
    .from(backgroundJobs)
    .where(gte(backgroundJobs.createdAt, oneDayAgo));

  const counts: Record<string, number> = {};
  const typeBreakdown: Record<string, number> = {};

  for (const job of allJobs) {
    counts[job.status] = (counts[job.status] || 0) + 1;
    typeBreakdown[job.jobType] = (typeBreakdown[job.jobType] || 0) + 1;
  }

  // Recent failures (last hour)
  const recentFailures = allJobs.filter(j => 
    j.status === 'FAILED'
  ).length;

  return {
    total24h: allJobs.length,
    byStatus: counts,
    byType: typeBreakdown,
    recentFailures,
  };
}
