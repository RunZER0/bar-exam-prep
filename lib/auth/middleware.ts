import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase/admin';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface AuthUser {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  role: 'student' | 'admin';
}

/**
 * Verify Firebase ID token and get user data
 */
export async function verifyAuth(request: NextRequest): Promise<AuthUser | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1];
    const auth = getFirebaseAdmin();
    const decodedToken = await auth.verifyIdToken(token);

    // Get or create user in database
    const existingUser = await db.query.users.findFirst({
      where: eq(users.firebaseUid, decodedToken.uid),
    });

    if (existingUser) {
      return {
        id: existingUser.id,
        firebaseUid: existingUser.firebaseUid,
        email: existingUser.email,
        displayName: existingUser.displayName,
        role: existingUser.role,
      };
    }

    // Create new user if doesn't exist
    const [newUser] = await db.insert(users).values({
      firebaseUid: decodedToken.uid,
      email: decodedToken.email!,
      displayName: decodedToken.name || null,
      photoURL: decodedToken.picture || null,
      role: decodedToken.email === process.env.ADMIN_EMAIL ? 'admin' : 'student',
    }).returning();

    return {
      id: newUser.id,
      firebaseUid: newUser.firebaseUid,
      email: newUser.email,
      displayName: newUser.displayName,
      role: newUser.role,
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

/**
 * Middleware wrapper for protected API routes
 */
export function withAuth(
  handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const user = await verifyAuth(req);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return handler(req, user);
  };
}

/**
 * Middleware wrapper for admin-only routes
 */
export function withAdminAuth(
  handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const user = await verifyAuth(req);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    return handler(req, user);
  };
}
