import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

async function testConnection() {
  console.log('Testing Neon database connection...');
  
  const sql = postgres(DATABASE_URL, { 
    ssl: 'require',
    connect_timeout: 30
  });
  
  try {
    const result = await sql`SELECT 1 as test, NOW() as timestamp`;
    console.log('✅ Connection successful:', result);
    await sql.end();
  } catch (error) {
    console.error('❌ Connection failed:', (error as Error).message);
    console.error('Full error:', error);
  }
}

testConnection();
