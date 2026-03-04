import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
  console.log('=== ALL TABLES ===');
  tables.forEach((t: any) => console.log(t.table_name));

  // Check if specific tables exist
  const check = async (name: string) => {
    try {
      const r = await sql`SELECT COUNT(*)::int as c FROM information_schema.tables WHERE table_schema='public' AND table_name=${name}`;
      return r[0].c > 0;
    } catch { return false; }
  };

  console.log('\n=== GAP CHECK ===');
  for (const t of ['mastery_state', 'attempts', 'skill_error_signatures', 'skill_verifications', 'daily_plan_items', 'study_streaks']) {
    const exists = await check(t);
    console.log(`${exists ? '✅' : '❌'} ${t}`);
  }
}

main().catch(e => console.error(e.message));
