import { pgTable, text, timestamp, uuid, boolean, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['student', 'admin']);
export const competencyTypeEnum = pgEnum('competency_type', ['drafting', 'research', 'oral']);
export const difficultyLevelEnum = pgEnum('difficulty_level', ['beginner', 'intermediate', 'advanced']);
export const questionTypeEnum = pgEnum('question_type', ['multiple_choice', 'essay', 'case_analysis', 'practical']);

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  firebaseUid: text('firebase_uid').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  photoURL: text('photo_url'),
  role: userRoleEnum('role').default('student').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Study topics based on Kenyan ATP
export const topics = pgTable('topics', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  competencyType: competencyTypeEnum('competency_type').notNull(),
  category: text('category').notNull(), // e.g., "Constitutional Law", "Criminal Law", etc.
  order: integer('order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Questions bank
export const questions = pgTable('questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  topicId: uuid('topic_id').references(() => topics.id).notNull(),
  questionType: questionTypeEnum('question_type').notNull(),
  difficulty: difficultyLevelEnum('difficulty').notNull(),
  question: text('question').notNull(),
  context: text('context'), // Additional context for case-based questions
  options: jsonb('options'), // For multiple choice questions
  correctAnswer: text('correct_answer'),
  explanation: text('explanation'),
  rubric: jsonb('rubric'), // Scoring rubric for essays
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User progress tracking
export const userProgress = pgTable('user_progress', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  topicId: uuid('topic_id').references(() => topics.id).notNull(),
  completionPercentage: integer('completion_percentage').default(0).notNull(),
  questionsAttempted: integer('questions_attempted').default(0).notNull(),
  questionsCorrect: integer('questions_correct').default(0).notNull(),
  lastAccessedAt: timestamp('last_accessed_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User responses/submissions
export const userResponses = pgTable('user_responses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  questionId: uuid('question_id').references(() => questions.id).notNull(),
  userAnswer: text('user_answer').notNull(),
  isCorrect: boolean('is_correct'),
  score: integer('score'), // For essay-type questions
  aiFeedback: text('ai_feedback'),
  timeSpent: integer('time_spent'), // in seconds
  attemptNumber: integer('attempt_number').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Practice sessions
export const practiceSessions = pgTable('practice_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  topicId: uuid('topic_id').references(() => topics.id),
  competencyType: competencyTypeEnum('competency_type').notNull(),
  totalQuestions: integer('total_questions').notNull(),
  completedQuestions: integer('completed_questions').default(0).notNull(),
  score: integer('score').default(0),
  isCompleted: boolean('is_completed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// AI chat history for research/drafting assistance
export const chatHistory = pgTable('chat_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  sessionId: uuid('session_id').notNull(),
  competencyType: competencyTypeEnum('competency_type').notNull(),
  message: text('message').notNull(),
  response: text('response').notNull(),
  wasFiltered: boolean('was_filtered').default(false).notNull(), // Guardrail triggered
  metadata: jsonb('metadata'), // Store context, sources, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Admin content management
export const contentUpdates = pgTable('content_updates', {
  id: uuid('id').defaultRandom().primaryKey(),
  adminId: uuid('admin_id').references(() => users.id).notNull(),
  entityType: text('entity_type').notNull(), // 'topic', 'question', etc.
  entityId: uuid('entity_id').notNull(),
  action: text('action').notNull(), // 'create', 'update', 'delete'
  changes: jsonb('changes'),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  progress: many(userProgress),
  responses: many(userResponses),
  sessions: many(practiceSessions),
  chatHistory: many(chatHistory),
}));

export const topicsRelations = relations(topics, ({ many }) => ({
  questions: many(questions),
  progress: many(userProgress),
  sessions: many(practiceSessions),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  topic: one(topics, {
    fields: [questions.topicId],
    references: [topics.id],
  }),
  responses: many(userResponses),
}));

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  user: one(users, {
    fields: [userProgress.userId],
    references: [users.id],
  }),
  topic: one(topics, {
    fields: [userProgress.topicId],
    references: [topics.id],
  }),
}));
