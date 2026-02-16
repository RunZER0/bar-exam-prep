/**
 * YNAI Mastery Engine v3 - Seed Script (postgres.js version)
 * 
 * Seeds a complete demo curriculum for Civil Procedure unit:
 * - 1 Domain
 * - 20 Micro-skills with prerequisites
 * - 100 Items (mix of MCQ, written, oral, drafting)
 * - Item-skill mappings
 * 
 * Uses item_hash for idempotent seeding (ON CONFLICT DO NOTHING)
 * 
 * Run with: npx tsx scripts/seed-curriculum-v2.ts
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Load .env manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

// Schema configuration - use DB_SCHEMA env var or default to 'public'
const DB_SCHEMA = process.env.DB_SCHEMA || 'public';

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Computes a stable hash for item identity using SHA-256
 * Uses: normalized_prompt | item_type | unit_id | difficulty
 */
function computeItemHash(prompt: string, itemType: string, unitId: string, difficulty: number): string {
  const normalized = prompt.trim().toLowerCase().replace(/\s+/g, ' ');
  const content = `${normalized}|${itemType}|${unitId}|${difficulty}`;
  // Use SHA-256 (not MD5) to avoid collision risk at scale
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 64);
}

// ============================================
// CONFIGURATION
// ============================================

const DOMAIN = {
  name: 'Civil Procedure',
  code: 'civil-proc',
  description: 'Civil Procedure and Practice under Kenyan law',
};

const UNIT_ID = 'atp-100'; // Civil Procedure ATP unit

// 20 Micro-skills with hierarchy
const SKILLS = [
  // Foundation skills (no prerequisites)
  { code: 'cp-jurisdiction', name: 'Jurisdiction Analysis', difficulty: 'foundation', weight: 0.08, formats: ['written', 'mcq'], isCore: true },
  { code: 'cp-parties', name: 'Parties to Civil Proceedings', difficulty: 'foundation', weight: 0.05, formats: ['written', 'mcq'], isCore: true },
  { code: 'cp-cause-action', name: 'Cause of Action Elements', difficulty: 'foundation', weight: 0.07, formats: ['written', 'mcq'], isCore: true },
  { code: 'cp-limitation', name: 'Limitation Periods', difficulty: 'foundation', weight: 0.05, formats: ['mcq'], isCore: false },
  { code: 'cp-service', name: 'Service of Process', difficulty: 'foundation', weight: 0.04, formats: ['mcq', 'drafting'], isCore: false },
  
  // Core skills (require foundation)
  { code: 'cp-plaint-draft', name: 'Plaint Drafting', difficulty: 'core', weight: 0.08, formats: ['drafting'], isCore: true, prereqs: ['cp-jurisdiction', 'cp-parties', 'cp-cause-action'] },
  { code: 'cp-defence-draft', name: 'Defence Drafting', difficulty: 'core', weight: 0.06, formats: ['drafting'], isCore: true, prereqs: ['cp-plaint-draft'] },
  { code: 'cp-counterclaim', name: 'Counterclaim Procedure', difficulty: 'core', weight: 0.05, formats: ['written', 'drafting'], isCore: false, prereqs: ['cp-defence-draft'] },
  { code: 'cp-interlocutory', name: 'Interlocutory Applications', difficulty: 'core', weight: 0.07, formats: ['written', 'oral', 'drafting'], isCore: true, prereqs: ['cp-plaint-draft'] },
  { code: 'cp-injunction', name: 'Injunction Applications', difficulty: 'core', weight: 0.08, formats: ['written', 'oral', 'drafting'], isCore: true, prereqs: ['cp-interlocutory'] },
  { code: 'cp-summary-judg', name: 'Summary Judgment', difficulty: 'core', weight: 0.05, formats: ['written', 'oral'], isCore: false, prereqs: ['cp-plaint-draft', 'cp-defence-draft'] },
  { code: 'cp-discovery', name: 'Discovery & Interrogatories', difficulty: 'core', weight: 0.05, formats: ['written', 'drafting'], isCore: false, prereqs: ['cp-plaint-draft'] },
  { code: 'cp-joinder', name: 'Joinder of Parties', difficulty: 'core', weight: 0.04, formats: ['written'], isCore: false, prereqs: ['cp-parties'] },
  { code: 'cp-amendment', name: 'Amendment of Pleadings', difficulty: 'core', weight: 0.04, formats: ['written', 'oral'], isCore: false, prereqs: ['cp-plaint-draft'] },
  
  // Advanced skills (require core)
  { code: 'cp-trial-conduct', name: 'Trial Conduct & Evidence', difficulty: 'advanced', weight: 0.08, formats: ['oral', 'written'], isCore: true, prereqs: ['cp-interlocutory', 'cp-discovery'] },
  { code: 'cp-examination', name: 'Witness Examination', difficulty: 'advanced', weight: 0.06, formats: ['oral'], isCore: true, prereqs: ['cp-trial-conduct'] },
  { code: 'cp-judgment-draft', name: 'Judgment Analysis & Drafts', difficulty: 'advanced', weight: 0.05, formats: ['written', 'drafting'], isCore: false, prereqs: ['cp-trial-conduct'] },
  { code: 'cp-costs', name: 'Costs in Civil Proceedings', difficulty: 'advanced', weight: 0.04, formats: ['written', 'mcq'], isCore: false, prereqs: ['cp-judgment-draft'] },
  { code: 'cp-execution', name: 'Execution of Judgments', difficulty: 'advanced', weight: 0.05, formats: ['written', 'drafting'], isCore: false, prereqs: ['cp-judgment-draft'] },
  { code: 'cp-appeals', name: 'Appeals & Review', difficulty: 'advanced', weight: 0.06, formats: ['written', 'oral'], isCore: true, prereqs: ['cp-judgment-draft'] },
] as const;

