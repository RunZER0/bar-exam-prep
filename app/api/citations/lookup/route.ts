import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

/* ----------------------------------------------------------------
   Helpers
   ---------------------------------------------------------------- */

/** Pull the numeric section reference out of a full match, e.g.
 *  "Section 45(1) of the Companies Act" → "45"  */
function extractSectionNumber(text: string): string | null {
    const m = text.match(/(?:section|s\.)\s+(\d+)(?:\([^)]*\))*/i);
    return m ? m[1] : null;
}

/** Strip year / Cap / No from statute name so we get a clean search term.
 *  "Companies Act, Cap. 486" → "Companies Act"
 *  "Section 45(1) of the Companies Act, 2015" → "Companies Act"  */
function cleanStatuteName(text: string): string {
    return text
        .replace(/^(?:section|s\.)\s+[\d()a-z]+\s+of\s+(?:the\s+)?/i, '')
        .replace(/,?\s*[-–—]\s*.*/i, '')                               // trailing Part/Chapter info
        .replace(/,?\s*(?:Cap\.?\s*\d+[A-Z]?|No\.?\s*\d+(?:\s+of\s+\d{4})?|\d{4})$/i, '')
        .replace(/^the\s+/i, '')
        .replace(/\s*\(.*?\)\s*/g, ' ')                               // strip parenthetical references
        .replace(/\s+/g, ' ')
        .trim();
}

/** Extract core words for a broader fallback search.
 *  "Employment and Labour Relations Court Act" → ["Employment", "Labour", "Court", "Act"] */
function extractCoreWords(name: string): string[] {
    const stopWords = new Set(['the', 'of', 'and', 'in', 'to', 'for', 'by', 'on', 'an', 'a', 'no']);
    return name.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
}

/** Try to locate the referenced section inside the full statute text
 *  and return a focused ≈ 3 000-char excerpt around it.                */
function extractSectionFromText(fullText: string, sectionNum: string): string | null {
    const baseNum = sectionNum.replace(/\(.*/, '');          // "45(1)" → "45"

    const patterns = [
        new RegExp(`(?:^|\\n)\\s*${baseNum}\\.\\s`, 'm'),   // \n45. …
        new RegExp(`(?:^|\\n)\\s*${baseNum}\\s*[-–—]`, 'm'), // \n45 – …
        new RegExp(`\\bSection\\s+${baseNum}\\b`, 'i'),      // Section 45
    ];

    for (const pat of patterns) {
        const match = pat.exec(fullText);
        if (match) {
            const start = Math.max(0, match.index - 100);
            const end   = Math.min(fullText.length, match.index + 3000);
            return fullText.slice(start, end);
        }
    }
    return null;
}

/* ----------------------------------------------------------------
   POST  /api/citations/lookup
   Body: { type: 'case'|'statute', name: string, fullMatch: string }
   ---------------------------------------------------------------- */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { type, name, fullMatch } = body;

        if (!type || (!name && !fullMatch)) {
            return NextResponse.json({ found: false, reason: 'missing fields' });
        }

        /* ============================================================
           CASE LAW  —  return Kenya Law URL
           ============================================================ */
        if (type === 'case') {
            const raw = (name || fullMatch || '')
                .replace(/\[.*?\]|\(.*?\)/g, '')        // strip [2019] or (2019)
                .trim();

            // split on "v" / "vs" / "&" / "and"
            const parts = raw
                .split(/\s+v\.?\s+|\s+vs?\.?\s+|\s+&\s+|\s+and\s+/i)
                .map((s: string) => s.trim())
                .filter(Boolean);

            const primary = (parts[0] || raw).slice(0, 50);
            if (!primary) return NextResponse.json({ found: false });

            const searchPattern = `%${primary}%`;
            const cases = await sql`
                SELECT title, citation, url, court_code, year
                FROM cases
                WHERE title ILIKE ${searchPattern}
                   OR parties ILIKE ${searchPattern}
                   OR citation ILIKE ${searchPattern}
                ORDER BY year DESC NULLS LAST
                LIMIT 5
            `;

            if (cases.length === 0) return NextResponse.json({ found: false });

            // Score: prefer rows matching more of the parties
            let best = cases[0];
            if (parts.length > 1) {
                const scored = cases.map((c: any) => {
                    let score = 0;
                    const blob = `${c.title || ''} ${c.parties || ''}`.toLowerCase();
                    for (const p of parts) { if (blob.includes(p.toLowerCase())) score++; }
                    return { ...c, score };
                });
                scored.sort((a: any, b: any) => b.score - a.score);
                best = scored[0];
            }

            return NextResponse.json({
                found: true,
                url: best.url,
                title: best.title,
                citation: best.citation,
                court: best.court_code,
                year: best.year,
            });
        }

        /* ============================================================
           STATUTE  —  return verbatim excerpt + Kenya Law URL
           ============================================================ */
        if (type === 'statute') {
            const cleanName = cleanStatuteName(name || fullMatch || '');
            if (!cleanName) return NextResponse.json({ found: false });

            // Strategy 1: Direct ilike match on cleaned name
            const searchPattern = `%${cleanName}%`;
            let statutes = await sql`
                SELECT name, chapter, url, full_text
                FROM statutes
                WHERE name ILIKE ${searchPattern}
                ORDER BY name
                LIMIT 3
            `;

            // Strategy 2: If no match, try with just core words (broader search)
            if (statutes.length === 0) {
                const coreWords = extractCoreWords(cleanName);
                if (coreWords.length >= 2) {
                    const significantWords = coreWords.filter(w => !['Act', 'Rules', 'Regulations', 'Order', 'Bill'].includes(w));
                    const searchWord = significantWords[0] || coreWords[0];
                    const broaderPattern = `%${searchWord}%`;
                    const broader = await sql`
                        SELECT name, chapter, url, full_text
                        FROM statutes
                        WHERE name ILIKE ${broaderPattern}
                        ORDER BY name
                        LIMIT 5
                    `;
                    
                    // Score by how many core words match
                    if (broader.length > 0) {
                        const scored = broader.map(s => {
                            let score = 0;
                            const nameLower = (s.name || '').toLowerCase();
                            for (const w of coreWords) {
                                if (nameLower.includes(w.toLowerCase())) score++;
                            }
                            return { ...s, score };
                        }).sort((a: any, b: any) => b.score - a.score);
                        statutes = scored.filter((s: any) => s.score > 0);
                    }
                }
            }

            if (statutes.length === 0) return NextResponse.json({ found: false });

            const best = statutes[0] as any;

            // Try to extract the referenced section
            const sectionNum = extractSectionNumber(fullMatch || '');
            let excerpt: string | null = null;

            if (best.full_text && sectionNum) {
                excerpt = extractSectionFromText(best.full_text, sectionNum);
            }

            return NextResponse.json({
                found: true,
                name: best.name,
                chapter: best.chapter,
                url: best.url,
                hasFullText: !!best.full_text,
                excerpt,                                                          // focused section slice
                fullText: !excerpt && best.full_text
                    ? best.full_text.slice(0, 8000)                               // fallback: first 8 000 chars
                    : null,
            });
        }

        return NextResponse.json({ found: false });
    } catch (err) {
        console.error('[citations/lookup] Error:', err);
        return NextResponse.json({ found: false, error: 'lookup failed' });
    }
}
