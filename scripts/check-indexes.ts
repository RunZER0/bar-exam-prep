import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

async function checkIndexes() {
  const sql = postgres(DATABASE_URL, { ssl: 'require' });

  console.log('\n📋 INDEXES ON items TABLE:\n');
  
  const indexes = await sql`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'items'
  `;
  
  for (const idx of indexes) {
    console.log(`  ${idx.indexname}`);
    console.log(`    ${idx.indexdef}\n`);
  }
  
  // Verify hash length
  console.log('📋 HASH LENGTH VERIFICATION:\n');
  const hashCheck = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN LENGTH(item_hash) = 64 THEN 1 END) as sha256_hashes,
      COUNT(CASE WHEN item_hash IS NULL THEN 1 END) as null_hashes
    FROM items
  `;
  console.log(`  Total items: ${hashCheck[0].total}`);
  console.log(`  SHA-256 hashes (64 chars): ${hashCheck[0].sha256_hashes}`);
  console.log(`  NULL hashes: ${hashCheck[0].null_hashes}`);
  
  await sql.end();
  process.exit(0);
}

checkIndexes();
