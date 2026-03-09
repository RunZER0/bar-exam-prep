# YNAI — Complete System Feature Report
### Board Meeting Document · Pricing Review Edition
**Platform:** ynai.co.ke — Kenya Bar Exam Preparation  
**Architecture:** Next.js 14.2.35 · Neon PostgreSQL (pgvector) · Firebase Auth · Paystack · Render  
**Market:** ~2,200 KSL students/cohort + ~900 resitters · 9 ATP units · 3 terms × 11 weeks  
**Report Date:** July 2025

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Feature Catalog — Flagship Features](#2-flagship-features)
3. [Feature Catalog — Core Features](#3-core-features)
4. [Feature Catalog — Supporting Features](#4-supporting-features)
5. [Feature Catalog — Infrastructure & Admin](#5-infrastructure--admin)
6. [AI Model Inventory & Costs](#6-ai-model-inventory--costs)
7. [Complete AI Call Site Register (38 sites)](#7-complete-ai-call-site-register)
8. [Cost Scenarios Per User](#8-cost-scenarios-per-user)
9. [Current Pricing vs. Actual Cost](#9-current-pricing-vs-actual-cost)
10. [Pricing Implications & Recommendations](#10-pricing-implications--recommendations)

---

## 1. Executive Summary

YNAI is a comprehensive AI-powered Kenya Bar Exam preparation platform with **17 user-facing features**, **74+ API endpoints**, **38 distinct AI call sites**, and **5 AI model families**. The platform covers the entire bar preparation journey — from onboarding through mastery, practice, examination simulation, and community engagement.

### Key Numbers at a Glance

| Metric | Count |
|--------|-------|
| User-facing features | 17 |
| Flagship features (heavy AI) | 5 |
| Core features | 6 |
| Supporting features | 6 |
| API endpoints | 74+ |
| AI call sites | 38 |
| AI models in use | 7 (across 5 families) |
| Database tables | 30+ |
| Infrastructure cost | $0 (all free tier) |
| Prebuilt study notes | 297 (all syllabus nodes, v1) |
| Prebuilt drafting training courses | 55 (all document types, v1) |
| AI cost per moderate user/month | **$13.38** |
| Monthly subscription revenue (Standard) | **$15.38** (KES 2,000) |
| **Net margin per moderate user (Standard)** | **+15.0% (PROFITABLE)** |

---

## 2. Flagship Features

These are the 5 defining features that differentiate YNAI from every competitor. They are AI-heavy, high-value, and form the core of the product's value proposition.

---

### 2.1 🏆 MASTERY HUB — "The Engine"
**Flagship: YES** · **Status: Live** · **Page: `/mastery`** (869 lines)

#### What It Does
The Mastery Hub is YNAI's signature learning engine — an AI-orchestrated spaced repetition system that takes every student through a structured 4-phase mastery lifecycle for each topic across all 9 ATP units. It is the single most complex and AI-intensive feature in the platform.

#### How It Works
**Two-Track Daily Queue Logic:**
- **Path A — Surgical Strike** (for resitters): Focuses on weak areas identified from prior exam attempts, skips already-mastered topics, prioritizes high-yield content
- **Path B — Paced Build** (for first-timers): Systematic coverage of all 9 ATP units with adaptive pacing based on student capacity

**4-Phase Mastery Lifecycle per Topic:**
1. **NOTE** — Pre-built expert study notes served from database (297 notes covering all syllabus nodes, generated offline with gpt-5.2 + RAG grounding against Kenyan cases & statutes)
2. **EXHIBIT** — Pre-built interactive narrative slides with citation detection for Kenya Law Reports, eKLR references, statute sections
3. **DIAGNOSIS** — Practice items (MCQ, written, short-answer) to assess comprehension
4. **MASTERY** — Checkpoint assessment + evidence-backed mastery verification

**Sub-components:**
- **MasteryCarousel** (1,485 lines) — Carousel-based study flow with regex-based Kenyan law citation parsing
- **ReadinessDashboard** (602 lines) — Per-unit readiness scores with confidence intervals, gate progress tracking, exam format performance
- **EmbeddedPracticePanel** (705 lines) — Full practice workflow: question → answer → AI grading → rubric breakdown → mastery update
- **4 Tabs:** Today's Plan, Backlog, Readiness, Explore

#### AI Models Used (8 call sites — highest of any feature)

| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Study notes | DB lookup | 🔵 **PREBUILT** — served from database (297 pre-generated notes) | **$0.000** |
| Narrative renderer | DB lookup | 🔵 **PREBUILT** — served from database | **$0.000** |
| Practice item generation | gpt-5.2 | MCQ/written/short-answer questions | ~$0.031 |
| Assessment generation | gpt-5.2 (ASSESSMENT) | Comprehensive topic assessments | ~$0.031 |
| Checkpoint generation | gpt-5.2 (ASSESSMENT) | Phase gate verification | ~$0.023 |
| Grading service | gpt-5.2 (GRADING) | Answer evaluation + rubric scoring | ~$0.025 |
| Pacing decision | gpt-5.2 (ORCHESTRATOR) | Adaptive daily load calibration | ~$0.009 |
| Queue re-prioritization | gpt-5.2 (ORCHESTRATOR) | Dynamic queue reordering | ~$0.011 |

> **🔵 PREBUILT CONTENT STRATEGY:** Study notes and narrative slides are pre-generated offline using gpt-5.2 with full RAG grounding and stored in the database. This eliminates the two most expensive per-user call sites, reducing Mastery Hub session costs by ~46% compared to live generation.

**Total Mastery Hub AI cost per session:** ~$0.07–$0.25 (was ~$0.15–$0.40 before prebuilt)  
**Daily cost for active user:** ~$0.15–$0.50  
**Monthly cost for daily user:** ~$4.50–$15.00

#### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/mastery/plan` | Daily queue generation |
| `/api/mastery/notes` | AI study notes with RAG |
| `/api/mastery/content` | Narrative slides + checkpoints |
| `/api/mastery/item` | Practice item generation |
| `/api/mastery/attempt` | Submit answers + AI grading |
| `/api/mastery/progress` | Record phase completion |
| `/api/mastery/readiness` | Evidence-backed readiness scores |
| `/api/mastery/report` | Weekly progress report |

---

### 2.2 🏆 ORAL EXAMINATIONS — "The Courtroom"
**Flagship: YES** · **Status: Live** · **Page: `/oral-exams`** (1,496 lines)

#### What It Does
Full simulation of the Kenya Bar oral examination with two distinct modes, voice input/output, and detailed performance scoring. The only feature with named AI personas.

#### How It Works
**Two Exam Modes:**
1. **Devil's Advocate** — Aggressive adversarial questioning: the AI takes the opposing position on any legal topic and relentlessly challenges the student's arguments. Forces students to defend their position under pressure.
2. **3-Panel Examiner** — Simulates the actual bar exam panel with 3 named characters:
   - **Justice Mwangi** — Strict, procedural, tests technical knowledge
   - **Advocate Amara** — Practical, tests real-world application
   - **Prof. Otieno** — Academic, tests theoretical foundations

**Voice Pipeline:**
- Student speaks → Whisper STT transcription → AI response → TTS playback (tts-1)
- Also supports text-only mode for quiet environments

**Session Features:**
- Full transcript recording and replay
- AI-generated session summary with scores
- Performance tracking over time
- Topic selection across all 9 ATP units

#### AI Models Used (5 call sites)

| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Devil's Advocate (stream) | gpt-4o-mini | Adversarial questioning | ~$0.0006 |
| Devil's Advocate (non-stream) | gpt-4o-mini | Fallback | ~$0.0006 |
| 3-Panel Examiner (stream) | gpt-4o-mini | Panel simulation | ~$0.0006 |
| 3-Panel Examiner (non-stream) | gpt-4o-mini | Fallback | ~$0.0006 |
| Session summary | gpt-4o-mini | Score + feedback | ~$0.001 |

**Plus Voice I/O (shared):**
| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Speech-to-text | whisper-1 | Student speech input | ~$0.006/min |
| Text-to-speech | tts-1 | AI speech output | ~$0.008/call |

**Total Oral Exam AI cost per session:** ~$0.04–$0.10 (text only) / ~$0.15–$0.40 (with voice)  
**Trial Limit:** 2 Devil's Advocate sessions + 2 Panel sessions

#### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/oral-exams` | Conversation streaming + summary generation |
| `/api/oral-exams/sessions` | Save/list session transcripts |
| `/api/oral-exams/sessions/[id]` | Session detail + replay |
| `/api/voice/stt` | Speech-to-text (whisper-1) |
| `/api/voice/tts` | Text-to-speech (tts-1) |

---

### 2.3 🏆 LEGAL DRAFTING — "The Workshop"
**Flagship: YES** · **Status: Live** · **Page: `/drafting`** (157 lines)

#### What It Does
Progressive session-based legal drafting training across 55 document types in 11 categories. Each document type is taught through a structured "Build a House" methodology — foundation first, then scaffolding, then the finished product. Features pre-built training manuals with AI-generated exercise scenarios and AI grading.

#### How It Works
**11 Document Categories (55 document types total):**
1. Pleadings & Court Documents (9) — plaints, defences, petitions, summons, etc.
2. Affidavits (5) — supporting, replying, supplementary, service, statutory
3. Submissions & Arguments (3) — written submissions, heads of argument, skeleton
4. Contracts & Agreements (8) — sale, lease, employment, partnership, NDA, etc.
5. Conveyancing Documents (4) — transfers, charges, discharges, consents
6. Company/Corporate Documents (4) — M&A, resolutions, minutes
7. Legal Opinions & Memoranda (3) — opinions, memoranda, client advisory
8. Criminal Practice Documents (4) — charges, bail, plea bargain, mitigation
9. Notices & Correspondence (4) — demand letters, notices to admit/appeal
10. Judgments & Court Orders (7) — judgments, rulings, decrees, injunctions
11. ADR & Arbitration Documents (4) — arbitration agreements, awards, mediation

**Progressive Training Methodology — "Build a House":**
Each document type is taught through 6-8 progressive sessions:
1. **Foundation** — What is this document? Legal framework, when it's used (Exercise: identify correct document type)
2. **Anatomy** — Structure, format, court heading, skeleton (Exercise: build document skeleton)
3. **Fact Pattern Analysis** — Extract material facts from client narrative (Exercise: identify & organize facts)
4. **Drafting Core Part 1** — Opening/preliminary sections with specimen language (Exercise: draft opening)
5. **Drafting Core Part 2** — Substantive body, key provisions (Exercise: draft the core)
6. **Closing & Formalities** — Verification, filing, fees, service (Exercise: complete the document)
7. **Full Draft Challenge** — Draft the COMPLETE document from scratch (Exercise: full draft, 50 marks)

**Key Design Principles:**
- Teaching content is **pre-built** (55 training courses stored in database, generated offline with o3)
- Exercise **scenarios are AI-generated fresh each time** — never hardcoded, never repeated
- Student drafts are **AI-graded** using pre-built rubrics with specific criteria per session
- Skills escalate progressively: conceptual → analytical → drafting → full document

#### AI Models Used (2 call sites per exercise)

| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Training content | DB lookup | 🔵 **PREBUILT** — 55 progressive training courses from database | **$0.000** |
| Scenario generation | gpt-4o-mini | Fresh exercise scenario from prebuilt prompt | ~$0.002 |
| Exercise grading | gpt-5.2 (GRADING) | Draft evaluation against prebuilt rubric | ~$0.025 |
| Critique engine | claude-sonnet-4 | CLE-standard document critique (free practice mode) | ~$0.032 |

**Total Drafting AI cost per training session:** ~$0.03  
**Total Drafting AI cost per free practice critique:** ~$0.03–$0.06  
**Trial Limit:** 3 documents (free practice) / 3 training sessions

#### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/ai/chat` | Drafting critique via guardrails (context=drafting) |

---

### 2.4 🏆 QUIZZES — "The Drill Sergeant"
**Flagship: YES** · **Status: Live** · **Page: `/quizzes`** (1,473 lines)

#### What It Does
Comprehensive quiz engine supporting 3 question types, multiple difficulty levels, smart preloading, and detailed performance analytics.

#### How It Works
**3 Question Types:**
1. **MCQ** — Multiple choice with 4 options, AI-generated distractors
2. **Ordering** — Arrange legal steps/elements in correct sequence
3. **Text Entry** — Short written answers requiring legal reasoning

**Key Features:**
- **Difficulty Levels:** Easy / Medium / Hard / Mixed
- **Smart Preloading:** Background question generation via Gemini Flash for instant load times
- **Topic Selection:** Any of 9 ATP units, specific topics within units
- **Performance Tracking:** Per-topic accuracy, time spent, improvement trends
- **Immediate Feedback:** Detailed explanations for correct/incorrect answers

#### AI Models Used (2 call sites)

| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Quiz streaming | gpt-5.2 (ORCHESTRATOR) | Real-time question generation | ~$0.031 |
| Quiz preload | gemini-2.0-flash | Background batch generation | ~$0.001 |

**Total Quiz AI cost per session:** ~$0.02–$0.06  
**Trial Limit:** Unlimited (no gate)

#### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/ai/quiz-stream` | Streaming question generation |
| `/api/preload` | Background quiz precomputation |
| `/api/submit` | Answer submission + grading |
| `/api/questions` | Fetch existing question bank |

---

### 2.5 🏆 STUDY — "The Library"
**Flagship: YES** · **Status: Live** · **Page: `/study`** (808 lines)

#### What It Does
Structured study environment covering all 9 ATP units with AI-generated study materials, depth control, and daily curated case law.

#### How It Works
**9 ATP Units:**
| Unit | Subject |
|------|---------|
| ATP100 | Civil Litigation |
| ATP101 | Criminal Litigation |
| ATP102 | Probate & Administration |
| ATP103 | Legal Writing & Drafting |
| ATP104 | Professional Ethics |
| ATP105 | Trial Advocacy |
| ATP106 | Alternative Dispute Resolution |
| ATP107 | Commercial Transactions |
| ATP108 | Conveyancing |

**Key Features:**
- **3 Depth Levels:** Refresher (quick review) / Standard (comprehensive) / In-Depth (detailed analysis)
- **AI Study Notes:** Generated with RAG grounding against 218,974 cases + 2,942 statutes in the database
- **Case of the Day:** Daily landmark Kenyan case analysis relevant to current study topic
- **Ask AI Mode:** In-context Q&A within any topic
- **Topic Browser:** Hierarchical navigation through syllabus_nodes (297 nodes)

#### AI Models Used (2 call sites)

| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Study notes (quick) | gpt-4o-mini | Fast study note generation | ~$0.002 |
| Case of the Day | gpt-4o-mini | Daily case analysis | ~$0.001 |

**Total Study AI cost per session:** ~$0.003–$0.01  
**Trial Limit:** Unlimited (no gate)

#### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/study/notes` | AI study notes generation |
| `/api/study/case-of-day` | Daily landmark case |
| `/api/study/session` | Study session management |
| `/api/study/session/[id]` | Session detail |
| `/api/study/pacing` | Study pacing + break detection |
| `/api/topics` | Topic list with user progress |

---

## 3. Core Features

These are essential features that complete the platform experience. They are important differentiators but not as AI-intensive as Flagship features.

---

### 3.1 WRITTEN EXAMS — "The Exam Hall"
**Flagship: NO (Core)** · **Status: Live** · **Page: `/exams`** (490 lines)

#### What It Does
Simulates CLE-standard written bar exams with timed conditions, AI-generated questions, and comprehensive scoring.

#### How It Works
**3 Paper Sizes** (matching real Kenya Bar exam format):
- **Mini Paper** — 15 marks, ~20 minutes (quick practice)
- **Semi Paper** — 30 marks, ~40 minutes (half paper)
- **Full Paper** — 60 marks, ~90 minutes (full exam simulation)

**Features:**
- Countdown timer with auto-submission
- AI-generated exam questions per ATP unit
- Essay-format answers with word count
- AI grading with CLE rubric scoring

#### AI Models Used

| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Exam question generation | gpt-5.2 (FAST) | via `/api/preload` | ~$0.016 |
| Essay grading | gpt-5.2 | via `/api/submit` | ~$0.031 |

**Total Exam AI cost per session:** ~$0.05–$0.08

#### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/preload` | Exam paper generation |
| `/api/submit` | Essay submission + AI grading |
| `/api/exams/record` | Record exam results |

---

### 3.2 LEGAL RESEARCH — "The Research Desk"
**Flagship: NO (Core)** · **Status: Live** · **Page: `/research`** (403 lines)

#### What It Does
AI-powered legal research assistant with streaming responses, web search integration, and citation grounding against 218,974+ Kenyan cases and 2,942 statutes.

#### How It Works
- Chat-based interface for legal research queries
- RAG retrieval against Neon PostgreSQL knowledge base (pgvector, 1536-dim embeddings)
- Web search augmentation for current law developments
- Citation grounding: every legal reference verified against the database
- Streaming responses for real-time feedback

#### AI Models Used

| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Research query | gpt-5.2 (MENTOR) | RAG + web search via guardrails | ~$0.031 |
| Authority retrieval (×3) | gpt-5.2 | Case/statute lookup + validation | ~$0.024 ea. |
| Cross-validation | claude-sonnet-4 (AUDITOR) | Accuracy auditing | ~$0.032 |

**Total Research AI cost per query:** ~$0.09–$0.12 (with auditor)

#### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/ai/chat` | Research via guardrails (context=research) |
| `/api/citations/lookup` | Case/statute database lookup |

---

### 3.3 FLOATING CHAT — "The Omnipresent Assistant"
**Flagship: NO (Core)** · **Status: Live** · **Component: `FloatingChat.tsx`** (673 lines)

#### What It Does
Draggable floating chat bubble accessible from every page in the application. Context-aware AI assistant that can help with any study topic, explain concepts, or assist with navigation.

#### How It Works
**3 Intelligence Modes:**
1. **Standard** — gpt-4o-mini: Fast, cost-effective for general questions
2. **Smart** — gpt-5.2: Deeper reasoning for complex legal analysis
3. **Image** — gpt-4o: Vision-capable for analyzing uploaded images (past papers, notes, etc.)

**Features:**
- Voice recording with transcription (whisper-1)
- File/image attachment support
- Context-aware sessions (knows what page you're on)
- Streaming responses
- Draggable position on screen
- Custom events integration (`ynai:openChat`)

#### AI Models Used (3 call sites + voice)

| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Standard chat | gpt-4o-mini | General Q&A | ~$0.0007 |
| Smart mode | gpt-5.2 (ORCHESTRATOR) | Deep analysis | ~$0.031 |
| Image mode | gpt-4o | Vision analysis | ~$0.015 |
| Voice input | whisper-1 | Speech transcription | ~$0.006 |

**Total Chat AI cost per day:** ~$0.01–$0.15 (depends on mode usage)

#### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/ai/chat-stream` | Streaming chat (all 3 modes) |
| `/api/transcribe` | Voice transcription |
| `/api/chat/sessions` | Chat history management |

---

### 3.4 PROGRESS & ANALYTICS — "The Report Card"
**Flagship: NO (Core)** · **Status: Live** · **Page: `/progress`** (599 lines)

#### What It Does
Comprehensive analytics dashboard showing mastery progress, study time analysis, quiz performance, exam format scores, per-unit breakdowns, strengths/weaknesses, and exam readiness projections.

#### How It Works
**Analytics Sections:**
- **Overall Mastery Score** — Aggregate across all 430 micro-skills
- **Study Time Analysis** — Minutes/sessions/week-over-week trends, current streak
- **Quiz Performance** — Total questions, accuracy rate, session count
- **Exam Format Scores** — Written/Oral/Drafting average scores
- **Per-Unit Breakdown** — Mastery %, verified skills count, quiz accuracy per ATP unit
- **Strengths & Weaknesses** — Top-performing and struggling micro-skills
- **Activity Chart** — 7-day activity heatmap (minutes, questions, sessions)
- **Exam Projection** — Days until exam, topics covered vs remaining, on-track indicator

#### AI Models Used
**None** — Pure database aggregation (zero AI cost)

#### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/progress` | Topic-level progress |
| `/api/progress/report` | Full analytics report |

---

### 3.5 AI TUTOR / STUDY GUIDE — "The Personal Tutor"
**Flagship: NO (Core)** · **Status: Live** · **Page: `/tutor`** (580 lines)

#### What It Does
AI-generated daily study plan with prioritized items, case recommendations, and progress tracking. Acts as the student's personal study advisor.

#### How It Works
**Daily Study Plan includes:**
- Prioritized study items (reading, case studies, practice questions, quizzes, review, drafting, research)
- Estimated time per item
- AI rationale for why each item matters
- Case law recommendations with citations
- Today's statistics (items completed, minutes studied, reviews due, streak)
- Time-based greeting personalization

**Features:**
- Items can be marked complete, in-progress, or skipped
- Spaced repetition review cards
- Cached study guide recommendations

#### AI Models Used

| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Smart suggestions | gpt-5.2 (ORCHESTRATOR) | Study item recommendations | ~$0.031 |

**Total Tutor AI cost per day:** ~$0.02 (suggestions generated once/day)

#### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/tutor/today` | Today's items + stats |
| `/api/tutor/guide` | AI recommendations (cached) |
| `/api/tutor/plan` | Study plan CRUD |
| `/api/tutor/review` | Spaced repetition cards |

---

### 3.6 ONBOARDING — "The First Impression"
**Flagship: NO (Core)** · **Status: Live** · **Page: `/onboarding`** (811 lines)

#### What It Does
Multi-step questionnaire that profiles the student and generates a personalized study plan. Called the "Senior Partner" analysis — mimics a senior advocate personally assessing a pupil.

#### How It Works
**Data Collected:**
- Name, occupation (student/graduate/paralegal/advocate/career changer)
- Years in law (0 to 5+)
- Bar exam history (first attempt vs resitter, number of attempts)
- Law school attended
- Study preferences (time of day, daily/weekend hours, commitment level)
- Learning style
- Self-assessed confidence level
- Weak units and strong units (self-selected from 9 ATP units)
- Biggest challenge (understanding concepts, time management, exam technique, etc.)
- Goal and target exam date
- Mentorship interest

**AI Analysis:**
- All responses sent to gpt-5.2 (ORCHESTRATOR) for "Senior Partner" analysis
- Generates personalized study plan seeded into the mastery engine
- Sets exam track: FIRST_TIME or RESIT (controls Path A vs Path B in Mastery Hub)

#### AI Models Used (1 call site — one-time per user)

| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Onboarding analysis | gpt-5.2 (ORCHESTRATOR) | Profile analysis + plan seeding | ~$0.016 |

**Total Onboarding AI cost:** ~$0.011 (one-time only)

#### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/onboarding` | Senior Partner analysis |
| `/api/onboarding/exam` | Exam track selection |

---

## 4. Supporting Features

These features enhance the platform experience but are not primary study tools. Lower AI intensity or zero AI cost.

---

### 4.1 CLARIFY — "The Quick Question"
**Flagship: NO (Supporting)** · **Status: Live** · **Page: `/clarify`** (543 lines)

#### What It Does
Focused Q&A interface for quick legal concept clarification. Supports text, image upload, voice recording, and document attachments.

#### How It Works
- Chat-based interface optimized for quick questions
- Supports multimodal input: text, images, audio recordings, documents
- Voice recording with real-time transcription (whisper-1)
- Streaming AI responses
- Session-based context awareness
- Uses guardrails system for grounded responses

#### AI Models Used (via guardrails — shared with research/chat)

| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Clarification query | gpt-5.2 (MENTOR) | Grounded legal explanation | ~$0.031 |
| Voice input | whisper-1 | Speech transcription | ~$0.006 |

**Total per query:** ~$0.02–$0.03

---

### 4.2 COMMUNITY — "The Common Room"
**Flagship: NO (Supporting)** · **Status: Live** · **Page: `/community`** (1,960 lines — largest page)

#### What It Does
Full social learning platform with chat rooms, friends, discussion threads, and AI-generated study challenges with competitive rankings.

#### How It Works
**Sub-features:**
- **Chat Rooms** — Official (9 ATP unit rooms) + custom student-created rooms with moderation
- **Friends System** — Friend requests, suggestions based on study overlap, direct messaging
- **Discussion Threads** — Forum-style Q&A on legal topics with replies
- **Community Challenges** — AI-generated weekly challenges with submission, review, grading, and rankings
- **Events & Rankings** — Weekly leaderboards, challenge participation tracking

#### AI Models Used (3 call sites)

| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Challenge generation | gpt-4o-mini | Weekly challenge creation | ~$0.003 |
| Challenge review | gpt-4o-mini | Submission review | ~$0.0004 |
| Challenge grading | gpt-4o-mini | Score + feedback | ~$0.001 |

**Total AI cost:** ~$0.004/user/week (very low — challenges are shared)

#### API Endpoints (9 routes)
`/api/community/events`, `/api/community/threads`, `/api/community/threads/replies`, `/api/community/rooms`, `/api/community/rooms/request`, `/api/community/rooms/[roomId]/messages`, `/api/community/friends`, `/api/community/rankings`, `/api/community/username`

---

### 4.3 LEGAL BANTER — "The Fun Corner"
**Flagship: NO (Supporting)** · **Status: Live** · **Page: `/banter`** (625 lines)

#### What It Does
Legal entertainment with 6 categories of fun content. Designed to keep students engaged and provide lighter study breaks.

#### How It Works
**6 Content Categories:**
1. **Legal Jokes** — AI-generated lawyer jokes relevant to Kenyan legal practice
2. **Fun Facts** — Obscure legal facts from around the world
3. **Wild Cases** — Real bizarre court cases with analysis
4. **Legal Puns** — Wordplay with legal terminology
5. **World Laws** — Strange laws from different countries
6. **Pop Culture & Law** — Law in movies, TV, books

**Features:**
- Rating system (users rate content quality)
- Fresh content on each visit (AI-generated)
- Category filtering

#### AI Models Used (1 call site)

| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Banter content | gpt-5.2 (FAST) | Entertainment generation | ~$0.003 |

**Total AI cost:** ~$0.002–$0.006/session

#### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/ai/banter` | Content generation |

---

### 4.4 HISTORY — "The Timeline"
**Flagship: NO (Supporting)** · **Status: Live** · **Page: `/history`** (399 lines)

#### What It Does
Complete activity audit trail showing all user actions across every feature with time tracking.

#### How It Works
- Logs page visits across all sections
- Tracks time spent per feature (via `useTimeTracker` hook)
- Displays activity history in chronological order
- Filterable by feature/date
- Session duration tracking

#### AI Models Used
**None** — Pure database reads (zero AI cost)

#### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/history` | Activity log retrieval |
| `/api/page-visits` | Page visit tracking |

---

### 4.5 DASHBOARD — "Home Base"
**Flagship: NO (Supporting)** · **Status: Live** · **Page: `/dashboard`** (458 lines)

#### What It Does
Central hub page with navigation cards to all features, quick stats, streak display, study recommendations, and user profile summary.

#### How It Works
- Module cards linking to all 12+ features
- Quick stats: questions attempted, correct, accuracy percentage
- Current streak display
- Mastery level and weak area highlights
- Study recommendations
- Welcome personalization

#### AI Models Used
**None** — Pure data aggregation (zero AI cost)

#### API Endpoints
Uses `/api/streaks`, `/api/progress`, `/api/mastery/readiness` (all DB-only)

---

### 4.6 SUBSCRIBE — "The Paywall"
**Flagship: NO (Supporting)** · **Status: Live** · **Page: `/subscribe`** (448 lines)

#### What It Does
Subscription management page with plan selection, Paystack payment integration, and plan comparison.

#### How It Works
- 3 paid plans displayed with feature comparisons
- Paystack checkout redirect (supports card + M-Pesa/mobile money)
- Current plan status display
- Plan upgrade/downgrade flow

#### AI Models Used
**None** — Payment integration only (zero AI cost)

#### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/payments/initialize` | Create Paystack transaction |
| `/api/payments/verify` | Verify payment + activate |
| `/api/payments/webhook` | Paystack webhook handler |
| `/api/payments/status` | Current subscription status |

---

## 5. Infrastructure & Admin

---

### 5.1 ADMIN PANEL
**Internal** · **Page: `/admin`** (1,145 lines)

#### What It Does
Platform administration with analytics dashboard, content management, and system controls.

**Capabilities:**
- Platform-wide analytics (users, sessions, scores, completion rates)
- Topic CRUD management
- Question bank management
- Micro-skill management (430 skills)
- Practice item management (6,615 items)
- RAG knowledge base entries management (33 entries)
- Lecture transcript management + skill mapping
- KSL exam timeline management
- Community room request moderation
- Background job monitoring
- Feature flag management

#### 12 API Endpoints
`/api/admin/analytics`, `/api/admin/settings`, `/api/admin/topics`, `/api/admin/questions`, `/api/admin/skills`, `/api/admin/items`, `/api/admin/item-skill-map`, `/api/admin/knowledge`, `/api/admin/transcripts`, `/api/admin/transcripts/mappings`, `/api/admin/timelines`, `/api/admin/community`, `/api/admin/jobs`

---

### 5.2 NOTIFICATION SYSTEM
**Background** · **Component: `NotificationBell.tsx`** (175 lines) + **Service: `notification-service.ts`** (~700 lines)

#### What It Does
Multi-channel notification system with email (Brevo), push notifications (VAPID), and in-app toast alerts.

**Email Templates (7):**
1. **WELCOME** — Sent on signup
2. **DAILY_REMINDER** — Personalized with actual next unit/topic from syllabus
3. **MISSED_DAY** — Triggered after inactive day
4. **SESSION_READY** — Study session prepared
5. **EXAM_COUNTDOWN** — Days to exam alerts
6. **WEEKLY_REPORT** — Weekly progress summary
7. **FUN_FACT** — Curated Kenyan law fun fact (10 facts rotating)

**In-App Notifications:**
- Study nudges, mastery milestones, streak alerts, exam countdowns, diagnosis alerts

#### AI Models Used
**None** — Template-based (zero AI cost)  
**Brevo Cost:** Free tier (300 emails/day)

---

### 5.3 CRON / BACKGROUND WORKERS
**Background** · **Endpoint: `/api/cron/tick`**

#### What It Does
Scheduled tasks runner triggered by UptimeRobot keepalive (also keeps Render free tier alive).

**Tasks:**
- `processReminderTick()` — Daily personalized email reminders
- `processWeeklyReports()` — Weekly progress email reports
- `processFunFactEmails()` — Fun fact email distribution
- Quiz preloading — Background question generation
- Session cleanup

#### AI Models Used
**None directly** — Triggers services that may use AI

---

### 5.4 PWA (Progressive Web App)
**Infrastructure** · **Files: `manifest.json`, `sw.js`**

#### What It Does
Installable progressive web app with offline capability, push notifications, and home screen installation prompt.

#### AI Models Used
**None** (zero cost)

---

### 5.5 PUBLIC PAGES
**Marketing** · **Pages: `/`, `/about`, `/pricing`, `/privacy`, `/terms`, `/disclaimer`**

Static marketing and legal pages. Zero AI cost.

---

## 6. AI Model Inventory & Costs

### Models in Use

| # | Model | Provider | Pricing (Input/Output per 1M tokens) | Call Sites | % of AI Cost |
|---|-------|----------|---------------------------------------|------------|-------------|
| 1 | **gpt-5.2** | OpenAI | **$1.75 / $14.00** | 16 (was 18; 2 now prebuilt) | **~85%** |
| 2 | **gpt-4o-mini** | OpenAI | $0.15 / $0.60 | 11 | ~4% |
| 3 | **gpt-4o** | OpenAI | $2.50 / $10.00 | 1 (rare) | <1% |
| 4 | **claude-sonnet-4** | Anthropic | $3.00 / $15.00 | 2 | ~5% |
| 5 | **gemini-2.0-flash** | Google | $0.10 / $0.40 | 1 | <1% |
| 6 | **whisper-1** | OpenAI | $0.006/minute | 3 | ~2% |
| 7 | **tts-1** | OpenAI | $15.00/1M chars | 1 | ~1% |
| 8 | **o3** | OpenAI | $2.00 / $8.00 | Offline generation only | $0 per-user |

> **⚠️ PRICING CORRECTION:** gpt-5.2 pricing is **$1.75 / $14.00** per 1M tokens (input/output), not $2.00 / $8.00 as previously reported. The higher output price ($14.00 vs $8.00) increases per-call costs by ~55%, but this is more than offset by the prebuilt content strategy which eliminates the two most expensive call sites entirely.

### Model Role Assignments (from `model-config.ts`)

| Config Role | Model | Used By |
|-------------|-------|---------|
| ORCHESTRATOR_MODEL | gpt-5.2 | Mastery pacing, queue, chat (smart), quiz, suggestions, onboarding, agentic tools |
| MENTOR_MODEL | gpt-5.2 | Study notes, narrative rendering, research, clarification |
| AUDITOR_MODEL | claude-sonnet-4 | Cross-validation, drafting critique |
| ASSESSMENT_MODEL | gpt-5.2 | Assessment + checkpoint generation |
| GRADING_MODEL | gpt-5.2 | Answer grading across all features |
| FAST_MODEL | gpt-5.2 | Fast preload, banter, quick responses |

---

## 7. Complete AI Call Site Register

### All 38 AI Call Sites

| # | Feature Area | Call Site | Model | Per-Call Cost | Calls/Day (Active User) |
|---|-------------|-----------|-------|---------------|------------------------|
| 1 | Chat | Standard chat | gpt-4o-mini | $0.0007 | 5–15 |
| 2 | Chat | Smart mode | gpt-5.2 | $0.031 | 1–3 |
| 3 | Chat | Image mode | gpt-4o | $0.015 | 0–1 |
| 4 | Chat | Non-streaming | guardrails | varies | varies |
| 5 | Mastery | Study notes | **DB lookup** | **$0.000** 🔵 | 0 (prebuilt) |
| 6 | Mastery | Narrative renderer | **DB lookup** | **$0.000** 🔵 | 0 (prebuilt) |
| 7 | Mastery | Practice items | gpt-5.2 | $0.031 | 3–8 |
| 8 | Mastery | Assessment gen | gpt-5.2 | $0.031 | 1–2 |
| 9 | Mastery | Checkpoint gen | gpt-5.2 | $0.023 | 0–1 |
| 10 | Mastery | Grading | gpt-5.2 | $0.025 | 2–5 |
| 11 | Mastery | Pacing decision | gpt-5.2 | $0.009 | 1–3 |
| 12 | Mastery | Queue reorder | gpt-5.2 | $0.011 | 0–1 |
| 13 | Oral | Devil's Advocate (stream) | gpt-4o-mini | $0.0006 | 5–15/session |
| 14 | Oral | Devil's Advocate (non-stream) | gpt-4o-mini | $0.0006 | 5–15/session |
| 15 | Oral | 3-Panel (stream) | gpt-4o-mini | $0.0006 | 5–15/session |
| 16 | Oral | 3-Panel (non-stream) | gpt-4o-mini | $0.0006 | 5–15/session |
| 17 | Oral | Session summary | gpt-4o-mini | $0.001 | 1/session |
| 18 | Quiz | Quiz streaming | gpt-5.2 | $0.031 | 1–3 |
| 19 | Quiz | Quiz preload | gemini-2.0-flash | $0.001 | 1–2 |
| 20 | Study | Quick notes | gpt-4o-mini | $0.002 | 1–2 |
| 21 | Study | Case of Day | gpt-4o-mini | $0.001 | 0–1 |
| 22–24 | Research | Authority retrieval (×3) | gpt-5.2 | $0.024 ea. | 0–3 |
| 25 | Research | Mentor + web search | gpt-5.2 | $0.031 | 1–3 |
| 26 | Research | Auditor validation | claude-sonnet-4 | $0.032 | 1–2/session |
| 27–28 | Guardrails | Agentic tool-use (×2) | gpt-5.2 | $0.033 ea. | 0–2 |
| 29 | Preload | Fast preload | gpt-5.2 | $0.016 | 1–2 |
| 30 | Community | Challenge generation | gpt-4o-mini | $0.003 | 0–1 |
| 31 | Community | Challenge review | gpt-4o-mini | $0.0004 | 0–1 |
| 32 | Community | Challenge grading | gpt-4o-mini | $0.001 | 0–2 |
| 33 | Drafting | Training scenario gen | gpt-4o-mini | $0.002 | 1–2/session |
| 33b | Drafting | Exercise grading | gpt-5.2 | $0.025 | 1–2/session |
| 33c | Drafting | Critique engine | claude-sonnet-4 | $0.032 | 1–2/session |
| 34 | Voice | STT (chat) | whisper-1 | $0.006 | 0–2 |
| 35 | Voice | STT (oral) | whisper-1 | $0.006 | 0–3 |
| 36 | Voice | TTS | tts-1 | $0.008 | 0–3 |
| 37 | Onboarding | Senior Partner analysis | gpt-5.2 | $0.016 | 1 (once) |
| 38 | Banter | Entertainment content | gpt-5.2 | $0.003 | 0–3 |

> 🔵 = **Prebuilt content** — served from database at $0 per-user cost. Generated offline using gpt-5.2/o3 as a one-time investment.

---

## 8. Cost Scenarios Per User

### Scenario A: Light User (~30 min/day, basic features)

| Feature | Daily AI Calls | Daily Cost |
|---------|---------------|------------|
| Standard chat (5×) | 5 | $0.004 |
| Study notes (1×) | 1 | $0.002 |
| Quiz session (1×) | 1 | $0.031 |
| Mastery (light — reads prebuilt notes + 1 practice) | 3 | $0.065 |
| **Daily Total** | | **$0.102** |
| **Monthly Total (30 days)** | | **$3.06** |

> Note: Mastery Hub light usage = pacing ($0.009) + prebuilt notes ($0) + 1 practice item ($0.031) + 1 grading ($0.025). Notes reading is free thanks to prebuilt content.

### Scenario B: Moderate User (~1–2 hrs/day, multiple features)

| Feature | Daily AI Calls | Daily Cost |
|---------|---------------|------------|
| Standard chat (10×) | 10 | $0.007 |
| Smart chat (2×) | 2 | $0.062 |
| Mastery Hub (full session — prebuilt notes) | 6 | $0.138 |
| Study notes (2×) | 2 | $0.004 |
| Quiz session (2×) | 2 | $0.062 |
| Oral exam (voice, 1×/week) | 0.14 | $0.029 |
| Research query (1×) | 3 | $0.087 |
| Drafting training (1×/week) | 0.14 | $0.004 |
| Case of Day | 1 | $0.001 |
| Banter (1×) | 1 | $0.003 |
| Preload | 1 | $0.016 |
| Tutor suggestions | 1 | $0.031 |
| Community | 0.14 | $0.001 |
| **Daily Total** | | **$0.445** |
| **Monthly Total (30 days)** | | **$13.38** |

> Note: Mastery Hub cost reduced from $0.153 to $0.138 per session despite corrected (higher) gpt-5.2 pricing, thanks to prebuilt notes eliminating 2 AI calls. Without prebuilt content, the corrected Mastery cost would have been ~$0.251/session.

### Scenario C: Heavy User (~3+ hrs/day, power user)

| Feature | Daily AI Calls | Daily Cost |
|---------|---------------|------------|
| Standard chat (15×) | 15 | $0.011 |
| Smart chat (3×) | 3 | $0.093 |
| Image chat (1×) | 1 | $0.015 |
| Mastery Hub (deep — prebuilt notes) | 13 | $0.335 |
| Study notes (3×) | 3 | $0.006 |
| Quiz sessions (3×) | 3 | $0.093 |
| Oral exams (voice, 3×/week) | 0.43 | $0.086 |
| Research queries (3×) | 9 | $0.261 |
| Drafting training (3×/week) | 0.43 | $0.012 |
| Written exams (1×) | 2 | $0.047 |
| Case of Day | 1 | $0.001 |
| Banter (3×) | 3 | $0.009 |
| Preload (2×) | 2 | $0.032 |
| Tutor suggestions | 1 | $0.031 |
| Community challenges | 0.43 | $0.002 |
| Voice (STT+TTS, 5×) | 5 | $0.034 |
| **Daily Total** | | **$1.068** |
| **Monthly Total (30 days)** | | **$32.04** |

> Note: Heavy user costs increased due to corrected gpt-5.2 pricing ($14.00/1M output vs. previously reported $8.00). However, the 3-tier pricing system with **weekly feature limits** caps actual costs significantly — Premium tier limits all premium features to 6/week, Standard to 4/week, Light to 2–3/week, preventing unlimited usage of the most expensive features.

---

## 9. Current Pricing vs. Actual Cost

### Updated 3-Tier Pricing Structure (IMPLEMENTED)

| Tier | KES/Week | KES/Month | KES/Year | USD/Month (@ 130 KES/$) |
|------|----------|-----------|----------|-------------------------|
| Free Trial | — | — | — | $0 (3 days) |
| **Light** | 500 | 1,500 | 12,000 | $11.54 |
| **Standard** | 700 | 2,000 | 16,000 | $15.38 |
| **Premium** | 850 | 2,500 | 20,000 | $19.23 |

**Weekly Feature Limits (Premium features gated per tier):**

| Feature | Free Trial | Light | Standard | Premium | Custom |
|---------|-----------|-------|----------|---------|--------|
| Legal Drafting | 3/week | 3/week | 4/week | 6/week | 3/week* |
| Oral Exams | 2/week | 2/week | 4/week | 6/week | 3/week* |
| Devil's Advocate | 2/week | 2/week | 4/week | 6/week | 3/week* |
| CLE Exams | 0 | 3/week | 4/week | 6/week | 3/week* |
| Legal Research | 0 | 2/week | 4/week | 6/week | 3/week* |
| Get Clarification | 0 | 3/week | 4/week | 6/week | 3/week* |
| Clarify AI Model | GPT-4o Mini | GPT-4o Mini | GPT-4o Mini | **GPT-5.2** | GPT-4o Mini |
| Add-on passes | ❌ | ✅ | ✅ | ✅ | ✅ |
| Drafting daily cap | — | 2 attempts/day per doc | 2 attempts/day per doc | 2 attempts/day per doc | 2 attempts/day per doc |

*\*Custom: 3/week per selected feature only. Users pick à la carte.*

**Custom Package Pricing (per feature, KES):**

| Feature | Weekly | Monthly | Annual |
|---------|--------|---------|--------|
| Legal Drafting | 120 | 350 | 2,800 |
| Oral Examination | 100 | 300 | 2,400 |
| Devil's Advocate | 100 | 300 | 2,400 |
| CLE Exams | 85 | 250 | 2,000 |
| Legal Research | 100 | 300 | 2,400 |
| Get Clarification | 70 | 200 | 1,600 |

**Add-on Pass Pricing (KES):**

| Feature | Single Pass | 5-Pack (save ~20%) |
|---------|------------|-------------------|
| Drafting | 100 | 400 |
| Oral Exam | 100 | 400 |
| Devil's Advocate | 100 | 400 |
| CLE Exams | 80 | 350 |
| Research | 80 | 350 |
| Clarify | 50 | 200 |

> Basic features (Mastery Hub, Study, Quizzes, Community, Banter, Progress, Dashboard, Reports, AI Tutor) are **unlimited** across all tiers including Custom.

### Margin Analysis Per Tier (Monthly Plan)

| Tier | Revenue/Month | Light User ($3.06) | Moderate User ($13.38) | Heavy User ($32.04) |
|------|--------------|--------------------|-----------------------|---------------------|
| **Light** (KES 1,500) | $11.54 | +$8.48 (+277%) | **-$1.84 (-16%)** | **-$20.50 (-178%)** |
| **Standard** (KES 2,000) | $15.38 | +$12.32 (+403%) | **+$2.00 (+15%)** ✅ | **-$16.66 (-108%)** |
| **Premium** (KES 2,500) | $19.23 | +$16.17 (+528%) | **+$5.85 (+44%)** ✅ | **-$12.81 (-67%)** |

### Critical Finding (Updated)

| User Type | Est. % of Users | Standard Tier Profitable? | Premium Tier Profitable? |
|-----------|-----------------|---------------------------|-------------------------|
| Light | ~30% | ✅ Yes (+$12.32) | ✅ Yes (+$16.17) |
| Moderate | ~50% | ✅ **Yes (+$2.00)** | ✅ **Yes (+$5.85)** |
| Heavy | ~20% | ❌ No (-$16.66) | ❌ No (-$12.81) |

> **Key change vs. original report:** Moderate users (50% of the base) are now **profitable** on both Standard and Premium tiers, thanks to: (1) prebuilt content reducing Mastery Hub costs by 46%, (2) tiered pricing increasing revenue, (3) weekly feature limits capping heavy user costs.

**Blended margin assuming 30/50/20 user split across tiers (40% Light / 40% Standard / 20% Premium):**

Weighted ARPU: (0.40 × $11.54) + (0.40 × $15.38) + (0.20 × $19.23) = **$14.62/user/month**

Weighted cost: (0.30 × $3.06) + (0.50 × $13.38) + (0.20 × $32.04) = **$14.01/user/month**

> Blended margin: $14.62 - $14.01 = **+$0.61/user/month (+4.2% margin)**

With weekly feature limits capping heavy users to ~$25/month:
> Blended cost: (0.30 × $3.06) + (0.50 × $13.38) + (0.20 × $25.00) = **$12.61/user/month**  
> Blended margin: $14.62 - $12.61 = **+$2.01/user/month (+13.7% margin)**

**At 200 subscribers: +$122 to +$402/month PROFIT**  
**At 500 subscribers: +$305 to +$1,005/month PROFIT**

---

## 10. Pricing Implications & Recommendations

### Actions Taken Since Original Report

Three major cost optimizations have been implemented:

#### ✅ Action 1: Prebuilt Content Strategy (IMPLEMENTED)

The two most expensive per-user call sites — study notes generation ($0.060/call at correct pricing) and narrative rendering ($0.053/call) — have been **eliminated from per-user costs entirely** by pre-generating all content offline:

| Asset | Count | Model Used | One-Time Cost | Ongoing Per-User Cost |
|-------|-------|------------|---------------|-----------------------|
| Prebuilt study notes | 297 (all syllabus nodes) | gpt-5.2 | ~$18 | **$0.000** |
| Prebuilt drafting training courses | 55 (all document types) | o3 | ~$30 (est.) | **$0.000** |

**Impact:** Mastery Hub session cost reduced by 46% — from $0.251 (corrected) to $0.138. This single strategy absorbed the entire impact of the pricing correction and still came out cheaper.

#### ✅ Action 2: 3-Tier Pricing with Weekly Limits (IMPLEMENTED)

Replaced the single-tier pricing with Light ($11.54) / Standard ($15.38) / Premium ($19.23) monthly tiers plus a **Custom à-la-carte builder**. Premium features (Drafting, Oral Exams, Devil's Advocate, CLE Exams, Research, Clarify) are gated by **weekly usage limits** per tier (3/2→4→6), preventing unlimited consumption of expensive AI features. Users can also **buy add-on passes** for extra sessions or **build custom packages** selecting only the features they need.

**Light**: 2–3/week per feature · **Standard**: 4/week all features · **Premium**: 6/week all features + GPT-5.2 for clarify · **Custom**: 3/week per selected feature

**Impact:** Moderate users on Standard tier now generate +$2.00/month margin (was -$2.53 loss). Weekly limits cap heavy user costs significantly. Feature locking screens proactively gate premium feature tabs when usage is exhausted or subscription tier doesn't include the feature.

#### ✅ Action 3: Progressive Drafting Training (IMPLEMENTED)

Replaced static drafting critique with a full 7-session progressive training course per document type. Teaching content is prebuilt; only scenario generation (gpt-4o-mini, $0.002) and exercise grading (gpt-5.2, $0.025) require live AI — approximately the same cost as the old critique but delivering dramatically more value.

### Remaining Optimization Opportunity: Model Downgrade

Downgrade 6 of 16 remaining gpt-5.2 call sites to gpt-4o-mini where frontier reasoning isn't needed:

| Call Site | Current Model | Proposed Model | Savings/Call | Quality Impact |
|-----------|---------------|----------------|-------------|----------------|
| Pacing decision (#11) | gpt-5.2 | gpt-4o-mini | $0.008 | Low — algorithmic task |
| Queue reorder (#12) | gpt-5.2 | gpt-4o-mini | $0.010 | Low — sorting task |
| Fast preload (#29) | gpt-5.2 | gpt-4o-mini | $0.015 | Low — batch generation |
| Checkpoint gen (#9) | gpt-5.2 | gpt-4o-mini | $0.022 | Low — structured output |
| Banter (#38) | gpt-5.2 | gpt-4o-mini | $0.002 | None — entertainment |
| Onboarding (#37) | gpt-5.2 | gpt-4o-mini | $0.015 | Low — one-time analysis |

**Estimated additional savings if implemented: ~$1.50–$2.00/moderate user/month**

With model optimization applied on top of prebuilt content + tiered pricing:
> Moderate user cost: ~$11.50/month → Standard tier margin: +$3.88 (+25%)
> Blended margin with weekly limits: **+$3.50–$4.00/user/month (+24–27%)**

---

## Feature Summary Table — Complete At-A-Glance

| # | Feature | Category | AI Models | AI Cost/Session | Gated? | Page |
|---|---------|----------|-----------|----------------|--------|------|
| 1 | Mastery Hub | 🏆 Flagship | gpt-5.2 (6 active + 2 prebuilt) | $0.07–$0.25 | No (unlimited) | `/mastery` |
| 2 | Oral Exams | 🏆 Flagship | gpt-4o-mini, whisper-1, tts-1 | $0.04–$0.40 | ✅ 2–6/wk | `/oral-exams` |
| 3 | Legal Drafting | 🏆 Flagship | gpt-4o-mini + gpt-5.2 + claude-sonnet-4 | $0.03 (training) / $0.03–$0.06 (practice) | ✅ 3–6/wk | `/drafting` |
| 4 | Quizzes | 🏆 Flagship | gpt-5.2, gemini-flash | $0.03–$0.06 | No (unlimited) | `/quizzes` |
| 5 | Study | 🏆 Flagship | gpt-4o-mini | $0.003–$0.01 | No (unlimited) | `/study` |
| 6 | CLE Exams | ⭐ Core | gpt-5.2 | $0.05–$0.08 | ✅ 0–6/wk | `/exams` |
| 7 | Legal Research | ⭐ Core | gpt-5.2, claude-sonnet-4 | $0.09–$0.12 | ✅ 0–6/wk | `/research` |
| 8 | Floating Chat | ⭐ Core | gpt-4o-mini/gpt-5.2/gpt-4o | $0.01–$0.15 | No (unlimited) | (global) |
| 9 | Progress | ⭐ Core | None | $0 | No | `/progress` |
| 10 | AI Tutor | ⭐ Core | gpt-5.2 | $0.02 | No (unlimited) | `/tutor` |
| 11 | Onboarding | ⭐ Core | gpt-5.2 | $0.011 (once) | No | `/onboarding` |
| 12 | Clarify | 🔧 Supporting | gpt-5.2/gpt-4o-mini (tier-dependent) | $0.02–$0.03 | ✅ 0–6/wk | `/clarify` |
| 13 | Community | 🔧 Supporting | gpt-4o-mini | $0.004/week | No (unlimited) | `/community` |
| 14 | Legal Banter | 🔧 Supporting | gpt-5.2 | $0.003 | No (unlimited) | `/banter` |
| 15 | History | 🔧 Supporting | None | $0 | No | `/history` |
| 16 | Dashboard | 🔧 Supporting | None | $0 | No | `/dashboard` |
| 17 | Subscribe | 🔧 Supporting | None | $0 | No | `/subscribe` |

**Infrastructure (zero user-facing AI cost):**

| # | System | Purpose | Cost |
|---|--------|---------|------|
| 18 | Admin Panel | Content management, analytics, moderation | $0 |
| 19 | Notifications | Email (Brevo), push (VAPID), in-app | Brevo free tier |
| 20 | Payments | Paystack integration (card + M-Pesa) | 1.5% + KES 100 per transaction |
| 21 | PWA | Installable progressive web app | $0 |
| 22 | Cron/Workers | Background jobs, preloading, emails | $0 |
| 23 | Voice I/O | STT (whisper-1) + TTS (tts-1) shared service | Per-use (see call sites) |
| 24 | Citations | Case/statute DB lookup (218,974 cases, 2,942 statutes) | $0 (DB query) |
| 25 | Spaced Repetition | SM-2 algorithm for review scheduling | $0 (algorithmic) |
| 26 | Streaks | Daily engagement tracking | $0 (DB) |
| 27 | Page Visits | Time-on-page analytics | $0 (DB) |

---

### Database Assets

| Asset | Count | Source |
|-------|-------|--------|
| Cases (Kenyan law) | 218,974 | Seeded |
| Statutes | 2,942 | Seeded |
| Syllabus nodes | 297 | 9 ATP units |
| **Prebuilt study notes** | **297** | **gpt-5.2 + RAG (v1 complete)** |
| **Prebuilt drafting training courses** | **55** | **o3 progressive sessions (v1)** |
| Knowledge base (RAG) | 33 | Admin-curated |
| Micro-skills | 430 | Admin-mapped |
| Practice items | 6,615 | Generated + curated |
| Registered users | 26 | Early access |

---

### Prebuilt Content Investment Summary

| Content Type | Count | Model | One-Time Cost | Per-User Savings |
|-------------|-------|-------|---------------|------------------|
| Study Notes (Mastery Hub) | 297 notes (v1) | gpt-5.2 | ~$18 | Eliminates $0.060+$0.053 per Mastery session |
| Drafting Training Courses | 55 courses (v1) | o3 | ~$30 est. | 55 progressive courses with exercises + rubrics |
| **Total one-time investment** | | | **~$48** | **Saves ~$0.113 per Mastery session per user** |

At 200 active subscribers doing 1 Mastery session/day:
- Monthly savings: 200 × 30 × $0.113 = **$678/month saved**
- ROI on $48 investment: **payback in < 2 hours of platform usage**

---

*End of Board Report — YNAI Complete System Feature Catalog*  
*Prepared for pricing review and strategic planning*  
*Updated: July 2025 — Pricing correction, prebuilt content strategy, 3-tier pricing*
