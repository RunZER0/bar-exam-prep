/**
 * Seed Outline Topics + Skill Mapping
 * Populates outline_topics and skill_outline_map for M1 completion
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

const sql = neon(DATABASE_URL);

// ATP Outline Topics based on KSL curriculum
const OUTLINE_TOPICS = [
  // ATP 100 - Civil Procedure
  { unitId: 'atp-100', topicCode: 'CP-1', topicNumber: '1', title: 'Introduction to Civil Procedure', depthLevel: 0, sortOrder: 1 },
  { unitId: 'atp-100', topicCode: 'CP-1.1', topicNumber: '1.1', title: 'Jurisdiction and Competence of Courts', depthLevel: 1, sortOrder: 2 },
  { unitId: 'atp-100', topicCode: 'CP-1.2', topicNumber: '1.2', title: 'Parties to Civil Proceedings', depthLevel: 1, sortOrder: 3 },
  { unitId: 'atp-100', topicCode: 'CP-2', topicNumber: '2', title: 'Pleadings', depthLevel: 0, sortOrder: 4 },
  { unitId: 'atp-100', topicCode: 'CP-2.1', topicNumber: '2.1', title: 'Plaint and Written Statement of Defence', depthLevel: 1, sortOrder: 5 },
  { unitId: 'atp-100', topicCode: 'CP-3', topicNumber: '3', title: 'Interlocutory Applications', depthLevel: 0, sortOrder: 6 },
  { unitId: 'atp-100', topicCode: 'CP-4', topicNumber: '4', title: 'Summary Judgment and Dismissal', depthLevel: 0, sortOrder: 7 },
  { unitId: 'atp-100', topicCode: 'CP-5', topicNumber: '5', title: 'Execution of Decrees', depthLevel: 0, sortOrder: 8 },
  
  // ATP 101 - Criminal Procedure  
  { unitId: 'atp-101', topicCode: 'CRM-1', topicNumber: '1', title: 'Introduction to Criminal Procedure', depthLevel: 0, sortOrder: 1 },
  { unitId: 'atp-101', topicCode: 'CRM-1.1', topicNumber: '1.1', title: 'Constitutional Framework', depthLevel: 1, sortOrder: 2 },
  { unitId: 'atp-101', topicCode: 'CRM-2', topicNumber: '2', title: 'Arrest and Bail', depthLevel: 0, sortOrder: 3 },
  { unitId: 'atp-101', topicCode: 'CRM-3', topicNumber: '3', title: 'Prosecution and Trial', depthLevel: 0, sortOrder: 4 },
  { unitId: 'atp-101', topicCode: 'CRM-4', topicNumber: '4', title: 'Sentencing and Appeals', depthLevel: 0, sortOrder: 5 },
  
  // ATP 102 - Law of Evidence
  { unitId: 'atp-102', topicCode: 'EV-1', topicNumber: '1', title: 'Introduction to Evidence Law', depthLevel: 0, sortOrder: 1 },
  { unitId: 'atp-102', topicCode: 'EV-2', topicNumber: '2', title: 'Burden and Standard of Proof', depthLevel: 0, sortOrder: 2 },
  { unitId: 'atp-102', topicCode: 'EV-3', topicNumber: '3', title: 'Witnesses and Examination', depthLevel: 0, sortOrder: 3 },
  { unitId: 'atp-102', topicCode: 'EV-4', topicNumber: '4', title: 'Documentary Evidence', depthLevel: 0, sortOrder: 4 },
  
  // ATP 103 - Professional Ethics
  { unitId: 'atp-103', topicCode: 'PE-1', topicNumber: '1', title: 'Legal Profession in Kenya', depthLevel: 0, sortOrder: 1 },
  { unitId: 'atp-103', topicCode: 'PE-2', topicNumber: '2', title: 'Professional Conduct and Ethics', depthLevel: 0, sortOrder: 2 },
  { unitId: 'atp-103', topicCode: 'PE-3', topicNumber: '3', title: 'Advocate-Client Relationship', depthLevel: 0, sortOrder: 3 },
  
  // ATP 104 - Legal Writing and Drafting
  { unitId: 'atp-104', topicCode: 'LW-1', topicNumber: '1', title: 'Legal Writing Fundamentals', depthLevel: 0, sortOrder: 1 },
  { unitId: 'atp-104', topicCode: 'LW-2', topicNumber: '2', title: 'Contract Drafting', depthLevel: 0, sortOrder: 2 },
  { unitId: 'atp-104', topicCode: 'LW-3', topicNumber: '3', title: 'Litigation Documents', depthLevel: 0, sortOrder: 3 },
  
  // ATP 105 - Conveyancing
  { unitId: 'atp-105', topicCode: 'CV-1', topicNumber: '1', title: 'Land Registration System', depthLevel: 0, sortOrder: 1 },
  { unitId: 'atp-105', topicCode: 'CV-2', topicNumber: '2', title: 'Sale and Transfer of Land', depthLevel: 0, sortOrder: 2 },
  { unitId: 'atp-105', topicCode: 'CV-3', topicNumber: '3', title: 'Charges and Mortgages', depthLevel: 0, sortOrder: 3 },
  
  // ATP 106 - Trial Advocacy
  { unitId: 'atp-106', topicCode: 'TA-1', topicNumber: '1', title: 'Case Theory and Theme', depthLevel: 0, sortOrder: 1 },
  { unitId: 'atp-106', topicCode: 'TA-2', topicNumber: '2', title: 'Opening and Closing Statements', depthLevel: 0, sortOrder: 2 },
  { unitId: 'atp-106', topicCode: 'TA-3', topicNumber: '3', title: 'Examination of Witnesses', depthLevel: 0, sortOrder: 3 },
  { unitId: 'atp-106', topicCode: 'TA-4', topicNumber: '4', title: 'Cross-Examination Techniques', depthLevel: 0, sortOrder: 4 },
];

// Mapping: skill_code -> topic_codes (traceability)
const SKILL_TOPIC_MAP: Record<string, string[]> = {
  // All 20 skills are Civil Procedure (atp-100)
  'cp-jurisdiction': ['CP-1.1'],
  'cp-parties': ['CP-1.2'],
  'cp-joinder': ['CP-1.2'],
  'cp-plaint-draft': ['CP-2', 'CP-2.1'],
  'cp-defence-draft': ['CP-2', 'CP-2.1'],
  'cp-counterclaim': ['CP-2', 'CP-2.1'],
  'cp-amendment': ['CP-2', 'CP-2.1'],
  'cp-cause-action': ['CP-2', 'CP-2.1'],
  'cp-interlocutory': ['CP-3'],
  'cp-injunction': ['CP-3'],
  'cp-discovery': ['CP-3'],
  'cp-summary-judg': ['CP-4'],
  'cp-execution': ['CP-5'],
  'cp-trial-conduct': ['CP-1'],
  'cp-examination': ['CP-1'],
  'cp-judgment-draft': ['CP-5'],
  'cp-appeals': ['CP-5'],
  'cp-costs': ['CP-5'],
  'cp-limitation': ['CP-1'],
  'cp-service': ['CP-2'],
};

async function seed() {
  console.log('🌱 Seeding outline_topics and skill_outline_map...\n');

  // 1. Insert outline topics
  console.log('1. Inserting outline_topics...');
  let topicsInserted = 0;
  const topicIdMap = new Map<string, string>();

  for (const t of OUTLINE_TOPICS) {
    const result = await sql`
      INSERT INTO outline_topics (unit_id, topic_code, topic_number, title, depth_level, sort_order)
      VALUES (${t.unitId}, ${t.topicCode}, ${t.topicNumber}, ${t.title}, ${t.depthLevel}, ${t.sortOrder})
      ON CONFLICT DO NOTHING
      RETURNING id, topic_code
    `;
    if (result.length > 0) {
      topicIdMap.set(result[0].topic_code, result[0].id);
      topicsInserted++;
    }
  }
  console.log(`   ✅ Inserted ${topicsInserted} outline topics`);

  // Fetch all topic IDs (including existing)
  const allTopics = await sql`SELECT id, topic_code FROM outline_topics`;
  for (const t of allTopics) {
    topicIdMap.set(t.topic_code, t.id);
  }

  // 2. Get all skills
  console.log('2. Fetching micro_skills...');
  const skills = await sql`SELECT id, code FROM micro_skills`;
  console.log(`   Found ${skills.length} skills`);

  // 3. Create skill_outline_map entries
  console.log('3. Creating skill_outline_map...');
  let linksCreated = 0;

  for (const skill of skills) {
    const topicCodes = SKILL_TOPIC_MAP[skill.code] || [];
    for (const topicCode of topicCodes) {
      const topicId = topicIdMap.get(topicCode);
      if (topicId) {
        await sql`
          INSERT INTO skill_outline_map (skill_id, topic_id, coverage_strength)
          VALUES (${skill.id}, ${topicId}, 1.0)
          ON CONFLICT DO NOTHING
        `;
        linksCreated++;
      }
    }
  }
  console.log(`   ✅ Created ${linksCreated} skill-topic links`);

  // 4. Verify counts
  console.log('\n4. Verification...');
  const topicsCount = await sql`SELECT COUNT(*) AS c FROM outline_topics`;
  const linksCount = await sql`SELECT COUNT(*) AS c FROM skill_outline_map`;
  console.log(`   outline_topics: ${topicsCount[0]?.c}`);
  console.log(`   skill_outline_map: ${linksCount[0]?.c}`);

  console.log('\n✅ Seed complete!');
}

seed().catch(console.error);