// Sample prompts for items
const SAMPLE_PROMPTS: Record<string, string[]> = {
  'cp-jurisdiction': [
    'Analyze which court has jurisdiction over a contract dispute worth KES 2 million where the contract was executed in Nairobi but the defendant resides in Mombasa.',
    'Explain the distinction between original and appellate jurisdiction in the Kenyan court system.',
    'Which court has jurisdiction for a land claim valued at KES 300,000?',
    'MCQ: Under the CPC, the court for a contract dispute worth KES 50,000 is which court?',
    'A party challenges jurisdiction after filing a defence. Is this valid under Order 6 CPC?',
  ],
  'cp-parties': [
    'Explain who can be a proper party to civil proceedings and the test for necessary vs proper parties.',
    'A minor wishes to sue for damages from a road accident. Explain the procedure for representation.',
    'A company director is sued personally for company debts. Are they a proper party?',
    'Distinguish between representative suits and class actions under Kenyan civil procedure.',
    'MCQ: A deceased persons estate can sue through whom?',
  ],
  'cp-plaint-draft': [
    'Draft a plaint for recovery of KES 5 million being money lent and not repaid.',
    'Review this plaint and identify all defects in format and content.',
    'Draft the averments section for breach of employment contract and wrongful dismissal.',
    'A plaint has been rejected by the registry. Identify common rejection reasons and correct them.',
    'Draft a plaint claiming specific performance of a land sale agreement.',
  ],
};

function getItemType(format: string): string {
  switch (format) {
    case 'mcq': return 'mcq';
    case 'written': return 'issue_spot';
    case 'oral': return 'oral_prompt';
    case 'drafting': return 'drafting_task';
    default: return 'issue_spot';
  }
}

function getEstimatedMinutes(format: string): number {
  switch (format) {
    case 'mcq': return 5;
    case 'written': return 20;
    case 'oral': return 15;
    case 'drafting': return 30;
    default: return 15;
  }
}

