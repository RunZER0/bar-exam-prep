import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const totals = await sql`
    SELECT 
      COUNT(*) as cnt,
      COALESCE(SUM(input_tokens),0) as total_input,
      COALESCE(SUM(output_tokens),0) as total_output,
      COALESCE(SUM(cost_usd),0) as logged_cost
    FROM prebuilt_notes_generation_log 
    WHERE status = 'completed'
  `;
  
  const t = totals[0];
  const inp = parseInt(t.total_input);
  const out = parseInt(t.total_output);
  
  console.log("=== RAW TOKEN USAGE ===");
  console.log("Completed generations:", t.cnt);
  console.log("Total input tokens:", inp.toLocaleString());
  console.log("Total output tokens:", out.toLocaleString());
  console.log("Total ALL tokens:", (inp + out).toLocaleString());
  console.log("Logged cost (at $2/$8):", "$" + parseFloat(t.logged_cost).toFixed(2));

  console.log("\n=== COST AT VARIOUS PRICING TIERS ===");
  const prices = [
    ["$2/$8 (assumed gpt-5.2)", 2, 8],
    ["$2.50/$10 (gpt-4o)", 2.5, 10],
    ["$5/$15", 5, 15],
    ["$5/$20", 5, 20],
    ["$10/$30", 10, 30],
    ["$10/$40", 10, 40],
    ["$15/$60 (o1-pro level)", 15, 60],
  ] as const;
  
  for (const [label, inP, outP] of prices) {
    const c = (inp * inP / 1e6) + (out * outP / 1e6);
    console.log(`  ${label}: $${c.toFixed(2)}`);
  }

  // Reverse: what pricing hits $25?
  // Assume standard 1:4 ratio => P*(inp + 4*out)/1e6 = 25
  const P = 25 / ((inp + 4 * out) / 1e6);
  console.log("\n=== TO HIT $25 ===");
  console.log(`Need ~$${P.toFixed(2)} input / $${(P*4).toFixed(2)} output per 1M tokens`);

  console.log("\nAvg input tokens/note:", Math.round(inp / parseInt(t.cnt)).toLocaleString());
  console.log("Avg output tokens/note:", Math.round(out / parseInt(t.cnt)).toLocaleString());
  
  // What model is stored?
  const models = await sql`
    SELECT DISTINCT model_used, COUNT(*) as cnt
    FROM prebuilt_notes WHERE version_number = 1 
    GROUP BY model_used
  `;
  console.log("\n=== ACTUAL MODEL USED ===");
  models.forEach((m: any) => console.log("  " + m.model_used + ": " + m.cnt + " notes"));

  // Status breakdown
  const statuses = await sql`
    SELECT status, COUNT(*) as cnt FROM prebuilt_notes_generation_log GROUP BY status
  `;
  console.log("\nGeneration log status:");
  statuses.forEach((s: any) => console.log("  " + s.status + ": " + s.cnt));

  const notes = await sql`SELECT COUNT(*) as cnt FROM prebuilt_notes WHERE version_number = 1`;
  console.log("v1 notes in DB:", notes[0].cnt);

  // ====== SAMPLE NOTES QUALITY CHECK ======
  console.log("\n\n========== SAMPLE NOTES QUALITY CHECK ==========\n");
  
  // Get 3 random notes from different units
  const samples = await sql`
    SELECT pn.id, pn.title, pn.word_count, pn.model_used,
           pn.narrative_markdown, pn.sections_json, pn.authorities_json,
           LENGTH(pn.narrative_markdown) as md_size,
           LENGTH(pn.sections_json::text) as json_size
    FROM prebuilt_notes pn
    WHERE pn.version_number = 1
    ORDER BY RANDOM()
    LIMIT 3
  `;

  for (const s of samples) {
    console.log("─".repeat(80));
    console.log(`TOPIC: ${s.title}`);
    console.log(`Model: ${s.model_used} | Words: ${s.word_count}`);
    console.log(`Markdown size: ${s.md_size} chars | Sections JSON size: ${s.json_size} chars`);
    
    // Parse sections_json
    let sections: any[];
    try {
      sections = typeof s.sections_json === 'string' ? JSON.parse(s.sections_json) : s.sections_json;
    } catch {
      console.log("⚠️ Could not parse sections_json");
      continue;
    }
    
    // Parse authorities_json
    let authorities: any[];
    try {
      authorities = typeof s.authorities_json === 'string' ? JSON.parse(s.authorities_json) : s.authorities_json;
    } catch {
      authorities = [];
    }
    
    console.log(`Sections: ${sections.length} | Authorities: ${authorities.length}`);
    
    // Show section titles
    if (Array.isArray(sections)) {
      console.log(`\nSECTION TITLES:`);
      sections.forEach((sec: any, i: number) => {
        const bodyLen = sec.body ? sec.body.length : 0;
        const examTip = sec.examTip ? `  ✓ Tip` : '';
        console.log(`  ${i+1}. "${sec.title}" (${bodyLen} chars)${examTip}`);
      });
      
      // Show first section body (truncated)
      if (sections[0]?.body) {
        console.log(`\nFIRST SECTION BODY (first 600 chars):`);
        console.log(sections[0].body.substring(0, 600));
      }
    }
    
    // Show authorities
    if (authorities.length > 0) {
      console.log(`\nAUTHORITIES (first 5):`);
      authorities.slice(0, 5).forEach((a: any, i: number) => {
        console.log(`  ${i+1}. ${typeof a === 'string' ? a : JSON.stringify(a).substring(0, 120)}`);
      });
    }
    
    // Show narrative markdown snippet
    console.log(`\nMARKDOWN BEGINNING (first 400 chars):`);
    console.log(s.narrative_markdown.substring(0, 400));
    
    console.log("");
  }

  // Also check: are there any notes with suspiciously low content?
  console.log("\n========== QUALITY FLAGS ==========\n");
  
  const lowWord = await sql`
    SELECT COUNT(*) as cnt FROM prebuilt_notes 
    WHERE version_number = 1 AND word_count < 500
  `;
  console.log(`Notes with < 500 words: ${lowWord[0].cnt}`);
  
  const totalNotes = await sql`SELECT COUNT(*) as cnt FROM prebuilt_notes WHERE version_number = 1`;
  console.log(`Total v1 notes: ${totalNotes[0].cnt}`);
  
  // Check sections_json array length
  const sectionStats = await sql`
    SELECT 
      MIN(jsonb_array_length(sections_json)) as min_sec,
      MAX(jsonb_array_length(sections_json)) as max_sec,
      AVG(jsonb_array_length(sections_json))::numeric(4,1) as avg_sec
    FROM prebuilt_notes WHERE version_number = 1
  `;
  const ss = sectionStats[0];
  console.log(`Section count: min=${ss.min_sec}, max=${ss.max_sec}, avg=${ss.avg_sec}`);
  
  // Check authorities_json array length
  const authStats = await sql`
    SELECT 
      MIN(jsonb_array_length(authorities_json)) as min_auth,
      MAX(jsonb_array_length(authorities_json)) as max_auth,
      AVG(jsonb_array_length(authorities_json))::numeric(4,1) as avg_auth,
      COUNT(*) FILTER (WHERE jsonb_array_length(authorities_json) = 0) as zero_auth
    FROM prebuilt_notes WHERE version_number = 1
  `;
  const as2 = authStats[0];
  console.log(`Authority count: min=${as2.min_auth}, max=${as2.max_auth}, avg=${as2.avg_auth}, zero=${as2.zero_auth}`);
  
  // Word count distribution
  const wordStats = await sql`
    SELECT 
      MIN(word_count) as min_w,
      MAX(word_count) as max_w,
      AVG(word_count)::int as avg_w
    FROM prebuilt_notes WHERE version_number = 1
  `;
  const ws = wordStats[0];
  console.log(`Word count: min=${ws.min_w}, max=${ws.max_w}, avg=${ws.avg_w}`);
  
  // Token usage from generation log
  const tokenStats = await sql`
    SELECT 
      MIN(input_tokens) as min_in, MAX(input_tokens) as max_in, AVG(input_tokens)::int as avg_in,
      MIN(output_tokens) as min_out, MAX(output_tokens) as max_out, AVG(output_tokens)::int as avg_out
    FROM prebuilt_notes_generation_log WHERE status = 'completed'
  `;
  const ts2 = tokenStats[0];
  console.log(`\nToken distribution (from generation log):`);
  console.log(`  Input:  min=${ts2.min_in}, max=${ts2.max_in}, avg=${ts2.avg_in}`);
  console.log(`  Output: min=${ts2.min_out}, max=${ts2.max_out}, avg=${ts2.avg_out}`);
  
  // CORRECT PRICING recalc
  console.log("\n========== CORRECT PRICING: $1.75/$14.00 ==========\n");
  const correctCost = (inp * 1.75 / 1e6) + (out * 14 / 1e6);
  console.log(`Total generation cost at $1.75/$14.00: $${correctCost.toFixed(2)}`);
  console.log(`Per note (avg): $${(correctCost / parseInt(t.cnt)).toFixed(4)}`);
  console.log(`For 297 unique notes (projected): $${(correctCost / parseInt(t.cnt) * 297).toFixed(2)}`);
}
main().catch(console.error);
