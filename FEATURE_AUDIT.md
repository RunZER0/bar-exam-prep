# YNAI Kenya Bar Exam Prep — Comprehensive Feature Audit

**Date:** March 9, 2026  
**Scope:** Every page, API endpoint, service, and component in the platform  
**AI Model Triumvirate:**
- **Orchestrator:** GPT-5.2 — queue management, path selection, quiz generation, grading
- **Mentor:** GPT-5.2 — narrative study notes, instructional content
- **Auditor:** Claude Sonnet 4 — redline critique engine for legal drafts
- **Fast:** GPT-5.2 — banter, suggestions, quick operations
- **Speech:** OpenAI Whisper (STT), OpenAI TTS-1 (TTS)
- **Embeddings:** OpenAI (via embedding-service for RAG)

---

## 1. MASTERY HUB ⭐ (Flagship)

**What the user sees:** The central study cockpit. Shows Today's Plan (a daily queue of ~12 prioritized study tasks), a Backlog view of all remaining skills, a Readiness dashboard with per-unit scores, and an Explore tab for discovering new topics. Users tap a task to enter an interactive study session: narrative notes → checkpoint quizzes → practice items → mastery gate.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/mastery/plan` | GET | Fetch today's hybrid queue (75% Syllabus / 25% Witness reinforcement) |
| `/api/mastery/plan` | POST | Generate plan for a specific date |
| `/api/mastery/plan` | PATCH | Update task status (completed/skipped/deferred) |
| `/api/mastery/content` | GET | Fetch narrative study notes & assessments (supports progressive loading: `?phase=narrative` then `?phase=extras`) |
| `/api/mastery/item` | GET | Fetch or AI-generate a practice item for a skill |
| `/api/mastery/attempt` | POST | Submit attempt for AI grading; updates mastery state, error signatures, gate verification |
| `/api/mastery/attempt` | GET | Fetch attempt history with filters |
| `/api/mastery/notes` | GET | Fetch grounded study notes for a skill with authority citations |
| `/api/mastery/progress` | POST | Record node phase completion (NOTE → EXHIBIT → DIAGNOSIS → MASTERY) |
| `/api/mastery/readiness` | GET | Evidence-backed readiness scores per unit, format, and overall |
| `/api/mastery/report` | GET | Weekly progress report with "if exam was today" prediction |

**AI Models Used:**
- **GPT-5.2 (Orchestrator):** Generates daily queue, selects priority tasks, generates practice items on-the-fly
- **GPT-5.2 (Mentor):** Renders narrative study notes via `NarrativeNoteRenderer`
- **GPT-5.2 (Assessment):** Generates 3-level assessment stacks (MCQ → Ordering → Drafting) via `AssessmentGenerator`
- **GPT-5.2 (Assessment):** Generates inline checkpoint questions via `CheckpointGenerator`
- **GPT-5.2 (Grading):** AI grades written, oral, drafting, MCQ responses via `GradingService`

**Key Files:**
- [app/(app)/mastery/page.tsx](app/(app)/mastery/page.tsx) — Mastery Hub UI
- [lib/services/mastery-orchestrator.ts](lib/services/mastery-orchestrator.ts) — Daily queue generation, phase advancement
- [lib/services/mastery-engine.ts](lib/services/mastery-engine.ts) — Core mastery update algorithm, gate verification, rubrics
- [lib/services/mastery-db-service.ts](lib/services/mastery-db-service.ts) — DB persistence for mastery state
- [lib/services/grading-service.ts](lib/services/grading-service.ts) — Structured AI grading (Zod-validated JSON output)
- [lib/services/narrative-renderer.ts](lib/services/narrative-renderer.ts) — AI note generation grounded in DB authorities
- [lib/services/assessment-generator.ts](lib/services/assessment-generator.ts) — 3-level assessment stack generator
- [lib/services/checkpoint-generator.ts](lib/services/checkpoint-generator.ts) — Inline checkpoint questions
- [lib/services/remediation-engine.ts](lib/services/remediation-engine.ts) — Prescribes remediation when users fail gates
- [components/MasteryCarousel.tsx](components/MasteryCarousel.tsx) — Slide-based study notes with citation detection
- [components/InteractiveStudyNotes.tsx](components/InteractiveStudyNotes.tsx) — Study notes with "Ask AI" on text selection
- [components/EmbeddedPracticePanel.tsx](components/EmbeddedPracticePanel.tsx) — In-mastery practice (written, MCQ, short answer)
- [components/ReadinessDashboard.tsx](components/ReadinessDashboard.tsx) — Readiness score visualization

**Classification:** ⭐ CORE / FLAGSHIP

---

## 2. STUDY MODULE ⭐ (Flagship)

