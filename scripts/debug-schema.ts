/**
 * Debug database schema
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

async function debug() {
  const sql = postgres(DATABASE_URL, { ssl: 'require' });

  console.log('🔍 Debugging database schema...\n');

  // What's our search_path?
  const [searchPath] = await sql`SHOW search_path`;
  console.log('search_path:', searchPath.search_path);

  // What schemas exist?
  const schemas = await sql`
    SELECT schema_name 
    FROM information_schema.schemata 
    ORDER BY schema_name
  `;
  console.log('\nSchemas:', schemas.map(s => s.schema_name).join(', '));

  // Where is the items table?
  const itemsLocation = await sql`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_name = 'items'
  `;
  console.log('\nitems table location:', itemsLocation);

  // Try to access items with explicit schema
  try {
    const [count] = await sql`SELECT COUNT(*) as count FROM public.items`;
    console.log('\npublic.items count:', count.count);
  } catch (e: any) {
    console.log('\npublic.items error:', e.message);
  }

  // Try unqualified access
  try {
    const [count] = await sql`SELECT COUNT(*) as count FROM items`;
    console.log('items (unqualified) count:', count.count);
  } catch (e: any) {
    console.log('items (unqualified) error:', e.message);
  }

  await sql.end();
}

debug();
