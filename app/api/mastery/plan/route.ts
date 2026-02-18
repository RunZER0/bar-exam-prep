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
import { eq, sql } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import {
  generateDailyPlan,
  determineExamPhase,
  MASTERY_CONFIG,
  type PlannerInput,
} from '@/lib/services/mastery-engine';

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
    
    // Get user profile for exam dates and weak/strong areas
    const userProfileResult = await db.execute(sql`
      SELECT 
        target_exam_date,
        weak_areas,
        strong_areas
      FROM user_profiles
      WHERE user_id = ${user.id}
      LIMIT 1
    `);
    
    const userProfile = userProfileResult.rows[0] as { 
      target_exam_date: string | null;
      weak_areas: string[] | null;
      strong_areas: string[] | null;
    } | undefined;
    
    // Calculate days until exam (use profile if available, else default)
    let daysUntilWritten = 45;
    let daysUntilOral = 60;
    
    if (userProfile?.target_exam_date) {
      const examDate = new Date(userProfile.target_exam_date);
      const now = new Date();
      daysUntilWritten = Math.max(0, Math.floor((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      daysUntilOral = daysUntilWritten + 15; // Oral typically 2 weeks after written
    }
    
    const weakAreas = userProfile?.weak_areas || [];
    const strongAreas = userProfile?.strong_areas || [];
    
    const examPhase = determineExamPhase(daysUntilWritten);
    
    // Query REAL skills from database
    const skillsResult = await db.execute(sql`
      SELECT 
        ms.id as skill_id,
        ms.name,
        ms.unit_id,
        ms.exam_weight,
        ms.difficulty,
        ms.format_tags,
        ms.is_core
      FROM micro_skills ms
      WHERE ms.is_active = true
      ORDER BY ms.exam_weight DESC
      LIMIT 50
    `);
    
    // Query REAL mastery state for this user
    const masteryResult = await db.execute(sql`
      SELECT 
        skill_id,
        p_mastery,
        stability,
        last_practiced_at,
        next_review_date,
        is_verified
      FROM mastery_state
      WHERE user_id = ${user.id}::uuid
    `);
    
    // Query REAL items from database
    const itemsResult = await db.execute(sql`
      SELECT 
        i.id as item_id,
        i.item_type,
        i.format,
        i.difficulty,
        i.estimated_minutes,
        i.prompt,
        ism.skill_id
      FROM items i
      JOIN item_skill_map ism ON i.id = ism.item_id
      WHERE i.is_active = true
    `);
    
    // Build planner input from real database data
    const plannerInput: PlannerInput = {
      userId: user.id,
      timeBudgetMinutes: 60, 
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
    
    // Populate skills from real DB data
    const skills = skillsResult.rows as Array<{
      skill_id: string;
      name: string;
      unit_id: string;
      exam_weight: string;
      difficulty: string;
      format_tags: string[];
      is_core: boolean;
    }>;
    
    for (const skill of skills) {
      const difficultyNum = skill.difficulty === 'foundation' ? 2 : skill.difficulty === 'advanced' ? 4 : 3;
      plannerInput.skills.set(skill.skill_id, {
        skillId: skill.skill_id,
        name: skill.name,
        unitId: skill.unit_id,
        examWeight: parseFloat(skill.exam_weight) || 0.05,
        difficulty: difficultyNum,
        formatTags: skill.format_tags || ['written'],
        isCore: skill.is_core,
      });
    }
    
    // Populate mastery states from real DB data
    const masteryStates = masteryResult.rows as Array<{
      skill_id: string;
      p_mastery: string;
      stability: string;
      last_practiced_at: string | null;
      next_review_date: string | null;
      is_verified: boolean;
    }>;
    
    const masteryMap = new Map(masteryStates.map(m => [m.skill_id, m]));
    
    for (const skill of skills) {
      const mastery = masteryMap.get(skill.skill_id);
      
      // If no existing mastery state, derive initial value from user profile
      // Values: strong=25%, neutral=10%, weak=5%
      let initialPMastery = 0.10; // Default neutral
      if (!mastery) {
        if (strongAreas.includes(skill.unit_id)) {
          initialPMastery = 0.25; // Strong area
        } else if (weakAreas.includes(skill.unit_id)) {
          initialPMastery = 0.05; // Weak area - needs focus
        }
      }
      
      plannerInput.masteryStates.set(skill.skill_id, {
        skillId: skill.skill_id,
        pMastery: mastery ? parseFloat(mastery.p_mastery) : initialPMastery,
        stability: mastery ? parseFloat(mastery.stability) : 1.0,
        lastPracticedAt: mastery?.last_practiced_at ? new Date(mastery.last_practiced_at) : null,
        nextReviewDate: mastery?.next_review_date ? new Date(mastery.next_review_date) : null,
        isVerified: mastery?.is_verified || false,
      });
    }
    
    // Populate items from real DB data
    const items = itemsResult.rows as Array<{
      item_id: string;
      skill_id: string;
      item_type: string;
      format: string;
      difficulty: number;
      estimated_minutes: number;
      prompt: string;
    }>;
    
    for (const item of items) {
      const existing = plannerInput.availableItems.get(item.skill_id) ?? [];
      existing.push({
        itemId: item.item_id,
        skillId: item.skill_id,
        itemType: item.item_type,
        difficulty: item.difficulty,
        estimatedMinutes: item.estimated_minutes,
      });
      plannerInput.availableItems.set(item.skill_id, existing);
    }
    
    // Generate plan using real data
    const plan = generateDailyPlan(plannerInput);
    
    // Get unit IDs from skills
    const taskUnitIds = plan.tasks.map(t => {
      const skill = plannerInput.skills.get(t.skillId);
      return skill?.unitId || 'atp-100';
    });
    
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
      tasks: plan.tasks.map((task, index) => {
        const skill = plannerInput.skills.get(task.skillId);
        return {
          id: `task-${index}`,
          taskType: task.taskType,
          itemId: task.itemId,
          skillId: task.skillId,
          skillName: skill?.name || task.title,
          unitId: skill?.unitId || 'atp-100',
          format: task.format,
          mode: task.mode,
          title: task.title,
          description: task.description,
          estimatedMinutes: task.estimatedMinutes,
          order: task.order,
          priorityScore: task.priorityScore,
          scoringFactors: task.scoringFactors || {
            learningGain: 0.25,
            retentionGain: 0.25,
            examRoi: 0.25,
            errorClosure: 0.25,
          },
          rationale: task.rationale,
          whySelected: task.whySelected,
          status: 'pending',
        };
      }),
      summary: {
        primaryObjective: `Focus on ${plan.examPhase === 'critical' ? 'timed practice' : 'skill development'}`,
        focusUnits: [...new Set(taskUnitIds.slice(0, 3))],
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