**What the user sees:** Browse all 9 ATP units and their topics. Select a topic, choose depth (Refresher / Standard / In-Depth), optionally enable embedded assessments, then receive AI-generated study notes with full Kenyan legal citations. Includes a "Case of the Day" feature showing landmark Kenyan cases with verbatim court excerpts. An "Ask AI" mode lets students ask questions about what they just studied.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/study/notes` | POST | Generate study notes for any topic at chosen depth |
| `/api/study/case-of-day` | GET | Fetch today's landmark Kenyan case (with rotation logic) |
| `/api/study/pacing` | GET | Get session/daily pacing state and break suggestions |
| `/api/study/pacing` | POST | Record pacing events (break taken, suggestion shown) |
| `/api/study/session` | POST | Start a new study session |
| `/api/study/session` | PATCH | End / update a study session |

**AI Models Used:**
- **GPT-5.2:** Generates study notes with statutory citations and case law references
- **GPT-5.2:** Generates embedded assessments (MCQs + scenarios + essay questions)

**Key Files:**
- [app/(app)/study/page.tsx](app/(app)/study/page.tsx) — Study module UI (808 lines)
- [lib/services/pacing-engine.ts](lib/services/pacing-engine.ts) — Pomodoro-style break detection, fatigue monitoring
- [lib/constants/legal-content.ts](lib/constants/legal-content.ts) — ATP units, topics, document types

**Classification:** ⭐ CORE / FLAGSHIP

---

## 3. QUIZZES & TRIVIA ⭐ (Flagship)

**What the user sees:** Choose from multiple quiz modes:
- **Adaptive Mode:** AI adapts difficulty to user level
- **SmartDrill:** Ordering, fill-ins & MCQs for deep mastery
- **Speed Round:** Timed rapid-fire questions
- **Quick 10:** Fast 10-question set
- **Exam Prep:** Exam-style questions
- **Infinity Mode:** Endless questions until you stop

Select one or more ATP units, then answer AI-generated questions with immediate feedback, explanations, and score tracking.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/ai/quiz-stream` | POST | SSE-streamed quiz question generation (instant first question) |
| `/api/submit` | POST | Submit quiz answers, update rankings, trigger preloading |
| `/api/questions` | GET | Fetch static questions by topic/difficulty |

**AI Models Used:**
- **GPT-5.2 (Orchestrator):** Streams quiz questions as JSON via SSE for instant loading
- **GPT-5.2:** Essay response evaluation (via `evaluateEssayResponse`)

**Key Files:**
- [app/(app)/quizzes/page.tsx](app/(app)/quizzes/page.tsx) — Quiz UI (1,473 lines)
- [lib/services/quiz-completion.ts](lib/services/quiz-completion.ts) — Post-quiz processing: rankings, preloading, achievements
- [lib/services/preloading.ts](lib/services/preloading.ts) — Predictive preloading of next quiz content

**Classification:** ⭐ CORE / FLAGSHIP

---

## 4. ORAL EXAMINATIONS ⭐ (Flagship)

**What the user sees:** Simulated oral exam with a 3-panelist board of AI-powered examiners (Justice Mwangi, Advocate Amara, Prof. Otieno). Two exam types:
- **Devil's Advocate:** Aggressive cross-examination to test argument defense
- **Oral Examiner:** Standard KSL oral exam simulation

Configurable settings: difficulty (Easy/Balanced/Aggressive), feedback mode (per-exchange or end), input mode (voice or text), unit focus, panelist count. Supports real-time voice input and TTS voice output for each panelist. Ends with a scored performance summary.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/oral-exams` | POST | Main oral exam interaction — generates panelist responses |
| `/api/oral-exams/sessions` | POST | Save completed session (transcript, score, audio) |
| `/api/oral-exams/sessions` | GET | Fetch past oral exam sessions |
| `/api/voice/stt` | POST | Speech-to-text via Whisper |
| `/api/voice/tts` | POST | Text-to-speech for panelist voices |

**AI Models Used:**
- **GPT-5.2 (via OpenAI):** Powers all 3 panelist personas with distinct styles, generates follow-up questions, scores responses
- **OpenAI Whisper:** Speech-to-text for voice input
- **OpenAI TTS-1:** Text-to-speech with distinct voices per panelist (onyx, nova, echo)

**Key Files:**
- [app/(app)/oral-exams/page.tsx](app/(app)/oral-exams/page.tsx) — Oral exam UI (1,496 lines)
- [components/AiThinkingIndicator.tsx](components/AiThinkingIndicator.tsx) — Visual indicator while AI generates responses

**Classification:** ⭐ CORE / FLAGSHIP

---

## 5. LEGAL DRAFTING ⭐ (Flagship)

**What the user sees:** Browse document types across 9 categories (Pleadings, Affidavits, Submissions, Contracts, Conveyancing, Corporate, Opinions, Criminal, Notices). Selecting a document opens a two-mode experience:
- **Learn Mode:** Step-by-step guided lesson with checkpoints on how to draft the document
- **Practice Mode:** Write the document yourself (timed or untimed), then get AI grading with redline annotations, rubric scores, and specific feedback

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/ai/chat` | POST | Generates drafting lessons and guided content |
| `/api/ai/chat-stream` | POST | Streaming drafting assistance |

**AI Models Used:**
- **GPT-5.2:** Generates step-by-step drafting lessons
- **Claude Sonnet 4 (Auditor):** `CritiqueEngine` produces Senior-Partner-grade redline annotations on student drafts with CLE rubric scores
- **GPT-5.2 (Grading):** Scores drafts against rubric dimensions

**Key Files:**
- [app/(app)/drafting/page.tsx](app/(app)/drafting/page.tsx) — Document type browser
- [app/(app)/drafting/[documentId]/page.tsx](app/(app)/drafting/%5BdocumentId%5D/page.tsx) — Individual drafting workspace (1,072 lines)
- [lib/services/critique-engine.ts](lib/services/critique-engine.ts) — Claude Sonnet 4 redline engine
- [lib/constants/legal-content.ts](lib/constants/legal-content.ts) — All document type definitions

