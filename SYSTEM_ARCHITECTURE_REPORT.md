# YNAI BAR EXAM PREP SYSTEM
## Complete Architecture & Features Documentation

**System:** Kenya Bar Exam Preparation Platform  
**Codebase:** Next.js 14 (App Router) + PostgreSQL (Neon) + OpenAI  
**Report Date:** 2026-02-21

---

## TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Technology Stack](#3-technology-stack)
4. [User Interface Pages](#4-user-interface-pages)
5. [API Reference](#5-api-reference)
6. [Core Services](#6-core-services)
7. [Database Schema](#7-database-schema)
8. [AI Integration](#8-ai-integration)
9. [Authentication Flow](#9-authentication-flow)
10. [Feature Details](#10-feature-details)
11. [Data Flow Diagrams](#11-data-flow-diagrams)

---

## 1. SYSTEM OVERVIEW

### 1.1 What Is This System?

YNAI (Your New AI) is a comprehensive AI-powered platform to help Kenyan law students prepare for the Council of Legal Education (CLE) Bar Examination. It covers all 9 ATP (Advocates Training Program) units with adaptive learning, practice questions, AI grading, and personalized study plans.

### 1.2 Core Value Propositions

| Feature | Description |
|---------|-------------|
| **Adaptive Learning** | AI adjusts difficulty based on user performance |
| **Mastery Tracking** | Per-skill mastery percentages with gate verification |
| **AI Grading** | OpenAI grades written responses with rubric-based feedback |
| **Legal Drafting** | 50+ document templates with AI guidance |
| **Research Tools** | AI-powered legal research with citation verification |
| **Voice Support** | Whisper transcription for oral advocacy practice |
| **PWA Support** | Installable on mobile devices |

### 1.3 User Journey Summary

```
Sign Up → Onboarding → Dashboard → [Feature Modules] → Track Progress
                ↓
        Sets exam date,
        study pace,
        weak areas
```

---

## 2. ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT (Browser/PWA)                            │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  Dashboard  │  │   Mastery   │  │  Drafting   │  │  Research   │       │
│  │   /         │  │   Hub       │  │             │  │             │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   Quizzes   │  │    Study    │  │    Exams    │  │   Tutor     │       │
│  │             │  │             │  │             │  │             │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NEXT.JS API ROUTES                                  │
│                                                                             │
│  /api/ai/chat              /api/mastery/*           /api/onboarding         │
│  /api/progress             /api/tutor/*             /api/questions          │
│  /api/transcribe           /api/study/*             /api/streaks            │
│  /api/exam/*               /api/upload              /api/submit             │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SERVICES    │    │    OPENAI       │    │    FIREBASE     │
│               │    │                 │    │                 │
│ grading-svc   │    │ GPT-4o / GPT-4o │    │ Authentication  │
│ mastery-engine│    │    -mini        │    │ (Firebase Auth) │
│ authority-svc │    │                 │    │                 │
│ pacing-engine │    │ Whisper-1       │    └─────────────────┘
│ study-planner │    │ (Transcription) │
└───────────────┘    └─────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        POSTGRESQL (Neon Serverless)                         │
│                                                                             │
│  47 Tables including:                                                       │
│  users, user_profiles, mastery_state, micro_skills, items, attempts,        │
│  daily_plans, chat_sessions, study_streaks, questions, rubrics, etc.        │
│                                                                             │
│  Key Counts: 273 skills, 100 items, 421 mastery records, 6 users           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. TECHNOLOGY STACK

### 3.1 Frontend

| Technology | Purpose |
|------------|---------|
| **Next.js 14** | React framework with App Router |
| **React 18** | UI library |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Styling |
| **shadcn/ui** | Component library |
| **Lucide Icons** | Icon set |

### 3.2 Backend

| Technology | Purpose |
|------------|---------|
| **Next.js API Routes** | Serverless API endpoints |
| **Drizzle ORM** | Type-safe database queries |
| **Neon PostgreSQL** | Serverless PostgreSQL |
| **OpenAI SDK** | AI integration |
| **Zod** | Schema validation |

### 3.3 Authentication

| Technology | Purpose |
|------------|---------|
| **Firebase Auth** | User authentication |
| **Firebase Admin SDK** | Server-side token verification |

### 3.4 AI Provider

| Provider | Model | Use Case |
|----------|-------|----------|
| **OpenAI** | GPT-4o-mini | Chat, grading, generation |
| **OpenAI** | GPT-4o | Complex grading, authority retrieval |
| **OpenAI** | Whisper-1 | Audio transcription |

---

## 4. USER INTERFACE PAGES

### 4.1 Page Routing Structure

**Public Pages:**
```
/                    → Landing page
/about               → About the platform
/pricing             → Pricing information
/privacy             → Privacy policy
/terms               → Terms of service
/disclaimer          → Legal disclaimer
```

**Authenticated Pages (under `/(app)/`):**
```
/dashboard           → Main dashboard with stats and module links
/mastery            → Mastery Hub - adaptive practice
/drafting           → Legal document drafting
/study              → Study materials and notes
/quizzes            → Quiz modes (adaptive, quick, challenge, blitz, exam)
/exams              → Full exam simulations
/research           → AI-powered legal research
/tutor              → AI tutor chat
/progress           → Progress tracking and analytics
/onboarding         → User profile setup
/history            → Past activity history
/banter             → Casual learning chat
/clarify            → Ask clarifying questions
/community          → Community features (placeholder)
/admin              → Admin dashboard
```

### 4.2 Key Page Features

| Page | Primary Feature | Key Components |
|------|-----------------|----------------|
| `/dashboard` | Entry point with quick links | Stats cards, module grid |
| `/mastery` | Adaptive practice with AI grading | DailyPlanView, EmbeddedPracticePanel, ReadinessDashboard |
| `/drafting` | Document drafting with AI | Document type selector, drafting interface |
| `/quizzes` | Multiple quiz modes | Adaptive, quick, challenge, blitz, exam simulation |
| `/research` | Legal research chat | SmartChatInput, web search toggle |
| `/study` | Study materials | Topic browser, notes reader |
| `/exams` | Timed exam practice | Unit-specific exams, grading |

---

## 5. API REFERENCE

### 5.1 AI & Chat APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai/chat` | POST | Main AI chat endpoint - routes to different competencies |
| `/api/ai/suggestions` | GET | Get smart suggestions based on context |

**POST /api/ai/chat Request:**
```typescript
{
  message: string;
  competencyType: 'drafting' | 'research' | 'oral' | 'banter' | 'clarification';
  context?: {
    topicArea?: string;
    documentType?: string;
    webSearchEnabled?: boolean;
  };
  sessionId?: string;
  attachments?: { type: string; dataUrl?: string; transcription?: string }[];
  useWebSearch?: boolean;
}
```

**Response:**
```typescript
{
  response: string;
  filtered: boolean;
  guardrails: {
    isHallucination: boolean;
    isOffTopic: boolean;
    isReliable: boolean;
    confidence: number;
    warnings?: string[];
  };
}
```

### 5.2 Mastery Hub APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/mastery/item` | GET | Fetch practice item for a skill |
| `/api/mastery/attempt` | POST | Submit answer for grading |
| `/api/mastery/attempt` | GET | Fetch attempt history |
| `/api/mastery/plan` | GET | Get daily study plan |
| `/api/mastery/readiness` | GET | Get readiness dashboard data |
| `/api/mastery/report` | GET | Get weekly mastery report |
| `/api/mastery/notes` | GET | Get study notes for a skill |

**GET /api/mastery/item:**
```
Query: ?skillId=uuid&format=written&itemId=optional-uuid
Returns: { id, itemType, format, prompt, keyPoints, modelAnswer, difficulty, ... }
```

**POST /api/mastery/attempt:**
```typescript
{
  itemId: string;
  format: 'written' | 'oral' | 'drafting' | 'mcq';
  mode: 'practice' | 'timed' | 'exam_sim';
  response: string;
  startedAt: string;
  timeTakenSec: number;
  prompt: string;
  keyPoints?: string[];
  modelAnswer?: string;
  skillIds: string[];
  coverageWeights: Record<string, number>;
  unitId: string;
  difficulty: number;
}
```

**Response:**
```typescript
{
  attemptId: string;
  grading: {
    scoreNorm: number;       // 0-1
    rubricBreakdown: [...];  // Per-category scores
    missingPoints: string[];
    errorTags: string[];
    modelOutline: string;
  };
  masteryUpdates: [{ skillId, oldPMastery, newPMastery }];
  gateResults: [{ skillId, verified: boolean, reason: string }];
  summary: { passed: boolean; scorePercent: number; improvementAreas: string[] };
}
```

### 5.3 User & Progress APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/onboarding` | GET | Get onboarding status |
| `/api/onboarding` | POST | Submit onboarding data |
| `/api/progress` | GET | Get user progress and stats |
| `/api/streaks` | GET | Get study streak data |

### 5.4 Study & Tutor APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tutor/guide` | GET | Get AI study recommendations |
| `/api/tutor/plan` | GET | Get personalized study plan |
| `/api/tutor/review` | GET | Get review recommendations |
| `/api/tutor/today` | GET | Get today's focus areas |
| `/api/study/pacing` | GET | Get session pacing state |
| `/api/study/pacing` | POST | Record pacing events |
| `/api/study/session` | POST | Start/end study session |

### 5.5 Quiz & Questions APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/questions` | GET | Fetch questions by topic/difficulty |
| `/api/submit` | POST | Submit quiz/question answers |

### 5.6 Voice & Media APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/transcribe` | POST | Transcribe audio using Whisper |
| `/api/upload` | POST | Upload files/media |

### 5.7 Exam APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/exam/profile` | GET/POST | User exam profile |
| `/api/exam/timeline` | GET | Exam timeline and schedule |

### 5.8 Admin APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/*` | Various | Admin management functions |
| `/api/cron/*` | POST | Scheduled job triggers |

---

## 6. CORE SERVICES

### 6.1 Service Layer Overview

```
lib/services/
├── mastery-engine.ts        # Mastery calculation, gate verification
├── grading-service.ts       # AI grading with rubrics
├── authority-retrieval-service.ts  # Legal authority lookup
├── pacing-engine.ts         # Session pacing and breaks
├── study-planner.ts         # Daily study plan generation
├── study-guide-algorithm.ts # Recommendation algorithm
├── notification-service.ts  # Push/email notifications
├── spaced-repetition.ts     # SM2 algorithm implementation
├── transcript-service.ts    # Audio/video transcription
├── banter-service.ts        # Casual chat handling
├── background-worker.ts     # Async job processing
└── preloading.ts            # Asset preloading
```

### 6.2 Mastery Engine (`mastery-engine.ts`)

**Purpose:** Calculate mastery updates, verify gates, generate daily plans.

**Key Functions:**
```typescript
updateMasteryWithCurrentState(input: MasteryUpdateInput): MasteryStateUpdate[]
checkGateVerification(userId, skillId): GateCheckResult
generateDailyPlan(userId, targetMinutes): DailyPlanItem[]
```

**Configuration:**
```typescript
MASTERY_CONFIG = {
  learningRate: 0.15,
  maxDeltaPositive: 0.10,
  maxDeltaNegative: -0.12,
  formatWeights: { written: 1.15, oral: 1.35, mcq: 0.75 },
  modeWeights: { timed: 1.25, practice: 1.0 },
  gates: { minPMastery: 0.85, requiredTimedPasses: 2, minHoursBetweenPasses: 24 }
}
```

**Mastery Formula:**
```
delta = learningRate × (scoreNorm - currentP) × formatWeight × modeWeight
delta = clamp(delta, -0.12, +0.10)
newPMastery = currentP + delta
```

### 6.3 Grading Service (`grading-service.ts`)

**Purpose:** AI-powered grading of written, oral, and drafting responses.

**Key Function:**
```typescript
gradeResponse(request: GradingRequest): Promise<GradingOutput>
```

**Output Schema (Zod validated):**
```typescript
{
  scoreNorm: number;      // 0-1
  scoreRaw: number;
  maxScore: number;
  rubricBreakdown: [{
    category: string;
    score: number;
    maxScore: number;
    feedback: string;
    missingPoints?: string[];
  }];
  missingPoints: string[];
  errorTags: string[];
  nextDrills: string[];
  modelOutline: string;
}
```

### 6.4 Authority Retrieval Service (`authority-retrieval-service.ts`)

**Purpose:** Fetch and verify legal authorities (cases, statutes) for grounding responses.

**Flow:**
1. LLM proposes candidate URLs
2. System filters by allowlist + tier rules
3. Fetch and extract content
4. LLM selects relevant spans
5. Store in `authority_records` + `authority_passages`

**Source Tiers:**
| Tier | Examples |
|------|----------|
| A | Kenya Law Reports, Kenya Gazette |
| B | Published commentaries, textbooks |
| C | Verified lecture materials |

### 6.5 Pacing Engine (`pacing-engine.ts`)

**Purpose:** Monitor study sessions and suggest breaks.

**Key Functions:**
```typescript
getSessionPacingState(sessionId): PacingState
analyzePacing(state): { shouldBreak: boolean; reason: string }
recordBreakTaken(sessionId): void
getTodayCumulativeStudy(userId): { totalMinutes, sessionsCount }
```

### 6.6 Study Planner (`study-planner.ts`)

**Purpose:** Generate personalized daily study plans based on mastery state, exam date, and coverage requirements.

**Objective Function Weights:**
```typescript
{
  learningGain: 0.35,    // New learning potential
  retentionGain: 0.20,   // Spaced repetition value
  examRoi: 0.25,         // Exam weight of skill
  errorClosure: 0.15,    // Fix previous errors
  burnoutPenalty: 0.05,  // Avoid overwork
}
```

---

## 7. DATABASE SCHEMA

### 7.1 Table Overview (47 tables)

**User Domain:**
| Table | Purpose |
|-------|---------|
| `users` | Core user accounts |
| `user_profiles` | Extended profile (exam date, study pace, weak areas) |
| `study_streaks` | Daily activity tracking |
| `user_progress` | Per-topic progress |
| `user_engagement_signals` | Behavioral analytics |

**Mastery Domain:**
| Table | Purpose |
|-------|---------|
| `micro_skills` | 273 curriculum skills across 9 units |
| `items` | 100 practice questions |
| `item_skill_map` | Link items to skills |
| `mastery_state` | Per-user skill mastery (p_mastery, stability, attempts) |
| `attempts` | Practice attempt records |
| `daily_plans` | Generated study plans |
| `daily_plan_items` | Tasks within plans |
| `error_tags` | Error categorization |

**Content Domain:**
| Table | Purpose |
|-------|---------|
| `topics` | Learning topics |
| `questions` | Quiz questions |
| `lectures` | Lecture content |
| `lecture_chunks` | Chunked lecture content |
| `rubrics` | Grading rubrics |

**Authority Domain:**
| Table | Purpose |
|-------|---------|
| `authority_records` | Legal sources (cases, statutes) |
| `authority_passages` | Extracted text passages |
| `evidence_spans` | Citation locations |
| `vetted_authorities` | Pre-verified authorities |
| `missing_authority_log` | Authorities AI couldn't find |

**Session Domain:**
| Table | Purpose |
|-------|---------|
| `chat_sessions` | Conversation sessions |
| `chat_messages` | Individual messages |
| `study_sessions` | Timed study sessions |
| `practice_sessions` | Practice sessions |

**System Domain:**
| Table | Purpose |
|-------|---------|
| `background_jobs` | Async job queue |
| `notification_log` | Notification history |
| `push_subscriptions` | PWA push subscriptions |

### 7.2 Key Table Schemas

**users:**
```sql
id, firebase_uid, email, display_name, role, theme, 
is_active, onboarding_completed, created_at, updated_at
```

**micro_skills:**
```sql
id, name, unit_id, exam_weight, difficulty, is_core, 
is_active, format_tags, created_at, updated_at
```

**mastery_state:**
```sql
id, user_id, skill_id, p_mastery, stability, 
attempt_count, correct_count, is_verified, 
last_practiced_at, next_review_date, created_at, updated_at
```

**attempts:**
```sql
id, user_id, item_id, mode, format, started_at, submitted_at,
time_taken_sec, raw_answer_text, transcript_text, 
score_norm, rubric_breakdown_json, feedback_json,
error_tag_ids, is_complete, is_graded, created_at
```

---

## 8. AI INTEGRATION

### 8.1 Guardrails System (`lib/ai/guardrails.ts`)

**Purpose:** Route AI requests, enforce citation requirements, validate responses.

**Competency Types:**
| Type | Handler Function | Use Case |
|------|------------------|----------|
| `drafting` | `generateDraftingResponse()` | Document drafting |
| `research` | `generateResearchResponse()` | Legal research |
| `oral` | `generateOralAdvocacyFeedback()` | Oral advocacy |
| `banter` | `generateBanterResponse()` | Casual chat |
| `clarification` | `generateClarificationResponse()` | Q&A |

**Key Guardrails:**
1. **Citation Requirement:** All legal claims must cite specific sections/articles
2. **Hallucination Check:** Validate citations are real
3. **Off-Topic Filter:** Keep responses within bar exam scope
4. **Kenyan Law Focus:** Ensure Kenya-specific legal context

**System Prompt Excerpt:**
```
EVERY legal statement MUST be grounded in a specific, verifiable source.

REQUIRED FORMAT FOR ALL LEGAL CLAIMS:
1. Constitutional Provisions: "Article 50(2)(a) of the Constitution of Kenya 2010"
2. Statutory Provisions: "Section 107(1) of the Evidence Act, Cap 80"
3. Case Law: "Republic v JSC ex parte Pareno [2004] eKLR"

IF YOU CANNOT CITE A SPECIFIC SOURCE:
- Say: "I cannot identify the specific provision..."
- Do NOT make up citations
```

### 8.2 OpenAI Integration

**API Pattern:**
```typescript
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// For chat/generation (Responses API)
const response = await openai.responses.create({
  model: 'gpt-4o-mini',
  instructions: systemPrompt,
  input: userMessage,
});
const text = response.output_text;

// For transcription
const transcription = await openai.audio.transcriptions.create({
  file: audioFile,
  model: 'whisper-1',
  language: 'en',
});
```

### 8.3 Grading Prompt Structure

```typescript
const gradingPrompt = `
You are a bar exam grader for Kenya. Grade this response strictly.

QUESTION: ${prompt}
STUDENT RESPONSE: ${response}
MODEL ANSWER: ${modelAnswer}
KEY POINTS: ${keyPoints.join(', ')}

Return JSON only (no markdown):
{
  "scoreNorm": 0.75,
  "rubricBreakdown": [
    { "category": "Issue Identification", "score": 4, "maxScore": 5, "feedback": "..." }
  ],
  "missingPoints": ["Point not addressed"],
  "errorTags": ["incomplete_analysis"],
  "modelOutline": "1. First point\\n2. Second point"
}
`;
```

---

## 9. AUTHENTICATION FLOW

### 9.1 Firebase Authentication

**Client Side:**
```typescript
// AuthContext.tsx
const { user, loading, getIdToken } = useAuth();

// Get token for API calls
const token = await getIdToken();
fetch('/api/endpoint', {
  headers: { Authorization: `Bearer ${token}` }
});
```

**Server Side:**
```typescript
// lib/auth/middleware.ts
export async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.split('Bearer ')[1];
  const decodedToken = await verifyIdToken(token);
  
  // Get or create user in database
  const user = await db.query.users.findFirst({
    where: eq(users.firebaseUid, decodedToken.uid)
  });
  return user;
}

// Usage in API route
export const GET = withAuth(async (req, user) => {
  // user is the authenticated database user
});
```

### 9.2 Onboarding Gate

Users must complete onboarding before accessing Mastery Hub:

1. Check `user.onboardingCompleted` flag
2. If false, redirect to `/onboarding`
3. Onboarding sets: exam date, study pace, weak/strong areas
4. Initial mastery states are seeded based on self-assessment

---

## 10. FEATURE DETAILS

### 10.1 Mastery Hub

**Purpose:** Adaptive practice with AI grading and mastery tracking.

**Components:**
- `DailyPlanView`: Today's recommended tasks
- `EmbeddedPracticePanel`: Inline practice experience
- `ReadinessDashboard`: Mastery percentages by unit

**Flow (Study-First Approach):**
1. User opens Mastery Hub
2. Daily plan shows prioritized tasks
3. User clicks "Start" on a task
4. **STUDY PHASE**: System shows study notes with key concepts, statutes, and exam tips
5. User clicks "Ready for the Question" when done studying
6. **QUESTION PHASE**: Practice question is displayed
7. User writes response
8. AI grades with rubric breakdown
9. Mastery state updated (delta clamped to ±10-12%)
10. Gate verification checked (85% + 2 timed passes)

**Notes Generation:**
- First tries database outline topics (skill_outline_map → outline_topics)
- Falls back to hardcoded Kenya law base (Civil Litigation provisions)
- Falls back to AI-generated notes (GPT-4o-mini) for all other units
- Includes statutory provisions, case law, and exam tips

### 10.2 Legal Drafting

**Purpose:** Learn to draft 50+ legal document types.

**Categories:**
- Pleadings (plaints, defences, replies)
- Affidavits
- Submissions
- Contracts
- Conveyancing
- Corporate documents
- Legal opinions
- Criminal documents
- Notices

**AI Features:**
- Step-by-step guidance
- Template suggestions
- Format validation
- Citation checking

### 10.3 Quizzes

**Quiz Modes:**
| Mode | Questions | Time | Features |
|------|-----------|------|----------|
| Adaptive | 10 | ~7 min | AI adjusts difficulty |
| Quick | 5 | ~3 min | Warm-up |
| Challenge | 10 | ~8 min | Test mastery |
| Blitz | 8 | ~2 min | 15 sec per question |
| Exam | 20 | ~15 min | Cross-topic simulation |

**Quiz Flow:**
1. Select mode and optional unit filter
2. Questions generated (DB or AI)
3. Answer each question
4. Get instant feedback with explanations
5. See final score and weak areas

### 10.4 Research

**Purpose:** AI-powered legal research with citations.

**Features:**
- Chat interface for research queries
- Web search toggle (for up-to-date info)
- Topic filtering by ATP unit
- Citation verification
- Copy response to clipboard

### 10.5 Study

**Purpose:** Deep learning of course materials.

**Features:**
- Topic browser by ATP unit
- Notes reader component
- Session tracking with pacing alerts
- Study time recommendations

### 10.6 Exams

**Purpose:** Full exam simulations.

**Features:**
- Unit-specific exams
- Timed conditions
- AI grading with detailed feedback
- Score history

### 10.7 Tutor

**Purpose:** AI study guide and recommendations.

**Endpoints:**
- `/api/tutor/guide`: Personalized recommendations
- `/api/tutor/plan`: Weekly study plan
- `/api/tutor/today`: Focus areas for today

### 10.8 Voice/Oral Advocacy

**Purpose:** Practice oral arguments with voice input.

**Flow:**
1. User records audio response
2. Audio sent to `/api/transcribe`
3. Whisper transcribes to text
4. Text graded by AI
5. Feedback on delivery and content

---

## 11. DATA FLOW DIAGRAMS

### 11.1 Practice Attempt Flow (Study-First)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    User      │     │   Frontend   │     │     API      │
│ Clicks Start │────>│  Component   │────>│   /notes     │
└──────────────┘     └──────────────┘     │   /item      │
                                          └──────────────┘
                                                  │
                                                  ▼
                                         ┌──────────────┐
                                         │ STUDY PHASE  │ ←── Notes displayed
                                         │  (User reads │     first before
                                         │   notes)     │     question
                                         └──────────────┘
                                                  │
                                                  ▼ User clicks "Ready"
                                         ┌──────────────┐
                                         │   QUESTION   │
                                         │    PHASE     │
                                         └──────────────┘
                                                  │
                                                  ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    User      │────>│   Submit     │────>│   /attempt   │
│  Writes Ans  │     │   Answer     │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                                                  ▼
                                         ┌──────────────┐
                                         │   Grading    │
                                         │   Service    │
                                         └──────────────┘
                                                  │
                                                  ▼
                                         ┌──────────────┐
                                         │   OpenAI     │
                                         │   GPT-4o     │
                                         └──────────────┘
                                                  │
                                                  ▼
                                         ┌──────────────┐
                                         │   Mastery    │
                                         │   Engine     │
                                         └──────────────┘
                                                  │
                     ┌────────────────────────────┤
                     ▼                            ▼
              ┌──────────────┐           ┌──────────────┐
              │  attempts    │           │ mastery_state│
              │    table     │           │    table     │
              └──────────────┘           └──────────────┘
```

### 11.2 AI Chat Flow

```
User Message
     │
     ▼
Route by competencyType
     │
     ├── 'drafting'  ───> generateDraftingResponse()
     ├── 'research'  ───> generateResearchResponse()
     ├── 'oral'      ───> generateOralAdvocacyFeedback()
     ├── 'banter'    ───> generateBanterResponse()
     └── 'clarify'   ───> generateClarificationResponse()
                               │
                               ▼
                    Build prompt with Kenya context
                               │
                               ▼
                    Call OpenAI Responses API
                               │
                               ▼
                    validateResponse() - Check guardrails
                               │
                               ▼
                    Return { response, guardrails }
```

### 11.3 Onboarding → Mastery Initialization

```
User submits onboarding form
          │
          ▼
POST /api/onboarding
          │
          ├── Update users.onboarding_completed = true
          │
          ├── Upsert user_profiles with:
          │   - targetExamDate
          │   - studyPace
          │   - weakAreas, strongAreas
          │
          └── Initialize mastery_states:
              - Strong areas: p_mastery = 0.25
              - Neutral:      p_mastery = 0.10
              - Weak areas:   p_mastery = 0.05
              
              For each of 273 micro_skills
```

---

## APPENDIX A: ENVIRONMENT VARIABLES

```env
# Database
DATABASE_URL=postgresql://...@neon.tech/...

# Firebase
FIREBASE_PROJECT_ID=xxx
FIREBASE_CLIENT_EMAIL=xxx
FIREBASE_PRIVATE_KEY=xxx
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx

# AI
OPENAI_API_KEY=sk-xxx

# Optional
RETRIEVAL_MODEL=gpt-4o-mini
```

---

## APPENDIX B: ATP UNITS (Kenya Bar Curriculum)

| Unit ID | Name |
|---------|------|
| atp-100 | Civil Litigation |
| atp-101 | Criminal Litigation |
| atp-102 | Conveyancing |
| atp-103 | Family Law |
| atp-104 | Probate and Administration |
| atp-105 | Commercial Transactions |
| atp-106 | Legal Ethics |
| atp-107 | Legal Writing |
| atp-108 | Oral Advocacy |

---

## APPENDIX C: CURRENT SYSTEM STATS

From audit dated 2026-02-21:

| Metric | Value |
|--------|-------|
| Total Tables | 47 |
| Total Skills | 273 |
| Total Items | 100 |
| Total Mastery Records | 421 |
| Users with Data | 6 |
| Real Attempts | 4 |
| Max Mastery Achieved | 19% |
| Skills Verified | 0 |

---

*This documentation captures the system as of February 2026. For code-level details, refer to the source files directly.*
