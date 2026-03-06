import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthUser } from '@/lib/auth/middleware';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST - Generate study notes for a topic
async function handlePost(req: NextRequest, user: AuthUser) {
  const body = await req.json();
  const { topicName, unitName, unitId, depth = 'standard', withAssessment = false, customPrompt } = body;

  if (!topicName && !customPrompt) {
    return NextResponse.json({ error: 'Topic name or custom prompt required' }, { status: 400 });
  }

  const depthInstructions: Record<string, string> = {
    refresher: 'Keep it concise — bullet points, key takeaways, and critical provisions only. This is a quick refresher, not a deep dive. ~800 words max.',
    standard: 'Provide comprehensive coverage with clear explanations, relevant statutory provisions, case law references, and practical examples. ~1500-2000 words.',
    indepth: 'Provide exhaustive, exam-level coverage. Include detailed statutory analysis, all major case law with ratios, practical applications, common exam scenarios, cross-references between topics, and examiner tips. ~3000+ words.',
  };

  const assessmentBlock = withAssessment ? `

IMPORTANT: Integrate assessment throughout the notes:
- After every 2-3 major concepts, insert a "🧠 Quick Check" box with 1-2 MCQ or short-answer questions (provide answers immediately after in a collapsible section marked with <details><summary>Answer</summary>...</details>)
- At the end, include a full "📝 Assessment" section with:
  - 5 multiple-choice questions (with lettered options and answers)
  - 2 scenario-based questions requiring application
  - 1 essay question typical of KSL exams
Include model answers for all questions.` : '';

  const topicContext = customPrompt || `${topicName} under ${unitName} (${unitId})`;

  const systemPrompt = `You are an expert Kenyan law tutor specializing in the Kenya School of Law Advocates Training Programme (ATP) 2026/2027 curriculum. 

Generate comprehensive study notes on the requested topic. 

Study depth: ${depthInstructions[depth] || depthInstructions.standard}
${assessmentBlock}

FORMAT REQUIREMENTS:
- Use proper Markdown with clear headings (##, ###)
- Bold key terms and statutory provisions  
- Use blockquotes for important case ratios
- Include statutory section references (e.g., "Section 3A, Civil Procedure Act")
- Cite relevant case law with proper citations (e.g., *Anarita Karimi Njeru v Republic* [1979] KLR 154)
- Use numbered lists for procedural steps
- Use bullet points for elements/requirements
- Include practical tips and exam strategies where relevant
- Add cross-references to related topics

KENYAN LAW CONTEXT:
- All references must be to Kenyan law and procedure
- Use the correct Kenyan court hierarchy (Supreme Court → Court of Appeal → High Court → Magistrates' Courts)
- Reference current legislation (post-2010 Constitution)
- Include both written and oral exam tips where applicable`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate study notes on: ${topicContext}` },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });

    const notes = completion.choices[0]?.message?.content || 'Failed to generate notes.';

    return NextResponse.json({
      notes,
      topicName: topicName || 'Custom Study',
      unitName: unitName || '',
      depth,
      withAssessment,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Study notes generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate notes. Please try again.' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handlePost);
