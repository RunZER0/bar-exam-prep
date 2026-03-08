/**
 * Migration: Add subscription & payment columns
 *
 * Run: npx tsx scripts/apply-subscription-migration.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    console.log('Starting subscription migration...\n');

    // 1. Create enums (safe — IF NOT EXISTS)
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE subscription_plan AS ENUM ('free_trial', 'weekly', 'monthly', 'annual');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log('✓ subscription_plan enum');

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'expired');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log('✓ subscription_status enum');

    // 2. Add columns to users table
    const columns = [
      { name: 'subscription_plan', sql: "subscription_plan NOT NULL DEFAULT 'free_trial'" },
      { name: 'subscription_status', sql: "subscription_status NOT NULL DEFAULT 'trialing'" },
      { name: 'trial_ends_at', sql: 'TIMESTAMPTZ' },
      { name: 'subscription_ends_at', sql: 'TIMESTAMPTZ' },
      { name: 'paystack_customer_id', sql: 'TEXT' },
      { name: 'paystack_subscription_code', sql: 'TEXT' },
      { name: 'trial_drafting_used', sql: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'trial_oral_devil_used', sql: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'trial_oral_exam_used', sql: 'INTEGER NOT NULL DEFAULT 0' },
    ];

    for (const col of columns) {
      try {
        await client.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.sql}`);
        console.log(`✓ Added users.${col.name}`);
      } catch (e: any) {
        if (e.code === '42701') {
          console.log(`  (exists) users.${col.name}`);
        } else {
          throw e;
        }
      }
    }

    // 3. Set trial_ends_at for existing users who don't have it yet
    const result = await client.query(`
      UPDATE users
      SET trial_ends_at = created_at + INTERVAL '3 days'
      WHERE trial_ends_at IS NULL
    `);
    console.log(`✓ Set trial_ends_at for ${result.rowCount} existing users`);

    // 4. Create payment_transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        paystack_reference TEXT NOT NULL UNIQUE,
        paystack_transaction_id TEXT,
        plan subscription_plan NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'KES',
        status TEXT NOT NULL DEFAULT 'pending',
        channel TEXT,
        paid_at TIMESTAMPTZ,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✓ payment_transactions table');

    // 5. Create index on user_id
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_txn_user ON payment_transactions(user_id)
    `);
    console.log('✓ idx_payment_txn_user index');

    console.log('\n✅ Subscription migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
