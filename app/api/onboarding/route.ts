import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { users, userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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

    const profileData = {
      currentOccupation: data.occupation,
      yearsOfStudy: data.yearsOfStudy ? parseInt(data.yearsOfStudy) : null,
      targetExamDate: data.targetExamDate || null,
      studyPace: data.studyPace || 'moderate',
      weakAreas: data.weakAreas || [],
      strongAreas: data.strongAreas || [],
      preferredStudyTime: data.preferredStudyTime,
      dailyStudyGoal: data.dailyStudyGoal || 60,
      weeklyQuizGoal: data.weeklyQuizGoal || 3,
      learningStyle: data.learningStyle,
      goals: data.goals || [],
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
