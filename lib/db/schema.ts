import { pgTable, text, timestamp, uuid, boolean, integer, jsonb, pgEnum, date, numeric, real } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['student', 'admin']);
export const competencyTypeEnum = pgEnum('competency_type', ['drafting', 'research', 'oral', 'banter', 'clarification']);
export const difficultyLevelEnum = pgEnum('difficulty_level', ['beginner', 'intermediate', 'advanced']);
export const questionTypeEnum = pgEnum('question_type', ['multiple_choice', 'essay', 'case_analysis', 'practical']);
export const themeEnum = pgEnum('theme', ['light', 'dark', 'system']);
export const studyPaceEnum = pgEnum('study_pace', ['relaxed', 'moderate', 'intensive']);

// Tutor OS Enums
export const candidateTypeEnum = pgEnum('candidate_type', ['FIRST_TIME', 'RESIT']);
export const examEventTypeEnum = pgEnum('exam_event_type', ['WRITTEN', 'ORAL', 'REGISTRATION', 'RESULTS']);
export const sessionStatusEnum = pgEnum('session_status', ['QUEUED', 'PREPARING', 'READY', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED']);
export const sessionModalityEnum = pgEnum('session_modality', ['WRITTEN', 'ORAL', 'DRAFTING', 'REVIEW', 'MIXED']);
export const assetTypeEnum = pgEnum('asset_type', ['NOTES', 'CHECKPOINT', 'PRACTICE_SET', 'TIMED_PROMPT', 'RUBRIC', 'MODEL_ANSWER', 'REMEDIATION', 'ORAL_PROMPT', 'FOLLOW_UP']);
export const assetStatusEnum = pgEnum('asset_status', ['GENERATING', 'READY', 'FAILED']);
export const jobStatusEnum = pgEnum('job_status', ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']);

// M4: Authority & Notification Enums
export const sourceTierEnum = pgEnum('source_tier', ['A', 'B', 'C']);
export const sourceTypeEnum = pgEnum('source_type', ['CASE', 'STATUTE', 'REGULATION', 'ARTICLE', 'TEXTBOOK', 'OTHER']);
export const licenseTagEnum = pgEnum('license_tag', ['PUBLIC_LEGAL_TEXT', 'CC_BY_SA', 'RESTRICTED', 'UNKNOWN']);
export const notificationChannelEnum = pgEnum('notification_channel', ['EMAIL', 'PUSH', 'IN_APP']);
export const notificationStatusEnum = pgEnum('notification_status', ['PENDING', 'SENT', 'FAILED', 'BOUNCED']);
export const studyActivityTypeEnum = pgEnum('study_activity_type', [
  'READING_NOTES',
  'MEMORY_CHECK',
  'FLASHCARDS',
  'WRITTEN_QUIZ',
  'ISSUE_SPOTTER',
  'RULE_ELEMENTS_DRILL',
  'ESSAY_OUTLINE',
  'FULL_ESSAY',
  'PAST_PAPER_STYLE',
  'ERROR_CORRECTION',
  'MIXED_REVIEW'
]);

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
  // Notification preferences
  reminderEnabled: boolean('reminder_enabled').default(true),
  reminderTime: text('reminder_time').default('09:00'), // HH:MM format
  reminderTimezone: text('reminder_timezone').default('Africa/Nairobi'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User engagement signals - TikTok-style continuous learning
export const userEngagementSignals = pgTable('user_engagement_signals', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  // Session tracking
  sessionStartedAt: timestamp('session_started_at').notNull(),
  sessionEndedAt: timestamp('session_ended_at'),
  sessionDurationMinutes: integer('session_duration_minutes'),
  // Activity patterns
  activityType: text('activity_type').notNull(), // quiz, study, drafting, research, review, chat
  unitId: text('unit_id'),
  // Engagement metrics
  contentInteractionCount: integer('content_interaction_count').default(0), // clicks, scrolls, etc.
  completionRate: integer('completion_rate'), // 0-100% for activities
  focusTimePercent: integer('focus_time_percent'), // Time actively engaged vs idle
  // Behavioral signals
  timeOfDay: text('time_of_day').notNull(), // morning, afternoon, evening, night
  dayOfWeek: integer('day_of_week').notNull(), // 0-6 (Sunday-Saturday)
  // User signals (implicit)
  exitedEarly: boolean('exited_early').default(false),
  completedActivity: boolean('completed_activity').default(false),
  returnedWithin24h: boolean('returned_within_24h'),
  // Performance signals
  performanceScore: integer('performance_score'), // How well they did
  difficultyFelt: text('difficulty_felt'), // inferred from time/accuracy
  // Device & context
  deviceType: text('device_type'), // mobile, tablet, desktop
  // Mood signals (inferred)
  engagementLevel: text('engagement_level'), // low, medium, high (inferred from behavior)
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// User engagement patterns - aggregated insights
export const userEngagementPatterns = pgTable('user_engagement_patterns', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(),
  // Time patterns
  peakStudyHour: integer('peak_study_hour'), // 0-23
  peakStudyDay: integer('peak_study_day'), // 0-6
  averageSessionMinutes: integer('average_session_minutes'),
  preferredSessionLength: text('preferred_session_length'), // short, medium, long
  // Activity preferences (learned)
  preferredActivityWeights: jsonb('preferred_activity_weights').$type<Record<string, number>>(),
  // Unit affinity (learned)
  unitEngagementScores: jsonb('unit_engagement_scores').$type<Record<string, number>>(),
  // Learning patterns
  optimalDifficulty: text('optimal_difficulty'), // beginner, intermediate, advanced
  learningVelocity: text('learning_velocity'), // slow, moderate, fast
  retentionStrength: text('retention_strength'), // weak, moderate, strong
  // Engagement trends
  weeklyEngagementTrend: text('weekly_engagement_trend'), // increasing, stable, decreasing
  averageWeeklyMinutes: integer('average_weekly_minutes'),
  // Last computed
  lastComputedAt: timestamp('last_computed_at').defaultNow().notNull(),
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

// Quiz history for AI-generated quiz questions (no questionId needed)
// This is separate from userResponses which requires database questions
export const quizHistory = pgTable('quiz_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  // Quiz metadata
  quizMode: text('quiz_mode').notNull(), // adaptive, legendary, blitz, exam
  unitId: text('unit_id'), // atp100, atp200, etc. or 'all'
  unitName: text('unit_name'),
  // Question data (stored for review)
  questionText: text('question_text').notNull(),
  options: jsonb('options').$type<string[]>(),
  correctAnswer: text('correct_answer').notNull(),
  userAnswer: text('user_answer').notNull(),
  explanation: text('explanation'),
  // Results
  isCorrect: boolean('is_correct').notNull(),
  difficulty: text('difficulty'), // easy, medium, hard
  // Topic categorization for analytics
  topicCategory: text('topic_category'), // e.g., "Constitutional Law", "Evidence"
  // Session tracking
  sessionId: uuid('session_id'), // Group questions from same quiz session
  questionNumber: integer('question_number'), // Order within session
  timeSpent: integer('time_spent'), // Seconds to answer
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

// ============================================
// COMMUNITY SYSTEM
// ============================================

// Study room status enum
export const roomStatusEnum = pgEnum('room_status', ['active', 'archived', 'pending']);
export const roomTypeEnum = pgEnum('room_type', ['official', 'custom']);
export const memberRoleEnum = pgEnum('member_role', ['owner', 'moderator', 'member']);
export const challengeStatusEnum = pgEnum('challenge_status', ['upcoming', 'active', 'completed']);
export const challengeTypeEnum = pgEnum('challenge_type', ['trivia', 'reading', 'quiz_marathon', 'drafting', 'research']);
export const friendStatusEnum = pgEnum('friend_status', ['pending', 'accepted', 'blocked']);

// Study Rooms - both official (pre-created) and user-created
export const studyRooms = pgTable('study_rooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  unitId: text('unit_id'), // Links to ATP unit for official rooms
  roomType: roomTypeEnum('room_type').default('custom').notNull(),
  status: roomStatusEnum('status').default('active').notNull(),
  coverImage: text('cover_image'),
  createdById: uuid('created_by_id').references(() => users.id),
  maxMembers: integer('max_members').default(100),
  isPublic: boolean('is_public').default(true).notNull(),
  tags: jsonb('tags').$type<string[]>(),
  memberCount: integer('member_count').default(0).notNull(),
  messageCount: integer('message_count').default(0).notNull(),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Room membership
export const roomMembers = pgTable('room_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => studyRooms.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  role: memberRoleEnum('role').default('member').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  lastReadAt: timestamp('last_read_at').defaultNow(),
  isMuted: boolean('is_muted').default(false).notNull(),
});

// Room messages/discussions
export const roomMessages = pgTable('room_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => studyRooms.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  parentId: uuid('parent_id'), // For replies/threads
  attachments: jsonb('attachments').$type<{ type: string; url: string; name: string }[]>(),
  reactions: jsonb('reactions').$type<Record<string, string[]>>(), // emoji -> userIds
  isPinned: boolean('is_pinned').default(false).notNull(),
  isEdited: boolean('is_edited').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  editedAt: timestamp('edited_at'),
});

// Room join requests (for private rooms)
export const roomRequests = pgTable('room_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => studyRooms.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  message: text('message'),
  status: text('status').default('pending').notNull(), // pending, approved, rejected
  reviewedById: uuid('reviewed_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
});

// Community Events/Challenges
export const communityEvents = pgTable('community_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  type: challengeTypeEnum('type').notNull(),
  status: challengeStatusEnum('status').default('upcoming').notNull(),
  coverImage: text('cover_image'),
  unitId: text('unit_id'), // Optional - specific to a unit
  targetTopics: jsonb('target_topics').$type<string[]>(),
  rules: text('rules'),
  rewards: jsonb('rewards').$type<{ position: number; reward: string; value: number }[]>(),
  pointsPerCorrect: integer('points_per_correct').default(10).notNull(),
  bonusPoints: integer('bonus_points').default(0), // Bonus for completion
  maxParticipants: integer('max_participants'),
  participantCount: integer('participant_count').default(0).notNull(),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  createdById: uuid('created_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Event/Challenge participants
export const eventParticipants = pgTable('event_participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => communityEvents.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  score: integer('score').default(0).notNull(),
  questionsAnswered: integer('questions_answered').default(0).notNull(),
  correctAnswers: integer('correct_answers').default(0).notNull(),
  timeSpent: integer('time_spent').default(0).notNull(), // seconds
  rank: integer('rank'),
  completedAt: timestamp('completed_at'),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

// User friendships
export const userFriends = pgTable('user_friends', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  friendId: uuid('friend_id').references(() => users.id).notNull(),
  status: friendStatusEnum('status').default('pending').notNull(),
  matchScore: integer('match_score').default(0), // AI-calculated compatibility
  sharedInterests: jsonb('shared_interests').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at'),
});

// User achievements and points
export const userAchievements = pgTable('user_achievements', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  achievementType: text('achievement_type').notNull(),
  achievementId: text('achievement_id').notNull(),
  points: integer('points').default(0).notNull(),
  metadata: jsonb('metadata'),
  earnedAt: timestamp('earned_at').defaultNow().notNull(),
});

// Weekly rankings
export const weeklyRankings = pgTable('weekly_rankings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  weekStart: date('week_start').notNull(),
  weekEnd: date('week_end').notNull(),
  totalPoints: integer('total_points').default(0).notNull(),
  rank: integer('rank'),
  quizzesCompleted: integer('quizzes_completed').default(0).notNull(),
  challengesWon: integer('challenges_won').default(0).notNull(),
  studyMinutes: integer('study_minutes').default(0).notNull(),
  bonusEarned: integer('bonus_earned').default(0), // KES discount earned
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Preloaded content cache for instant loading
// Supports smart staleness detection - if user's progress changes significantly,
// preloaded content based on old data is discarded and regenerated
export const preloadedContent = pgTable('preloaded_content', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  contentType: text('content_type').notNull(), // 'quiz', 'exam', 'study'
  contextKey: text('context_key').notNull(), // e.g., 'exam_atp100_abcd_semi', 'quiz_civil'
  content: jsonb('content').notNull(),
  // Staleness tracking - hash of user progress data at generation time
  // If current progress hash differs, content is stale and should be regenerated
  dataVersionHash: text('data_version_hash'),
  // For exams: track type and paper size
  examType: text('exam_type'), // 'abcd' | 'cle'
  paperSize: text('paper_size'), // 'mini' | 'semi' | 'full'
  // Whether this preload is currently being generated (prevents duplicates)
  isGenerating: boolean('is_generating').default(false),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Friend suggestions based on AI analysis
export const friendSuggestions = pgTable('friend_suggestions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  suggestedUserId: uuid('suggested_user_id').references(() => users.id).notNull(),
  matchScore: integer('match_score').default(0).notNull(),
  reasons: jsonb('reasons').$type<string[]>(),
  dismissed: boolean('dismissed').default(false).notNull(),
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
  quizHistory: many(quizHistory),
}));

export const quizHistoryRelations = relations(quizHistory, ({ one }) => ({
  user: one(users, {
    fields: [quizHistory.userId],
    references: [users.id],
  }),
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

// Community Relations
export const studyRoomsRelations = relations(studyRooms, ({ one, many }) => ({
  creator: one(users, {
    fields: [studyRooms.createdById],
    references: [users.id],
  }),
  members: many(roomMembers),
  messages: many(roomMessages),
  requests: many(roomRequests),
}));

export const roomMembersRelations = relations(roomMembers, ({ one }) => ({
  room: one(studyRooms, {
    fields: [roomMembers.roomId],
    references: [studyRooms.id],
  }),
  user: one(users, {
    fields: [roomMembers.userId],
    references: [users.id],
  }),
}));

export const roomMessagesRelations = relations(roomMessages, ({ one }) => ({
  room: one(studyRooms, {
    fields: [roomMessages.roomId],
    references: [studyRooms.id],
  }),
  user: one(users, {
    fields: [roomMessages.userId],
    references: [users.id],
  }),
}));

export const communityEventsRelations = relations(communityEvents, ({ one, many }) => ({
  creator: one(users, {
    fields: [communityEvents.createdById],
    references: [users.id],
  }),
  participants: many(eventParticipants),
}));

export const eventParticipantsRelations = relations(eventParticipants, ({ one }) => ({
  event: one(communityEvents, {
    fields: [eventParticipants.eventId],
    references: [communityEvents.id],
  }),
  user: one(users, {
    fields: [eventParticipants.userId],
    references: [users.id],
  }),
}));

export const userFriendsRelations = relations(userFriends, ({ one }) => ({
  user: one(users, {
    fields: [userFriends.userId],
    references: [users.id],
  }),
  friend: one(users, {
    fields: [userFriends.friendId],
    references: [users.id],
  }),
}));

export const weeklyRankingsRelations = relations(weeklyRankings, ({ one }) => ({
  user: one(users, {
    fields: [weeklyRankings.userId],
    references: [users.id],
  }),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id],
  }),
}));

// ============================================
// AI TUTOR SYSTEM
// ============================================

// KSL Timeline tracking (exam dates, intake periods)
export const kslTimelines = pgTable('ksl_timelines', {
  id: uuid('id').defaultRandom().primaryKey(),
  intakeName: text('intake_name').notNull(), // e.g., "January 2025 Intake"
  registrationOpens: date('registration_opens').notNull(),
  registrationCloses: date('registration_closes').notNull(),
  examDate: date('exam_date').notNull(),
  examEndDate: date('exam_end_date'), // For multi-day exams
  resultsDate: date('results_date'),
  isActive: boolean('is_active').default(true).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Study plan status enum
export const studyPlanStatusEnum = pgEnum('study_plan_status', ['active', 'paused', 'completed', 'abandoned']);
export const studyItemTypeEnum = pgEnum('study_item_type', ['reading', 'case_study', 'practice_questions', 'quiz', 'review', 'drafting', 'research']);
export const studyItemStatusEnum = pgEnum('study_item_status', ['pending', 'in_progress', 'completed', 'skipped']);

// AI-generated study plans
export const studyPlans = pgTable('study_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  targetExamDate: date('target_exam_date'),
  kslTimelineId: uuid('ksl_timeline_id').references(() => kslTimelines.id),
  status: studyPlanStatusEnum('status').default('active').notNull(),
  totalItems: integer('total_items').default(0).notNull(),
  completedItems: integer('completed_items').default(0).notNull(),
  currentWeek: integer('current_week').default(1).notNull(),
  totalWeeks: integer('total_weeks').default(12).notNull(),
  dailyMinutes: integer('daily_minutes').default(60).notNull(),
  focusAreas: jsonb('focus_areas').$type<string[]>(),
  aiGeneratedAt: timestamp('ai_generated_at').defaultNow().notNull(),
  lastUpdatedByAi: timestamp('last_updated_by_ai'),
  nextReviewDate: date('next_review_date'),
  metadata: jsonb('metadata'), // Store AI reasoning, adjustments made
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Individual items in a study plan (daily tasks)
export const studyPlanItems = pgTable('study_plan_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  studyPlanId: uuid('study_plan_id').references(() => studyPlans.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  scheduledDate: date('scheduled_date').notNull(),
  itemType: studyItemTypeEnum('item_type').notNull(),
  status: studyItemStatusEnum('status').default('pending').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  unitId: text('unit_id'), // ATP unit reference
  topicId: uuid('topic_id').references(() => topics.id),
  caseReference: text('case_reference'), // For case studies
  estimatedMinutes: integer('estimated_minutes').default(30).notNull(),
  actualMinutes: integer('actual_minutes'),
  priority: integer('priority').default(1).notNull(), // 1=high, 2=medium, 3=low
  isSpacedRepetition: boolean('is_spaced_repetition').default(false).notNull(),
  aiRationale: text('ai_rationale'), // Why AI scheduled this
  completedAt: timestamp('completed_at'),
  skippedAt: timestamp('skipped_at'),
  rescheduledFrom: date('rescheduled_from'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Spaced repetition cards (SM-2 algorithm)
export const spacedRepetitionCards = pgTable('spaced_repetition_cards', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  contentType: text('content_type').notNull(), // 'case', 'concept', 'provision', 'question'
  contentId: text('content_id').notNull(), // Reference to the content
  title: text('title').notNull(),
  content: text('content').notNull(), // The actual content to review
  unitId: text('unit_id'),
  // SM-2 algorithm fields
  easinessFactor: integer('easiness_factor').default(250).notNull(), // EF * 100 (2.5 default)
  interval: integer('interval').default(1).notNull(), // Days until next review
  repetitions: integer('repetitions').default(0).notNull(),
  nextReviewDate: date('next_review_date').notNull(),
  lastReviewDate: date('last_review_date'),
  lastQuality: integer('last_quality'), // 0-5 rating from last review
  totalReviews: integer('total_reviews').default(0).notNull(),
  correctReviews: integer('correct_reviews').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  metadata: jsonb('metadata'), // Store extra context
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Detailed onboarding responses for AI analysis
export const onboardingResponses = pgTable('onboarding_responses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(),
  // Basic info
  fullName: text('full_name'),
  currentOccupation: text('current_occupation'),
  yearsInLaw: integer('years_in_law'),
  // Experience and background
  hasAttemptedBar: boolean('has_attempted_bar').default(false),
  previousAttempts: integer('previous_attempts').default(0),
  lawSchool: text('law_school'),
  graduationYear: integer('graduation_year'),
  // Study preferences
  preferredStudyTime: text('preferred_study_time'), // morning, afternoon, evening, flexible
  dailyStudyHours: integer('daily_study_hours'),
  weekendStudyHours: integer('weekend_study_hours'),
  learningStyle: text('learning_style'), // visual, reading, practice, mixed
  // Self-assessment
  weakUnits: jsonb('weak_units').$type<string[]>(), // ATP units they struggle with
  strongUnits: jsonb('strong_units').$type<string[]>(),
  confidenceLevel: integer('confidence_level'), // 1-10
  biggestChallenge: text('biggest_challenge'),
  // Goals and timeline
  targetExamDate: date('target_exam_date'),
  selectedKslIntake: uuid('selected_ksl_intake').references(() => kslTimelines.id),
  primaryGoal: text('primary_goal'), // pass_bar, improve_drafting, career_change
  secondaryGoals: jsonb('secondary_goals').$type<string[]>(),
  // Commitment
  commitmentLevel: text('commitment_level'), // casual, moderate, intensive
  hasStudyGroup: boolean('has_study_group').default(false),
  wantsMentorship: boolean('wants_mentorship').default(false),
  // Raw AI analysis
  aiAnalysis: jsonb('ai_analysis'), // AI's interpretation of responses
  aiRecommendations: jsonb('ai_recommendations'), // Initial recommendations
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Admin settings for site-wide configuration
export const adminSettings = pgTable('admin_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
  description: text('description'),
  category: text('category').notNull(), // 'tutor', 'content', 'pricing', 'ai', 'general'
  updatedById: uuid('updated_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Curriculum management (ATP units and structure)
export const curriculumUnits = pgTable('curriculum_units', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(), // e.g., 'ATP1', 'ATP2'
  name: text('name').notNull(),
  description: text('description'),
  order: integer('order').notNull(),
  estimatedHours: integer('estimated_hours').default(40).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  color: text('color'), // For UI theming
  icon: text('icon'),
  syllabus: jsonb('syllabus').$type<{ topic: string; subtopics: string[] }[]>(),
  keyStatutes: jsonb('key_statutes').$type<string[]>(),
  keyCases: jsonb('key_cases').$type<{ name: string; citation: string; importance: string }[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Pre-generated study recommendations (system-guided mode)
export const studyRecommendations = pgTable('study_recommendations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  // Recommendation details
  activityType: text('activity_type').notNull(), // 'quiz', 'study', 'drafting', 'research', 'review', 'case_study', 'exam'
  unitId: text('unit_id'), // ATP unit
  unitName: text('unit_name'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  rationale: text('rationale').notNull(), // Why this was recommended
  // Priority and ordering
  priority: integer('priority').notNull(), // 1=highest, lower is more urgent
  urgencyScore: integer('urgency_score').notNull(), // 0-100 computed score
  // Contextual data
  estimatedMinutes: integer('estimated_minutes').default(30),
  difficulty: text('difficulty'), // beginner, intermediate, advanced
  targetHref: text('target_href').notNull(), // URL to navigate to
  // Algorithm metadata
  decisionFactors: jsonb('decision_factors').$type<{
    performanceWeight: number;
    recencyWeight: number;
    spacedRepWeight: number;
    weaknessWeight: number;
    examProximityWeight: number;
    streakWeight: number;
    activityBalanceWeight: number;
    timeOfDayWeight: number;
  }>(),
  inputSnapshot: jsonb('input_snapshot'), // User data at time of generation
  algorithmVersion: text('algorithm_version').default('v1').notNull(),
  // Lifecycle
  isActive: boolean('is_active').default(true).notNull(),
  wasActedOn: boolean('was_acted_on').default(false),
  actedOnAt: timestamp('acted_on_at'),
  dismissedAt: timestamp('dismissed_at'),
  expiresAt: timestamp('expires_at').notNull(),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
});

// Index for efficient queries
export const studyRecommendationsRelations = relations(studyRecommendations, ({ one }) => ({
  user: one(users, {
    fields: [studyRecommendations.userId],
    references: [users.id],
  }),
}));

// RAG knowledge base entries (for admin to manage)
export const ragKnowledgeEntries = pgTable('rag_knowledge_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  contentType: text('content_type').notNull(), // 'case_law', 'statute', 'concept', 'procedure'
  unitId: text('unit_id'),
  tags: jsonb('tags').$type<string[]>(),
  citation: text('citation'),
  sourceUrl: text('source_url'),
  importance: text('importance').default('medium'), // high, medium, low
  isVerified: boolean('is_verified').default(false).notNull(),
  verifiedById: uuid('verified_by_id').references(() => users.id),
  addedById: uuid('added_by_id').references(() => users.id),
  lastUsedAt: timestamp('last_used_at'),
  usageCount: integer('usage_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Tutor system relations
export const studyPlansRelations = relations(studyPlans, ({ one, many }) => ({
  user: one(users, {
    fields: [studyPlans.userId],
    references: [users.id],
  }),
  kslTimeline: one(kslTimelines, {
    fields: [studyPlans.kslTimelineId],
    references: [kslTimelines.id],
  }),
  items: many(studyPlanItems),
}));

export const studyPlanItemsRelations = relations(studyPlanItems, ({ one }) => ({
  studyPlan: one(studyPlans, {
    fields: [studyPlanItems.studyPlanId],
    references: [studyPlans.id],
  }),
  user: one(users, {
    fields: [studyPlanItems.userId],
    references: [users.id],
  }),
  topic: one(topics, {
    fields: [studyPlanItems.topicId],
    references: [topics.id],
  }),
}));

export const spacedRepetitionCardsRelations = relations(spacedRepetitionCards, ({ one }) => ({
  user: one(users, {
    fields: [spacedRepetitionCards.userId],
    references: [users.id],
  }),
}));

export const onboardingResponsesRelations = relations(onboardingResponses, ({ one }) => ({
  user: one(users, {
    fields: [onboardingResponses.userId],
    references: [users.id],
  }),
  kslTimeline: one(kslTimelines, {
    fields: [onboardingResponses.selectedKslIntake],
    references: [kslTimelines.id],
  }),
}));

export const curriculumUnitsRelations = relations(curriculumUnits, ({ many }) => ({
  topics: many(topics),
}));

export const ragKnowledgeEntriesRelations = relations(ragKnowledgeEntries, ({ one }) => ({
  verifier: one(users, {
    fields: [ragKnowledgeEntries.verifiedById],
    references: [users.id],
  }),
  addedBy: one(users, {
    fields: [ragKnowledgeEntries.addedById],
    references: [users.id],
  }),
}));

// User engagement relations
export const userEngagementSignalsRelations = relations(userEngagementSignals, ({ one }) => ({
  user: one(users, {
    fields: [userEngagementSignals.userId],
    references: [users.id],
  }),
}));

export const userEngagementPatternsRelations = relations(userEngagementPatterns, ({ one }) => ({
  user: one(users, {
    fields: [userEngagementPatterns.userId],
    references: [users.id],
  }),
}));

// ============================================
// TUTOR OS - EXAM TIMELINE SYSTEM
// ============================================

// Exam cycles (e.g., "ATP 2026 April Resit", "ATP 2026 First-time Track")
export const examCycles = pgTable('exam_cycles', {
  id: uuid('id').defaultRandom().primaryKey(),
  label: text('label').notNull(),
  candidateType: candidateTypeEnum('candidate_type').notNull(),
  year: integer('year').notNull(),
  timezone: text('timezone').notNull().default('Africa/Nairobi'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Exam events (written windows, oral windows, registration, results)
export const examEvents = pgTable('exam_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  cycleId: uuid('cycle_id').references(() => examCycles.id).notNull(),
  eventType: examEventTypeEnum('event_type').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  unitId: text('unit_id'),
  sourceAssetId: uuid('source_asset_id'),
  metaJson: jsonb('meta_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User exam profile (which cycle they're targeting)
export const userExamProfiles = pgTable('user_exam_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(),
  cycleId: uuid('cycle_id').references(() => examCycles.id).notNull(),
  timezone: text('timezone').notNull().default('Africa/Nairobi'),
  autopilotEnabled: boolean('autopilot_enabled').notNull().default(false),
  // For FIRST_TIME: if oral slot is known, use exact date; else use window start (July 1)
  oralSlotDate: date('oral_slot_date'),
  notificationPreferences: jsonb('notification_preferences').$type<{
    dailyPlan: boolean;
    sessionStart: boolean;
    breaks: boolean;
    weeklyReport: boolean;
  }>().default({ dailyPlan: true, sessionStart: true, breaks: true, weeklyReport: true }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// TUTOR OS - CURRICULUM KNOWLEDGE GRAPH
// ============================================

// Content assets (outline PDFs, lecture recordings, etc.)
export const contentAssets = pgTable('content_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetType: text('asset_type').notNull(),
  unitId: text('unit_id').notNull(),
  title: text('title').notNull(),
  fileUrl: text('file_url'),
  contentText: text('content_text'),
  fileSizeBytes: integer('file_size_bytes'),
  mimeType: text('mime_type'),
  parsedAt: timestamp('parsed_at'),
  parserVersion: text('parser_version'),
  metaJson: jsonb('meta_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Outline topics (hierarchical topic tree from KSL outlines)
export const outlineTopics = pgTable('outline_topics', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetId: uuid('asset_id').references(() => contentAssets.id),
  unitId: text('unit_id').notNull(),
  parentId: uuid('parent_id'),
  topicNumber: text('topic_number'),
  title: text('title').notNull(),
  description: text('description'),
  learningOutcomes: jsonb('learning_outcomes').$type<string[]>(),
  depthLevel: integer('depth_level').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  examWeight: numeric('exam_weight', { precision: 5, scale: 4 }).default('0.05'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Micro-skills (atomic skills derived from learning outcomes)
export const microSkills = pgTable('micro_skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  skillCode: text('skill_code').notNull().unique(),
  unitId: text('unit_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  formatTags: text('format_tags').array().notNull().default([]),
  examWeight: numeric('exam_weight', { precision: 5, scale: 4 }).default('0.01'),
  minPracticeReps: integer('min_practice_reps').notNull().default(3),
  minTimedProofs: integer('min_timed_proofs').notNull().default(1),
  minVerificationPasses: integer('min_verification_passes').notNull().default(2),
  prerequisiteSkills: text('prerequisite_skills').array(),
  metaJson: jsonb('meta_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Skill outline mapping
export const skillOutlineMap = pgTable('skill_outline_map', {
  id: uuid('id').defaultRandom().primaryKey(),
  skillId: uuid('skill_id').references(() => microSkills.id).notNull(),
  topicId: uuid('topic_id').references(() => outlineTopics.id).notNull(),
  coverageStrength: numeric('coverage_strength', { precision: 3, scale: 2 }).default('1.0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Vetted authorities (statutes, cases, practice notes - for grounding)
export const vettedAuthorities = pgTable('vetted_authorities', {
  id: uuid('id').defaultRandom().primaryKey(),
  authorityType: text('authority_type').notNull(),
  title: text('title').notNull(),
  citation: text('citation'),
  fullText: text('full_text'),
  summary: text('summary'),
  unitIds: text('unit_ids').array().notNull().default([]),
  skillIds: uuid('skill_ids').array(),
  importance: text('importance').default('medium'),
  isVerified: boolean('is_verified').notNull().default(false),
  verifiedById: uuid('verified_by_id').references(() => users.id),
  verifiedAt: timestamp('verified_at'),
  sourceUrl: text('source_url'),
  metaJson: jsonb('meta_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// TUTOR OS - STUDY SESSION ORCHESTRATOR
// ============================================

// Study sessions
export const studySessions = pgTable('study_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  planItemId: uuid('plan_item_id'),
  status: sessionStatusEnum('status').notNull().default('QUEUED'),
  targetSkillIds: jsonb('target_skill_ids').$type<string[]>().notNull().default([]),
  modality: sessionModalityEnum('modality').notNull().default('WRITTEN'),
  phaseWritten: text('phase_written'),
  phaseOral: text('phase_oral'),
  currentStep: integer('current_step').notNull().default(0),
  stepsJson: jsonb('steps_json').$type<string[]>().notNull().default(['notes', 'checkpoint', 'practice', 'grading', 'fix', 'summary']),
  estimatedMinutes: integer('estimated_minutes'),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  continuousMinutes: integer('continuous_minutes').default(0),
  lastBreakAt: timestamp('last_break_at'),
  performanceDrops: integer('performance_drops').default(0),
  finalScore: numeric('final_score', { precision: 5, scale: 4 }),
  errorTagsJson: jsonb('error_tags_json').$type<string[]>(),
  masteryUpdatesJson: jsonb('mastery_updates_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Study assets
export const studyAssets = pgTable('study_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').references(() => studySessions.id).notNull(),
  assetType: assetTypeEnum('asset_type').notNull(),
  contentJson: jsonb('content_json').notNull(),
  groundingRefsJson: jsonb('grounding_refs_json'),
  activityTypes: text('activity_types').array(), // M4: Activity types used in this asset
  status: assetStatusEnum('status').notNull().default('GENERATING'),
  generationStartedAt: timestamp('generation_started_at'),
  generationCompletedAt: timestamp('generation_completed_at'),
  generationError: text('generation_error'),
  stepOrder: integer('step_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Session events (for pacing engine + weekly reports)
export const sessionEvents = pgTable('session_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').references(() => studySessions.id).notNull(),
  eventType: text('event_type').notNull(),
  eventData: jsonb('event_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// TUTOR OS - BACKGROUND JOBS
// ============================================

export const backgroundJobs = pgTable('background_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobType: text('job_type').notNull(),
  userId: uuid('user_id').references(() => users.id),
  status: jobStatusEnum('status').notNull().default('PENDING'),
  priority: integer('priority').notNull().default(5),
  payloadJson: jsonb('payload_json').notNull(),
  resultJson: jsonb('result_json'),
  errorMessage: text('error_message'),
  attempts: integer('attempts').default(0),
  maxAttempts: integer('max_attempts').default(3),
  scheduledFor: timestamp('scheduled_for').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// TUTOR OS - WEEKLY REPORTS
// ============================================

export const weeklyReports = pgTable('weekly_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  weekStart: date('week_start').notNull(),
  weekEnd: date('week_end').notNull(),
  readinessScore: numeric('readiness_score', { precision: 5, scale: 4 }),
  writtenReadiness: numeric('written_readiness', { precision: 5, scale: 4 }),
  oralReadiness: numeric('oral_readiness', { precision: 5, scale: 4 }),
  readinessTrend: text('readiness_trend'),
  coverageCompleted: jsonb('coverage_completed'),
  coverageDebtRemaining: jsonb('coverage_debt_remaining'),
  strongestSkills: jsonb('strongest_skills'),
  weakestSkills: jsonb('weakest_skills'),
  skillsVerified: integer('skills_verified').default(0),
  recurringErrorTags: jsonb('recurring_error_tags'),
  remediationPlan: jsonb('remediation_plan'),
  totalSessions: integer('total_sessions').default(0),
  totalMinutes: integer('total_minutes').default(0),
  totalAttempts: integer('total_attempts').default(0),
  gatesPassed: integer('gates_passed').default(0),
  nextWeekRecommendations: jsonb('next_week_recommendations'),
  daysToWritten: integer('days_to_written'),
  daysToOral: integer('days_to_oral'),
  evidenceRefsJson: jsonb('evidence_refs_json'),
  reportGeneratedAt: timestamp('report_generated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// M3: TRANSCRIPT-ALIGNED TUTOR (TRANSCRIPT INGESTION)
// ============================================

// Lecture source type enum
export const lectureSourceEnum = pgEnum('lecture_source', ['KSL', 'ATP_OFFICIAL', 'EXTERNAL', 'ADMIN_UPLOAD']);

// Skill mapping status enum
export const skillMappingStatusEnum = pgEnum('skill_mapping_status', ['SUGGESTED', 'APPROVED', 'REJECTED']);

// Evidence source type for grounding
export const evidenceSourceEnum = pgEnum('evidence_source', ['OUTLINE_TOPIC', 'LECTURE_CHUNK', 'AUTHORITY']);

/**
 * lectures - KSL lecture recordings/transcripts
 * Links to ATP units for curriculum alignment
 */
export const lectures = pgTable('lectures', {
  id: uuid('id').defaultRandom().primaryKey(),
  unitId: text('unit_id'), // ATP unit ID (matches microSkills.unitId pattern)
  title: text('title').notNull(),
  lecturerName: text('lecturer_name'), // e.g., "Prof. Wanyama"
  lectureDate: date('lecture_date'),
  source: lectureSourceEnum('source').notNull().default('KSL'),
  transcriptAssetUrl: text('transcript_asset_url'), // S3/storage URL for raw file
  durationMinutes: integer('duration_minutes'),
  isActive: boolean('is_active').default(true).notNull(),
  metadata: jsonb('metadata').$type<{
    language?: string;
    quality?: 'good' | 'fair' | 'poor';
    hasTimestamps?: boolean;
    originalFormat?: 'vtt' | 'txt' | 'srt' | 'json';
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * lecture_chunks - Chunked transcript segments
 * Used for RAG retrieval and skill mapping
 */
export const lectureChunks = pgTable('lecture_chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  lectureId: uuid('lecture_id').references(() => lectures.id).notNull(),
  chunkIndex: integer('chunk_index').notNull(), // 0-indexed order within lecture
  text: text('text').notNull(), // The actual transcript content
  startTime: integer('start_time'), // seconds from start (optional)
  endTime: integer('end_time'), // seconds from start (optional)
  // Embedding: stored externally or as vector extension
  embeddingId: text('embedding_id'), // External embedding service ID (OpenAI, etc.)
  embeddingVector: jsonb('embedding_vector').$type<number[]>(), // Or local storage
  // Chunking metadata
  tokenCount: integer('token_count'),
  chunkHash: text('chunk_hash'), // SHA256 for deduplication
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * lecture_skill_map - Mapping chunks to curriculum skills
 * Admin-approved mappings for retrieval-first generation
 */
export const lectureSkillMap = pgTable('lecture_skill_map', {
  id: uuid('id').defaultRandom().primaryKey(),
  chunkId: uuid('chunk_id').references(() => lectureChunks.id).notNull(),
  skillId: uuid('skill_id').references(() => microSkills.id).notNull(),
  confidence: numeric('confidence', { precision: 5, scale: 4 }).notNull(), // 0.0 - 1.0, AI-suggested
  evidenceSpan: text('evidence_span'), // Quoted text supporting the mapping
  status: skillMappingStatusEnum('status').notNull().default('SUGGESTED'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * evidence_spans - Auditable receipts linking outputs to sources
 * Tracks "why this is true" for notes, grading, feedback
 */
export const evidenceSpans = pgTable('evidence_spans', {
  id: uuid('id').defaultRandom().primaryKey(),
  // What this evidence supports
  targetType: text('target_type').notNull(), // 'STUDY_ASSET', 'GRADING_OUTPUT', 'ATTEMPT_FEEDBACK'
  targetId: uuid('target_id').notNull(), // ID of the asset/attempt/etc.
  // The source
  sourceType: evidenceSourceEnum('source_type').notNull(),
  sourceId: uuid('source_id').notNull(), // outline_topic_id, lecture_chunk_id, or authority_id
  // Evidence details
  quotedText: text('quoted_text'), // The exact text cited
  claimText: text('claim_text'), // What claim this supports
  confidenceScore: numeric('confidence_score', { precision: 5, scale: 4 }),
  pageOrTimestamp: text('page_or_timestamp'), // For source location
  // Audit
  generatedBy: text('generated_by'), // 'AI', 'ADMIN', 'RETRIEVAL'
  isVerified: boolean('is_verified').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * missing_authority_log - Tracking when system can't find verified sources
 * For admin review and gap analysis
 */
export const missingAuthorityLog = pgTable('missing_authority_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  claimText: text('claim_text').notNull(), // What the AI wanted to cite
  requestedSkillIds: jsonb('requested_skill_ids').$type<string[]>(),
  searchQuery: text('search_query'), // What was searched
  searchResults: jsonb('search_results'), // What came back (empty or low confidence)
  errorTag: text('error_tag').notNull(), // 'MISSING_AUTHORITY', 'MISSING_TRANSCRIPT_SUPPORT', etc.
  sessionId: uuid('session_id').references(() => studySessions.id),
  assetId: uuid('asset_id').references(() => studyAssets.id),
  resolvedAt: timestamp('resolved_at'), // When admin added the missing source
  resolvedBy: uuid('resolved_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// M4: AUTHORITY RECORDS + NOTIFICATIONS
// ============================================

/**
 * authority_records - Canonical source records for citations
 * Stores cases, statutes, regulations with source governance
 */
export const authorityRecords = pgTable('authority_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceTier: sourceTierEnum('source_tier').notNull(), // A = primary, B = secondary, C = restricted
  sourceType: sourceTypeEnum('source_type').notNull(),
  domain: text('domain').notNull(), // e.g., 'kenyalaw.org'
  canonicalUrl: text('canonical_url').notNull(),
  title: text('title').notNull(),
  jurisdiction: text('jurisdiction'), // e.g., 'Kenya', 'UK'
  court: text('court'), // e.g., 'Supreme Court', 'Court of Appeal'
  citation: text('citation'), // e.g., '[2020] KECA 123'
  decisionDate: date('decision_date'),
  actName: text('act_name'), // For statutes
  sectionPath: text('section_path'), // e.g., 'Section 3(1)(a)'
  licenseTag: licenseTagEnum('license_tag').notNull().default('UNKNOWN'),
  retrievedAt: timestamp('retrieved_at').defaultNow().notNull(),
  contentHash: text('content_hash'), // For change detection
  rawText: text('raw_text'), // Full text for search
  isVerified: boolean('is_verified').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * authority_passages - Verbatim excerpts from authority records
 * With pinpoint locators for precise citations
 */
export const authorityPassages = pgTable('authority_passages', {
  id: uuid('id').defaultRandom().primaryKey(),
  authorityId: uuid('authority_id').references(() => authorityRecords.id, { onDelete: 'cascade' }).notNull(),
  passageText: text('passage_text').notNull(),
  locatorJson: jsonb('locator_json').$type<{
    paragraphStart?: number;
    paragraphEnd?: number;
    section?: string;
    subsection?: string;
    schedule?: string;
    page?: number;
  }>().notNull(),
  snippetHash: text('snippet_hash'), // For deduplication
  startIndex: integer('start_index'),
  endIndex: integer('end_index'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * notification_log - All outbound notifications
 */
export const notificationLog = pgTable('notification_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  channel: notificationChannelEnum('channel').notNull(),
  template: text('template').notNull(),
  payloadJson: jsonb('payload_json'),
  status: notificationStatusEnum('status').notNull().default('PENDING'),
  providerMessageId: text('provider_message_id'),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * push_subscriptions - Web push subscription endpoints
 */
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  endpoint: text('endpoint').notNull().unique(),
  keysJson: jsonb('keys_json').$type<{
    p256dh: string;
    auth: string;
  }>().notNull(),
  userAgent: text('user_agent'),
  isActive: boolean('is_active').default(true).notNull(),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// TUTOR OS - RELATIONS
// ============================================

export const examCyclesRelations = relations(examCycles, ({ many }) => ({
  events: many(examEvents),
  userProfiles: many(userExamProfiles),
}));

export const examEventsRelations = relations(examEvents, ({ one }) => ({
  cycle: one(examCycles, {
    fields: [examEvents.cycleId],
    references: [examCycles.id],
  }),
}));

export const userExamProfilesRelations = relations(userExamProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userExamProfiles.userId],
    references: [users.id],
  }),
  cycle: one(examCycles, {
    fields: [userExamProfiles.cycleId],
    references: [examCycles.id],
  }),
}));

export const studySessionsRelations = relations(studySessions, ({ one, many }) => ({
  user: one(users, {
    fields: [studySessions.userId],
    references: [users.id],
  }),
  assets: many(studyAssets),
  events: many(sessionEvents),
}));

export const studyAssetsRelations = relations(studyAssets, ({ one }) => ({
  session: one(studySessions, {
    fields: [studyAssets.sessionId],
    references: [studySessions.id],
  }),
}));

export const sessionEventsRelations = relations(sessionEvents, ({ one }) => ({
  session: one(studySessions, {
    fields: [sessionEvents.sessionId],
    references: [studySessions.id],
  }),
}));

export const weeklyReportsRelations = relations(weeklyReports, ({ one }) => ({
  user: one(users, {
    fields: [weeklyReports.userId],
    references: [users.id],
  }),
}));

export const backgroundJobsRelations = relations(backgroundJobs, ({ one }) => ({
  user: one(users, {
    fields: [backgroundJobs.userId],
    references: [users.id],
  }),
}));
// ============================================
// M3: TRANSCRIPT TABLES RELATIONS
// ============================================

export const lecturesRelations = relations(lectures, ({ many }) => ({
  chunks: many(lectureChunks),
}));

export const lectureChunksRelations = relations(lectureChunks, ({ one, many }) => ({
  lecture: one(lectures, {
    fields: [lectureChunks.lectureId],
    references: [lectures.id],
  }),
  skillMappings: many(lectureSkillMap),
}));

export const lectureSkillMapRelations = relations(lectureSkillMap, ({ one }) => ({
  chunk: one(lectureChunks, {
    fields: [lectureSkillMap.chunkId],
    references: [lectureChunks.id],
  }),
  skill: one(microSkills, {
    fields: [lectureSkillMap.skillId],
    references: [microSkills.id],
  }),
  approver: one(users, {
    fields: [lectureSkillMap.approvedBy],
    references: [users.id],
  }),
}));

export const evidenceSpansRelations = relations(evidenceSpans, ({ }) => ({
  // Dynamic references based on targetType and sourceType
  // No direct relations as these are polymorphic
}));

export const missingAuthorityLogRelations = relations(missingAuthorityLog, ({ one }) => ({
  session: one(studySessions, {
    fields: [missingAuthorityLog.sessionId],
    references: [studySessions.id],
  }),
  asset: one(studyAssets, {
    fields: [missingAuthorityLog.assetId],
    references: [studyAssets.id],
  }),
  resolver: one(users, {
    fields: [missingAuthorityLog.resolvedBy],
    references: [users.id],
  }),
}));

// ============================================
// M4: AUTHORITY & NOTIFICATION RELATIONS
// ============================================

export const authorityRecordsRelations = relations(authorityRecords, ({ many }) => ({
  passages: many(authorityPassages),
}));

export const authorityPassagesRelations = relations(authorityPassages, ({ one }) => ({
  authority: one(authorityRecords, {
    fields: [authorityPassages.authorityId],
    references: [authorityRecords.id],
  }),
}));

export const notificationLogRelations = relations(notificationLog, ({ one }) => ({
  user: one(users, {
    fields: [notificationLog.userId],
    references: [users.id],
  }),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));