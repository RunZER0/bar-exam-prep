import { pgTable, text, timestamp, uuid, boolean, integer, jsonb, pgEnum, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['student', 'admin']);
export const competencyTypeEnum = pgEnum('competency_type', ['drafting', 'research', 'oral', 'banter', 'clarification']);
export const difficultyLevelEnum = pgEnum('difficulty_level', ['beginner', 'intermediate', 'advanced']);
export const questionTypeEnum = pgEnum('question_type', ['multiple_choice', 'essay', 'case_analysis', 'practical']);
export const themeEnum = pgEnum('theme', ['light', 'dark', 'system']);
export const studyPaceEnum = pgEnum('study_pace', ['relaxed', 'moderate', 'intensive']);

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  firebaseUid: text('firebase_uid').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  photoURL: text('photo_url'),
  role: userRoleEnum('role').default('student').notNull(),
  theme: themeEnum('theme').default('system').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User profile for adaptive learning
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(),
  currentOccupation: text('current_occupation'), // law student, paralegal, etc.
  yearsOfStudy: integer('years_of_study'),
  targetExamDate: date('target_exam_date'),
  studyPace: studyPaceEnum('study_pace').default('moderate'),
  weakAreas: jsonb('weak_areas').$type<string[]>(), // ATP units they struggle with
  strongAreas: jsonb('strong_areas').$type<string[]>(),
  preferredStudyTime: text('preferred_study_time'), // morning, afternoon, evening
  dailyStudyGoal: integer('daily_study_goal').default(60), // minutes
  weeklyQuizGoal: integer('weekly_quiz_goal').default(3),
  learningStyle: text('learning_style'), // visual, reading, practice
  goals: jsonb('goals').$type<string[]>(), // pass bar, improve drafting, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Study streaks
export const studyStreaks = pgTable('study_streaks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  date: date('date').notNull(),
  minutesStudied: integer('minutes_studied').default(0).notNull(),
  questionsAnswered: integer('questions_answered').default(0).notNull(),
  sessionsCompleted: integer('sessions_completed').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Chat sessions for persistent conversations
export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  competencyType: competencyTypeEnum('competency_type').notNull(),
  context: text('context'), // document type, unit, etc.
  isArchived: boolean('is_archived').default(false).notNull(),
  lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Chat messages within sessions
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').references(() => chatSessions.id).notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  attachments: jsonb('attachments').$type<{ type: string; url: string; name: string }[]>(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Clarification requests with uploads
export const clarificationRequests = pgTable('clarification_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  sessionId: uuid('session_id').references(() => chatSessions.id),
  content: text('content'),
  attachmentType: text('attachment_type'), // 'image', 'audio', 'document'
  attachmentUrl: text('attachment_url'),
  attachmentName: text('attachment_name'),
  transcription: text('transcription'), // for audio
  aiResponse: text('ai_response'),
  isResolved: boolean('is_resolved').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles),
  streaks: many(studyStreaks),
  chatSessions: many(chatSessions),
  clarifications: many(clarificationRequests),
  progress: many(userProgress),
  responses: many(userResponses),
  sessions: many(practiceSessions),
  chatHistory: many(chatHistory),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

export const studyStreaksRelations = relations(studyStreaks, ({ one }) => ({
  user: one(users, {
    fields: [studyStreaks.userId],
    references: [users.id],
  }),
}));

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
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
