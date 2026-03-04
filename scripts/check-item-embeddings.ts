import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();
const sql = neon(process.env.DATABASE_URL!);
async function main() {
  const r = await sql`SELECT COUNT(*)::int as c FROM items WHERE embedding IS NOT NULL`;
  const t = await sql`SELECT COUNT(*)::int as c FROM items`;
  console.log(`Items with embeddings: ${r[0].c} / ${t[0].c}`);
}
main().catch(e => console.error(e.message));
