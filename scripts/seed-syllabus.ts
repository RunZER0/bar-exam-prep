// @ts-ignore - path alias not available in scripts context
import { db } from '../lib/db';
// @ts-ignore - path alias not available in scripts context
import { syllabusNodes } from '../lib/db/schema';
import { sql } from 'drizzle-orm';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as dotenv from 'dotenv';
dotenv.config();

const SYLLABUS_DATA = [
  // ATP 100: Civil Litigation
  { unit: 'ATP100', week: 1, topic: 'Introduction to Civil Litigation', subtopic: 'Nature and Scope', drafting: false },
  { unit: 'ATP100', week: 2, topic: 'Parties to Suits', subtopic: 'Joinder and Misjoinder', drafting: false },
  { unit: 'ATP100', week: 4, topic: 'Courts and Jurisdiction', subtopic: 'Hierarchy of Courts', drafting: false, highYield: true },
  { unit: 'ATP100', week: 5, topic: 'Pleadings', subtopic: 'Plaint Drafting', drafting: true, highYield: true },
  { unit: 'ATP100', week: 6, topic: 'Pleadings', subtopic: 'Defence and Counterclaim', drafting: true },
  { unit: 'ATP100', week: 10, topic: 'Commencement of Suits', subtopic: 'Service of Process', drafting: true, highYield: true }, // The example
  
  // ATP 101: Criminal Litigation
  { unit: 'ATP101', week: 1, topic: 'Introduction to Criminal Litigation', subtopic: 'Constitutional Foundations', drafting: false },
  { unit: 'ATP101', week: 4, topic: 'Arrest and Search', subtopic: 'Rights of Arrested Persons', drafting: false },
  { unit: 'ATP101', week: 5, topic: 'Charges', subtopic: 'Drafting Charge Sheets', drafting: true, highYield: true }, // Week 5 for Feb 25th alignment
  
  // ATP 102: Probate
  { unit: 'ATP102', week: 1, topic: 'Introduction to Succession', subtopic: 'Types of Succession', drafting: false },
  { unit: 'ATP102', week: 5, topic: 'Wills', subtopic: 'Drafting Valid Wills', drafting: true },

  // ATP 103: Legal Writing
  { unit: 'ATP103', week: 1, topic: 'Principles of Drafting', subtopic: 'Plain English', drafting: true },
  { unit: 'ATP103', week: 5, topic: 'Legislative Drafting', subtopic: 'Structure of Bills', drafting: true },

  // ATP 104: Trial Advocacy
  { unit: 'ATP104', week: 1, topic: 'Case Analysis', subtopic: 'Theory of the Case', drafting: false },
  { unit: 'ATP104', week: 5, topic: 'Examination in Chief', subtopic: 'Witness Handling', drafting: false, highYield: true },

  // ATP 105: Ethics
  { unit: 'ATP105', week: 1, topic: 'Introduction to Ethics', subtopic: 'History of the Bar', drafting: false },
  { unit: 'ATP105', week: 4, topic: 'Advocate-Client Relations', subtopic: 'Professional Undertakings', drafting: false, highYield: true },
  { unit: 'ATP105', week: 5, topic: 'Conflict of Interest', subtopic: 'Duty to Court', drafting: false },

  // ATP 106: Legal Practice Management
  { unit: 'ATP106', week: 1, topic: 'Law Firm Management', subtopic: 'Business Structures', drafting: false },
  { unit: 'ATP106', week: 5, topic: 'Accounts', subtopic: 'Advocates Accounts Rules', drafting: false },

  // ATP 107: Conveyancing
  { unit: 'ATP107', week: 1, topic: 'Land Law Principles', subtopic: 'Doctrines of Tenure', drafting: false },
  { unit: 'ATP107', week: 5, topic: 'Sale of Land', subtopic: 'Drafting Sale Agreements', drafting: true, highYield: true },

  // ATP 108: Commercial Transactions
  { unit: 'ATP108', week: 1, topic: 'Sale of Goods', subtopic: 'Terms of Contract', drafting: false },
  { unit: 'ATP108', week: 5, topic: 'Agency', subtopic: 'Creation of Agency', drafting: false },
];

async function seedSyllabus() {
  console.log('🌱 Seeding Global Syllabus Map...');
  
  try {
    // 1. Create table if not exists (for dev speed, usually done via migration)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS syllabus_nodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_code TEXT NOT NULL,
        week_number INTEGER NOT NULL,
        topic_name TEXT NOT NULL,
        subtopic_name TEXT,
        is_drafting_node BOOLEAN DEFAULT false NOT NULL,
        is_high_yield BOOLEAN DEFAULT false NOT NULL,
        learning_outcome TEXT,
        section_reference TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    // 2. Clear existing
    await db.delete(syllabusNodes);
    
    // 3. Insert specific nodes
    for (const node of SYLLABUS_DATA) {
      await db.insert(syllabusNodes).values({
        unitCode: node.unit,
        weekNumber: node.week,
        topicName: node.topic,
        subtopicName: node.subtopic,
        isDraftingNode: node.drafting,
        isHighYield: node.highYield || false,
        learningOutcome: `Understand ${node.subtopic} in the context of ${node.topic}`,
      });
    }

    // 4. Verify specific Requirement: ATP 101, Week 10
    await db.insert(syllabusNodes).values({
        unitCode: 'ATP101', 
        weekNumber: 10,
        topicName: 'Commencement of Suits',
        subtopicName: 'Service of Process',
        isDraftingNode: true,
        isHighYield: true,
        learningOutcome: 'Understand service of process in the context of Commencement of Suits'
    });
    
  } catch (error) {
    console.error('❌ Failed to seed syllabus:', error);
  }
  process.exit(0);
}

seedSyllabus();