**Classification:** ⭐ CORE / FLAGSHIP

---

## 6. WRITTEN EXAMINATIONS ⭐ (Core)

**What the user sees:** CLE-format exam simulation. Select an ATP unit, choose paper size (Mini 15-mark/30min, Semi 30-mark/60min, Full 60-mark/180min), then take an AI-generated exam with essay questions and marking schemes. Includes a timer, rich text editor, and AI grading with model answers.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/preload` | POST | Preloads exam papers by unit/size with progress-based personalization |
| `/api/exams/record` | POST | Records exam results for progress tracking |

**AI Models Used:**
- **GPT-5.2:** Generates exam questions, model answers, and marking rubrics tailored to unit and paper size

**Key Files:**
- [app/(app)/exams/page.tsx](app/(app)/exams/page.tsx) — Exam simulation UI (490 lines)
- [lib/services/preloading.ts](lib/services/preloading.ts) — Pre-generates exam papers

**Classification:** ⭐ CORE

---

## 7. AI CHAT & CLARIFICATION ⭐ (Core)

**What the user sees:** Full-screen AI chat for getting clarification on any legal concept. Supports multiple input types:
- Text messages
- Image uploads (photos of textbooks, notes, past papers)
- Voice recordings (transcribed via Whisper)
- Document uploads (PDF, Word)

The AI provides warm, mentor-style explanations grounded in Kenyan law with proper citations. Session history is maintained for context-aware follow-ups.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/ai/chat` | POST | Non-streaming AI response with guardrails |
| `/api/ai/chat-stream` | POST | SSE streaming AI response with personality modes |
| `/api/upload` | POST | Handle image/document/audio uploads |
| `/api/transcribe` | POST | Voice transcription via Whisper |

**AI Models Used:**
- **GPT-5.2 (Orchestrator):** Streaming chat responses with Kenyan law context
- **GPT-5.2:** Non-streaming chat with guardrails (hallucination detection, off-topic filtering)
- **OpenAI Whisper:** Voice message transcription
- **GPT-4o (Vision):** Image analysis for uploaded photos of notes/textbooks

**Key Files:**
- [app/(app)/clarify/page.tsx](app/(app)/clarify/page.tsx) — Clarification chat UI (543 lines)
- [lib/ai/guardrails.ts](lib/ai/guardrails.ts) — AI guardrails, hallucination detection, response generation (1,043 lines)

**Classification:** ⭐ CORE

---

## 8. LEGAL RESEARCH ⭐ (Core)

**What the user sees:** AI-powered legal research assistant. Ask any legal question and get structured research findings with proper citations to Kenyan statutes, case law, and constitutional provisions. Features suggestion chips for common research topics and web search toggle. Supports file attachments.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/ai/chat-stream` | POST | Streaming research responses with `research` personality |
| `/api/ai/chat` | POST | Non-streaming research via `generateResearchResponse` |
| `/api/citations/lookup` | GET | Look up statute sections from the knowledge base |

**AI Models Used:**
- **GPT-5.2:** Generates structured research findings with case law and statutory citations
- **OpenAI Embeddings:** RAG retrieval from knowledge base for grounding

**Key Files:**
- [app/(app)/research/page.tsx](app/(app)/research/page.tsx) — Research UI (403 lines)
- [lib/services/authority-retrieval-service.ts](lib/services/authority-retrieval-service.ts) — Web search + allowlist-filtered authority retrieval
- [lib/services/retrieval-service.ts](lib/services/retrieval-service.ts) — Retrieval-first grounding from outlines, lectures, authorities
- [lib/citations.tsx](lib/citations.tsx) — Citation parsing and rendering

**Classification:** ⭐ CORE

---

## 9. COMMUNITY

**What the user sees:** Social features including:
- **Study Rooms:** Official per-unit rooms + custom rooms with real-time messaging
- **Discussion Threads:** Forum-style threads with categories, voting, and replies
- **Weekly Rankings:** Leaderboard with points from quizzes, streaks, and study time
- **Friends:** Friend suggestions, requests, and connections based on study overlap
- **Community Events:** Weekly challenges (trivia, reading, quiz marathon, drafting, research) with prizes

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/community/rooms` | GET/POST | List/create study rooms |
| `/api/community/threads` | GET/POST | List/create discussion threads |
| `/api/community/rankings` | GET/POST | Weekly leaderboard (Nairobi time boundaries) |
| `/api/community/friends` | GET/POST/DELETE | Friends list, suggestions, requests |
| `/api/community/events` | GET/POST | Community challenges and events |
| `/api/community/username` | GET/POST/PUT | Community profile and username management |

**AI Models Used:**
- **GPT-5.2:** Generates community challenge questions for events

**Key Files:**
- [app/(app)/community/page.tsx](app/(app)/community/page.tsx) — Community hub UI (1,960 lines)

**Classification:** Supporting

---

## 10. TUTOR OS / STUDY PLANNER

**What the user sees:** An AI tutor dashboard showing today's personalized study items (reading, case studies, practice questions, quizzes, reviews, drafting, research), daily stats (items completed, minutes studied, streak), and case recommendations. Integrates spaced repetition cards for optimal review scheduling.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/tutor/today` | GET | Today's study items, stats, exam timeline, precomputed sessions |
| `/api/tutor/plan` | GET/POST | Fetch/generate personalized study plan |
| `/api/tutor/review` | GET/POST | Spaced repetition card review |
| `/api/tutor/guide` | GET | System-guided study recommendations |
| `/api/exam/profile` | GET/POST | User's exam cycle profile |
| `/api/exam/timeline` | GET | Exam event timeline |

