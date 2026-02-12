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
