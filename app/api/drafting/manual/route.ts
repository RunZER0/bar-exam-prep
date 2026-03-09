import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthUser } from '@/lib/auth/middleware';
import { neon } from '@neondatabase/serverless';

const rawSql = neon(process.env.DATABASE_URL!);

/**
 * GET /api/drafting/manual?documentId=plaint
 * 
 * Returns a pre-built training manual for the specified document type.
 * 3 versions per document type — user gets a random version on first access,
 * then sees the same version consistently (version affinity).
 * 
 * Sections are returned WITHOUT checkpoints — checkpoints are generated
 * live by the client using GPT-5.2.
 * 
 * Response: { sections: LearnSection[], version: number, personality: string }
 */
export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  try {
    const documentId = req.nextUrl.searchParams.get('documentId');
    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    // Get db user ID
    let dbUserId: string | null = null;
    try {
      const [dbUser] = await rawSql`
        SELECT id FROM users WHERE firebase_uid = ${user.firebaseUid}
      `;
      dbUserId = dbUser?.id || null;
    } catch { /* user might not exist yet */ }

    // Check for existing version affinity
    let assignedVersion: number | null = null;

    if (dbUserId) {
      const [existing] = await rawSql`
        SELECT assigned_version FROM user_drafting_manual_versions
        WHERE user_id = ${dbUserId}::uuid AND document_type_id = ${documentId}
      `;
      if (existing) {
        assignedVersion = existing.assigned_version;
      }
    }

    // If no affinity, assign a random version (1-3)
    if (!assignedVersion) {
      assignedVersion = Math.floor(Math.random() * 3) + 1;

      // Save affinity if we have a user
      if (dbUserId) {
        try {
          await rawSql`
            INSERT INTO user_drafting_manual_versions (user_id, document_type_id, assigned_version)
            VALUES (${dbUserId}::uuid, ${documentId}, ${assignedVersion})
            ON CONFLICT (user_id, document_type_id) DO UPDATE SET
              last_accessed_at = NOW(),
              times_accessed = user_drafting_manual_versions.times_accessed + 1
          `;
        } catch { /* non-critical */ }
      }
    } else {
      // Update access tracking
      if (dbUserId) {
        try {
          await rawSql`
            UPDATE user_drafting_manual_versions
            SET last_accessed_at = NOW(), times_accessed = times_accessed + 1
            WHERE user_id = ${dbUserId}::uuid AND document_type_id = ${documentId}
          `;
        } catch { /* non-critical */ }
      }
    }

    // Fetch pre-built manual
    const [manual] = await rawSql`
      SELECT sections_json, version_number, personality, document_name, category, word_count
      FROM prebuilt_drafting_manuals
      WHERE document_type_id = ${documentId}
        AND version_number = ${assignedVersion}
        AND is_active = true
      LIMIT 1
    `;

    if (!manual) {
      // No pre-built manual exists — tell client to fall back to live generation
      return NextResponse.json({
        fallback: true,
        message: 'No pre-built manual available for this document type',
        documentId,
      });
    }

    return NextResponse.json({
      sections: manual.sections_json,
      version: manual.version_number,
      personality: manual.personality,
      documentName: manual.document_name,
      category: manual.category,
      wordCount: manual.word_count,
      prebuilt: true,
    });

  } catch (error: any) {
    console.error('Drafting manual API error:', error);
    return NextResponse.json(
      { error: 'Failed to load training manual' },
      { status: 500 }
    );
  }
});
