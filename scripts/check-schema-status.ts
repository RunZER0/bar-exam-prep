// Script to verify Schema
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env');
    return;
  }
  
  const sqlConnection = neon(process.env.DATABASE_URL);
  const dbClient = drizzle(sqlConnection);

  try {
    // Check if table witnesses exists
    // Check if column exam_path exists in user_profiles
    
    // We will just do a check by selecting from information_schema
    const checkWitnesses = await dbClient.execute(sql`
        SELECT table_name FROM information_schema.tables WHERE table_name = 'witnesses'
    `);

    const checkColumns = await dbClient.execute(sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name IN ('exam_path', 'llb_origin', 'professional_exposure', 'failure_analysis')
    `);

    console.log('Witnesses table exists:', checkWitnesses.rows.length > 0);
    console.log('User Profile Columns found:', checkColumns.rows.map(r => r.column_name));

  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

main().catch(console.error);