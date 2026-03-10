import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase/admin';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendWelcomeEmail } from '@/lib/services/notification-service';

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
    // Use explicit column selection to avoid crashing if newer schema columns
    // (subscription_tier, billing_period, custom_features) haven't been migrated yet.
    const [existingUser] = await db
      .select({
        id: users.id,
        firebaseUid: users.firebaseUid,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
      })
      .from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

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
    const isAdmin = decodedToken.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase();

    // Admins get full access; everyone else gets a 3-day free trial
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 3);

    const [newUser] = await db.insert(users).values({
      firebaseUid: decodedToken.uid,
      email: decodedToken.email!,
      displayName: decodedToken.name || null,
      photoURL: decodedToken.picture || null,
      role: isAdmin ? 'admin' : 'student',
      subscriptionPlan: isAdmin ? 'annual' : 'free_trial',
      subscriptionStatus: isAdmin ? 'active' : 'trialing',
      trialEndsAt: isAdmin ? null : trialEnd,
      subscriptionEndsAt: isAdmin ? new Date('2099-12-31') : null,
    }).returning();

    // Send welcome email (non-blocking)
    if (!isAdmin) {
      sendWelcomeEmail(newUser.id).catch(err =>
        console.error('[auth] Welcome email failed (non-fatal):', err)
      );
    }

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
 * Supports both NextResponse (JSON) and Response (streaming)
 */
export function withAuth(
  handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse | Response>
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
