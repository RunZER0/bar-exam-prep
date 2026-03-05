import { OpenAI } from 'openai';
import { MENTOR_MODEL, getOpenAIKey } from '@/lib/ai/model-config';
import { db } from '@/lib/db';
import { authorityRecords } from '@/lib/db/schema';
import { or, ilike, sql } from 'drizzle-orm';

const getOpenAI = () => {
    const apiKey = getOpenAIKey();
    if (!apiKey) {
        console.error('[NarrativeRenderer] OPENAI_API_KEY not set');
        return null;
    }
    return new OpenAI({ apiKey });
};

/**
 * NarrativeNoteRenderer — "The Mentor" (GPT-5.2)
 * 
 * Pipeline: DB Authority Search → Statute Context Assembly → GPT-5.2 Narrative
 * Output: Professional prose in Senior Counsel voice.
 * Formatting: H3 headers, indented blockquotes, bolded citations. NO META-TAGS.
 */
export class NarrativeNoteRenderer {

    /**
     * Fetch real statute/case context from the authority_records table.
     * Falls back to Supabase Kenya Law index, then empty (AI uses training knowledge).
     */
    static async fetchAuthorityContext(topic: string): Promise<string[]> {
        const trimmed = topic.trim().slice(0, 150);

        // 1. Try local authority_records first
        try {
            const results = await db
                .select({
                    title: authorityRecords.title,
                    citation: authorityRecords.citation,
                    sectionPath: authorityRecords.sectionPath,
                    actName: authorityRecords.actName,
                    rawText: authorityRecords.rawText,
                    sourceType: authorityRecords.sourceType,
                })
                .from(authorityRecords)
                .where(
                    or(
                        ilike(authorityRecords.title, `%${trimmed}%`),
                        ilike(authorityRecords.actName, `%${trimmed}%`),
                        sql`to_tsvector('english', ${authorityRecords.title} || ' ' || COALESCE(${authorityRecords.rawText}, '')) @@ websearch_to_tsquery('english', ${trimmed})`
                    )
                )
                .limit(8);

            if (results.length > 0) {
                return results.map(r => {
                    const cite = r.citation ? ` (${r.citation})` : '';
                    const section = r.sectionPath ? `, ${r.sectionPath}` : '';
                    const snippet = r.rawText ? `\n${r.rawText.slice(0, 500)}` : '';
                    return `**${r.title}**${cite}${section}${snippet}`;
                });
            }
        } catch (e) {
            console.warn('[NarrativeRenderer] Local authority fetch failed:', e);
        }

        // 2. Fallback: Query Supabase Kenya Law index (cases + statutes)
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey) {
            try {
                console.log(`[NarrativeRenderer] Querying Supabase for: ${trimmed}`);
                const headers = {
                    apikey: supabaseKey,
                    Authorization: `Bearer ${supabaseKey}`,
                    Accept: 'application/json',
                };

                // Extract meaningful search terms (remove common words)
                const stopWords = new Set(['the', 'and', 'for', 'with', 'under', 'from', 'this', 'that', 'which', 'their', 'have', 'been', 'will', 'into', 'upon', 'such', 'than', 'other', 'between']);
                const searchTerms = trimmed.split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w.toLowerCase())).slice(0, 5);
                
                // Try multiple search strategies for better coverage
                const queries: Promise<Response>[] = [];
                const headers2 = headers;

                // Strategy 1: Combined search pattern (original)
                const searchPattern = `*${searchTerms.join('*')}*`;
                queries.push(
                    fetch(
                        `${supabaseUrl}/rest/v1/cases?select=title,citation,court_code,url,year&or=(title.ilike.${searchPattern},parties.ilike.${searchPattern})&order=year.desc.nullslast&limit=5`,
                        { headers: headers2, signal: AbortSignal.timeout(8000) }
                    )
                );

                // Strategy 2: Search each significant term individually for broader results
                if (searchTerms.length >= 2) {
                    const topTerm = searchTerms[0];
                    queries.push(
                        fetch(
                            `${supabaseUrl}/rest/v1/cases?select=title,citation,court_code,url,year&or=(title.ilike.*${encodeURIComponent(topTerm)}*,parties.ilike.*${encodeURIComponent(topTerm)}*)&order=year.desc.nullslast&limit=5`,
                            { headers: headers2, signal: AbortSignal.timeout(8000) }
                        )
                    );
                }

                // Statute search
                queries.push(
                    fetch(
                        `${supabaseUrl}/rest/v1/statutes?select=name,chapter,url,full_text&or=(name.ilike.${searchPattern},chapter.ilike.${searchPattern})&limit=3`,
                        { headers: headers2, signal: AbortSignal.timeout(8000) }
                    )
                );

                const responses = await Promise.all(queries);

                const context: string[] = [];
                const seenUrls = new Set<string>();

                // Process statute response (last in the array)
                const statutesRes = responses[responses.length - 1];
                if (statutesRes.ok) {
                    const statutes = await statutesRes.json();
                    for (const s of statutes) {
                        const snippet = s.full_text ? `\n${s.full_text.slice(0, 800)}` : '';
                        context.push(`**${s.name}** (${s.chapter || 'Statute'})${snippet}`);
                    }
                }

