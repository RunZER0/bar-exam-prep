/**
 * YNAI Mastery Engine v3 - Daily Plan API
 * 
 * GET: Fetch or generate today's plan
 * POST: Generate a new plan for specified date
 * PATCH: Update task status (completed, skipped, deferred)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import {
  generateDailyPlan,
  determineExamPhase,
  MASTERY_CONFIG,
  type PlannerInput,
} from '@/lib/services/mastery-engine';

// Import mastery schema tables (when migrated)
// import { dailyPlans, dailyPlanItems, masteryState, microSkills, items, itemSkillMap } from '@/lib/db/mastery-schema';

/**
 * GET /api/mastery/plan
 * Fetch today's plan or generate if not exists
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const today = new Date().toISOString().split('T')[0];
    
    // TODO: When schema is migrated, fetch from database
    // For now, generate a demo plan
    
    // Get user's exam dates (mock for now)
    const daysUntilWritten = 45; // Would come from user profile / kslTimelines
    const daysUntilOral = 60;
    
    const examPhase = determineExamPhase(daysUntilWritten);
    
    // Build planner input (simplified for now - real version pulls from DB)
    const plannerInput: PlannerInput = {
      userId: user.id,
      timeBudgetMinutes: 60, // From user profile
      examPhase,
      daysUntilWritten,
      daysUntilOral,
      masteryStates: new Map(),
      coverageDebts: new Map(),
      errorSignatures: new Map(),
      skills: new Map(),
      availableItems: new Map(),
      recentActivities: [],
    };
    
    // Generate demo micro-skills and items based on ATP units
    const demoSkills = [
      { skillId: 'skill-1', name: 'Issue Spotting in Civil Procedure', unitId: 'atp-100', examWeight: 0.15, difficulty: 3, formatTags: ['written'], isCore: true },
      { skillId: 'skill-2', name: 'Application for Injunction', unitId: 'atp-100', examWeight: 0.10, difficulty: 4, formatTags: ['drafting'], isCore: false },
      { skillId: 'skill-3', name: 'Criminal Bail Procedure', unitId: 'atp-101', examWeight: 0.12, difficulty: 3, formatTags: ['oral'], isCore: true },
      { skillId: 'skill-4', name: 'Evidence Act s.34 Analysis', unitId: 'atp-101', examWeight: 0.08, difficulty: 4, formatTags: ['written'], isCore: false },
      { skillId: 'skill-5', name: 'Grant of Probate Application', unitId: 'atp-102', examWeight: 0.10, difficulty: 3, formatTags: ['drafting'], isCore: true },
    ];
    
    const demoItems = [
      { itemId: 'item-1', skillId: 'skill-1', itemType: 'issue_spot', difficulty: 3, estimatedMinutes: 20 },
      { itemId: 'item-2', skillId: 'skill-2', itemType: 'drafting_task', difficulty: 4, estimatedMinutes: 30 },
      { itemId: 'item-3', skillId: 'skill-3', itemType: 'oral_prompt', difficulty: 3, estimatedMinutes: 15 },
      { itemId: 'item-4', skillId: 'skill-4', itemType: 'mcq', difficulty: 3, estimatedMinutes: 10 },
      { itemId: 'item-5', skillId: 'skill-5', itemType: 'drafting_task', difficulty: 3, estimatedMinutes: 25 },
    ];
    
    // Populate maps
    for (const skill of demoSkills) {
      plannerInput.skills.set(skill.skillId, skill);
      plannerInput.masteryStates.set(skill.skillId, {
        skillId: skill.skillId,
        pMastery: Math.random() * 0.6, // Random low mastery for demo
        stability: 1.0,
        lastPracticedAt: null,
        nextReviewDate: null,
        isVerified: false,
      });
    }
    
    for (const item of demoItems) {
      const existing = plannerInput.availableItems.get(item.skillId) ?? [];
      existing.push(item);
      plannerInput.availableItems.set(item.skillId, existing);
    }
    
    // Generate plan
    const plan = generateDailyPlan(plannerInput);
    
    return NextResponse.json({
      plan: {
        id: `plan-${today}`,
        date: today,
        examPhase: plan.examPhase,
        totalMinutesPlanned: plan.totalMinutes,
        totalMinutesCompleted: 0,
        daysUntilWritten,
        daysUntilOral,
        isGenerated: true,
        generatedAt: new Date().toISOString(),
      },
      tasks: plan.tasks.map((task, index) => ({
        id: `task-${index}`,
        ...task,
        status: 'pending',
      })),
      summary: {
        primaryObjective: `Focus on ${plan.examPhase === 'critical' ? 'timed practice' : 'skill development'}`,
        focusUnits: ['Civil Litigation', 'Criminal Litigation'],
        totalTasks: plan.tasks.length,
      },
    });

  } catch (error) {
    console.error('Error fetching daily plan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily plan' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mastery/plan
 * Generate a new plan (force regenerate)
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { date, timeBudgetMinutes } = body;
    
    // TODO: Implement force regeneration
    // This would:
    // 1. Clear existing plan for the date
    // 2. Re-pull mastery states
    // 3. Re-calculate coverage debt
    // 4. Generate fresh plan
    
    return NextResponse.json({
      success: true,
      message: 'Plan generation triggered',
      date: date ?? new Date().toISOString().split('T')[0],
    });

  } catch (error) {
    console.error('Error generating plan:', error);
    return NextResponse.json(
      { error: 'Failed to generate plan' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/mastery/plan
 * Update task status
 */
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { taskId, status, actualMinutes, deferredTo } = body;
    
    if (!taskId || !status) {
      return NextResponse.json({ error: 'taskId and status required' }, { status: 400 });
    }
    
    if (!['pending', 'in_progress', 'completed', 'skipped', 'deferred'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    
    // TODO: Update in database when schema is migrated
    // await db.update(dailyPlanItems)
    //   .set({ 
    //     status, 
    //     actualMinutes, 
    //     deferredTo,
    //     completedAt: status === 'completed' ? new Date() : null,
    //     skippedAt: status === 'skipped' ? new Date() : null,
    //   })
    //   .where(and(
    //     eq(dailyPlanItems.id, taskId),
    //     eq(dailyPlanItems.userId, user.id)
    //   ));
    
    return NextResponse.json({
      success: true,
      taskId,
      status,
      updatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}