**AI Models Used:**
- **GPT-5.2:** Generates study plans based on user profile, weak areas, and exam timeline

**Key Files:**
- [app/(app)/tutor/page.tsx](app/(app)/tutor/page.tsx) — Tutor dashboard UI (580 lines)
- [lib/services/study-planner.ts](lib/services/study-planner.ts) — AI study plan generation (790 lines)
- [lib/services/study-guide-algorithm.ts](lib/services/study-guide-algorithm.ts) — Recommendation engine (916 lines)
- [lib/services/spaced-repetition.ts](lib/services/spaced-repetition.ts) — SM-2 algorithm for review scheduling
- [lib/services/session-orchestrator.ts](lib/services/session-orchestrator.ts) — Determines what to study next based on coverage debt
- [lib/services/autopilot-precompute.ts](lib/services/autopilot-precompute.ts) — Pre-generates study session assets

**Classification:** Core

---

## 11. DASHBOARD

**What the user sees:** Home page with at-a-glance stats (questions attempted, accuracy), study streak information, module quick-links (Drafting, Study, Exams, Quizzes, Oral Exams, Research, Banter, Clarification), AI-generated personalized recommendations (what to study next), and weak/strong area highlights.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/progress` | GET | Overall progress stats by unit |
| `/api/streaks` | GET | Current streak, weekly activity data |
| `/api/ai/suggestions` | POST | AI-generated study suggestions based on weak areas |

**AI Models Used:**
- **GPT-5.2:** Generates personalized study suggestions

**Key Files:**
- [app/(app)/dashboard/page.tsx](app/(app)/dashboard/page.tsx) — Dashboard UI (458 lines)

**Classification:** Core

---

## 12. MY PROGRESS

**What the user sees:** Comprehensive progress report showing:
- Overall mastery percentage with verified skill count
- Study time analytics (total, weekly, session average, current streak)
- Quiz statistics (accuracy, total questions)
- Per-unit breakdown with mastery scores and trends
- Strengths and weaknesses with specific skill names
- 7-day activity chart
- Format breakdown (written, oral, drafting attempts and scores)

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/mastery/report` | GET | Weekly evidence-based progress report |
| `/api/progress` | GET | Overall progress with unit breakdown |
| `/api/streaks` | GET | Streak and activity data |

**AI Models Used:**
- None directly (evidence-based metrics from mastery engine)

**Key Files:**
- [app/(app)/progress/page.tsx](app/(app)/progress/page.tsx) — Progress report UI (599 lines)

**Classification:** Core

---

## 13. LEGAL BANTER

**What the user sees:** Fun break area with AI-generated legal entertainment across 6 categories: Jokes, Fun Facts, Wild Cases, Puns, World Laws, Pop Culture. Includes a "Roast Zone" where students can trade legal burns with the AI. Each piece can be rated, and preferences influence future content. Has a personalized greeting.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/ai/banter` | POST | Generates greeting, content, or roast response |

**AI Models Used:**
- **GPT-5.2 (Fast):** Generates jokes, facts, cases, puns, roasts — via `callAIFast`

**Key Files:**
- [app/(app)/banter/page.tsx](app/(app)/banter/page.tsx) — Banter UI (625 lines)
- [lib/services/banter-service.ts](lib/services/banter-service.ts) — Content library + session rewards

**Classification:** Supporting / Engagement

---

## 14. ONBOARDING

**What the user sees:** Multi-step onboarding wizard collecting:
- Name, occupation, years in law
- Bar exam attempt history  
- Study preferences (time, hours, style)
- Self-assessment (confidence level, weak/strong units)
- Goals and target exam date
- Mentorship interest

Data used to create personalized study plan and mastery queue.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/onboarding` | POST | Save onboarding data, initialize mastery state for all skills |

**AI Models Used:**
- **GPT-5.2 (Orchestrator):** Generates initial personalized study plan from onboarding data

**Key Files:**
- [app/(app)/onboarding/page.tsx](app/(app)/onboarding/page.tsx) — Onboarding wizard (811 lines)

**Classification:** Core (required flow)

---

## 15. SUBSCRIPTION & PAYMENTS

