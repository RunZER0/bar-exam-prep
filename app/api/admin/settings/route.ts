import { NextRequest, NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { adminSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Default settings
const DEFAULT_SETTINGS = {
  // AI Tutor Settings
  defaultDailyStudyGoal: 60, // minutes
  defaultWeeklyQuizGoal: 3,
  spacedRepetitionDefaultEF: 2.5,
  maxNewCardsPerDay: 10,
  
  // Site Settings
  siteAnnouncement: '',
  maintenanceMode: false,
  allowNewSignups: true,
  
  // Feature Flags
  enableCommunityFeatures: true,
  enableAIChat: true,
  enableTutorMode: true,
};

// GET - Retrieve all settings
export const GET = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const settings = await db.query.adminSettings.findMany();

    // Convert array to object, using defaults for missing keys
    const settingsMap: Record<string, any> = { ...DEFAULT_SETTINGS };
    
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value;
    }

    return NextResponse.json({ settings: settingsMap });
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
});

// POST - Create or update a setting
export const POST = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const { key, value, description } = body;

    if (!key) {
      return NextResponse.json(
        { error: 'Setting key is required' },
        { status: 400 }
      );
    }

    // Check if setting exists
    const existing = await db.query.adminSettings.findFirst({
      where: eq(adminSettings.key, key),
    });

    let setting;
    if (existing) {
      // Update existing
      [setting] = await db
        .update(adminSettings)
        .set({
          value,
          description: description ?? existing.description,
          updatedAt: new Date(),
          updatedBy: user.uid,
        })
        .where(eq(adminSettings.key, key))
        .returning();
    } else {
      // Create new
      [setting] = await db
        .insert(adminSettings)
        .values({
          key,
          value,
          description: description || '',
          updatedBy: user.uid,
        })
        .returning();
    }

    return NextResponse.json({ setting });
  } catch (error) {
    console.error('Error saving admin setting:', error);
    return NextResponse.json(
      { error: 'Failed to save setting' },
      { status: 500 }
    );
  }
});

// PATCH - Bulk update settings
export const PATCH = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const body = await req.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'Settings object is required' },
        { status: 400 }
      );
    }

    const results = [];

    for (const [key, value] of Object.entries(settings)) {
      const existing = await db.query.adminSettings.findFirst({
        where: eq(adminSettings.key, key),
      });

      if (existing) {
        const [setting] = await db
          .update(adminSettings)
          .set({
            value,
            updatedAt: new Date(),
            updatedBy: user.uid,
          })
          .where(eq(adminSettings.key, key))
          .returning();
        results.push(setting);
      } else {
        const [setting] = await db
          .insert(adminSettings)
          .values({
            key,
            value,
            description: '',
            updatedBy: user.uid,
          })
          .returning();
        results.push(setting);
      }
    }

    return NextResponse.json({ settings: results });
  } catch (error) {
    console.error('Error bulk updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
});

// DELETE - Reset a setting to default
export const DELETE = withAdminAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { error: 'Setting key is required' },
        { status: 400 }
      );
    }

    await db
      .delete(adminSettings)
      .where(eq(adminSettings.key, key));

    // Return the default value
    const defaultValue = DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS];

    return NextResponse.json({ 
      success: true,
      defaultValue: defaultValue ?? null,
    });
  } catch (error) {
    console.error('Error resetting admin setting:', error);
    return NextResponse.json(
      { error: 'Failed to reset setting' },
      { status: 500 }
    );
  }
});
