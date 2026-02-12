import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  users, studyPlans, studyPlanItems, onboardingResponses, 
  userProfiles, kslTimelines 
} from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { generateStudyPlan, type UserStudyProfile } from '@/lib/services/study-planner';

/**
 * GET /api/tutor/plan
 * Fetch the user's current study plan
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    // Get user
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get active study plan
    const [plan] = await db.select().from(studyPlans)
      .where(and(
        eq(studyPlans.userId, user.id),
        eq(studyPlans.status, 'active')
      ))
      .orderBy(desc(studyPlans.createdAt))
      .limit(1);

    if (!plan) {
      return NextResponse.json({ plan: null, message: 'No active study plan found' });
    }

    // Get plan items
    const items = await db.select().from(studyPlanItems)
      .where(eq(studyPlanItems.studyPlanId, plan.id))
      .orderBy(studyPlanItems.scheduledDate, studyPlanItems.priority);

    return NextResponse.json({
      plan: {
        ...plan,
        items,
      },
    });
  } catch (error) {
    console.error('Error fetching study plan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch study plan' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tutor/plan
 * Generate a new AI study plan based on user profile
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    // Get user
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user profile and onboarding responses
    const [profile] = await db.select().from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    const [onboarding] = await db.select().from(onboardingResponses)
      .where(eq(onboardingResponses.userId, user.id))
      .limit(1);

    // Build user study profile
    const studyProfile: UserStudyProfile = {
      userId: user.id,
      weakUnits: (onboarding?.weakUnits as string[]) || (profile?.weakAreas as string[]) || [],
      strongUnits: (onboarding?.strongUnits as string[]) || (profile?.strongAreas as string[]) || [],
      dailyMinutes: ((onboarding?.dailyStudyHours || 2) * 60),
      weekendMinutes: ((onboarding?.weekendStudyHours || 3) * 60),
      preferredStudyTime: (onboarding?.preferredStudyTime as UserStudyProfile['preferredStudyTime']) || 'flexible',
      learningStyle: (onboarding?.learningStyle as UserStudyProfile['learningStyle']) || 'mixed',
      targetExamDate: onboarding?.targetExamDate?.toString() || profile?.targetExamDate?.toString(),
      previousAttempts: onboarding?.previousAttempts || 0,
      confidenceLevel: onboarding?.confidenceLevel || 5,
      commitmentLevel: (onboarding?.commitmentLevel as UserStudyProfile['commitmentLevel']) || 'moderate',
    };

    // Deactivate any existing plans
    await db.update(studyPlans)
      .set({ status: 'abandoned' })
      .where(and(
        eq(studyPlans.userId, user.id),
        eq(studyPlans.status, 'active')
      ));

    // Generate new study plan
    const generatedPlan = generateStudyPlan(studyProfile);

    // Get KSL timeline if available
    const [kslTimeline] = await db.select().from(kslTimelines)
      .where(eq(kslTimelines.isActive, true))
      .orderBy(kslTimelines.examDate)
      .limit(1);

    // Save the plan to database
    const [newPlan] = await db.insert(studyPlans).values({
      userId: user.id,
      name: generatedPlan.name,
      description: generatedPlan.description,
      targetExamDate: generatedPlan.targetExamDate,
      kslTimelineId: kslTimeline?.id,
      status: 'active',
      totalItems: generatedPlan.weeks.reduce((sum, w) => sum + w.days.reduce((s, d) => s + d.items.length, 0), 0),
      completedItems: 0,
      currentWeek: 1,
      totalWeeks: generatedPlan.totalWeeks,
      dailyMinutes: studyProfile.dailyMinutes,
      focusAreas: studyProfile.weakUnits,
      metadata: generatedPlan.metadata as Record<string, unknown>,
    }).returning();

    // Insert all study items
    const allItems = generatedPlan.weeks.flatMap(week => 
      week.days.flatMap(day => 
        day.items.map(item => ({
          studyPlanId: newPlan.id,
          userId: user.id,
          scheduledDate: day.date,
          itemType: item.type as 'reading' | 'case_study' | 'practice_questions' | 'quiz' | 'review' | 'drafting' | 'research',
          status: 'pending' as const,
          title: item.title,
          description: item.description,
          unitId: item.unitId,
          caseReference: item.caseReference,
          estimatedMinutes: item.estimatedMinutes,
          priority: item.priority,
          isSpacedRepetition: item.isSpacedRepetition,
          aiRationale: item.rationale,
        }))
      )
    );

    // Batch insert items (in chunks to avoid query limits)
    const BATCH_SIZE = 100;
    for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
      const batch = allItems.slice(i, i + BATCH_SIZE);
      await db.insert(studyPlanItems).values(batch);
    }

    return NextResponse.json({
      success: true,
      plan: {
        id: newPlan.id,
        name: newPlan.name,
        description: newPlan.description,
        totalWeeks: newPlan.totalWeeks,
        totalItems: newPlan.totalItems,
      },
    });
  } catch (error) {
    console.error('Error generating study plan:', error);
    return NextResponse.json(
      { error: 'Failed to generate study plan' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tutor/plan
 * Update plan status or settings
 */
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const body = await req.json();
    const { planId, status } = body;

    // Get user
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update plan
    const [updatedPlan] = await db.update(studyPlans)
      .set({ 
        status,
        updatedAt: new Date(),
      })
      .where(and(
        eq(studyPlans.id, planId),
        eq(studyPlans.userId, user.id)
      ))
      .returning();

    return NextResponse.json({ success: true, plan: updatedPlan });
  } catch (error) {
    console.error('Error updating study plan:', error);
    return NextResponse.json(
      { error: 'Failed to update study plan' },
      { status: 500 }
    );
  }
}
