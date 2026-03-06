/**
 * Migration: Community Threads (Reddit-style posts)
 * + Case of the Day table
 */
import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';

const sql = neon(DATABASE_URL);

async function main() {
  console.log('=== Community Threads + Case of the Day Migration ===\n');

  // 1. Community Threads table
  console.log('1. Creating community_threads table...');
  await sql`
    CREATE TABLE IF NOT EXISTS community_threads (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      author_id UUID REFERENCES users(id) NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'general' NOT NULL,
      tags TEXT[] DEFAULT '{}',
      upvotes INT DEFAULT 0 NOT NULL,
      downvotes INT DEFAULT 0 NOT NULL,
      reply_count INT DEFAULT 0 NOT NULL,
      is_pinned BOOLEAN DEFAULT false NOT NULL,
      is_locked BOOLEAN DEFAULT false NOT NULL,
      is_agent_post BOOLEAN DEFAULT false NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `;
  console.log('   ✅ community_threads created');

  // 2. Thread replies table
  console.log('2. Creating thread_replies table...');
  await sql`
    CREATE TABLE IF NOT EXISTS thread_replies (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      thread_id UUID REFERENCES community_threads(id) ON DELETE CASCADE NOT NULL,
      author_id UUID REFERENCES users(id) NOT NULL,
      parent_reply_id UUID REFERENCES thread_replies(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      upvotes INT DEFAULT 0 NOT NULL,
      downvotes INT DEFAULT 0 NOT NULL,
      is_agent_reply BOOLEAN DEFAULT false NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `;
  console.log('   ✅ thread_replies created');

  // 3. Thread votes table (prevent double voting)
  console.log('3. Creating thread_votes table...');
  await sql`
    CREATE TABLE IF NOT EXISTS thread_votes (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES users(id) NOT NULL,
      thread_id UUID REFERENCES community_threads(id) ON DELETE CASCADE,
      reply_id UUID REFERENCES thread_replies(id) ON DELETE CASCADE,
      vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      CONSTRAINT unique_thread_vote UNIQUE (user_id, thread_id),
      CONSTRAINT unique_reply_vote UNIQUE (user_id, reply_id),
      CONSTRAINT vote_target_check CHECK (
        (thread_id IS NOT NULL AND reply_id IS NULL) OR
        (thread_id IS NULL AND reply_id IS NOT NULL)
      )
    )
  `;
  console.log('   ✅ thread_votes created');

  // 4. Case of the Day table
  console.log('4. Creating case_of_the_day table...');
  await sql`
    CREATE TABLE IF NOT EXISTS case_of_the_day (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      date DATE UNIQUE NOT NULL,
      case_name TEXT NOT NULL,
      citation TEXT NOT NULL,
      court TEXT NOT NULL,
      year INT NOT NULL,
      unit_id TEXT NOT NULL,
      facts TEXT NOT NULL,
      issue TEXT NOT NULL,
      holding TEXT NOT NULL,
      ratio TEXT NOT NULL,
      significance TEXT NOT NULL,
      full_text TEXT,
      source_url TEXT,
      summary TEXT,
      keywords TEXT[] DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `;
  console.log('   ✅ case_of_the_day created');

  // 5. Indexes
  console.log('5. Creating indexes...');
  await sql`CREATE INDEX IF NOT EXISTS idx_threads_created ON community_threads(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_threads_category ON community_threads(category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_threads_author ON community_threads(author_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_replies_thread ON thread_replies(thread_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_replies_parent ON thread_replies(parent_reply_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_votes_user ON thread_votes(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cotd_date ON case_of_the_day(date DESC)`;
  console.log('   ✅ All indexes created');

  // 6. Seed today's Case of the Day from kenyan-law-base
  console.log('6. Seeding Case of the Day...');
  const today = new Date().toISOString().split('T')[0];
  const existing = await sql`SELECT id FROM case_of_the_day WHERE date = ${today}`;
  if (existing.length === 0) {
    await sql`
      INSERT INTO case_of_the_day (date, case_name, citation, court, year, unit_id, facts, issue, holding, ratio, significance, summary, keywords)
      VALUES (
        ${today},
        'Anarita Karimi Njeru v Republic',
        '[1979] KLR 154',
        'High Court of Kenya',
        1979,
        'atp-100',
        'The applicant filed a constitutional reference challenging her conviction, but failed to identify specific constitutional provisions allegedly violated.',
        'What standard of pleading is required when raising constitutional questions?',
        'The Court held that a person seeking constitutional redress must set out with reasonable precision the specific rights claimed to have been violated and the manner of violation.',
        'Constitutional references must identify with precision: (1) the specific provisions of the Constitution allegedly contravened; (2) the manner in which they are alleged to have been contravened; and (3) the nature of relief sought. Vague or general allegations of constitutional breach are insufficient.',
        'Established the "Anarita Karimi test" — the foundational standard for constitutional pleading in Kenya, cited in virtually every constitutional petition since 1979.',
        'A petitioner must plead with reasonable precision which constitutional rights were violated and how. Vague claims of constitutional breach will be struck out. This case set the gold standard for constitutional petition pleading in Kenya.',
        ARRAY['constitutional petition', 'pleading standard', 'Anarita Karimi test', 'precision', 'fundamental rights']
      )
    `;
    console.log('   ✅ Seeded case: Anarita Karimi Njeru v Republic');
  } else {
    console.log('   ⏭️  Today already has a case seeded');
  }

  // 7. Seed sample community agent challenges if none exist
  console.log('7. Checking community events...');
  const eventCount = await sql`SELECT COUNT(*) as cnt FROM community_events`;
  if (parseInt(eventCount[0].cnt) === 0) {
    console.log('   Seeding weekly challenges...');
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    
    await sql`
      INSERT INTO community_events (title, description, type, status, starts_at, ends_at, rewards, max_participants)
      VALUES 
        ('Weekly Quiz Marathon', 'Complete as many quizzes as possible this week. Top 3 scorers win bragging rights and badges!', 'quiz_marathon', 'active', ${now.toISOString()}, ${endOfWeek.toISOString()}, ${JSON.stringify([{position: 1, reward: '🏆 Quiz Champion'}, {position: 2, reward: '🥈 Runner Up'}, {position: 3, reward: '🥉 Bronze Achiever'}])}, 100),
        ('Case Law Deep Dive', 'Read and analyze 5 landmark cases this week. Share your insights in the community threads!', 'reading', 'active', ${now.toISOString()}, ${endOfWeek.toISOString()}, ${JSON.stringify([{position: 1, reward: '📚 Legal Scholar'}, {position: 2, reward: '📖 Case Analyst'}])}, 50),
        ('Daily Drafting Challenge', 'Draft one legal document each day. Quality over quantity — AI will evaluate your work.', 'drafting', 'active', ${now.toISOString()}, ${endOfWeek.toISOString()}, ${JSON.stringify([{position: 1, reward: '✍️ Master Drafter'}, {position: 2, reward: '📝 Senior Drafter'}])}, 50)
    `;
    console.log('   ✅ Seeded 3 active challenges');
  } else {
    console.log('   ⏭️  Events already exist');
  }

  console.log('\n=== Migration Complete ===');
}

main().catch(console.error);
