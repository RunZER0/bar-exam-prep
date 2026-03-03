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
     * Falls back to topic-derived context if DB has no matching records.
     */
    static async fetchAuthorityContext(topic: string): Promise<string[]> {
        try {
            const trimmed = topic.trim().slice(0, 150);
            
            // Full-text search + ILIKE fallback
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
            console.warn('[NarrativeRenderer] Authority fetch failed, proceeding without DB context:', e);
        }

        // If no DB results, return empty — the AI will use its training knowledge
        return [];
    }

    static async generateNarrative(topic: string, statuteContext?: string[]): Promise<string> {
        // If no context provided, fetch from DB
        const context = statuteContext && statuteContext.length > 0 
            ? statuteContext 
            : await NarrativeNoteRenderer.fetchAuthorityContext(topic);

        const contextBlock = context.length > 0
            ? `**Source Material (from verified authority records):**\n${context.join('\n\n')}`
            : `**Note:** No pre-loaded authority records found for this topic. Use your deep knowledge of Kenyan law to provide authoritative instruction, citing specific statutes and rules by name.`;

        const prompt = `
You are a 30-year Kenyan Senior Counsel addressing a Junior Associate preparing for the Kenya School of Law Bar Examinations.
Your task is to dissect "${topic}" with surgical precision.

${contextBlock}

**The Senior Partner Protocol:**
1. **Voice:** Authoritative, cautionary, and deeply grounded in procedural reality. Do not be "wiki-ish". Be practical.
2. **Structure:** Use H3 headers (###) for distinct legal concepts. Each section must be self-contained.
3. **Citations:** BOLD every citation (e.g., **Section 2 of the Civil Procedure Act**). A claim without a citation is malpractice.
4. **Precision:** Use indented blockquotes (>) for operative statutory language where wording is fatal if missed.
5. **The Rule:** Do NOT use "Introduction" or "Conclusion" headers. Start immediately with the legal gravity of the topic.
6. **Context:** Frame advice in the context of Kenyan law, High Court practice, and KSL exam expectations.
7. **Exam Focus:** Where relevant, flag common exam pitfalls and points that attract maximum marks.
`;

        try {
            const openai = getOpenAI();
            if (!openai) {
                throw new Error('OpenAI client unavailable — OPENAI_API_KEY not set');
            }

            const response = await openai.chat.completions.create({
                model: MENTOR_MODEL,
                messages: [
                    { role: 'system', content: 'You are a 30-year Kenyan Senior Counsel. You do not summarize; you instruct. Every statement carries the weight of practice.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.2,
            });

            const content = response.choices[0].message.content;
            if (!content) throw new Error('Empty response from Mentor model');
            return content;
        } catch (error) {
            console.error('[NarrativeRenderer] Narrative generation failed:', error);
            throw error;
        }
    }
}
