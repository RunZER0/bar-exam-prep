# YNAI — Complete System Feature Report
### Board Meeting Document · Pricing Review Edition
**Platform:** ynai.co.ke — Kenya Bar Exam Preparation  
**Architecture:** Next.js 14.2.35 · Neon PostgreSQL (pgvector) · Firebase Auth · Paystack · Render  
**Market:** ~2,200 KSL students/cohort + ~900 resitters · 9 ATP units · 3 terms × 11 weeks  
**Report Date:** March 2026

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

YNAI is a comprehensive AI-powered Kenya Bar Exam preparation platform with **16 user-facing features**, **70+ API endpoints**, **38 distinct AI call sites**, and **5 AI model families**. The platform covers the entire bar preparation journey — from onboarding through mastery, practice, examination simulation, and community engagement.

### Key Numbers at a Glance

| Metric | Count |
|--------|-------|
| User-facing features | 16 |
| Flagship features (heavy AI) | 5 |
| Core features | 5 |
| Supporting features | 6 |
| API endpoints | 70+ |
| AI call sites | 38 |
| AI models in use | 6 (across 5 families) |
| Database tables | 30+ |
| Infrastructure cost | $0 (all free tier) |
| Prebuilt study notes | 297 (all syllabus nodes, v1) |
| Prebuilt drafting training courses | 55 (all document types, v1) |
| AI cost per moderate user/month | **$8.49** |
| Monthly subscription revenue (Standard) | **$15.38** (KES 2,000) |
| **Net margin per moderate user (Standard)** | **+45% (PROFITABLE)** |

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
| Practice item generation | gpt-5.2 | MCQ/written/short-answer questions (if not in DB) | ~$0.005 |
| Assessment generation | gpt-5.2 (ASSESSMENT) | 5-question end-of-lesson exam | ~$0.022 |
| Checkpoint generation | gpt-5.2 (ASSESSMENT) | 2-4 inline checkpoint questions | ~$0.014 |
| Grading service | gpt-5.2 (GRADING) | Answer evaluation + rubric scoring (JSON output) | ~$0.008 |
| Pacing decision | gpt-5.2 (ORCHESTRATOR) | Adaptive load calibration (~50 output tokens) | ~$0.002 |
| Queue re-prioritization | gpt-5.2 (ORCHESTRATOR) | Dynamic queue reordering (~80 output tokens) | ~$0.004 |

> **🔵 PREBUILT CONTENT STRATEGY:** Study notes and narrative slides are pre-generated offline using gpt-5.2 with full RAG grounding and stored in the database. This eliminates the two most expensive per-user call sites.

> **⚠️ COST AUDIT (March 2026):** All per-call costs have been recalculated using actual token counts against gpt-5.2 pricing ($1.75/$14.00 per 1M tokens). Previous estimates overstated costs by ~2× because they overestimated output token volumes — mastery AI calls return structured JSON (Zod-validated schemas), not verbose prose. Checkpoint gen outputs ~900 tokens, grading outputs ~380 tokens, pacing outputs ~50 tokens.

**Total Mastery Hub AI cost per session:** ~$0.04–$0.07 (token-audited)  
**Daily cost for active user:** ~$0.06–$0.14  
**Monthly cost for daily user:** ~$1.80–$4.30

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
- Student speaks → GPT-4o mini transcribe STT → AI response → GPT-4o mini TTS playback (with persona instructions)
- Also supports text-only mode for quiet environments

**Session Features:**
- Full transcript recording and replay
- AI-generated session summary with scores
- Performance tracking over time
- Topic selection across all 9 ATP units

#### AI Models Used (5 call sites)

| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Devil's Advocate (stream) | gpt-5.2-mini | Adversarial questioning | ~$0.001 |
| Devil's Advocate (non-stream) | gpt-5.2-mini | Fallback | ~$0.001 |
| 3-Panel Examiner (stream) | gpt-5.2-mini | Panel simulation | ~$0.001 |
| 3-Panel Examiner (non-stream) | gpt-5.2-mini | Fallback | ~$0.001 |
| Session summary | gpt-5.2-mini | Score + feedback | ~$0.002 |

**Plus Voice I/O (shared):**
| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Speech-to-text | gpt-4o-mini-transcribe | Student speech input | ~$0.003/min |
| Text-to-speech | gpt-4o-mini-tts | AI speech output (with persona instructions) | ~$0.006/call |

**Total Oral Exam AI cost per session:** ~$0.01–$0.02 (text only) / ~$0.12–$0.15 (with voice)  
**Trial Limit:** 2 Devil's Advocate sessions + 2 Panel sessions

#### API Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/oral-exams` | Conversation streaming + summary generation |
| `/api/oral-exams/sessions` | Save/list session transcripts |
| `/api/oral-exams/sessions/[id]` | Session detail + replay |
| `/api/voice/stt` | Speech-to-text (gpt-4o-mini-transcribe) |
| `/api/voice/tts` | Text-to-speech (gpt-4o-mini-tts with persona instructions) |

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
| Scenario generation | gpt-5.2-mini | Fresh exercise scenario from prebuilt prompt | ~$0.002 |
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
- **Smart Preloading:** Background question generation via gpt-5.2-mini for instant load times
- **Topic Selection:** Any of 9 ATP units, specific topics within units
- **Performance Tracking:** Per-topic accuracy, time spent, improvement trends
- **Immediate Feedback:** Detailed explanations for correct/incorrect answers

#### AI Models Used (2 call sites)

| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Quiz streaming | gpt-5.2-mini (MINI_MODEL) | Real-time question generation | ~$0.004 |
| Quiz preload | gpt-5.2-mini | Background batch generation | ~$0.001 |

**Total Quiz AI cost per session:** ~$0.005–$0.01  
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
| Study notes (quick) | gpt-5.2-mini | Fast study note generation | ~$0.006 |
| Case of the Day | gpt-5.2-mini | Daily case analysis | ~$0.003 |

**Total Study AI cost per session:** ~$0.006–$0.01  
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
1. **Standard** — gpt-5.2-mini: Fast, cost-effective for general questions
2. **Smart** — gpt-5.2: Deeper reasoning for complex legal analysis
3. **Image** — gpt-4o: Vision-capable for analyzing uploaded images (past papers, notes, etc.)

