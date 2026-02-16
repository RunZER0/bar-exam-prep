/**
 * Database cleanup script - removes duplicate items and resets to clean state
 * Run: npx tsx scripts/clean-db.ts
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

async function cleanDatabase() {
  console.log('🧹 DATABASE CLEANUP\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sql = postgres(DATABASE_URL, { ssl: 'require' });

  try {
    // Count before cleanup
    const [beforeItems] = await sql`SELECT COUNT(*) AS total FROM items`;
    const [beforeMappings] = await sql`SELECT COUNT(*) AS total FROM item_skill_map`;
    console.log(`📊 Before cleanup:`);
    console.log(`   items: ${beforeItems.total}`);
    console.log(`   item_skill_map: ${beforeMappings.total}\n`);

    // Find duplicate items by prompt
    console.log('🔍 Finding duplicates...');
    const duplicates = await sql`
      SELECT prompt, COUNT(*) as cnt
      FROM items
      WHERE unit_id = 'atp-100'
      GROUP BY prompt
      HAVING COUNT(*) > 1
    `;
    console.log(`   Found ${duplicates.length} prompts with duplicates\n`);

    // For each duplicate, keep only the first one and delete mappings + items for the rest
    console.log('🗑️ Removing duplicates...');
    let deletedItems = 0;
    let deletedMappings = 0;

    for (const dup of duplicates) {
      // Get all items with this prompt
      const items = await sql`
        SELECT id FROM items WHERE prompt = ${dup.prompt} ORDER BY created_at ASC
      `;
      
      // Keep the first, delete the rest
      const toDelete = items.slice(1).map(i => i.id);
      
      if (toDelete.length > 0) {
        for (const itemId of toDelete) {
          try {
            // Delete mappings first (FK constraint)
            await sql`DELETE FROM item_skill_map WHERE item_id = ${itemId}::uuid`;
            // Delete any attempts referencing this item
            await sql`DELETE FROM attempts WHERE item_id = ${itemId}::uuid`;
            // Delete the item
            await sql`DELETE FROM items WHERE id = ${itemId}::uuid`;
            deletedItems++;
          } catch (e) {
            console.log(`   ⚠️ Could not delete ${itemId}: FK constraint`);
          }
        }
      }
    }
    
    console.log(`   Deleted ${deletedItems} duplicate items`);
    console.log(`   Deleted ${deletedMappings} duplicate mappings\n`);

    // Count after cleanup
    const [afterItems] = await sql`SELECT COUNT(*) AS total FROM items`;
    const [afterMappings] = await sql`SELECT COUNT(*) AS total FROM item_skill_map`;
    const [unmapped] = await sql`
      SELECT COUNT(*) AS total 
      FROM items i 
      LEFT JOIN item_skill_map ism ON i.id = ism.item_id 
      WHERE ism.item_id IS NULL
    `;
    
    console.log(`📊 After cleanup:`);
    console.log(`   items: ${afterItems.total}`);
    console.log(`   item_skill_map: ${afterMappings.total}`);
    console.log(`   unmapped items: ${unmapped.total}\n`);

    await sql.end();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Cleanup complete');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await sql.end();
    process.exit(1);
  }
}

cleanDatabase();
