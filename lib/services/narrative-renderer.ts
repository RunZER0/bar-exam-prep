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
You are a 30-year Kenyan Senior Counsel and former High Court Judge. You are instructing a pupil preparing for the Kenya School of Law Bar Examinations on the topic: "${topic}".

${contextBlock}

**How to write - follow this exactly:**

1. **Write like a Kenyan judge writes a judgment.** Weave statutes and case law naturally into your sentences. Never dump a citation on its own line or in a standalone bracket. Citations must flow within the prose.

   WRONG: "A floating charge is invalid unless registered. **Companies Act, 2015 - Part XXXIII (Charges).**"
   RIGHT: "Under section 863(1) of the Companies Act, 2015, every charge created by a company must be registered with the Registrar within thirty days, failing which it becomes void against the liquidator and any creditor of the company."

   WRONG: "The court has addressed this issue. **See Mistry v Republic [2020] eKLR.**"
   RIGHT: "As the Court of Appeal held in Mistry v Republic [2020] eKLR, the question of whether a charge crystallises upon appointment of a receiver depends on the terms of the debenture itself."

2. **Cite case law.** For every major legal principle, cite at least one relevant Kenyan case. Use the format: Case Name [Year] eKLR, or Case Name (Year) KLR Volume Page. Explain what the court held, do not just name-drop.

3. **Cite statutes precisely.** Always pin the specific section and subsection, e.g. "section 45(1)(a)" not just "the Act". Where the exact wording of a provision is critical for the exam, quote it verbatim in a blockquote (>).

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
