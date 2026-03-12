/**
 * Profile Photo API
 * POST - Upload a profile photo (base64)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';

const MAX_FILE_SIZE = 500 * 1024; // 500KB max for base64

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    const { photoData } = await req.json();

    if (!photoData) {
      return NextResponse.json({ error: 'Photo data required' }, { status: 400 });
    }

    // Validate it's a proper data URL
    if (!photoData.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Invalid image format' }, { status: 400 });
    }

    // Check size (rough base64 check)
    const base64Part = photoData.split(',')[1] || '';
    const sizeBytes = (base64Part.length * 3) / 4;
    if (sizeBytes > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Image too large. Max 500KB.' }, { status: 400 });
    }

    // Update user's photo URL (match on firebaseUid, not users.id which is a Postgres UUID)
    await db
      .update(users)
      .set({ photoURL: photoData })
      .where(eq(users.firebaseUid, userId));

    return NextResponse.json({ success: true, photoURL: photoData });
  } catch (error) {
    console.error('Error uploading photo:', error);
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }
}

// GET - Get current user's photo
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    const [user] = await db
      .select({ photoURL: users.photoURL })
      .from(users)
      .where(eq(users.firebaseUid, userId))
      .limit(1);

    return NextResponse.json({ photoURL: user?.photoURL || null });
  } catch (error) {
    console.error('Error fetching photo:', error);
    return NextResponse.json({ error: 'Failed to fetch photo' }, { status: 500 });
  }
}
