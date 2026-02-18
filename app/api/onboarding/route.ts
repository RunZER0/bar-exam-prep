import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { users, userProfiles } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();

    // User already exists from verifyAuth - update onboarding status
    await db.update(users)
      .set({ onboardingCompleted: true, updatedAt: new Date() })
      .where(eq(users.firebaseUid, user.firebaseUid));

    // Get the user's db id
    const dbUser = await db.query.users.findFirst({
      where: eq(users.firebaseUid, user.firebaseUid),
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Upsert user profile
    const existingProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, dbUser.id),
    });

    const weakUnits = data.weakUnits || [];
    const strongUnits = data.strongUnits || [];
    
    const profileData = {
      currentOccupation: data.occupation || data.currentOccupation,
      yearsOfStudy: data.yearsOfStudy || data.yearsInLaw ? parseInt(String(data.yearsOfStudy || data.yearsInLaw).replace(/[^0-9]/g, '')) : null,
      targetExamDate: data.targetExamDate || null,
      studyPace: data.studyPace || data.commitmentLevel || 'moderate',
      weakAreas: weakUnits,
      strongAreas: strongUnits,
      preferredStudyTime: data.preferredStudyTime,
      dailyStudyGoal: data.dailyStudyGoal || parseInt(data.dailyStudyHours) * 60 || 60,
      weeklyQuizGoal: data.weeklyQuizGoal || 3,
      learningStyle: data.learningStyle,
      goals: data.goals || [data.primaryGoal].filter(Boolean),
      updatedAt: new Date(),
    };

    if (existingProfile) {
      await db.update(userProfiles)
        .set(profileData)
        .where(eq(userProfiles.id, existingProfile.id));
    } else {
      await db.insert(userProfiles).values({
        userId: dbUser.id,
        ...profileData,
      });
    }

    // ============================================
    // INITIALIZE MASTERY STATES FROM ONBOARDING
    // ============================================
    // This creates the "first snapshot" - initial mastery based on self-assessment
    // - Strong areas start at 0.50 (some prior knowledge)
    // - Neutral areas start at 0.25 (baseline)
    // - Weak areas start at 0.10 (needs extra focus)
    
    try {
      // Get all active micro_skills
      const skillsResult = await db.execute(sql`
        SELECT id, unit_id FROM micro_skills WHERE is_active = true
      `);
      
      const skills = skillsResult.rows as Array<{ id: string; unit_id: string }>;
      
      // Check which mastery states already exist for this user
      const existingMasteryResult = await db.execute(sql`
        SELECT skill_id FROM mastery_state WHERE user_id = ${dbUser.id}::uuid
      `);
      const existingSkillIds = new Set((existingMasteryResult.rows as Array<{ skill_id: string }>).map(r => r.skill_id));
      
      // Determine initial p_mastery based on user's self-assessment
      const confidenceMultiplier = data.confidenceLevel ? 
        (parseInt(data.confidenceLevel.split('-')[0]) / 10) : 0.5; // Scale confidence 0-10 to 0-1
      
      // Insert mastery states for skills that don't exist yet
      for (const skill of skills) {
        if (existingSkillIds.has(skill.id)) continue;
        
        // Determine initial mastery based on unit classification
        let baseMastery = 0.25; // Default: neutral
        
        if (strongUnits.includes(skill.unit_id)) {
          baseMastery = 0.50; // Strong area - higher starting point
        } else if (weakUnits.includes(skill.unit_id)) {
          baseMastery = 0.10; // Weak area - needs more work
        }
        
        // Adjust by confidence level (±20%)
        const adjustedMastery = Math.max(0.05, Math.min(0.70, baseMastery * (0.8 + confidenceMultiplier * 0.4)));
        
        await db.execute(sql`
          INSERT INTO mastery_state (user_id, skill_id, p_mastery, stability, created_at, updated_at)
          VALUES (${dbUser.id}::uuid, ${skill.id}, ${adjustedMastery}, 1.0, NOW(), NOW())
          ON CONFLICT (user_id, skill_id) DO NOTHING
        `);
      }
      
      console.log(`[Onboarding] Initialized mastery for ${skills.length - existingSkillIds.size} skills for user ${dbUser.id}`);
    } catch (masteryError) {
      // Log but don't fail - mastery will be initialized lazily if this fails
      console.error('[Onboarding] Error initializing mastery states:', masteryError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await db.query.users.findFirst({
      where: eq(users.firebaseUid, user.firebaseUid),
      with: {
        profile: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ onboardingCompleted: false });
    }

    return NextResponse.json({
      onboardingCompleted: dbUser.onboardingCompleted,
      profile: dbUser.profile || null,
    });
  } catch (error) {
    console.error('Onboarding check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
