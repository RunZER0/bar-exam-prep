/**
 * Apply SHA-256 item_hash migration + planner indexes
 * 
 * Fixes:
 * - P0-1: Replace MD5 with SHA-256 for item_hash
 * - P0-2: Add indexes to avoid seq scan on items
 * 
 * Run with: npx tsx scripts/apply-sha256-migration.ts
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

// Schema from env var or default to public
const DB_SCHEMA = process.env.DB_SCHEMA || 'public';

/**
 * Compute SHA-256 hash for item identity
 */
function computeItemHash(prompt: string, itemType: string, unitId: string, difficulty: number): string {
  const normalized = prompt.trim().toLowerCase().replace(/\s+/g, ' ');
  const content = `${normalized}|${itemType}|${unitId}|${difficulty}`;
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 64);
}

async function run() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not found');
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL, { ssl: 'require' });
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 P0 Migration: SHA-256 item_hash + Planner Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Schema: ${DB_SCHEMA}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  try {
    // Set search_path
    await sql.unsafe(`SET search_path TO ${DB_SCHEMA}`);
    console.log(`✓ Set search_path to ${DB_SCHEMA}`);
    
    // ============================================
    // P0-1: Migrate MD5 → SHA-256 for item_hash
    // ============================================
    console.log('\n▶ P0-1: Migrating item_hash from MD5 to SHA-256...');
    
    // Fetch all items and recompute hashes
    const items = await sql`
      SELECT id, prompt, item_type, unit_id, difficulty 
      FROM items
    `;
    console.log(`   Found ${items.length} items to update`);
    
    // Drop the unique constraint temporarily
    try {
      await sql`ALTER TABLE items DROP CONSTRAINT IF EXISTS items_item_hash_unique`;
      console.log('   ✓ Dropped old unique constraint');
    } catch (e: any) {
      console.log('   ✓ No constraint to drop');
    }
    
    // Update each item with SHA-256 hash
    let updated = 0;
    for (const item of items) {
      const newHash = computeItemHash(
        item.prompt, 
        item.item_type, 
        item.unit_id, 
        item.difficulty
      );
      await sql`
        UPDATE items SET item_hash = ${newHash} WHERE id = ${item.id}::uuid
      `;
      updated++;
    }
    console.log(`   ✓ Updated ${updated} items with SHA-256 hashes`);
    
    // Re-add unique constraint
    await sql`ALTER TABLE items ADD CONSTRAINT items_item_hash_unique UNIQUE (item_hash)`;
    console.log('   ✓ Added unique constraint on item_hash');
    
    // Verify no duplicates
    const duplicates = await sql`
      SELECT item_hash, COUNT(*) as count 
      FROM items 
      GROUP BY item_hash 
      HAVING COUNT(*) > 1
    `;
    console.log(`   ✓ Duplicate hashes: ${duplicates.length}`);
    
    // Sample new hashes (show they're 64 chars = SHA-256 hex)
    const samples = await sql`SELECT item_hash FROM items LIMIT 3`;
    console.log('   Sample SHA-256 hashes:');
    for (const s of samples) {
      console.log(`     - ${s.item_hash} (len=${s.item_hash.length})`);
    }
    
    // ============================================
    // P0-2: Add Planner Indexes
    // ============================================
    console.log('\n▶ P0-2: Adding planner indexes...');
    
    // Index 1: Partial index on items for active items (covers WHERE is_active = true)
    const idx1Exists = await sql`
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = ${DB_SCHEMA} AND indexname = 'idx_items_active'
    `;
    if (idx1Exists.length === 0) {
      await sql`CREATE INDEX idx_items_active ON items(id) WHERE is_active = true`;
      console.log('   ✓ Created idx_items_active (partial index)');
    } else {
      console.log('   ✓ idx_items_active already exists');
    }
    
    // Index 2: Composite index for planner filters (unit_id, item_type, difficulty)
    const idx2Exists = await sql`
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = ${DB_SCHEMA} AND indexname = 'idx_items_planner'
    `;
    if (idx2Exists.length === 0) {
      await sql`CREATE INDEX idx_items_planner ON items(unit_id, item_type, difficulty) WHERE is_active = true`;
      console.log('   ✓ Created idx_items_planner (composite partial index)');
    } else {
      console.log('   ✓ idx_items_planner already exists');
    }
    
    // Index 3: Index on item_hash for lookups
    const idx3Exists = await sql`
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = ${DB_SCHEMA} AND indexname = 'idx_items_item_hash'
    `;
    if (idx3Exists.length === 0) {
      await sql`CREATE INDEX idx_items_item_hash ON items(item_hash)`;
      console.log('   ✓ Created idx_items_item_hash');
    } else {
      console.log('   ✓ idx_items_item_hash already exists');
    }
    
    // List all indexes on items
    console.log('\n   All indexes on items table:');
    const allIndexes = await sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE schemaname = ${DB_SCHEMA} AND tablename = 'items'
    `;
    for (const idx of allIndexes) {
      console.log(`     - ${idx.indexname}`);
    }
    
    // ============================================
    // Verify with EXPLAIN
    // ============================================
    console.log('\n▶ Verifying EXPLAIN for planner query...');
    
    // Get a user ID for the explain
    const users = await sql`SELECT id FROM users LIMIT 1`;
    const userId = users[0]?.id || '00000000-0000-0000-0000-000000000000';
    
    const explainResult = await sql`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT 
        i.id as item_id,
        i.prompt,
        i.item_type,
        i.difficulty,
        ism.skill_id,
        ms.p_mastery
      FROM items i
      JOIN item_skill_map ism ON ism.item_id = i.id
      LEFT JOIN mastery_state ms ON ms.skill_id = ism.skill_id AND ms.user_id = ${userId}::uuid
      WHERE i.is_active = true
      ORDER BY COALESCE(ms.p_mastery, 0) ASC, i.difficulty ASC
      LIMIT 20
    `;
    
    console.log('\n   EXPLAIN OUTPUT:');
    for (const row of explainResult) {
      console.log(`   ${row['QUERY PLAN']}`);
    }
    
    // ============================================
    // Summary
    // ============================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ P0 MIGRATION COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   item_hash algorithm: SHA-256`);
    console.log(`   Items updated: ${updated}`);
    console.log(`   Duplicate hashes: ${duplicates.length}`);
    console.log(`   Indexes created: 3`);
    
    await sql.end();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await sql.end();
    process.exit(1);
  }
}

run();
