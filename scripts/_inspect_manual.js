const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Load env
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
const dbUrl = envContent.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const sql = neon(dbUrl);

async function main() {
  const rows = await sql`
    SELECT document_type_id, section_count, word_count, sections_json
    FROM prebuilt_drafting_manuals
    WHERE document_type_id = 'plaint'
  `;
  
  if (!rows.length) {
    console.log('No plaint manual found');
    return;
  }

  const d = rows[0];
  const sessions = typeof d.sections_json === 'string' ? JSON.parse(d.sections_json) : d.sections_json;
  
  console.log(`Sessions: ${sessions.length}`);
  console.log(`Total word count: ${d.word_count}`);
  console.log('');

  for (const sess of sessions) {
    console.log(`--- Session ${sess.session_number}: ${sess.title} ---`);
    console.log(`  Objective: ${sess.objective}`);
    console.log(`  Content words: ${sess.content?.split(/\s+/).length || 0}`);
    if (sess.exercise) {
      console.log(`  Exercise type: ${sess.exercise.type}`);
      console.log(`  Exercise title: ${sess.exercise.title}`);
      console.log(`  Instructions: ${sess.exercise.instructions?.substring(0, 120)}...`);
      console.log(`  Has scenario_prompt: ${!!sess.exercise.scenario_prompt} (${sess.exercise.scenario_prompt?.length || 0} chars)`);
      console.log(`  Rubric criteria: ${sess.exercise.grading_rubric?.length || 0}`);
      console.log(`  Total marks: ${sess.exercise.total_marks}`);
    } else {
      console.log('  Exercise: NONE');
    }
    console.log('');
  }
}

main().catch(console.error);
