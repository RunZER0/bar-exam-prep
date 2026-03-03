// Force apply schema changes for Senior Partner Protocol
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
    console.log('Applying manual migration...');

    // 1. Create witnesses table
    await dbClient.execute(sql`
      CREATE TABLE IF NOT EXISTS "witnesses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "unit_id" text NOT NULL,
        "topic_id" text NOT NULL,
        "title" text NOT NULL,
        "severity_weight" numeric(3, 1) DEFAULT '1.0' NOT NULL,
        "status" text DEFAULT 'ACTIVE' NOT NULL,
        "identified_at" timestamp DEFAULT now() NOT NULL,
        "resolved_at" timestamp,
        "notes" text
      );
    `);
    console.log('Checked/Created witnesses table.');

    // 2. Add foreign key if not exists (try/catch block in SQL if possible, or just ignore error)
    try {
        await dbClient.execute(sql`
            ALTER TABLE "witnesses" ADD CONSTRAINT "witnesses_user_id_users_id_fk" 
            FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
        `);
        console.log('Added FK to witnesses.');
    } catch (e: any) {
        if (e.code === '42710') { // duplicate_object
             console.log('FK witnesses_user_id_users_id_fk already exists.');
        } else {
             console.log('Warning adding FK:', e.message);
        }
    }

    // 3. Add columns to user_profiles
    const columns = ['exam_path', 'llb_origin', 'professional_exposure', 'failure_analysis'];
    for (const col of columns) {
        try {
            await dbClient.execute(sql`
                ALTER TABLE "user_profiles" ADD COLUMN "${sql.raw(col)}" text;
            `);
            console.log(`Added column ${col} to user_profiles.`);
        } catch (e: any) {
             if (e.code === '42701') { // duplicate_column
                 console.log(`Column ${col} already exists in user_profiles.`);
             } else {
                 console.error(`Error adding column ${col}:`, e.message);
             }
        }
    }

    console.log('Manual migration completed successfully.');

  } catch (error) {
    console.error('Migration failed:', error);
  }
}

main().catch(console.error);