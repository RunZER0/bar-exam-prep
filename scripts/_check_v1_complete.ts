import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function check() {
  const countResult = await sql`SELECT COUNT(*) as total FROM prebuilt_notes WHERE version_number = 1 AND is_active = true`;
  console.log('Total v1 notes:', countResult[0].total);

  const missing = await sql`
    SELECT sn.*
    FROM syllabus_nodes sn
    LEFT JOIN prebuilt_notes pn ON pn.node_id = sn.id AND pn.version_number = 1 AND pn.is_active = true
    WHERE pn.id IS NULL
    ORDER BY sn.id
  `;
  console.log('Missing v1 notes:', missing.length);
  if (missing.length > 0) {
    missing.forEach((m: any) => console.log('  -', JSON.stringify(m)));
  }

  const totalNodes = await sql`SELECT COUNT(*) as total FROM syllabus_nodes`;
  console.log('Total syllabus nodes:', totalNodes[0].total);
}

check().catch(e => console.error(e));
