/**
 * Apply item_hash migration to production database
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

async function run() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not found');
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL, { ssl: 'require' });
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 Applying migration: add item_hash column');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Reset search_path to public schema
    await sql`SET search_path TO public`;
    console.log('✓ Set search_path to public');
    
    // Check existing columns
    const existingCols = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'items' AND column_name IN ('format', 'item_hash')
    `;
    console.log(`Existing columns: ${existingCols.map(c => c.column_name).join(', ') || 'none'}`);
    
    // Add format column if not exists
    const hasFormat = existingCols.some(c => c.column_name === 'format');
    if (!hasFormat) {
      await sql`ALTER TABLE items ADD COLUMN format TEXT`;
      console.log('✓ Added format column');
    } else {
      console.log('✓ format column already exists');
    }
    
    // Add item_hash column if not exists
    const hasItemHash = existingCols.some(c => c.column_name === 'item_hash');
    if (!hasItemHash) {
      await sql`ALTER TABLE items ADD COLUMN item_hash TEXT`;
      console.log('✓ Added item_hash column');
    } else {
      console.log('✓ item_hash column already exists');
    }
    
    // Backfill item_hash for existing items
    const backfillResult = await sql`
      UPDATE items 
      SET item_hash = MD5(
        LOWER(TRIM(prompt)) || '|' || item_type || '|' || unit_id || '|' || difficulty::text
      )
      WHERE item_hash IS NULL
      RETURNING id
    `;
    console.log(`✓ Backfilled ${backfillResult.length} items with item_hash`);
    
    // Check if unique constraint exists
    const constraintExists = await sql`
      SELECT 1 FROM pg_constraint WHERE conname = 'items_item_hash_unique'
    `;
    
    if (constraintExists.length === 0) {
      await sql`ALTER TABLE items ADD CONSTRAINT items_item_hash_unique UNIQUE (item_hash)`;
      console.log('✓ Added unique constraint on item_hash');
    } else {
      console.log('✓ Unique constraint already exists');
    }
    
    // Verify
    const finalCols = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'items' AND column_name IN ('format', 'item_hash')
    `;
    console.log(`\n📋 Verified columns: ${finalCols.map(c => c.column_name).join(', ')}`);
    
    // Count items with hashes
    const [counts] = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(item_hash) as with_hash
      FROM items
    `;
    console.log(`📋 Items: ${counts.total} total, ${counts.with_hash} with hash`);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    await sql.end();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await sql.end();
    process.exit(1);
  }
}

run();
