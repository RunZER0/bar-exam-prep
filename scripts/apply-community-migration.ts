/**
 * Community System Migration
 * Creates all community tables: rooms, members, messages, requests,
 * events, participants, friends, achievements, rankings, suggestions, profiles
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = dbMatch?.[1] || '';
const sql = neon(DATABASE_URL);

async function migrate() {
  console.log('=== Community System Migration ===\n');

  // 1. Create enums
  console.log('Creating enums...');
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_status') THEN CREATE TYPE room_status AS ENUM ('active', 'archived', 'pending'); END IF; END $$`;
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_type') THEN CREATE TYPE room_type AS ENUM ('official', 'custom'); END IF; END $$`;
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_role') THEN CREATE TYPE member_role AS ENUM ('owner', 'moderator', 'member'); END IF; END $$`;
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'challenge_status') THEN CREATE TYPE challenge_status AS ENUM ('upcoming', 'active', 'completed'); END IF; END $$`;
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'challenge_type') THEN CREATE TYPE challenge_type AS ENUM ('trivia', 'reading', 'quiz_marathon', 'drafting', 'research'); END IF; END $$`;
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'friend_status') THEN CREATE TYPE friend_status AS ENUM ('pending', 'accepted', 'blocked'); END IF; END $$`;
  console.log('  Enums created.\n');

  // 2. Add community columns to users
  console.log('Adding community columns to users...');
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS community_username TEXT UNIQUE`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS community_bio TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS community_joined_at TIMESTAMPTZ`;
  console.log('  Done.\n');

  // 3. Study Rooms
  console.log('Creating study_rooms...');
  await sql`
    CREATE TABLE IF NOT EXISTS study_rooms (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      unit_id TEXT,
      room_type room_type NOT NULL DEFAULT 'custom',
      status room_status NOT NULL DEFAULT 'active',
      cover_image TEXT,
      created_by_id UUID REFERENCES users(id),
      max_members INTEGER DEFAULT 100,
      is_public BOOLEAN NOT NULL DEFAULT true,
      tags JSONB,
      member_count INTEGER NOT NULL DEFAULT 0,
      message_count INTEGER NOT NULL DEFAULT 0,
      last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 4. Room Members
  console.log('Creating room_members...');
  await sql`
    CREATE TABLE IF NOT EXISTS room_members (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      room_id UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      role member_role NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_read_at TIMESTAMPTZ DEFAULT NOW(),
      is_muted BOOLEAN NOT NULL DEFAULT false,
      UNIQUE(room_id, user_id)
    )
  `;

  // 5. Room Messages
  console.log('Creating room_messages...');
  await sql`
    CREATE TABLE IF NOT EXISTS room_messages (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      room_id UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id),
      is_agent BOOLEAN NOT NULL DEFAULT false,
      content TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'text',
      parent_id UUID,
      attachments JSONB,
      reactions JSONB,
      is_pinned BOOLEAN NOT NULL DEFAULT false,
      is_edited BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      edited_at TIMESTAMPTZ
    )
  `;

  // 6. Room Requests (for admin approval of custom rooms) 
  console.log('Creating room_requests...');
  await sql`
    CREATE TABLE IF NOT EXISTS room_requests (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      requested_by UUID NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      description TEXT,
      visibility TEXT NOT NULL DEFAULT 'public',
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ
    )
  `;

  // 7. Community Events
  console.log('Creating community_events...');
  await sql`
    CREATE TABLE IF NOT EXISTS community_events (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      type challenge_type NOT NULL,
      status challenge_status NOT NULL DEFAULT 'upcoming',
      cover_image TEXT,
      unit_id TEXT,
      target_topics JSONB,
      rules TEXT,
      rewards JSONB,
      points_per_correct INTEGER NOT NULL DEFAULT 10,
      bonus_points INTEGER DEFAULT 0,
      max_participants INTEGER,
      participant_count INTEGER NOT NULL DEFAULT 0,
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      created_by_id UUID REFERENCES users(id),
      is_agent_created BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 8. Event Participants
  console.log('Creating event_participants...');
  await sql`
    CREATE TABLE IF NOT EXISTS event_participants (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      event_id UUID NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      score INTEGER NOT NULL DEFAULT 0,
      questions_answered INTEGER NOT NULL DEFAULT 0,
      correct_answers INTEGER NOT NULL DEFAULT 0,
      time_spent INTEGER NOT NULL DEFAULT 0,
      rank INTEGER,
      completed_at TIMESTAMPTZ,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(event_id, user_id)
    )
  `;

  // 9. User Friends
  console.log('Creating user_friends...');
  await sql`
    CREATE TABLE IF NOT EXISTS user_friends (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id),
      friend_id UUID NOT NULL REFERENCES users(id),
      status friend_status NOT NULL DEFAULT 'pending',
      match_score INTEGER DEFAULT 0,
      shared_interests JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      accepted_at TIMESTAMPTZ,
      UNIQUE(user_id, friend_id)
    )
  `;

  // 10. User Achievements
  console.log('Creating user_achievements...');
  await sql`
    CREATE TABLE IF NOT EXISTS user_achievements (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id),
      achievement_type TEXT NOT NULL,
      achievement_id TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      metadata JSONB,
      earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 11. Weekly Rankings
  console.log('Creating weekly_rankings...');
  await sql`
    CREATE TABLE IF NOT EXISTS weekly_rankings (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id),
      week_start DATE NOT NULL,
      week_end DATE NOT NULL,
      total_points INTEGER NOT NULL DEFAULT 0,
      rank INTEGER,
      quizzes_completed INTEGER NOT NULL DEFAULT 0,
      challenges_won INTEGER NOT NULL DEFAULT 0,
      study_minutes INTEGER NOT NULL DEFAULT 0,
      bonus_earned INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, week_start)
    )
  `;

  // 12. Friend Suggestions
  console.log('Creating friend_suggestions...');
  await sql`
    CREATE TABLE IF NOT EXISTS friend_suggestions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id),
      suggested_user_id UUID NOT NULL REFERENCES users(id),
      match_score INTEGER NOT NULL DEFAULT 0,
      reasons JSONB,
      dismissed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, suggested_user_id)
    )
  `;

  // 13. Create indexes
  console.log('\nCreating indexes...');
  await sql`CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_room_messages_room ON room_messages(room_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_room_messages_created ON room_messages(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_community_events_status ON community_events(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_friends_user ON user_friends(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_friends_friend ON user_friends(friend_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_weekly_rankings_week ON weekly_rankings(week_start, rank)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_friend_suggestions_user ON friend_suggestions(user_id, dismissed)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_room_requests_status ON room_requests(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_community_username ON users(community_username)`;

  // 14. Seed official unit rooms
  console.log('\nSeeding official unit rooms...');
  const units = [
    { id: 'atp-100', code: 'ATP 100', name: 'Civil Litigation' },
    { id: 'atp-101', code: 'ATP 101', name: 'Criminal Litigation' },
    { id: 'atp-102', code: 'ATP 102', name: 'Probate and Administration' },
    { id: 'atp-103', code: 'ATP 103', name: 'Legal Writing and Drafting' },
    { id: 'atp-104', code: 'ATP 104', name: 'Trial Advocacy' },
    { id: 'atp-105', code: 'ATP 105', name: 'Professional Ethics' },
    { id: 'atp-106', code: 'ATP 106', name: 'Legal Practice Management' },
    { id: 'atp-107', code: 'ATP 107', name: 'Conveyancing' },
    { id: 'atp-108', code: 'ATP 108', name: 'Commercial Transactions' },
  ];

  for (const unit of units) {
    await sql`
      INSERT INTO study_rooms (name, description, unit_id, room_type, status, is_public, max_members)
      VALUES (
        ${unit.name},
        ${'Official study group for ' + unit.code + ' - ' + unit.name + '. Discuss topics, share resources, and collaborate with fellow candidates.'},
        ${unit.id},
        'official',
        'active',
        true,
        5000
      )
      ON CONFLICT DO NOTHING
    `;
  }

  // Also create a "General" room
  await sql`
    INSERT INTO study_rooms (name, description, unit_id, room_type, status, is_public, max_members)
    VALUES (
      'General Discussion',
      'Open discussion room for all Bar Exam candidates. Share tips, ask questions, and support each other.',
      NULL,
      'official',
      'active',
      true,
      10000
    )
    ON CONFLICT DO NOTHING
  `;

  console.log('  Seeded 10 official rooms.\n');

  console.log('=== Migration Complete ===');
}

migrate().catch(console.error);