**Features:**
- Voice recording with transcription (gpt-4o-mini-transcribe)
- File/image attachment support
- Context-aware sessions (knows what page you're on)
- Streaming responses
- Draggable position on screen
- Custom events integration (`ynai:openChat`)

#### AI Models Used (3 call sites + voice)

| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Standard chat | gpt-5.2-mini | General Q&A | ~$0.001 |
| Smart mode | gpt-5.2 (ORCHESTRATOR) | Deep analysis | ~$0.031 |
| Image mode | gpt-4o | Vision analysis | ~$0.015 |
| Voice input | gpt-4o-mini-transcribe | Speech transcription | ~$0.003 |

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

### 3.5 ONBOARDING — "The First Impression"
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
- Voice recording with real-time transcription (gpt-4o-mini-transcribe)
- Streaming AI responses
- Session-based context awareness
- Uses guardrails system for grounded responses

#### AI Models Used (via guardrails — shared with research/chat)

| Call Site | Model | Purpose | Per-Call Cost |
|-----------|-------|---------|---------------|
| Clarification query | gpt-5.2 (MENTOR) / gpt-5.2-mini (tier-dependent) | Grounded legal explanation | ~$0.002–$0.031 |
| Voice input | gpt-4o-mini-transcribe | Speech transcription | ~$0.003 |

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
| Challenge generation | gpt-5.2-mini | Weekly challenge creation | ~$0.004 |
| Challenge review | gpt-5.2-mini | Submission review | ~$0.001 |
| Challenge grading | gpt-5.2-mini | Score + feedback | ~$0.002 |

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
| Banter content | gpt-5.2-mini (MINI_MODEL) | Entertainment generation | ~$0.002 |

**Total AI cost:** ~$0.002–$0.004/session

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
| 1 | **gpt-5.2** | OpenAI | **$1.75 / $14.00** | 14 | **~82%** |
| 2 | **gpt-5.2-mini** | OpenAI | **$0.25 / $2.00** | 15 | ~10% |
| 3 | **gpt-4o** | OpenAI | $2.50 / $10.00 | 1 (rare) | <1% |
| 4 | **claude-sonnet-4.6** | Anthropic | $3.00 / $15.00 | 2 | ~5% |
| 5 | **gpt-4o-mini-transcribe** | OpenAI | $0.003/minute | 3 | ~1% |
| 6 | **gpt-4o-mini-tts** | OpenAI | $12.00/1M chars | 1 | ~1% |
| 7 | **o3** | OpenAI | $2.00 / $8.00 | Offline generation only | $0 per-user |

> **⚠️ MODEL CORRECTIONS (March 2026):**
> 1. All previous "gpt-4o-mini" references were incorrect — codebase uses **gpt-5.2-mini** (`MINI_MODEL`), pricing $0.25/$2.00 per 1M tokens.
> 2. "gemini-2.0-flash" was listed for quiz preloading but **does not exist in the codebase** — `quiz-completion.ts` hardcodes `gpt-5.2-mini`. Gemini removed from inventory.
> 3. Per-call costs recalculated using **actual token counts** (input prompt length × $1.75/1M + output JSON size × $14.00/1M). Previous estimates overestimated by ~2× because they assumed prose-length outputs; actual outputs are compact Zod-validated JSON schemas.
> These corrections reduce estimated moderate user costs from $13.38 to **$8.49/month**.

> **⚠️ INFRASTRUCTURE UPGRADES (March 2026 — Round 2):**
> 4. **Voice stack migrated:** whisper-1 → **gpt-4o-mini-transcribe** ($0.003/min, 50% cheaper), tts-1 → **gpt-4o-mini-tts** ($12/1M chars, 20% cheaper + persona-based instructions for examiner voices).
> 5. **FAST_MODEL downgraded:** gpt-5.2 → **gpt-5.2-mini** for fast preload calls. Cost per call: $0.016 → $0.001.
> 6. **Smart chat router added:** Deterministic pre-checks + GPT-5.2-mini structured-output fallback routes smart chat and clarify queries to mini or frontier model. ~70% of queries resolved without any AI router call. Feature-flagged: `SMART_CHAT_ROUTER_ENABLED`, `CLARIFY_ROUTER_ENABLED`.
> 7. **Oral exam TTS now uses persona instructions:** Each examiner (Justice Mwangi, Advocate Amara, Prof. Otieno, Devil's Advocate) gets distinct voice tone/pace/delivery via gpt-4o-mini-tts `instructions` field.

### Model Role Assignments (from `model-config.ts`)

| Config Role | Model | Used By |
|-------------|-------|---------|
| ORCHESTRATOR_MODEL | gpt-5.2 | Mastery pacing, queue, chat (smart), onboarding, agentic tools |
| MENTOR_MODEL | gpt-5.2 | Research, clarification |
| AUDITOR_MODEL | claude-sonnet-4.6 | Cross-validation, drafting critique |
| ASSESSMENT_MODEL | gpt-5.2 | Assessment + checkpoint generation |
| GRADING_MODEL | gpt-5.2 | Answer grading across all features |
| FAST_MODEL | gpt-5.2-mini | Fast preload, quick responses |
| MINI_MODEL | gpt-5.2-mini | **Quizzes, banter, standard chat, oral exams, study notes, community, drafting scenarios** |
| ROUTER_MODEL | gpt-5.2-mini | Smart chat/clarify query routing (structured output) |
| TTS_MODEL | gpt-4o-mini-tts | Text-to-speech with persona instructions |
| STT_MODEL | gpt-4o-mini-transcribe | Speech-to-text (oral exams, voice notes) |

---

## 7. Complete AI Call Site Register

### All 38 AI Call Sites

| # | Feature Area | Call Site | Model | Per-Call Cost | Calls/Day (Active User) |
|---|-------------|-----------|-------|---------------|------------------------|
| 1 | Chat | Standard chat | gpt-5.2-mini | $0.001 | 5–15 |
| 2 | Chat | Smart mode | gpt-5.2 | $0.031 | 1–3 |
| 3 | Chat | Image mode | gpt-4o | $0.015 | 0–1 |
| 4 | Chat | Non-streaming | guardrails | varies | varies |
| 5 | Mastery | Study notes | **DB lookup** | **$0.000** 🔵 | 0 (prebuilt) |
| 6 | Mastery | Narrative renderer | **DB lookup** | **$0.000** 🔵 | 0 (prebuilt) |
| 7 | Mastery | Practice items | gpt-5.2 | $0.005 | 3–8 |
| 8 | Mastery | Assessment gen | gpt-5.2 | $0.022 | 1–2 |
| 9 | Mastery | Checkpoint gen | gpt-5.2 | $0.014 | 0–1 |
| 10 | Mastery | Grading | gpt-5.2 | $0.008 | 2–5 |
| 11 | Mastery | Pacing decision | gpt-5.2 | $0.002 | 1–3 |
| 12 | Mastery | Queue reorder | gpt-5.2 | $0.004 | 0–1 |
| 13 | Oral | Devil's Advocate (stream) | gpt-5.2-mini | $0.001 | 5–15/session |
| 14 | Oral | Devil's Advocate (non-stream) | gpt-5.2-mini | $0.001 | 5–15/session |
| 15 | Oral | 3-Panel (stream) | gpt-5.2-mini | $0.001 | 5–15/session |
| 16 | Oral | 3-Panel (non-stream) | gpt-5.2-mini | $0.001 | 5–15/session |
| 17 | Oral | Session summary | gpt-5.2-mini | $0.002 | 1/session |
| 18 | Quiz | Quiz streaming | gpt-5.2-mini | $0.004 | 1–3 |
| 19 | Quiz | Quiz preload | gpt-5.2-mini | $0.001 | 1–2 |
| 20 | Study | Quick notes | gpt-5.2-mini | $0.006 | 1–2 |
| 21 | Study | Case of Day | gpt-5.2-mini | $0.003 | 0–1 |
| 22–24 | Research | Authority retrieval (×3) | gpt-5.2 | $0.024 ea. | 0–3 |
| 25 | Research | Mentor + web search | gpt-5.2 | $0.031 | 1–3 |
| 26 | Research | Auditor validation | claude-sonnet-4.6 | $0.032 | 1–2/session |
| 27–28 | Guardrails | Agentic tool-use (×2) | gpt-5.2 | $0.033 ea. | 0–2 |
| 29 | Preload | Fast preload | gpt-5.2-mini | $0.001 | 1–2 |
| 30 | Community | Challenge generation | gpt-5.2-mini | $0.004 | 0–1 |
| 31 | Community | Challenge review | gpt-5.2-mini | $0.001 | 0–1 |
| 32 | Community | Challenge grading | gpt-5.2-mini | $0.002 | 0–2 |
| 33 | Drafting | Training scenario gen | gpt-5.2-mini | $0.002 | 1–2/session |
| 33b | Drafting | Exercise grading | gpt-5.2 | $0.025 | 1–2/session |
| 33c | Drafting | Critique engine | claude-sonnet-4.6 | $0.032 | 1–2/session |
| 34 | Voice | STT (chat) | gpt-4o-mini-transcribe | $0.003 | 0–2 |
| 35 | Voice | STT (oral) | gpt-4o-mini-transcribe | $0.003 | 0–3 |
| 36 | Voice | TTS | gpt-4o-mini-tts | $0.006 | 0–3 |
| 37 | Onboarding | Senior Partner analysis | gpt-5.2 | $0.016 | 1 (once) |
| 38 | Banter | Entertainment content | gpt-5.2-mini | $0.002 | 0–3 |


> 🔵 = **Prebuilt content** — served from database at $0 per-user cost. Generated offline using gpt-5.2/o3 as a one-time investment.

---

## 8. Cost Scenarios Per User

### Scenario A: Light User (~30 min/day, basic features)

| Feature | Daily AI Calls | Daily Cost |
|---------|---------------|------------|
| Standard chat (5×) | 5 | $0.005 |
| Study notes (1×) | 1 | $0.006 |
| Quiz session (1×) | 1 | $0.004 |
| Mastery (light — reads prebuilt notes + 1 practice) | 2 | $0.022 |
| **Daily Total** | | **$0.037** |
| **Monthly Total (30 days)** | | **$1.11** |

> Note: Mastery Hub light usage = checkpoint gen ($0.014) + prebuilt notes ($0) + 1 practice grading ($0.008). Practice items served from 6,615-item database ($0). Notes reading is free thanks to prebuilt content.

### Scenario B: Moderate User (~1–2 hrs/day, multiple features)

| Feature | Daily AI Calls | Daily Cost |
|---------|---------------|------------|
| Standard chat (10×) | 10 | $0.010 |
| Smart chat (2×) | 2 | $0.062 |
| Mastery Hub (full session — prebuilt notes) | 5 | $0.060 |
| Study notes (2×) | 2 | $0.012 |
| Quiz session (2×) | 2 | $0.008 |
| Oral exam (voice, 1×/week) | 0.14 | $0.018 |
| Research query (1×) | 3 | $0.087 |
| Drafting training (1×/week) | 0.14 | $0.004 |
| Case of Day | 1 | $0.003 |
| Banter (1×) | 1 | $0.002 |
| Preload | 1 | $0.016 |
| Community | 0.14 | $0.001 |
| **Daily Total** | | **$0.283** |
| **Monthly Total (30 days)** | | **$8.49** |

> **Key corrections vs. prior report:** (1) Mastery Hub session cost token-audited from $0.138 to **$0.060** — all AI calls output structured JSON (~380–1,450 tokens), not prose, making them 2× cheaper than assumed. (2) Quiz preloading uses gpt-5.2-mini, not gemini-2.0-flash (phantom model removed). (3) All "mini" model calls use gpt-5.2-mini ($0.25/$2.00).

### Scenario C: Heavy User (~3+ hrs/day, power user)

| Feature | Daily AI Calls | Daily Cost |
|---------|---------------|------------|
| Standard chat (15×) | 15 | $0.015 |
| Smart chat (3×) | 3 | $0.093 |
| Image chat (1×) | 1 | $0.015 |
| Mastery Hub (deep — prebuilt notes) | 13 | $0.144 |
| Study notes (3×) | 3 | $0.018 |
| Quiz sessions (3×) | 3 | $0.012 |
| Oral exams (voice, 3×/week) | 0.43 | $0.055 |
| Research queries (3×) | 9 | $0.261 |
| Drafting training (3×/week) | 0.43 | $0.012 |
| Written exams (1×) | 2 | $0.047 |
| Case of Day | 1 | $0.003 |
| Banter (3×) | 3 | $0.006 |
| Preload (2×) | 2 | $0.032 |
| Community challenges | 0.43 | $0.002 |
| Voice (STT+TTS, 5×) | 5 | $0.034 |
| **Daily Total** | | **$0.749** |
| **Monthly Total (30 days)** | | **$22.47** |

> Note: Heavy user cost reduced from $28.20 to $22.47 due to token-audited mastery costs ($0.144 vs $0.335 for deep usage). Weekly feature limits cap actual costs further — Premium tier limits all premium features to 6/week.

---

## 9. Current Pricing vs. Actual Cost

### Updated 3-Tier Pricing Structure (IMPLEMENTED)

| Tier | KES/Week | KES/Month | KES/Year | USD/Month (@ 130 KES/$) |
|------|----------|-----------|----------|-------------------------|
| Free Trial | — | — | — | $0 (3 days) |
| **Light** | 500 | 1,500 | 12,000 | $11.54 |
| **Standard** | 700 | 2,000 | 16,000 | $15.38 |
| **Premium** | 850 | 2,500 | 20,000 | $19.23 |

**Feature Limits (Premium features gated per tier):**

| Feature | Free Trial | Light | Standard | Premium | Custom |
|---------|-----------|-------|----------|---------|--------|
| Legal Drafting | 2/day* | 3/week | 4/week | 6/week | configurable† |
| Oral Exams | 2/day* | 2/week | 4/week | 6/week | configurable† |
| Devil's Advocate | 2/day* | 2/week | 4/week | 6/week | configurable† |
| CLE Exams | 2/day* | 3/week | 4/week | 6/week | configurable† |
| Legal Research | 2/day* | 2/week | 4/week | 6/week | configurable† |
| Get Clarification | 2/day* | 3/week | 4/week | 6/week | configurable† |
| Clarify AI Model | GPT-5.2 Mini | GPT-5.2 Mini | GPT-5.2 Mini | **GPT-5.2** | GPT-5.2 Mini |
| Add-on passes | ❌ | ✅ | ✅ | ✅ | ✅ |
| Drafting daily cap | 2/day per doc | 2/day per doc | 2/day per doc | 2/day per doc | 2/day per doc |
| Trial duration | 3 days | — | — | — | — |

*\*Free Trial: 2 sessions per feature per DAY (daily reset, not weekly). All 6 premium features unlocked during trial.*  
*†Custom: Users select which features and how many sessions/week per feature (1–50). Price = per-session rate × sessions × weeks.*

**Custom Package Builder — Per-Session Pricing (KES):**

| Feature | Per Session | Example: 3/week × 4 weeks |
|---------|------------|---------------------------|
| Legal Drafting | 40 | 480 |
| Oral Examination | 35 | 420 |
| Devil's Advocate | 35 | 420 |
| CLE Exams | 30 | 360 |
| Legal Research | 35 | 420 |
| Get Clarification | 25 | 300 |

**Custom Duration Discounts:**

| Duration | Discount |
|----------|----------|
| 1–2 Weeks | 0% |
| 1 Month (4 weeks) | 5% |
| 2 Months (8 weeks) | 10% |
| 3 Months (12 weeks) | 15% |

**Add-on Pass Pricing (KES):**

| Feature | Single Pass | 5-Pack (save ~20%) |
|---------|------------|-------------------|
| Drafting | 100 | 400 |
| Oral Exam | 100 | 400 |
| Devil's Advocate | 100 | 400 |
| CLE Exams | 80 | 350 |
| Research | 80 | 350 |
| Clarify | 50 | 200 |

> Basic features (Mastery Hub, Study, Quizzes, Community, Banter, Progress, Dashboard, Reports) are **unlimited** across all tiers including Custom.

### Margin Analysis Per Tier (Monthly Plan)

| Tier | Revenue/Month | Light User ($1.11) | Moderate User ($8.49) | Heavy User ($22.47) |
|------|--------------|--------------------|-----------------------|---------------------|
| **Light** (KES 1,500) | $11.54 | +$10.43 (+90%) | **+$3.05 (+36%)** ✅ | **-$10.93 (-95%)** |
| **Standard** (KES 2,000) | $15.38 | +$14.27 (+93%) | **+$6.89 (+81%)** ✅ | **-$7.09 (-46%)** |
| **Premium** (KES 2,500) | $19.23 | +$18.12 (+94%) | **+$10.74 (+127%)** ✅ | **-$3.24 (-17%)** |

### Critical Finding (Updated March 2026)

| User Type | Est. % of Users | Standard Tier Profitable? | Premium Tier Profitable? |
|-----------|-----------------|---------------------------|-------------------------|
| Light | ~30% | ✅ Yes (+$14.27) | ✅ Yes (+$18.12) |
| Moderate | ~50% | ✅ **Yes (+$6.89)** | ✅ **Yes (+$10.74)** |
| Heavy | ~20% | ❌ No (-$7.09) | ❌ No (-$3.24) |

> **Key change vs. prior report:** Token-audited mastery costs cut moderate user cost from $10.83 to $8.49 (−22%). Standard tier moderate margin improves from +$4.55 (+42%) to **+$6.89 (+81%)**. Premium heavy user loss narrows to just -$3.24 (−17%). Light users generate 90%+ margins on ALL tiers.

**Blended margin assuming 30/50/20 user split across tiers (40% Light / 40% Standard / 20% Premium):**

Weighted ARPU: (0.40 × $11.54) + (0.40 × $15.38) + (0.20 × $19.23) = **$14.62/user/month**

Weighted cost: (0.30 × $1.11) + (0.50 × $8.49) + (0.20 × $22.47) = **$9.07/user/month**

> Blended margin: $14.62 - $9.07 = **+$5.55/user/month (+38.0% margin)**

With weekly feature limits capping heavy users to ~$18/month:
> Blended cost: (0.30 × $1.11) + (0.50 × $8.49) + (0.20 × $18.00) = **$8.18/user/month**  
> Blended margin: $14.62 - $8.18 = **+$6.44/user/month (+44.1% margin)**

**At 200 subscribers: +$1,110 to +$1,288/month PROFIT**  
**At 500 subscribers: +$2,775 to +$3,220/month PROFIT**

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

**Impact:** Mastery Hub per-user session cost is **$0.060** (token-audited). Without prebuilt content, phases 1-2 would require live generation at ~$0.055/session, nearly doubling the session cost to ~$0.115.

#### ✅ Action 2: 3-Tier Pricing with Weekly/Daily Limits (IMPLEMENTED)

Replaced the single-tier pricing with Light ($11.54) / Standard ($15.38) / Premium ($19.23) monthly tiers plus a **Custom à-la-carte builder**. Premium features (Drafting, Oral Exams, Devil's Advocate, CLE Exams, Research, Clarify) are gated by **weekly usage limits** per tier (2–3→4→6), preventing unlimited consumption of expensive AI features.

**Free Trial**: ALL 6 premium features unlocked at **2 sessions per feature per day** (daily reset, 3-day trial). This lets trial users experience every feature without generating runaway costs.  
**Light**: 2–3/week per feature · **Standard**: 4/week all features · **Premium**: 6/week all features + GPT-5.2 for clarify  
**Custom**: Per-session pricing — users pick features, sessions/week, and duration (1 week to 3 months with up to 15% discount)

#### ✅ Action 3: Progressive Drafting Training (IMPLEMENTED)

Replaced static drafting critique with a full 7-session progressive training course per document type. Teaching content is prebuilt; only scenario generation (gpt-4o-mini, $0.002) and exercise grading (gpt-5.2, $0.025) require live AI — approximately the same cost as the old critique but delivering dramatically more value.

### Remaining Optimization Opportunity: Model Downgrade

Downgrade 4 of 14 remaining gpt-5.2 call sites to gpt-5.2-mini where frontier reasoning isn't needed:

| Call Site | Current Model | Proposed Model | Savings/Call | Quality Impact |
|-----------|---------------|----------------|-------------|----------------|
| Pacing decision (#11) | gpt-5.2 | gpt-5.2-mini | $0.002 | Low — algorithmic task |
| Queue reorder (#12) | gpt-5.2 | gpt-5.2-mini | $0.003 | Low — sorting task |
| Fast preload (#29) | gpt-5.2 | gpt-5.2-mini | $0.015 | Low — batch generation |
| Onboarding (#37) | gpt-5.2 | gpt-5.2-mini | $0.015 | Low — one-time analysis |

**Estimated additional savings if implemented: ~$0.50–$1.00/moderate user/month**

With model optimization applied on top of prebuilt content + tiered pricing + token-audited costs:
> Moderate user cost: ~$7.50/month → Standard tier margin: +$7.88 (+51%)
> Blended margin with weekly limits: **+$7.00–$7.50/user/month (+48–51%)**

---

## Feature Summary Table — Complete At-A-Glance

| # | Feature | Category | AI Models | AI Cost/Session | Gated? | Page |
|---|---------|----------|-----------|----------------|--------|------|
| 1 | Mastery Hub | 🏆 Flagship | gpt-5.2 (6 active + 2 prebuilt) | $0.04–$0.07 | No (unlimited) | `/mastery` |
| 2 | Oral Exams | 🏆 Flagship | gpt-5.2-mini, gpt-4o-mini-transcribe, gpt-4o-mini-tts | $0.01–$0.10 | ✅ 2–6/wk | `/oral-exams` |
| 3 | Legal Drafting | 🏆 Flagship | gpt-5.2-mini + gpt-5.2 + claude-sonnet-4.6 | $0.03 (training) / $0.03–$0.06 (practice) | ✅ 3–6/wk | `/drafting` |
| 4 | Quizzes | 🏆 Flagship | gpt-5.2-mini | $0.005–$0.01 | No (unlimited) | `/quizzes` |
| 5 | Study | 🏆 Flagship | gpt-5.2-mini | $0.006–$0.01 | No (unlimited) | `/study` |
| 6 | CLE Exams | ⭐ Core | gpt-5.2 | $0.05–$0.08 | ✅ 0–6/wk | `/exams` |
| 7 | Legal Research | ⭐ Core | gpt-5.2, claude-sonnet-4.6 | $0.09–$0.12 | ✅ 0–6/wk | `/research` |
| 8 | Floating Chat | ⭐ Core | gpt-5.2-mini/gpt-5.2/gpt-4o | $0.001–$0.031 | No (unlimited) | (global) |
| 9 | Progress | ⭐ Core | None | $0 | No | `/progress` |
| 10 | Onboarding | ⭐ Core | gpt-5.2 | $0.016 (once) | No | `/onboarding` |
| 11 | Clarify | 🔧 Supporting | gpt-5.2/gpt-5.2-mini (tier-dependent) | $0.002–$0.031 | ✅ 0–6/wk | `/clarify` |
| 12 | Community | 🔧 Supporting | gpt-5.2-mini | $0.007/week | No (unlimited) | `/community` |
| 13 | Legal Banter | 🔧 Supporting | gpt-5.2-mini | $0.002 | No (unlimited) | `/banter` |
| 14 | History | 🔧 Supporting | None | $0 | No | `/history` |
| 15 | Dashboard | 🔧 Supporting | None | $0 | No | `/dashboard` |
| 16 | Subscribe | 🔧 Supporting | None | $0 | No | `/subscribe` |

**Infrastructure (zero user-facing AI cost):**

| # | System | Purpose | Cost |
|---|--------|---------|------|
| 18 | Admin Panel | Content management, analytics, moderation | $0 |
| 19 | Notifications | Email (Brevo), push (VAPID), in-app | Brevo free tier |
| 20 | Payments | Paystack integration (card + M-Pesa) | 1.5% + KES 100 per transaction |
| 21 | PWA | Installable progressive web app | $0 |
| 22 | Cron/Workers | Background jobs, preloading, emails | $0 |
| 23 | Voice I/O | STT (gpt-4o-mini-transcribe) + TTS (gpt-4o-mini-tts with persona instructions) shared service | Per-use (see call sites) |
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

## Appendix A: Mastery Hub — Full Technical Architecture

*Prepared for technical board review. This appendix documents the complete architecture, data flow, AI call chain, and cost breakdown of the Mastery Hub ("The Engine") — the platform's most complex and expensive feature.*

---

### A.1 System Overview

The Mastery Hub is a **4-phase spaced mastery system** that takes each student through every syllabus node (297 nodes across 9 ATP units) in a structured lifecycle. It is NOT a chatbot or open-ended AI tutor — it is a deterministic state machine with AI-augmented transitions.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MASTERY HUB DATA FLOW                           │
│                                                                     │
│  Student opens /mastery                                             │
│       │                                                             │
│       ▼                                                             │
│  ┌──────────────────────┐     ┌──────────────────────────────┐     │
│  │  MasteryOrchestrator │────▶│  Daily Queue (max 12 items)  │     │
│  │  (generateDailyQueue)│     │  75% Syllabus + 25% Practice │     │
│  │  ════════════════════│     └──────────┬───────────────────┘     │
│  │  • DB: user_profiles │               │                          │
│  │  • DB: syllabus_nodes│               ▼                          │
│  │  • DB: node_progress │     Student picks a node                 │
│  │  • DB: mastery_state │               │                          │
│  │  • NO AI CALL (v3)   │               ▼                          │
│  └──────────────────────┘     ┌──────────────────────┐             │
│                               │  4-PHASE LIFECYCLE   │             │
│                               │                      │             │
│                               │  1. NOTE    ($0.00)  │◀── Prebuilt │
│                               │  2. EXHIBIT ($0.00)  │◀── Prebuilt │
│                               │  3. DIAGNOSIS        │◀── AI $$    │
│                               │  4. MASTERY          │◀── AI $$$   │
│                               └──────────────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

**Key architectural insight:** Phases 1-2 are **zero AI cost** (prebuilt content from database). Phases 3-4 are where ALL the AI spend happens.

---

### A.2 The Orchestrator — Queue Generation

**File:** `lib/services/mastery-orchestrator.ts` (653 lines)  
**Class:** `MasteryOrchestrator`  
**Method:** `generateDailyQueue(userId)`  
**AI Model:** None in v3 — pure DB queries + algorithmic sorting  

The orchestrator runs when a student loads the Mastery Hub. It builds a personalized daily study queue through this pipeline:

#### Step 1: Profile Extraction (DB Query)
```
user_profiles → {
  examPath: 'APRIL_2026' | 'NOVEMBER_2026'   // Determines Path A vs B
  weakAreas: ['atp-100', 'atp-103']           // Self-reported + detected
  strongAreas: ['atp-104']                     // Self-reported
  studyPace: 'moderate' | 'intensive' | 'relaxed'
  professionalExposure: 'STUDENT' | 'PARALEGAL' | 'ADVOCATE'
  learningStyle: 'visual' | 'reading' | 'mixed'
  goals.coverageTarget: 'full_calendar' | '16_weeks' | '8_weeks' | '4_weeks'
  goals.weekendStudyHours: 0-8
  goals.confidenceLevel: 1-10
}
```

#### Step 2: Two-Track Logic

| Track | Who | Strategy | Queue Source |
|-------|-----|----------|-------------|
| **Path A — Surgical Strike** | Resitters (examPath=APRIL_2026) | Only failed units, all unmastered nodes. High-yield + drafting nodes first. | `syllabus_nodes WHERE unit IN failedUnits AND NOT mastered` |
| **Path B — Paced Build** | First-timers | Synced to KSL academic calendar (3 terms × 11 weeks = 33 weeks). Current week ±1, plus backfill. | `syllabus_nodes WHERE week BETWEEN (currentWeek-1) AND (currentWeek+1)` |

KSL calendar is hardcoded:
- Term 1: Feb 3 – Apr 14, 2026
- Term 2: Apr 28 – Jul 7, 2026  
- Term 3: Aug 18 – Oct 27, 2026

#### Step 3: Personalized Sorting

Within the queue, nodes are sorted by a **3-tier priority system:**

| Priority | Condition | Effect |
|----------|-----------|--------|
| 0 (highest) | `unitCode ∈ weakAreas` | Weak units always surface first |
| 1 (normal) | Not weak, not strong | Standard ordering by week number |
| 2 (lowest) | `unitCode ∈ strongAreas` | De-prioritized — student is comfortable |

Within the same priority band: `isHighYield` nodes first, then by `weekNumber` ascending.

#### Step 4: Unit Diversity Cap

To prevent "topic whiplash," the queue is capped at **MAX_UNITS_PER_DAY = 3** distinct units. Selection uses a deterministic user-seeded daily rotation:

```
dateSeed = sum(YYYY, MM, DD)
userSeed = sum(charCodes of userId)
combinedSeed = dateSeed × 31 + userSeed

// Priority: weak units first → normal units (rotated) → strong units (last resort)
```

This means different users see different unit combinations each day, and the same user sees a rotating selection.

#### Step 5: Adaptive Queue Cap

The base daily cap of 12 items is adjusted by multipliers:

```
adjustedCap = 12 × coverageMultiplier × paceMultiplier × weekendBoost

coverageMultiplier:
  4_weeks  → ×1.7  (cramming — more items)
  8_weeks  → ×1.3
  16_weeks → ×1.0
  full_cal → ×0.7  (relaxed — fewer items)

paceMultiplier:
  intensive → ×1.25
  moderate  → ×1.0
  relaxed   → ×0.67

weekendBoost (Sat/Sun only):
  weekendStudyHours ≥ 4 → ×1.3
  weekendStudyHours ≥ 2 → ×1.15
  otherwise             → ×1.0
```

**Example:** An intensive student on a 4-week coverage target on a Saturday with 4+ weekend hours:  
`12 × 1.7 × 1.25 × 1.3 = 33 items/day`

A relaxed first-timer on full-calendar pacing on a weekday:  
`12 × 0.7 × 0.67 × 1.0 = 5 items/day`

#### Step 6: Micro-Skill Practice Items

Alongside syllabus nodes, the orchestrator fetches practice items from the `micro_skills` + `items` + `item_skill_map` tables. These are **pre-seeded** items (6,615 in database). Selection criteria:

```sql
WHERE ms.unit_id = ANY(queuedUnitCodes)
  AND ms.is_active = true
  AND (mastery_state.p_mastery IS NULL OR p_mastery < 0.85)
ORDER BY
  is_core DESC,           -- Core skills first
  p_mastery ASC,          -- Weakest first
  exam_weight DESC        -- High exam-weight first
```

**Cost:** $0 — pure SQL query against pre-seeded items.

#### AI Methods (Called On-Demand, Not Per Queue Load)

The orchestrator also exposes two AI-augmented methods, but these are **NOT called on every queue generation** — they are triggered conditionally:

| Method | Trigger | Model | Cost |
|--------|---------|-------|------|
| `checkPacing()` | Student scores <60% on understanding check | gpt-5.2 (ORCHESTRATOR) | ~$0.009 |
| `aiPrioritizeQueue()` | Called separately — reranks queue using error patterns | gpt-5.2 (ORCHESTRATOR) | ~$0.011 |

`checkPacing()` returns one of: `SLOW_DOWN`, `REVIEW_PREREQUISITE`, `CHANGE_FORMAT`, `INJECT_EXAMPLE` — with a specific skill target and difficulty adjustment. The AI analyzes the student's last 10 attempts to detect patterns.

`aiPrioritizeQueue()` takes the SQL-sorted queue and the student's error history, asks the ORCHESTRATOR to rerank for maximum exam readiness. Returns reordered indices + reasoning.

---

### A.3 The 4-Phase Lifecycle — Per Node

Each syllabus node (297 total) progresses through 4 phases. The `node_progress` table tracks where each user is on each node.

#### Phase 1: NOTE (Cost: $0.00)

**API:** `GET /api/mastery/content?skillId={nodeId}&phase=narrative`  
**Service:** `NarrativeNoteRenderer` (221 lines)  
**Source:** `prebuilt_notes` table  

Notes are **prebuilt** — 297 notes generated offline with gpt-5.2 + full RAG grounding (218,974 cases + 2,942 statutes). Each user is assigned a random version (1-3) on first access via `user_note_versions` table, then sees the same version consistently.

```
Student → GET /api/mastery/content → DB lookup (prebuilt_notes) → Markdown slides → UI
                                      ↓
                                 NO AI CALL
                                 $0.00 per user
```

The NarrativeNoteRenderer has a live-generation fallback (gpt-5.2 MENTOR_MODEL with RAG), but this path is only hit if a prebuilt note doesn't exist — which shouldn't happen for any of the 297 syllabus nodes.

#### Phase 2: EXHIBIT (Cost: $0.00)

**Same API as Phase 1** — the narrative includes interactive elements, citation detection for Kenya Law Reports / eKLR references, statute section parsing, and visual slide formatting.

Five visual styles are randomly chosen per session: `classic`, `magazine`, `slide`, `highlight`, `minimal`.

**Zero additional AI cost** — content is embedded in the prebuilt note.

#### Phase 3: DIAGNOSIS (Cost: ~$0.022/node)

**API:** `GET /api/mastery/content?phase=extras` + `GET /api/mastery/item`  
**Services:** `CheckpointGenerator` + `AssessmentGenerator` + Items from DB  

This is where AI cost begins. Two parallel AI calls are made:

| Call | Service | Model | Purpose | Cost |
|------|---------|-------|---------|------|
| Checkpoint questions | `CheckpointGenerator.generate()` | gpt-5.2 (ASSESSMENT_MODEL) | 2-4 inline checkpoint questions (MCQ, SHORT, ORDERING) | ~$0.014 |
| Practice item | `GET /api/mastery/item` | gpt-5.2 (ASSESSMENT_MODEL) | Generate MCQ/written/short-answer if none in DB | ~$0.005 |

**Checkpoints** are interleaved with note content. Types are distributed: 2 qs → [MCQ, SHORT], 3 qs → [MCQ, SHORT, ORDERING], 4 qs → [MCQ, SHORT, ORDERING, MCQ].

**Practice items** first attempt to serve from the 6,615 pre-seeded items (`items` + `item_skill_map` tables). AI generation only fires if no matching item exists in DB for the requested skill+format. Format selection is weighted: 60% written, 20% MCQ, 20% short-answer (bar exam is primarily written).

If the item is served from DB: **$0.00 for that call.**  
If AI-generated: **~$0.005** using ASSESSMENT_MODEL (gpt-5.2).

#### Phase 4: MASTERY (Cost: ~$0.038/node for assessment + grading)

**API:** `GET /api/mastery/content?phase=extras` + `POST /api/mastery/attempt`  
**Services:** `AssessmentGenerator` + `GradingService` + `MasteryEngine`  

The mastery phase is the most expensive — it generates a full 5-question assessment and then grades the student's responses.

##### Assessment Generation (Cost: ~$0.022)

**Service:** `AssessmentGenerator.generateStack(topic)`  
**Model:** gpt-5.2 (ASSESSMENT_MODEL)  

Generates a 5-question, 100-point assessment:

| Q# | Type | Points | Tests |
|----|------|--------|-------|
| Q1 | MCQ (scenario) | 20 | Recall + application |
| Q2 | MCQ (scenario) | 20 | Different subtopic |
| Q3 | SHORT (application) | 20 | Apply law to facts |
| Q4 | ORDERING (procedural) | 20 | Correct legal sequence |
| Q5 | ANALYSIS/DRAFTING | 20 | Full legal reasoning |

Pass mark: **70/100**. Questions are fresh-generated each time (no memorization on retakes). All grounded in Kenyan law with specific statute/case citations.

MCQ (Q1, Q2) and ORDERING (Q4) are **auto-graded** — $0 cost.  
SHORT (Q3) and ANALYSIS (Q5) are **AI-graded** — see below.

##### AI Grading (Cost: ~$0.008/submission)

**Service:** `GradingService.gradeResponse()`  
**Model:** gpt-5.2 (GRADING_MODEL)  

The grading pipeline:

```
Student submission
       │
       ▼
┌──────────────────────────────────────────────────┐
│  STEP 1: RAG Context Retrieval (pgvector)        │
│  • searchLectureChunksSemantic(query, topK=3)    │
│  • searchKnowledgeBaseSemantic(query, topK=5)    │
│  Cost: $0 (embedding similarity search)          │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│  STEP 2: AI Grading (GRADING_MODEL = gpt-5.2)   │
│  Inputs:                                          │
│  • Student's response text                        │
│  • Original question + rubric + model answer      │
│  • RAG: lecture chunks + authority records         │
│  Output (JSON, Zod-validated):                    │
│  {                                                │
│    scoreNorm: 0-1,                                │
│    rubricBreakdown: [{category, score, feedback}],│
│    missingPoints: [...],                          │
│    errorTags: [...],                              │
│    nextDrills: [...],                             │
│    modelOutline: "...",                           │
│    evidenceRequests: [...]                        │
│  }                                                │
│  Cost: ~$0.025                                    │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│  STEP 3: Mastery State Update (MasteryEngine)    │
│  Algorithm: Bayesian update with clamping         │
│  delta = LR × (quality - 0.6) × format × mode   │
│         × difficulty × coverage                   │
│  Clamped: [-0.12, +0.10] per attempt             │
│  Cost: $0 (pure math)                            │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│  STEP 4: Gate Verification Check                  │
│  Criteria for verification ("mastered"):          │
│  • p_mastery ≥ 0.85                              │
│  • 2 timed passes                                │
│  • Passes ≥ 24 hours apart                       │
│  • Top-3 error tags must not repeat              │
│  Cost: $0 (pure SQL + logic)                     │
└──────────────────────────────────────────────────┘
```

---

### A.4 Mastery Engine — The Math

**File:** `lib/services/mastery-engine.ts` (950 lines)  

The mastery update is a **clamped Bayesian learning rate model**, not a simple percentage counter. Each attempt produces a delta that moves the student's `p_mastery` for the tested skill(s).

#### Delta Calculation

```
delta = learningRate × (attemptQuality - passingThreshold)
        × formatWeight × modeWeight × difficultyFactor × coverageWeight

Clamped to: [-0.12, +0.10]
```

| Parameter | Values |
|-----------|--------|
| `learningRate` | 0.15 |
| `passingThreshold` | 0.6 (60%) |
| `formatWeight` | oral: 1.35, drafting: 1.25, written: 1.15, mcq: 0.75, flashcard: 0.65 |
| `modeWeight` | exam_sim: 1.25, timed: 1.25, practice: 1.0 |
| `difficultyFactor` | Easy(1): 0.6, Medium(3): 1.0, Hard(5): 1.4 |

**Example:** Student scores 80% on a timed written question at difficulty 4:
```
delta = 0.15 × (0.80 - 0.6) × 1.15 × 1.25 × 1.2 × 1.0
      = 0.15 × 0.20 × 1.15 × 1.25 × 1.2
      = 0.0518
→ p_mastery goes up by ~5.2% per correct answer
```

**Example:** Student scores 30% on a practice MCQ at difficulty 2:
```
delta = 0.15 × (0.30 - 0.6) × 0.75 × 1.0 × 0.8 × 1.0
      = 0.15 × (-0.30) × 0.60
      = -0.027
→ p_mastery goes down by ~2.7% per wrong answer
```

#### Stability Tracking

Each skill also has a `stability` score (0.3–2.0) that tracks consistency:
- **Success:** stability += 0.1 (max 2.0)
- **Failure:** stability -= 0.15 (min 0.3)

High stability = the student consistently performs well on this skill. Used by the planner to deprioritize stable skills.

#### Gate Verification (Cannot Be Bypassed)

A skill is "mastered" only when ALL four conditions are met:

| Gate | Requirement | Rationale |
|------|-------------|-----------|
| Minimum mastery | p_mastery ≥ 0.85 | Must demonstrate deep knowledge |
| Timed proof | ≥ 2 timed/exam_sim passes | Practice mode alone isn't enough |
| Spacing | 2 passes ≥ 24 hours apart | Proves retention, not short-term memory |
| Error clearance | Top-3 error tags must not repeat in 2nd pass | Must fix systematic weaknesses |

This means a student **cannot cram through mastery in one sitting.** Minimum 2 days to verify any skill, and they must fix their specific errors.

---

### A.5 Complete AI Call Chain — One Mastery Session

For a **full mastery session** (student works through one node from NOTE to MASTERY):

> **Methodology:** Costs calculated by counting actual input prompt tokens + expected output JSON tokens, priced at gpt-5.2 rates ($1.75/1M input, $14.00/1M output). Output drives ~85% of cost because the 8× output multiplier dominates. All mastery AI outputs are Zod-validated JSON schemas — compact structured data, not verbose prose.

| Step | What Happens | AI Model | Input ~tokens | Output ~tokens | Cost |
|------|-------------|----------|--------------|----------------|------|
| 1. Queue load | `MasteryOrchestrator.generateDailyQueue()` | **None** (SQL + algorithm) | — | — | $0.000 |
| 2. Phase NOTE | Fetch prebuilt note from `prebuilt_notes` table | **None** (DB lookup) | — | — | $0.000 |
| 3. Phase EXHIBIT | Same prebuilt content, rendered with citation parsing | **None** (DB lookup) | — | — | $0.000 |
| 4. Checkpoint gen | `CheckpointGenerator.generate()` — 3 inline questions | gpt-5.2 (ASSESSMENT) | ~720 | ~900 | $0.014 |
| 5. Practice item | `GET /api/mastery/item` — from DB or AI-generated | gpt-5.2 (ASSESSMENT) | ~300 | ~300 | $0.000–$0.005 |
| 6. Practice grading | `POST /api/mastery/attempt` — AI grades written answer | gpt-5.2 (GRADING) | ~1,300 | ~380 | $0.008 |
| 7. Mastery state update | `MasteryEngine.updateMasteryWithCurrentState()` | **None** (math) | — | — | $0.000 |
| 8. Assessment gen | `AssessmentGenerator.generateStack()` — 5-question exam | gpt-5.2 (ASSESSMENT) | ~1,000 | ~1,450 | $0.022 |
| 9. Assessment grading | `GradingService.gradeResponse()` × 2 written answers | gpt-5.2 (GRADING) | ~2,600 | ~760 | $0.016 |
| 10. Gate check | `MasteryEngine.checkGateVerification()` | **None** (logic) | — | — | $0.000 |
| 11. Pacing (conditional) | `MasteryOrchestrator.checkPacing()` — if score < 60% | gpt-5.2 (ORCHESTRATOR) | ~610 | ~50 | $0.002 |
| **TOTAL (full session)** | | | ~6,530 | ~3,840 | **$0.060–$0.067** |
| **TOTAL (typical — item from DB, no pacing)** | | | ~5,620 | ~3,490 | **$0.060** |

**AI calls per full session: 4-5 calls to gpt-5.2** (unchanged)  
**Non-AI operations per session: 6+ DB queries**  
**Why costs are lower than original estimates:** Output tokens dominate cost (8× input rate). Grading outputs ~380 tokens of structured JSON, not ~1,500 tokens of prose. Pacing outputs just ~50 tokens. Checkpoint gen outputs ~900 tokens for 3 questions in JSON. Original estimates assumed ~2× more output tokens than the actual Zod schemas produce.

---

### A.6 Monthly Cost Projection

| Usage Pattern | Sessions/Day | AI Calls/Day | Daily Cost | Monthly Cost |
|--------------|-------------|-------------|------------|-------------|
| Light (reads notes only, 1 practice) | 1 | 2 | $0.022 | $0.66 |
| Moderate (full session + 1 practice) | 1.5 | 5-7 | $0.068 | $2.04 |
| Heavy (2 full sessions + extra practice) | 3 | 10-14 | $0.144 | $4.32 |

**Key cost driver:** The ASSESSMENT_MODEL calls (checkpoint gen + assessment gen). Assessment generation outputs ~1,450 tokens of JSON per 5-question exam — this single call at ~$0.022 is the most expensive step. Grading outputs are compact (~380 tokens each, ~$0.008/call).

**Optimization opportunity:** Pacing ($0.002) and queue reorder ($0.004) could move to gpt-5.2-mini for ~$0.005/day savings. Assessment/grading must stay on gpt-5.2 — quality is critical for accurate mastery measurement.

---

### A.7 Database Tables Involved

| Table | Purpose | Records |
|-------|---------|---------|
| `syllabus_nodes` | All 297 nodes across 9 ATP units, with week numbers, term, high-yield flags | 297 |
| `node_progress` | Per-user, per-node phase tracking (NOTE→EXHIBIT→DIAGNOSIS→MASTERY) | Dynamic |
| `mastery_state` | Per-user, per-skill Bayesian mastery probability + stability | Dynamic |
| `user_profiles` | Student profile from onboarding (weak areas, pace, path) | 1/user |
| `micro_skills` | 430 discrete testable skills mapped to ATP units | 430 |
| `items` | 6,615 pre-seeded practice items (MCQ, written, short-answer) | 6,615 |
| `item_skill_map` | Maps items to the skills they test, with coverage weights | ~10,000 |
| `prebuilt_notes` | 297 pre-generated study notes (gpt-5.2 + RAG, 3 versions each) | 297 |
| `user_note_versions` | Tracks which note version each user has been assigned | Dynamic |
| `attempts` | Full attempt history with scores, error tags, timing | Dynamic |
| `daily_plans` | Cached daily queue per user | Dynamic |

---

*End of Appendix A — Mastery Hub Technical Architecture*

---

*End of Board Report — YNAI Complete System Feature Catalog*  
*Prepared for pricing review and strategic planning*  
*Updated: March 2026 — Model correction (gpt-5.2-mini), AI Tutor removed, prebuilt content strategy, 3-tier pricing*
