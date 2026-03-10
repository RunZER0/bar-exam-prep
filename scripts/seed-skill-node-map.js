/**
 * One-time script: Map all 430 micro_skills → syllabus_nodes
 * 
 * Strategy:
 *   Pass 1: Text matching (free) — catches ~42%
 *   Pass 2: Subtopic word matching (free) — catches more
 *   Pass 3: AI batch mapping via gpt-4o-mini (~$0.01) — catches the rest
 * 
 * Usage: node scripts/seed-skill-node-map.js [--dry-run]
 */
const { neon } = require('@neondatabase/serverless');
const OpenAI = require('openai');

const sql = neon(process.env.DATABASE_URL);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n=== Skill → Node Mapping Script ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  // Load all skills
  const skills = await sql`
    SELECT id, name, unit_id, domain_id 
    FROM micro_skills 
    ORDER BY UPPER(REPLACE(unit_id, '-', '')), name
  `;
  console.log(`Loaded ${skills.length} micro_skills`);

  // Load all nodes with subtopics
  const nodes = await sql`
    SELECT id, unit_code, topic_name, subtopic_name 
    FROM syllabus_nodes 
    ORDER BY unit_code, topic_name, subtopic_name
  `;
  console.log(`Loaded ${nodes.length} syllabus_nodes`);

  // Check existing mappings
  const existing = await sql`SELECT skill_id FROM skill_node_map`;
  const existingSet = new Set(existing.map(r => r.skill_id));
  console.log(`Existing mappings: ${existingSet.size}`);

  // Group nodes by unit
  const nodesByUnit = {};
  for (const n of nodes) {
    const unit = n.unit_code.toUpperCase().replace(/-/g, '');
    if (!nodesByUnit[unit]) nodesByUnit[unit] = [];
    nodesByUnit[unit].push(n);
  }

  const mapped = [];
  const unmatchedForAI = [];

  for (const skill of skills) {
    if (existingSet.has(skill.id)) continue;
    
    const skillUnit = skill.unit_id.toUpperCase().replace(/-/g, '');
    const unitNodes = nodesByUnit[skillUnit] || [];
    if (unitNodes.length === 0) {
      console.warn(`  No nodes for unit ${skillUnit} (skill: ${skill.name})`);
      continue;
    }

    const skillName = skill.name.trim();
    const cleanName = skillName.replace(/^Case:\s*/i, '').trim();
    const skillLower = cleanName.toLowerCase();

    let bestNode = null;
    let bestSource = 'text_match';
    let bestConfidence = 1.0;

    // ── Pass 1: Direct text matching ──
    for (const node of unitNodes) {
      const topicLower = node.topic_name.toLowerCase();
      const subLower = (node.subtopic_name || '').toLowerCase();
      
      // Exact match
      if (topicLower === skillLower || subLower === skillLower) {
        bestNode = node;
        bestConfidence = 1.0;
        break;
      }
      // Skill name contained in topic/subtopic
      if (topicLower.includes(skillLower) || subLower.includes(skillLower)) {
        bestNode = node;
        bestConfidence = 0.95;
        break;
      }
      // Topic name contained in skill name (reverse)
      if (skillLower.includes(topicLower) && topicLower.length >= 4) {
        if (!bestNode || node.topic_name.length > bestNode.topic_name.length) {
          bestNode = node;
          bestConfidence = 0.9;
        }
      }
    }

    // ── Pass 2: Word matching against subtopics ──
    if (!bestNode) {
      const skillWords = cleanName.toLowerCase()
        .split(/[\s,&:()+\-/]+/)
        .filter(w => w.length >= 3 && !['the','and','for','with','from','case','legal'].includes(w));
      
      let bestScore = 0;
      for (const node of unitNodes) {
        const combined = `${node.topic_name} ${node.subtopic_name || ''}`.toLowerCase();
        let score = 0;
        for (const w of skillWords) {
          if (combined.includes(w)) score++;
        }
        // Require at least 1 word match, preferring more
        if (score > bestScore) {
          bestScore = score;
          bestNode = node;
          bestConfidence = Math.min(0.85, 0.5 + score * 0.15);
        }
      }
      if (bestNode && bestScore < 1) bestNode = null;
      if (bestNode) bestSource = 'text_match';
    }

    if (bestNode) {
      mapped.push({ skillId: skill.id, nodeId: bestNode.id, confidence: bestConfidence, source: bestSource, skillName, nodeTopic: bestNode.topic_name });
    } else {
      unmatchedForAI.push({ skill, unitNodes });
    }
  }

  console.log(`\nPass 1+2 text matching: ${mapped.length} mapped, ${unmatchedForAI.length} need AI\n`);

  // ── Pass 3: AI batch mapping ──
  if (unmatchedForAI.length > 0) {
    console.log(`Running AI mapping for ${unmatchedForAI.length} skills...`);
    
    // Group unmatched by unit for efficient batching
    const byUnit = {};
    for (const { skill, unitNodes } of unmatchedForAI) {
      const unit = skill.unit_id.toUpperCase().replace(/-/g, '');
      if (!byUnit[unit]) byUnit[unit] = { skills: [], nodes: unitNodes };
      byUnit[unit].skills.push(skill);
    }

    for (const [unit, { skills: unitSkills, nodes: uNodes }] of Object.entries(byUnit)) {
      // Build compact node reference
      const nodeRef = uNodes.map((n, i) => 
        `${i}: "${n.topic_name}"${n.subtopic_name ? ` → "${n.subtopic_name}"` : ''}`
      ).join('\n');

      // Process in batches of 30
      for (let i = 0; i < unitSkills.length; i += 30) {
        const batch = unitSkills.slice(i, i + 30);
        const skillList = batch.map((s, j) => `${j}: "${s.name}"`).join('\n');

        const prompt = `Map each skill to the BEST matching syllabus node by index number.
These are Kenya Bar Exam (ATP) skills and syllabus topics for unit ${unit}.

SYLLABUS NODES (index: "topic" → "subtopic"):
${nodeRef}

SKILLS TO MAP (index: "skill name"):
${skillList}

Return ONLY a JSON array of [skillIndex, nodeIndex] pairs. Example: [[0,5],[1,12],[2,3]]
Every skill MUST be mapped to exactly one node. Pick the closest conceptual match.`;

        try {
          const resp = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            response_format: { type: 'json_object' },
          });

          const content = resp.choices[0].message.content;
          let pairs;
          try {
            const parsed = JSON.parse(content);
            pairs = Array.isArray(parsed) ? parsed : parsed.mappings || parsed.pairs || Object.values(parsed)[0];
          } catch {
            // Try extracting array from text
            const match = content.match(/\[[\s\S]*\]/);
            pairs = match ? JSON.parse(match[0]) : [];
          }

          for (const pair of pairs) {
            const [sIdx, nIdx] = Array.isArray(pair) ? pair : [pair.skill || pair.s, pair.node || pair.n];
            if (sIdx >= 0 && sIdx < batch.length && nIdx >= 0 && nIdx < uNodes.length) {
              mapped.push({
                skillId: batch[sIdx].id,
                nodeId: uNodes[nIdx].id,
                confidence: 0.8,
                source: 'ai',
                skillName: batch[sIdx].name,
                nodeTopic: uNodes[nIdx].topic_name,
              });
            }
          }
          console.log(`  ${unit} batch ${Math.floor(i/30)+1}: ${pairs.length} mapped`);
        } catch (e) {
          console.error(`  ${unit} batch ${Math.floor(i/30)+1} FAILED:`, e.message);
        }
      }
    }
  }

  console.log(`\n=== TOTAL MAPPED: ${mapped.length} / ${skills.length - existingSet.size} ===\n`);

  // ── Insert mappings ──
  if (!DRY_RUN && mapped.length > 0) {
    let inserted = 0;
    // Insert in batches of 50
    for (let i = 0; i < mapped.length; i += 50) {
      const batch = mapped.slice(i, i + 50);
      for (const m of batch) {
        try {
          await sql`
            INSERT INTO skill_node_map (skill_id, node_id, confidence, source)
            VALUES (${m.skillId}::uuid, ${m.nodeId}::uuid, ${m.confidence}, ${m.source})
            ON CONFLICT (skill_id, node_id) DO NOTHING
          `;
          inserted++;
        } catch (e) {
          console.warn(`  Insert failed for ${m.skillName}:`, e.message);
        }
      }
      console.log(`  Inserted ${Math.min(i + 50, mapped.length)}/${mapped.length}...`);
    }
    console.log(`\nInserted ${inserted} mappings into skill_node_map`);
  }

  // ── Report ──
  if (DRY_RUN) {
    console.log('\nDRY RUN — Sample mappings:');
    for (const m of mapped.slice(0, 30)) {
      console.log(`  "${m.skillName}" → "${m.nodeTopic}" (${m.source}, ${m.confidence})`);
    }
  }

  // Verify final coverage
  const totalMapped = await sql`SELECT COUNT(DISTINCT skill_id) as c FROM skill_node_map`;
  const totalSkills = await sql`SELECT COUNT(*) as c FROM micro_skills`;
  console.log(`\nFinal coverage: ${totalMapped[0]?.c || 0} / ${totalSkills[0]?.c || 0} skills mapped`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