                // Process all case responses (everything except the last)
                for (let i = 0; i < responses.length - 1; i++) {
                    const casesRes = responses[i];
                    if (casesRes.ok) {
                        const cases = await casesRes.json();
                        for (const c of cases) {
                            const key = c.url || c.title;
                            if (seenUrls.has(key)) continue;
                            seenUrls.add(key);
                            context.push(`**${c.title}** ${c.citation || ''} (${c.court_code}, ${c.year}) - ${c.url}`);
                        }
                    }
                }

                if (context.length > 0) {
                    console.log(`[NarrativeRenderer] Supabase returned ${context.length} authorities`);
                    return context;
                }
            } catch (e) {
                console.warn('[NarrativeRenderer] Supabase fallback failed:', e);
            }
        }

        // 3. No results from any source — AI will use training knowledge + web_search
        return [];
    }

    static async generateNarrative(topic: string, statuteContext?: string[]): Promise<string> {
        // If no context provided, fetch from DB
        const context = statuteContext && statuteContext.length > 0 
            ? statuteContext 
            : await NarrativeNoteRenderer.fetchAuthorityContext(topic);

        const contextBlock = context.length > 0
            ? `**Source Material (from verified Kenya Law records — ONLY cite these cases and statutes):**\n${context.join('\n\n')}`
            : `**IMPORTANT:** No verified authority records were found for this topic in our Kenya Law database. Do NOT invent or fabricate case names. Only cite statutes you are confident about (by specific section number). If you are unsure whether a case exists, do not cite it.`;

        const prompt = `
You are a 30-year Kenyan Senior Counsel and former High Court Judge. You are instructing a pupil preparing for the Kenya School of Law Bar Examinations on the topic: "${topic}".

${contextBlock}

**How to write - follow this exactly:**

1. **Write like a Kenyan judge writes a judgment.** Weave statutes and case law naturally into your sentences. Never dump a citation on its own line or in a standalone bracket. Citations must flow within the prose.

   WRONG: "A floating charge is invalid unless registered. **Companies Act, 2015 - Part XXXIII (Charges).**"
   RIGHT: "Under section 863(1) of the Companies Act, 2015, every charge created by a company must be registered with the Registrar within thirty days, failing which it becomes void against the liquidator and any creditor of the company."

   WRONG: "The court has addressed this issue. **See Mistry v Republic [2020] eKLR.**"
   RIGHT: "As the Court of Appeal held in Mistry v Republic [2020] eKLR, the question of whether a charge crystallises upon appointment of a receiver depends on the terms of the debenture itself."

2. **Case law citation rules:**
   - If Source Material above includes specific cases, cite ONLY those cases. Do not add cases that are not in the Source Material.
   - If no Source Material is provided, do NOT cite any cases by name. Instead, describe the legal principle without attribution, e.g. "Kenyan courts have consistently held that..." rather than inventing a case name.
   - NEVER fabricate a case name. If you are not 100% certain a case exists and is correctly named, do not cite it.

3. **Cite statutes precisely.** Always pin the specific section and subsection, e.g. "section 45(1)(a)" not just "the Act". Where the exact wording of a provision is critical for the exam, quote it verbatim in a blockquote (>). Only cite specific quoted sections inline — do not make entire statute names clickable.

4. **Structure:** Use H3 headers (###) for distinct legal concepts. Each section should be self-contained. No "Introduction" or "Conclusion" headers - dive straight in.

5. **Exam pitfalls:** Where students commonly lose marks, flag it with "Exam pitfall:" in italics, then explain the mistake and the correct position with authority.

6. **Voice:** Authoritative and practical, not academic. You are teaching a pupil how to answer an exam question, not writing a textbook. Be direct.

7. **Formatting:** Use hyphens (-) not em dashes. Keep paragraphs concise. Leave blank lines between paragraphs for readability.
`;

        try {
            const openai = getOpenAI();
            if (!openai) {
                throw new Error('OpenAI client unavailable — OPENAI_API_KEY not set');
            }

            const response = await openai.responses.create({
                model: MENTOR_MODEL,
                instructions: 'You are a 30-year Kenyan Senior Counsel and former High Court Judge. You write in the style of a Kenyan judgment - weaving statute citations and case law naturally into your prose. Every legal proposition must be supported by a specific section of statute or a decided case. Cite Kenyan cases using [Year] eKLR format. Never dump citations as standalone blocks.',
                input: prompt,
                tools: [{ type: 'web_search_preview' as const }],
                temperature: 0.2,
            });

            const content = response.output_text;
            if (!content) throw new Error('Empty response from Mentor model');
            
            // Post-process: replace em dashes with hyphens, clean up spacing
            const cleaned = content
                .replace(/\u2014/g, ' - ')   // em dash → hyphen
                .replace(/\u2013/g, ' - ')   // en dash → hyphen
                .replace(/\u2018|\u2019/g, "'") // smart single quotes
                .replace(/\u201C|\u201D/g, '"') // smart double quotes
                .replace(/\n{4,}/g, '\n\n\n'); // collapse excessive blank lines
            
            return cleaned;
        } catch (error) {
            console.error('[NarrativeRenderer] Narrative generation failed:', error);
            throw error;
        }
    }
}
