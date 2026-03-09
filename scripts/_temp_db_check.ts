import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
const DATABASE_URL = envContent.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim() || '';
const sql = neon(DATABASE_URL);

async function main() {
  // Re-parse ALL notes that still have no tips but have *Exam pitfall:* in markdown
  const notes = await sql`
    SELECT id, title, narrative_markdown, sections_json
    FROM prebuilt_notes WHERE version_number = 1
  `;
  
  let fixed = 0;
  for (const note of notes) {
    const secs = typeof note.sections_json === 'string' ? JSON.parse(note.sections_json) : note.sections_json;
    const hasTips = secs.some((s: any) => s.examTips && typeof s.examTips === 'string' && s.examTips.trim().length > 0);
    
    if (!hasTips && /\*{1,2}Exam\s+(?:Tip|pitfall):\*{1,2}/i.test(note.narrative_markdown)) {
      const reParsed = note.narrative_markdown
        .split(/(?=^### )/m)
        .filter((s: string) => s.trim().length > 0)
        .map((s: string, i: number) => {
          const titleMatch = s.match(/^### (.+)/m);
          const examTipMatch = s.match(/\*{1,2}Exam\s+(?:Tip|pitfall):\*{1,2}\s*(.+)/i);
          const examTips = examTipMatch ? examTipMatch[1].trim() : undefined;
          const content = examTips
            ? s.replace(/\*{1,2}Exam\s+(?:Tip|pitfall):\*{1,2}\s*.+/i, '').trim()
            : s.trim();
          return {
            id: `section-${i + 1}`,
            title: titleMatch ? titleMatch[1].trim() : `Section ${i + 1}`,
            content,
            ...(examTips && { examTips }),
          };
        });
      
      // Cap at 15
      if (reParsed.length > 15) {
        const kept = reParsed.slice(0, 15);
        const overflow = reParsed.slice(15);
        kept[14] = { ...kept[14], content: [kept[14].content, ...overflow.map((s: any) => s.content)].join('\n\n') };
        reParsed.length = 0;
        reParsed.push(...kept);
      }
      
      const tipCount = reParsed.filter((s: any) => s.examTips).length;
      await sql`UPDATE prebuilt_notes SET sections_json = ${JSON.stringify(reParsed)}::jsonb, updated_at = NOW() WHERE id = ${note.id}`;
      console.log(`Fixed: "${note.title}" — ${reParsed.length} sections, ${tipCount} tips`);
      fixed++;
    }
  }
  
  console.log(`\nFixed ${fixed} remaining notes`);
  
  // Final tally
  const all = await sql`SELECT sections_json FROM prebuilt_notes WHERE version_number = 1`;
  let withTips = 0, withoutTips = 0;
  for (const n of all) {
    const s = typeof n.sections_json === 'string' ? JSON.parse(n.sections_json) : n.sections_json;
    if (s.some((sec: any) => sec.examTips && sec.examTips.trim().length > 0)) withTips++;
    else withoutTips++;
  }
  console.log(`Final: ${withTips} with tips, ${withoutTips} without tips (total: ${all.length})`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });

