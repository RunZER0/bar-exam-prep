// List all tables in the database
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const result = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  
  console.log('Tables found:', result.rows.map(r => r.table_name));
}

main().catch(console.error);