async function seedCurriculum() {
  console.log('🌱 Starting curriculum seed...\n');
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not found');
    process.exit(1);
  }
  
  const sql = postgres(DATABASE_URL, { ssl: 'require' });
  
  try {
    // Set search_path to configured schema (from DB_SCHEMA env var)
    await sql.unsafe(`SET search_path TO ${DB_SCHEMA}`);
    console.log(`   ✓ Set search_path to ${DB_SCHEMA}\n`);
    
    // 1. Create domain
    console.log('📁 Creating domain...');
    const [domain] = await sql`
      INSERT INTO domains (name, code, description)
      VALUES (${DOMAIN.name}, ${DOMAIN.code}, ${DOMAIN.description})
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    const domainId = domain.id;
    console.log(`   ✓ Domain created: ${domainId}\n`);
    
    // 2. Create micro-skills
    console.log('🎯 Creating micro-skills...');
    const skillIdMap: Map<string, string> = new Map();
    
    for (const skill of SKILLS) {
      const formatTags = `{${skill.formats.join(',')}}`;
      
      const [result] = await sql`
        INSERT INTO micro_skills (name, code, domain_id, unit_id, format_tags, exam_weight, difficulty, is_core, is_active)
        VALUES (
          ${skill.name}, 
          ${skill.code}, 
          ${domainId}::uuid, 
          ${UNIT_ID},
          ${formatTags}::text[],
          ${skill.weight},
          ${skill.difficulty},
          ${skill.isCore},
          true
        )
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `;
      skillIdMap.set(skill.code, result.id);
      console.log(`   ✓ ${skill.name}`);
    }
    console.log(`   Total: ${skillIdMap.size} skills\n`);
    
    // 3. Create skill prerequisites (edges)
    console.log('🔗 Creating skill prerequisites...');
    let edgeCount = 0;
    for (const skill of SKILLS) {
      if ('prereqs' in skill && skill.prereqs) {
        const toSkillId = skillIdMap.get(skill.code);
        for (const prereqCode of skill.prereqs) {
          const fromSkillId = skillIdMap.get(prereqCode);
          if (fromSkillId && toSkillId) {
            await sql`
              INSERT INTO skill_edges (from_skill_id, to_skill_id, edge_type, strength)
              VALUES (${fromSkillId}::uuid, ${toSkillId}::uuid, 'prerequisite', 1.0)
              ON CONFLICT (from_skill_id, to_skill_id) DO NOTHING
            `;
            edgeCount++;
          }
        }
      }
    }
    console.log(`   ✓ ${edgeCount} prerequisite edges created\n`);
    
    // 4. Create items and mappings
    console.log('📝 Creating items and mappings...');
    let insertedCount = 0;
    let skippedCount = 0;
    let mappingCount = 0;
    
    for (const skill of SKILLS) {
      const skillId = skillIdMap.get(skill.code);
      if (!skillId) continue;
      
      // Get sample prompts or generate generic ones
      const prompts = SAMPLE_PROMPTS[skill.code] || [
        `Practice question 1 for ${skill.name}`,
        `Practice question 2 for ${skill.name}`,
        `Practice question 3 for ${skill.name}`,
        `Practice question 4 for ${skill.name}`,
        `Practice question 5 for ${skill.name}`,
      ];
      
      // Create 5 items per skill (with idempotency via item_hash)
      for (let i = 0; i < 5; i++) {
        const format = skill.formats[i % skill.formats.length];
        const itemType = getItemType(format);
        const estimatedMinutes = getEstimatedMinutes(format);
        const difficulty = skill.difficulty === 'foundation' ? 2 : skill.difficulty === 'core' ? 3 : 4;
        const prompt = prompts[i] || `Practice question ${i + 1} for ${skill.name}`;
        
        // Compute stable hash for idempotency
        const itemHash = computeItemHash(prompt, itemType, UNIT_ID, difficulty);
        
        // Use ON CONFLICT for idempotent insert
        const result = await sql`
          INSERT INTO items (item_type, format, unit_id, prompt, difficulty, estimated_minutes, is_active, item_hash)
          VALUES (
            ${itemType},
            ${format},
            ${UNIT_ID},
            ${prompt},
            ${difficulty},
            ${estimatedMinutes},
            true,
            ${itemHash}
          )
          ON CONFLICT (item_hash) DO NOTHING
          RETURNING id
        `;
        
        let itemId: string;
        if (result.length > 0) {
          itemId = result[0].id;
          insertedCount++;
        } else {
          // Item already exists, fetch its ID
          const [existing] = await sql`
            SELECT id FROM items WHERE item_hash = ${itemHash} LIMIT 1
          `;
          itemId = existing.id;
          skippedCount++;
        }
        
        // Create item-skill mapping (idempotent)
        await sql`
          INSERT INTO item_skill_map (item_id, skill_id, strength, coverage_weight)
          VALUES (${itemId}::uuid, ${skillId}::uuid, 'primary', 1.0)
          ON CONFLICT (item_id, skill_id) DO NOTHING
        `;
        mappingCount++;
      }
      console.log(`   ✓ ${skill.name}: 5 items`);
    }
    console.log(`   Inserted: ${insertedCount}, Skipped (duplicate): ${skippedCount}`);
    console.log(`   Total mappings: ${mappingCount}\n`);
    
    // 5. Verify seed
    console.log('🔍 Verifying seed...');
    const [skillCount] = await sql`SELECT COUNT(*) as count FROM micro_skills`;
    const [itemCountDb] = await sql`SELECT COUNT(*) as count FROM items`;
    const [mapCount] = await sql`SELECT COUNT(*) as count FROM item_skill_map`;
    
    // Check for duplicate hashes
    const duplicateHashes = await sql`
      SELECT item_hash, COUNT(*) as count
      FROM items
      WHERE item_hash IS NOT NULL
      GROUP BY item_hash
      HAVING COUNT(*) > 1
    `;
    
    console.log(`   micro_skills: ${skillCount.count}`);
    console.log(`   items: ${itemCountDb.count}`);
    console.log(`   item_skill_map: ${mapCount.count}`);
    console.log(`   duplicate_hashes: ${duplicateHashes.length}`);
    
    // 6. Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Curriculum seed complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Domain:     1 (${DOMAIN.name})`);
    console.log(`   Skills:     ${skillIdMap.size}`);
    console.log(`   Prereqs:    ${edgeCount} edges`);
    console.log(`   Items:      ${insertedCount} inserted, ${skippedCount} skipped`);
    console.log(`   Total Items: ${itemCountDb.count}`);
    console.log(`   Mappings:   ${mappingCount}`);
    console.log(`   Unit:       ${UNIT_ID}`);
    console.log(`   Idempotent: ${duplicateHashes.length === 0 ? 'YES ✓' : 'NO ✗'}\n`);
    
    await sql.end();
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    await sql.end();
    process.exit(1);
  }
}

seedCurriculum();
