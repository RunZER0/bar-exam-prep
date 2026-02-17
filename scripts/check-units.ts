import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

// Load .env
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').replace(/^["']|["']$/g, '');
    if (key && value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log('Checking unit IDs in micro_skills...');
  const result = await sql`
    SELECT unit_id, COUNT(*)::int as cnt 
    FROM micro_skills 
    WHERE is_active = true 
    GROUP BY unit_id 
    ORDER BY unit_id
  `;
  console.log(result);
  
  console.log('\nSample skills:');
  const samples = await sql`
    SELECT id, code, unit_id, name 
    FROM micro_skills 
    WHERE is_active = true 
    LIMIT 5
  `;
  console.log(samples);
}

main().catch(console.error);