**What the user sees:** Pricing page with 3 plans (Weekly KES 500, Monthly KES 1,500, Annual KES 12,000) via Paystack (Card/M-Pesa). Free trial: 3 days with limited features (3 drafting docs, 2 Devil's Advocate sessions, 2 oral exam sessions). Premium unlocks everything.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/payments/initialize` | POST | Initialize Paystack transaction |
| `/api/payments/verify` | GET | Verify payment and activate subscription |
| `/api/payments/status` | GET | Current subscription status and feature access |
| `/api/payments/webhook` | POST | Paystack webhook (charge.success, subscription events) |

**AI Models Used:** None

**Key Files:**
- [app/(app)/subscribe/page.tsx](app/(app)/subscribe/page.tsx) — Pricing page UI (448 lines)
- [lib/services/subscription.ts](lib/services/subscription.ts) — Trial limits, feature gating, plan management
- [components/TrialLimitReached.tsx](components/TrialLimitReached.tsx) — Paywall modal

**Classification:** Core (monetization)

---

## 16. CHAT HISTORY

**What the user sees:** Chronological activity history combining page visits, conversations, study sessions, and milestones. Filterable by type (All, Page Visits, Conversations, Study, Milestones). Shows time ago, section icon, and duration.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/history` | GET | Aggregated activity from chat_sessions, study_sessions, streaks |
| `/api/chat/sessions` | GET | List chat sessions with message counts |
| `/api/page-visits` | GET/POST | Record and retrieve page visit history |

**AI Models Used:** None

**Key Files:**
- [app/(app)/history/page.tsx](app/(app)/history/page.tsx) — History UI (399 lines)

**Classification:** Supporting

---

## 17. ADMIN PANEL

**What the user sees:** Admin-only dashboard with tabs for:
- **Analytics:** User count, active users, session counts, AI interactions, completion rates
- **User Management:** View/edit users, manage roles
- **Content Management:** CRUD for topics, questions, RAG knowledge entries
- **KSL Timelines:** Manage exam intake dates
- **Micro-Skills:** Manage skill definitions, item-skill mappings, error tags
- **Community:** Approve/reject room creation requests
- **Transcripts:** Upload and manage lecture transcripts
- **Background Jobs:** View job status and statistics
- **Settings:** Feature flags, daily goals, maintenance mode

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/admin/analytics` | GET | Platform-wide usage analytics |
| `/api/admin/settings` | GET/PUT | Platform settings and feature flags |
| `/api/admin/knowledge` | GET/POST/PUT/DELETE | RAG knowledge base management |
| `/api/admin/timelines` | GET/POST/PUT/DELETE | KSL exam timeline management |
| `/api/admin/topics` | GET/POST | Topic CRUD |
| `/api/admin/questions` | POST | Add quiz questions |
| `/api/admin/skills` | GET/POST/PUT | Micro-skill management |
| `/api/admin/items` | GET | List practice items with skill mappings |
| `/api/admin/item-skill-map` | POST/DELETE | Item-to-skill mapping management |
| `/api/admin/transcripts` | GET/POST | Lecture transcript upload and management |
| `/api/admin/jobs` | GET/POST | Background job monitoring |
| `/api/admin/community` | GET/POST | Room request approval/rejection |

**AI Models Used:** None directly (admin manages AI-consumed data)

**Key Files:**
- [app/(app)/admin/page.tsx](app/(app)/admin/page.tsx) — Admin panel UI (1,145 lines)

**Classification:** Supporting (internal)

---

## 18. FLOATING CHAT (Global Component)

**What the user sees:** A floating chat bubble available on most pages (disabled during exams, quizzes, clarify). Supports text input, image/document attachments, and voice recording. Context-aware — adapts personality based on current page (study, research, drafting, etc.). Can be triggered externally (e.g., "Ask AI" from MasteryCarousel).

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/ai/chat-stream` | POST | Streaming chat with personality modes |
| `/api/upload` | POST | File uploads within chat |
| `/api/transcribe` | POST | Voice message transcription |

**AI Models Used:**
- **GPT-5.2 (Orchestrator):** Streaming responses with page-specific personality
- **OpenAI Whisper:** Voice transcription

**Key Files:**
- [components/FloatingChat.tsx](components/FloatingChat.tsx) — Floating chat widget (673 lines)

**Classification:** Core (cross-cutting)

---

## 19. VOICE SERVICES

**What the user sees:** Voice input across the platform (clarification, oral exams, floating chat) and voice output (oral exam panelist responses).

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/voice/stt` | POST | Speech-to-text via OpenAI Whisper |
| `/api/voice/tts` | POST | Text-to-speech via OpenAI TTS-1 (multiple voices) |
| `/api/transcribe` | POST | Alternative transcription endpoint |

**AI Models Used:**
- **OpenAI Whisper:** Speech recognition
- **OpenAI TTS-1:** Speech synthesis with voices: alloy, echo, fable, onyx, nova, shimmer

**Key Files:**
- [app/api/voice/stt/route.ts](app/api/voice/stt/route.ts)
- [app/api/voice/tts/route.ts](app/api/voice/tts/route.ts)
- [app/api/transcribe/route.ts](app/api/transcribe/route.ts)

**Classification:** Supporting (infrastructure)

---

## 20. STUDY STREAKS & GAMIFICATION

**What the user sees:** Daily streak counter, weekly activity heatmap, study time tracking. Streaks encourage daily engagement and are displayed on the dashboard and sidebar.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/streaks` | GET | Current streak, longest streak, weekly activity data |
| `/api/page-visits` | POST | Track time on each page section |

**AI Models Used:** None

**Key Files:**
- [app/api/streaks/route.ts](app/api/streaks/route.ts)
- [lib/hooks/useTimeTracker.ts](lib/hooks/useTimeTracker.ts) — Client-side time tracking hook

**Classification:** Supporting (engagement)

---

## 21. CITATION LOOKUP

**What the user sees:** Clicking a statute reference in study notes opens a panel showing the actual statutory text. The system extracts section numbers and fetches relevant provisions from the knowledge base.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/citations/lookup` | GET | Full-text statute lookup with section extraction |

**AI Models Used:** None (rule-based text extraction + DB lookup)

**Key Files:**
- [app/api/citations/lookup/route.ts](app/api/citations/lookup/route.ts) — Statute text extraction and search
- [lib/citations.tsx](lib/citations.tsx) — Citation parsing, rendering, and StatutePanel component
- [components/NotesReader.tsx](components/NotesReader.tsx) — Notes display with citation chips

**Classification:** Supporting (enhances study)

---

## 22. NOTIFICATIONS & REMINDERS

**What the user sees:** In-app notification bell with toast alerts, email reminders (daily study nudges, weekly progress reports, fun facts), and web push notifications. Notifications are context-aware based on study patterns.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/cron/tick` | GET | Scheduled task: sends daily/weekly emails, push notifications, cleanup |

**AI Models Used:**
- **GPT-5.2:** Personalizes reminder email content with AI-planned study topics

**Key Files:**
- [lib/services/notification-service.ts](lib/services/notification-service.ts) — Email (Brevo API), web push (VAPID), in-app notifications (939 lines)
- [lib/services/reminder-policies.ts](lib/services/reminder-policies.ts) — Trigger conditions, cooldowns, streak-at-risk alerts (560 lines)
- [components/NotificationBell.tsx](components/NotificationBell.tsx) — Bell icon + notification dropdown + toast
- [contexts/NotificationContext.tsx](contexts/NotificationContext.tsx) — Notification state management

**Classification:** Supporting (retention)

---

## 23. AUTONOMOUS PRELOADING

**What the user sees:** Nothing directly — this runs silently in the background. Preloads mastery plan, readiness data, recommendations, and quiz content before the user navigates to them, so pages load instantly.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/preload` | POST | Content preloading (exams, quizzes) with caching |
| All mastery/tutor endpoints | Various | Pre-fetched by autonomous preload |

**AI Models Used:**
- **GPT-5.2:** Generates preloaded content (exam papers, quiz questions)

**Key Files:**
- [lib/services/autonomous-preload.ts](lib/services/autonomous-preload.ts) — TikTok-style anticipatory loading (391 lines)
- [lib/services/autopilot-precompute.ts](lib/services/autopilot-precompute.ts) — Pre-generates study session assets

**Classification:** Supporting (performance)

---

## 24. BACKGROUND WORKER

**What the user sees:** Nothing directly — processes async jobs for content generation.

**Job Types:**
- `GENERATE_NOTES` — AI study notes
- `GENERATE_PRACTICE_SET` — AI practice questions
- `GENERATE_WEEKLY_REPORT` — Progress reports
- `PRECOMPUTE_COVERAGE` — Coverage analysis
- `GENERATE_SESSION_ASSETS` — All assets for a study session
- `GENERATE_RETEST_VARIANT` — Variant questions for retesting
- `RETRIEVE_AUTHORITIES` — Fetch and store legal authorities
- `SEND_REMINDER_EMAIL` — Via Brevo
- `SEND_PUSH_REMINDER` — Web push

**Key Files:**
- [lib/services/background-worker.ts](lib/services/background-worker.ts) — Job processing (1,062 lines)

**Classification:** Supporting (infrastructure)

---

## 25. PWA INSTALL

**What the user sees:** A floating prompt at bottom-right offering to install the app on their device for offline access. Registers a service worker.

**Key Files:**
- [components/PWAInstallPrompt.tsx](components/PWAInstallPrompt.tsx) — Install prompt (60 lines)
- [public/sw.js](public/sw.js) — Service worker
- [public/manifest.json](public/manifest.json) — PWA manifest

**Classification:** Supporting

---

## 26. CASE OF THE DAY

**What the user sees:** A daily featured landmark Kenyan case displayed on the Study page with facts, issues, holdings, ratio, significance, and verbatim court excerpts. Cases rotate daily from a curated library of post-2010 Constitution era cases.

**API Endpoints:**
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/study/case-of-day` | GET | Fetch/rotate today's case |

**AI Models Used:**
- **GPT-5.2:** Generates case summaries and analysis for non-curated cases

**Key Files:**
- [app/api/study/case-of-day/route.ts](app/api/study/case-of-day/route.ts) — Curated case library + rotation logic (703 lines)

**Classification:** Supporting (engagement)

---

## 27. KNOWLEDGE BASE & RAG

**What the user sees:** Nothing directly — underpins the quality of all AI-generated content by grounding it in verified Kenyan legal sources.

**Components:**
- **Embedding Service:** OpenAI embeddings for semantic search over knowledge base
- **Authority Records:** Vetted statutes, cases, regulations stored with full text
- **Lecture Transcripts:** Chunked, embedded, and skill-mapped lecture content
- **Outline Topics:** ATP curriculum outlines mapped to micro-skills

**Key Files:**
- [lib/ai/embedding-service.ts](lib/ai/embedding-service.ts) — Vector search and RAG retrieval
- [lib/knowledge/kenyan-law-base.ts](lib/knowledge/kenyan-law-base.ts) — Legal provisions and case law
- [lib/services/authority-retrieval-service.ts](lib/services/authority-retrieval-service.ts) — Web search + allowlist authority retrieval (836 lines)
- [lib/services/transcript-service.ts](lib/services/transcript-service.ts) — Lecture transcript processing (633 lines)
- [lib/services/transcript-ingestion.ts](lib/services/transcript-ingestion.ts) — Transcript upload, chunking, embedding (606 lines)

**Classification:** Supporting (infrastructure, quality)

---

## 28. SIDEBAR & NAVIGATION

**What the user sees:** Collapsible sidebar with navigation to all modules: Mastery Hub, Dashboard, My Progress, Legal Drafting, Study, Examinations, Oral Exams, Quizzes & Trivia, Community, Research, Get Clarification, Legal Banter, Chat History. Shows user avatar, theme toggle, notification bell, and upgrade button for free users.

**Key Files:**
- [components/Sidebar.tsx](components/Sidebar.tsx) — Navigation sidebar (267 lines)
- [components/AuthenticatedLayout.tsx](components/AuthenticatedLayout.tsx) — Layout wrapper
- [contexts/SidebarContext.tsx](contexts/SidebarContext.tsx) — Collapse state

**Classification:** Supporting (navigation)

---

## 29. THEME & UI

**What the user sees:** Dark/light mode toggle, consistent design system with shadcn/ui components.

**Key Files:**
- [components/ThemeToggle.tsx](components/ThemeToggle.tsx)
- [contexts/ThemeContext.tsx](contexts/ThemeContext.tsx)
- [components/ui/](components/ui/) — shadcn/ui component library
- [app/globals.css](app/globals.css) — Global styles

**Classification:** Supporting

---

## 30. AUTH & USER MANAGEMENT

**What the user sees:** Firebase-based authentication (login/signup). User profile stored in PostgreSQL (Neon DB) linked via Firebase UID.

**Key Files:**
- [contexts/AuthContext.tsx](contexts/AuthContext.tsx) — Firebase auth state management
- [lib/auth/middleware.ts](lib/auth/middleware.ts) — `withAuth`, `withAdminAuth`, `verifyAuth` middleware
- [lib/firebase/admin.ts](lib/firebase/admin.ts) — Firebase Admin SDK

**Classification:** Core (infrastructure)

---

## COMPLETE API ENDPOINT INVENTORY

### AI Routes (`/api/ai/`)
| Endpoint | Method | AI Model |
|---|---|---|
| `/api/ai/chat` | POST | GPT-5.2 (multiple personalities) |
| `/api/ai/chat-stream` | POST | GPT-5.2 (streaming, personality-aware) |
| `/api/ai/quiz-stream` | POST | GPT-5.2 (SSE quiz generation) |
| `/api/ai/banter` | POST | GPT-5.2 (fast, entertainment) |
| `/api/ai/suggestions` | POST | GPT-5.2 (study suggestions) |

### Mastery Routes (`/api/mastery/`)
| Endpoint | Method | AI Model |
|---|---|---|
| `/api/mastery/plan` | GET/POST/PATCH | GPT-5.2 (Orchestrator) |
| `/api/mastery/content` | GET | GPT-5.2 (Mentor + Assessment) |
| `/api/mastery/item` | GET | GPT-5.2 (item generation) |
| `/api/mastery/attempt` | POST/GET | GPT-5.2 (grading) |
| `/api/mastery/notes` | GET | GPT-5.2 (Mentor) |
| `/api/mastery/progress` | POST | None (algorithmic) |
| `/api/mastery/readiness` | GET | None (evidence-based) |
| `/api/mastery/report` | GET | None (evidence-based) |

### Study Routes (`/api/study/`)
| Endpoint | Method | AI Model |
|---|---|---|
| `/api/study/notes` | POST | GPT-5.2 |
| `/api/study/case-of-day` | GET | GPT-5.2 (fallback) |
| `/api/study/pacing` | GET/POST | None (algorithmic) |
| `/api/study/session` | POST/PATCH | None |

### Tutor Routes (`/api/tutor/`)
| Endpoint | Method | AI Model |
|---|---|---|
| `/api/tutor/today` | GET | None (precomputed) |
| `/api/tutor/plan` | GET/POST | GPT-5.2 (study planning) |
| `/api/tutor/review` | GET/POST | None (SM-2 algorithm) |
| `/api/tutor/guide` | GET | None (algorithmic) |

### Oral Exam Routes (`/api/oral-exams/`)
| Endpoint | Method | AI Model |
|---|---|---|
| `/api/oral-exams` | POST | GPT-5.2 (3 panelists) |
| `/api/oral-exams/sessions` | GET/POST | None |

### Community Routes (`/api/community/`)
| Endpoint | Method | AI Model |
|---|---|---|
| `/api/community/rooms` | GET/POST | None |
| `/api/community/threads` | GET/POST | None |
| `/api/community/rankings` | GET/POST | None |
| `/api/community/friends` | GET/POST/DELETE | None |
| `/api/community/events` | GET/POST | GPT-5.2 (challenge questions) |
| `/api/community/username` | GET/POST/PUT | None |

### Voice Routes (`/api/voice/`)
| Endpoint | Method | AI Model |
|---|---|---|
| `/api/voice/stt` | POST | Whisper |
| `/api/voice/tts` | POST | TTS-1 |

### Payment Routes (`/api/payments/`)
| Endpoint | Method | AI Model |
|---|---|---|
| `/api/payments/initialize` | POST | None |
| `/api/payments/verify` | GET | None |
| `/api/payments/status` | GET | None |
| `/api/payments/webhook` | POST | None |

### Exam Routes (`/api/exam/`)
| Endpoint | Method | AI Model |
|---|---|---|
| `/api/exam/profile` | GET/POST | None |
| `/api/exam/timeline` | GET | None |
| `/api/exams/record` | POST | None |

### Admin Routes (`/api/admin/`)
| Endpoint | Method | AI Model |
|---|---|---|
| `/api/admin/analytics` | GET | None |
| `/api/admin/settings` | GET/PUT | None |
| `/api/admin/knowledge` | GET/POST/PUT/DELETE | None |
| `/api/admin/timelines` | GET/POST/PUT/DELETE | None |
| `/api/admin/topics` | GET/POST | None |
| `/api/admin/questions` | POST | None |
| `/api/admin/skills` | GET/POST/PUT | None |
| `/api/admin/items` | GET | None |
| `/api/admin/item-skill-map` | POST/DELETE | None |
| `/api/admin/transcripts` | GET/POST | None |
| `/api/admin/jobs` | GET/POST | None |
| `/api/admin/community` | GET/POST | None |

### Other Routes
| Endpoint | Method | AI Model |
|---|---|---|
| `/api/onboarding` | POST | GPT-5.2 (initial plan) |
| `/api/preload` | POST | GPT-5.2 (content generation) |
| `/api/progress` | GET | None |
| `/api/streaks` | GET | None |
| `/api/history` | GET | None |
| `/api/submit` | POST | GPT-5.2 (essay grading) |
| `/api/questions` | GET | None |
| `/api/topics` | GET | None |
| `/api/upload` | POST | GPT-4o (vision) |
| `/api/transcribe` | POST | Whisper |
| `/api/citations/lookup` | GET | None |
| `/api/chat/sessions` | GET | None |
| `/api/page-visits` | GET/POST | None |
| `/api/cron/tick` | GET | GPT-5.2 (email content) |
| `/api/notes/[assetId]` | GET | None |

---

## COMPLETE SERVICES INVENTORY

| Service File | Purpose | AI Model |
|---|---|---|
| `mastery-orchestrator.ts` | Daily queue generation, node advancement | GPT-5.2 |
| `mastery-engine.ts` | Core mastery algorithm, gate verification | None (algorithmic) |
| `mastery-db-service.ts` | DB persistence for mastery state | None |
| `grading-service.ts` | Structured AI grading | GPT-5.2 |
| `narrative-renderer.ts` | AI study note generation | GPT-5.2 (Mentor) |
| `assessment-generator.ts` | 3-level assessment stacks | GPT-5.2 |
| `checkpoint-generator.ts` | Inline checkpoint questions | GPT-5.2 |
| `critique-engine.ts` | Redline draft critique | Claude Sonnet 4 |
| `remediation-engine.ts` | Prescribes remediation for failed gates | None (algorithmic) |
| `pacing-engine.ts` | Pomodoro breaks, fatigue detection | None (algorithmic) |
| `spaced-repetition.ts` | SM-2 algorithm for review scheduling | None (algorithmic) |
| `study-planner.ts` | AI study plan generation | GPT-5.2 |
| `study-guide-algorithm.ts` | Weighted recommendation engine | None (algorithmic) |
| `session-orchestrator.ts` | Coverage debt, exam phase planning | None (algorithmic) |
| `subscription.ts` | Trial limits, feature gating | None |
| `notification-service.ts` | Email (Brevo), push (VAPID), in-app | None |
| `reminder-policies.ts` | Context-aware reminder scheduling | None |
| `banter-service.ts` | Content library, session rewards | None (static + AI) |
| `quiz-completion.ts` | Post-quiz processing, rankings | None |
| `autonomous-preload.ts` | Background data preloading | None |
| `autopilot-precompute.ts` | Pre-generates session assets | None |
| `background-worker.ts` | Async job processing | GPT-5.2 (generation) |
| `retrieval-service.ts` | RAG grounding from DB sources | None |
| `authority-retrieval-service.ts` | Web search authority fetching | GPT-5.2 |
| `transcript-service.ts` | Lecture transcript processing | None |
| `transcript-ingestion.ts` | Transcript upload, chunking, embedding | OpenAI Embeddings |
| `preloading.ts` | Client-side preloading hooks | None |
| `generators/session-blueprint.ts` | Activity mix computation | None |
| `generators/grounding-validator.ts` | Content grounding validation | None |
| `generators/rubric-generator.ts` | Rubric generation | GPT-5.2 |
| `generators/written-generators.ts` | Written content generation | GPT-5.2 |

---

## SUMMARY STATISTICS

| Metric | Count |
|---|---|
| **Total App Pages** | 17 (+ 1 layout) |
| **Total API Route Files** | 55+ |
| **Total API Endpoints** | ~75 (GET/POST/PATCH/PUT/DELETE) |
| **Total Service Files** | 28 |
| **Total Component Files** | 17 |
| **AI-Powered Endpoints** | ~25 |
| **Flagship Features** | 5 (Mastery Hub, Study, Quizzes, Oral Exams, Legal Drafting) |
| **Core Features** | 8 (Clarification, Research, Dashboard, Progress, Tutor, Exams, Floating Chat, Onboarding) |
| **Supporting Features** | 10+ (Community, Banter, History, Streaks, Notifications, PWA, etc.) |
| **Payment Provider** | Paystack (M-Pesa + Card) |
| **Database** | PostgreSQL (Neon) with pgvector |
| **Auth** | Firebase Authentication |
| **Email** | Brevo HTTP API |
| **Deployment** | Render (render.yaml) |
