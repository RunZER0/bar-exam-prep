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
    // This creates the "first snapshot" - initial mastery based on ALL self-assessment data
    // Initial mastery values:
    // - Strong areas: 25% (0.25) - student has prior knowledge
    // - Neutral areas: 10% (0.10) - baseline starting point
    // - Weak areas: 5% (0.05) - needs significant work
    
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
      
      // ============================================
      // CALCULATE MODIFIERS FROM ALL ONBOARDING DATA
      // ============================================
      
      // 1. Confidence level (1-10 scale) - affects overall mastery multiplier
      const confidenceLevel = data.confidenceLevel ? 
        parseInt(data.confidenceLevel.split('-')[0]) / 10 : 0.5;
      
      // 2. Years in law - more experience = slightly higher base
      const yearsInLaw = parseInt(String(data.yearsInLaw || '0').replace(/[^0-9]/g, '')) || 0;
      const experienceBonus = Math.min(0.05, yearsInLaw * 0.01); // Max 5% bonus
      
      // 3. Previous bar attempts - retakers may have partial knowledge
      const previousAttempts = parseInt(String(data.previousAttempts || '0').replace(/[^0-9]/g, '')) || 0;
      const retakerBonus = previousAttempts > 0 ? 0.05 : 0; // 5% bonus for retakers
      
      // 4. Commitment level affects study velocity (stored for pacing, not initial mastery)
      const commitmentMultiplier = data.commitmentLevel === 'fulltime' ? 1.2 : 
                                   data.commitmentLevel === 'parttime' ? 1.0 : 0.9;
      
      // 5. Learning style affects format weights (stored in profile)
      // Visual = prefers written, Auditory = prefers oral, Kinesthetic = prefers practice
      
      // Insert mastery states for skills that don't exist yet
      for (const skill of skills) {
        if (existingSkillIds.has(skill.id)) continue;
        
        // Base mastery based on unit classification (strong=25%, neutral=10%, weak=5%)
        let baseMastery: number;
        
        if (strongUnits.includes(skill.unit_id)) {
          baseMastery = 0.25; // Strong area
        } else if (weakUnits.includes(skill.unit_id)) {
          baseMastery = 0.05; // Weak area
        } else {
          baseMastery = 0.10; // Neutral area
        }
        
        // Apply modifiers: confidence, experience, retaker status
        // Confidence affects by ±30%, experience/retaker adds flat bonus
        const confidenceModifier = 0.7 + (confidenceLevel * 0.6); // Range: 0.7 to 1.3
        const adjustedMastery = Math.max(
          0.02, 
          Math.min(0.40, baseMastery * confidenceModifier + experienceBonus + retakerBonus)
        );
        
        // Stability starts at 1.0 for new skills, adjusted by commitment
        const initialStability = commitmentMultiplier;
        
        await db.execute(sql`
          INSERT INTO mastery_state (user_id, skill_id, p_mastery, stability, created_at, updated_at)
          VALUES (${dbUser.id}::uuid, ${skill.id}, ${adjustedMastery}, ${initialStability}, NOW(), NOW())
          ON CONFLICT (user_id, skill_id) DO NOTHING
        `);
      }
      
      console.log(`[Onboarding] Initialized mastery for ${skills.length - existingSkillIds.size} skills for user ${dbUser.id}`);
      console.log(`[Onboarding] Profile: confidence=${confidenceLevel}, yearsInLaw=${yearsInLaw}, attempts=${previousAttempts}`);
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
