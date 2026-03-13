import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthUser } from '@/lib/auth/middleware';
import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';
import { MINI_MODEL } from '@/lib/ai/model-config';
import { getDocumentById } from '@/lib/constants/legal-content';

const rawSql = neon(process.env.DATABASE_URL!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateAndPersistManual(documentId: string) {
  const doc = getDocumentById(documentId);
  if (!doc) return null;

  const prompt = [
    `Generate a comprehensive step-by-step guide to drafting a "${doc.name}" under Kenyan law.`,
    '',
    'Return ONLY a JSON array (no markdown fences). Each element:',
    '{',
    '  "id": "section-1",',
    '  "title": "Section Title",',
    '  "content": "Detailed markdown explaining this step with practical Kenyan drafting examples..."',
    '}',
    '',
    'Cover 5-7 sections:',
    '1. Purpose and when this document is used in Kenya',
    '2. Facts and parties with a mini case scenario',
    '3. Structure and format requirements',
    '4. Key legal provisions and mandatory contents',
    '5. Drafting the opening/introductory parts',
    '6. Drafting the substantive body',
    '7. Closing, verification, and filing requirements',
    '',
    'This is a training manual for bar exam candidates. Be practical and specific.',
  ].join('\n');

  const completion = await openai.chat.completions.create({
    model: MINI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: 3500,
  });

  const content = completion.choices[0]?.message?.content || '[]';
  let sections: any[] = [];
  try {
    const m = content.match(/\[[\s\S]*\]/);
    sections = m ? JSON.parse(m[0]) : JSON.parse(content);
  } catch {
    sections = [{
      id: 'section-1',
      title: `Drafting ${doc.name}`,
      content,
    }];
  }

  if (!Array.isArray(sections) || sections.length === 0) return null;

  const normalizedSections = sections.map((s: any, i: number) => ({
    id: s.id || `section-${i + 1}`,
    title: s.title || `Section ${i + 1}`,
    content: s.content || '',
  }));

  const wordCount = normalizedSections
    .map((s: any) => String(s.content || ''))
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  await rawSql`
    INSERT INTO prebuilt_drafting_manuals (
      document_type_id,
      category,
      document_name,
      version_number,
      sections_json,
      section_count,
      personality,
      word_count,
      model_used,
      is_active,
      updated_at
    )
    VALUES (
      ${documentId},
      ${doc.category},
      ${doc.name},
      1,
      ${JSON.stringify(normalizedSections)}::jsonb,
      ${normalizedSections.length},
      ${'structured'},
      ${wordCount},
      ${MINI_MODEL},
      true,
      NOW()
    )
    ON CONFLICT (document_type_id, version_number)
    DO UPDATE SET
      sections_json = EXCLUDED.sections_json,
      section_count = EXCLUDED.section_count,
      word_count = EXCLUDED.word_count,
      model_used = EXCLUDED.model_used,
      is_active = true,
      updated_at = NOW()
  `;

  const [saved] = await rawSql`
    SELECT sections_json, version_number, personality, document_name, category, word_count
    FROM prebuilt_drafting_manuals
    WHERE document_type_id = ${documentId} AND version_number = 1 AND is_active = true
    LIMIT 1
  `;

  return saved || null;
}

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

    // Determine available prebuilt versions first
    const availableRows = await rawSql`
      SELECT version_number
      FROM prebuilt_drafting_manuals
      WHERE document_type_id = ${documentId}
        AND is_active = true
      ORDER BY version_number ASC
    `;
    const availableVersions = availableRows.map((r: any) => Number(r.version_number)).filter((n: number) => Number.isFinite(n));

    // If assigned version is missing, choose an existing version (or default to 1)
    if (!assignedVersion || (availableVersions.length > 0 && !availableVersions.includes(assignedVersion))) {
      assignedVersion = availableVersions.length > 0
        ? availableVersions[Math.floor(Math.random() * availableVersions.length)]
        : 1;

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
    const manualRows = await rawSql`
      SELECT sections_json, version_number, personality, document_name, category, word_count
      FROM prebuilt_drafting_manuals
      WHERE document_type_id = ${documentId}
        AND version_number = ${assignedVersion}
        AND is_active = true
      LIMIT 1
    `;
    let manual: any | null = manualRows[0] || null;

    if (!manual) {
      // No pre-built manual exists — generate once, persist globally, then serve it
      try {
        manual = await generateAndPersistManual(documentId);

        if (manual && dbUserId) {
          try {
            await rawSql`
              INSERT INTO user_drafting_manual_versions (user_id, document_type_id, assigned_version)
              VALUES (${dbUserId}::uuid, ${documentId}, ${manual.version_number})
              ON CONFLICT (user_id, document_type_id) DO UPDATE SET
                assigned_version = EXCLUDED.assigned_version,
                last_accessed_at = NOW(),
                times_accessed = user_drafting_manual_versions.times_accessed + 1
            `;
          } catch { /* non-critical */ }
        }
      } catch (genError) {
        console.error('Failed to generate missing manual:', genError);
      }
    }

    if (!manual) {
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
