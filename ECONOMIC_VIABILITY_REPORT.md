# YNAI Economic Viability Report
## Kenya Bar Exam Prep — AI Cost vs. Revenue Analysis
### Prepared: June 2025 | Market Context: KSL March 2026 Cohort

---

## 1. Executive Summary

YNAI (ynai.co.ke) is an AI-powered Kenya Bar Exam preparation platform serving Kenya School of Law (KSL) students. This report analyzes the economic viability of the platform by mapping **all 36 AI API call sites** against current model pricing and projecting costs across three realistic usage scenarios.

**Bottom Line:** The platform is economically viable at moderate-to-high adoption with monthly/annual subscribers, but requires careful monitoring of heavy users and the high cost of GPT-5.2 calls.

---

## 2. KSL Market Context (March 2026 Cohort)

| Metric | Value | Source |
|--------|-------|--------|
| Students per KSL cohort | ~2,000–2,500 | KSL typical intake |
| Annual graduation rate | ~60–70% pass | Historical CLE pass rates |
| April resit candidates | ~800–1,000 per cycle | Failed/deferred students |
| Total addressable market (TAM) | ~3,000–3,500 | Current students + resitters |
| Realistic serviceable market (SAM) | ~500–1,000 | Tech-savvy, willing to pay |
| KSL term structure | 3 terms × 11 weeks | Jan–Nov academic year |
| Monthly KSL student stipend/budget | KES 15,000–30,000 | Typical student range |

**Key insight:** KSL students are a concentrated, motivated market. Bar exam prep is high-stakes — failure means 6+ months delay and retake fees. Students are willing to pay for an edge.

---

## 3. Revenue Model

### 3.1 Subscription Tiers

| Plan | Price (KES) | Price (USD ~@ 130 KES/$) | Billing Period |
|------|-------------|--------------------------|----------------|
| Weekly | 500 | $3.85 | 7 days |
| Monthly | 1,500 | $11.54 | 30 days |
| Annual | 12,000 | $92.31 | 365 days |

### 3.2 Free Trial

- **Duration:** 3 days
- **Limits:** Mastery Hub unlimited, 3 drafting docs, 2 oral AI sessions (Devil's Advocate + Oral Exam)
- **Conversion target:** 15–30% trial → paid

---

## 4. Complete AI Model Inventory

### 4.1 Models Used & Current Pricing (as of mid-2025)

| Model | Provider | Input (per 1M tokens) | Output (per 1M tokens) | Used For |
|-------|----------|----------------------|------------------------|----------|
| **gpt-5.2** | OpenAI | ~$2.00 | ~$8.00 | Orchestrator, Mentor, Grading, Assessment, Fast ops (18 call sites) |
| **gpt-4o-mini** | OpenAI | $0.15 | $0.60 | Chat, oral exams, community, study notes, case-of-day (10 call sites) |
| **gpt-4o** | OpenAI | $2.50 | $10.00 | Image analysis in chat (conditional, rare) |
| **claude-sonnet-4** | Anthropic | $3.00 | $15.00 | Auditor/critique engine (1 call site) |
| **gemini-2.0-flash** | Google | $0.10 | $0.40 | Quiz preloading (1 call site) |
| **whisper-1** | OpenAI | $0.006/min | — | Speech-to-text (3 call sites) |
| **tts-1** | OpenAI | $15.00/1M chars | — | Text-to-speech (1 call site) |

### 4.2 All 36 AI Call Sites

| # | Feature | Model | Avg Input Tokens | Avg Output Tokens | Calls/Session | Notes |
|---|---------|-------|-----------------|-------------------|---------------|-------|
| **Chat & Tutoring** | | | | | | |
| 1 | Floating chat (standard) | gpt-4o-mini | 1,500 | 800 | 5–15/day | Most frequent feature |
| 2 | Floating chat (smart mode) | gpt-5.2 | 2,000 | 2,000 | 1–3/day | Premium deep queries |
| 3 | Floating chat (image) | gpt-4o | 2,000 | 1,000 | 0–1/day | Rare usage |
| **Mastery Hub** | | | | | | |
| 4 | Study notes generation | gpt-5.2 (MENTOR) | 3,000 | 4,000 | 2–5/day | Grounded notes + web search |
| 5 | Narrative renderer | gpt-5.2 (MENTOR) | 2,500 | 3,500 | 1–3/day | "Senior Counsel" style |
| 6 | Practice item generation | gpt-5.2 | 1,500 | 2,000 | 3–8/day | MCQ, short-answer, written |
| 7 | Assessment generation | gpt-5.2 | 1,500 | 2,000 | 1–2/day | Stacked assessments |
| 8 | Checkpoint generation | gpt-5.2 | 1,200 | 1,500 | 0–1/day | Unit checkpoints |
| 9 | Grading service | gpt-5.2 | 2,000 | 1,500 | 2–5/day | Student submission grading |
| 10 | Pacing decision | gpt-5.2 | 800 | 500 | 1–3/day | AI decides pace adjustments |
| 11 | Queue re-prioritization | gpt-5.2 | 1,000 | 800 | 0–1/day | Error pattern analysis |
| **Oral Exams** | | | | | | |
| 12 | Devil's Advocate streaming | gpt-4o-mini | 2,000 | 150–700 | 5–15/session | Multi-turn conversation |
| 13 | Devil's Advocate non-stream | gpt-4o-mini | 2,000 | 150–700 | 5–15/session | Fallback path |
| 14 | Oral panel streaming | gpt-4o-mini | 2,000 | 120–550 | 5–15/session | 3-panelist board |
| 15 | Oral panel non-stream | gpt-4o-mini | 2,000 | 120–550 | 5–15/session | Fallback path |
| 16 | Session summary | gpt-4o-mini | 3,000 | 1,500 | 1/session | End-of-session feedback |
| **Quizzes** | | | | | | |
| 17 | Quiz stream | gpt-5.2 | 1,500 | 2,000 | 1–3/day | On-demand quiz gen |
| 18 | Quiz preload | gemini-2.0-flash | 1,200 | 1,500 | 1–2/day | Background MCQ generation |
| **Study Features** | | | | | | |
| 19 | Study notes | gpt-4o-mini | 1,500 | 3,000 | 1–2/day | Quick topic notes |
| 20 | Case of the Day | gpt-4o-mini | 1,000 | 1,200 | 0–1/day | Daily case analysis |
| **Legal Research** | | | | | | |
| 21–23 | Authority retrieval (3 calls) | gpt-5.2 | 1,500 | 1,500 | 0–3/day | Case/statute URL finding + extraction |
| **Guardrails/AI Core** | | | | | | |
| 24 | Mentor call + web search | gpt-5.2 | 2,000 | 2,000 | 1–3/day | Grounded legal AI |
| 25–26 | Agentic tool-use (2 calls) | gpt-5.2 | 2,500 | 2,000 | 0–2/day | Multi-step reasoning |
| 27 | Fast preload | gpt-5.2 | 1,000 | 1,000 | 1–2/day | Background precompute |
| **Community** | | | | | | |
| 28 | Challenge generation | gpt-4o-mini | 1,500 | 4,000 | 0–1/day | Daily challenges |
| 29 | Challenge review | gpt-4o-mini | 1,000 | 400 | 0–1/day | User submission review |
| 30 | Challenge grading | gpt-4o-mini | 1,500 | 1,500 | 0–2/day | Answer grading |
| **Drafting** | | | | | | |
| 31 | Critique engine | claude-sonnet-4 | 3,000 | 1,500 | 1–2/session | Redline + CLE rubric |
| **Voice** | | | | | | |
| 32–34 | Speech-to-text (3 endpoints) | whisper-1 | ~1 min audio | — | 0–5/day | Voice input |
| 35 | Text-to-speech | tts-1 | — | ~500 chars | 0–3/day | Audio playback |
| **Onboarding** | | | | | | |
| 36 | Onboarding analysis | gpt-5.2 | 1,500 | 1,000 | 1 (once) | Signup questionnaire |

---

## 5. Per-User Cost Analysis — Three Scenarios

### Scenario A: Light User (Casual Studier)
*Profile: Signs up, uses mastery hub casually, does 1–2 sessions/week, no oral exams*

| Category | Model | Daily Calls | Input Tokens | Output Tokens | Daily Cost (USD) |
|----------|-------|-------------|-------------|---------------|-----------------|
| Chat (standard) | gpt-4o-mini | 3 | 4,500 | 2,400 | $0.002 |
| Mastery notes | gpt-5.2 | 1 | 3,000 | 4,000 | $0.038 |
| Practice items | gpt-5.2 | 2 | 3,000 | 4,000 | $0.038 |
| Grading | gpt-5.2 | 1 | 2,000 | 1,500 | $0.016 |
| Quiz preload | gemini-2.0-flash | 1 | 1,200 | 1,500 | $0.001 |
| Study notes | gpt-4o-mini | 1 | 1,500 | 3,000 | $0.002 |
| **Daily Total** | | | | | **$0.097** |
| **Monthly Total (22 active days)** | | | | | **$2.13** |

**Revenue vs Cost (Monthly sub @ KES 1,500 = $11.54):**
- **Gross margin: 81.5%** ✅

### Scenario B: Moderate User (Dedicated Student)
*Profile: Daily studier, uses mastery + quizzes + oral exams, active in community*

| Category | Model | Daily Calls | Input Tokens | Output Tokens | Daily Cost (USD) |
|----------|-------|-------------|-------------|---------------|-----------------|
| Chat (standard) | gpt-4o-mini | 8 | 12,000 | 6,400 | $0.006 |
| Chat (smart) | gpt-5.2 | 2 | 4,000 | 4,000 | $0.040 |
| Mastery notes | gpt-5.2 | 3 | 9,000 | 12,000 | $0.114 |
| Narrative renderer | gpt-5.2 | 2 | 5,000 | 7,000 | $0.066 |
| Practice items | gpt-5.2 | 5 | 7,500 | 10,000 | $0.095 |
| Assessment gen | gpt-5.2 | 1 | 1,500 | 2,000 | $0.019 |
| Grading | gpt-5.2 | 3 | 6,000 | 4,500 | $0.048 |
| Pacing/queue | gpt-5.2 | 2 | 1,800 | 1,300 | $0.014 |
| Quiz stream | gpt-5.2 | 2 | 3,000 | 4,000 | $0.038 |
| Quiz preload | gemini-2.0-flash | 1 | 1,200 | 1,500 | $0.001 |
| Study notes | gpt-4o-mini | 1 | 1,500 | 3,000 | $0.002 |
| Case of Day | gpt-4o-mini | 1 | 1,000 | 1,200 | $0.001 |
| Authority retrieval | gpt-5.2 | 2 | 3,000 | 3,000 | $0.030 |
| Guardrails/AI core | gpt-5.2 | 2 | 4,000 | 4,000 | $0.040 |
| Fast preload | gpt-5.2 | 1 | 1,000 | 1,000 | $0.010 |
| Oral exam (2 sessions/week = 0.3/day, 10 turns each) | gpt-4o-mini | 3 | 6,000 | 1,500 | $0.002 |
| Oral summary | gpt-4o-mini | 0.3 | 900 | 450 | $0.000 |
| Community | gpt-4o-mini | 1 | 1,500 | 1,500 | $0.001 |
| Voice STT | whisper-1 | 1 | 1 min | — | $0.006 |
| Voice TTS | tts-1 | 1 | 500 chars | — | $0.008 |
| **Daily Total** | | | | | **$0.541** |
| **Monthly Total (26 active days)** | | | | | **$14.07** |

**Revenue vs Cost (Monthly sub @ KES 1,500 = $11.54):**
- **Gross margin: -21.9%** ⚠️ (*Loss per user at monthly tier*)
- At **Annual tier** (KES 12,000 = $92.31/yr → $7.69/mo): **Margin: -45.4%** ❌

### Scenario C: Heavy User (Power Crammer / Resit Student)
*Profile: Multiple daily sessions, extensive oral practice, drafted documents, uses all features aggressively*

| Category | Model | Daily Calls | Input Tokens | Output Tokens | Daily Cost (USD) |
|----------|-------|-------------|-------------|---------------|-----------------|
| Chat (standard) | gpt-4o-mini | 15 | 22,500 | 12,000 | $0.011 |
| Chat (smart) | gpt-5.2 | 3 | 6,000 | 6,000 | $0.060 |
| Mastery notes | gpt-5.2 | 5 | 15,000 | 20,000 | $0.190 |
| Narrative renderer | gpt-5.2 | 3 | 7,500 | 10,500 | $0.099 |
| Practice items | gpt-5.2 | 8 | 12,000 | 16,000 | $0.152 |
| Assessment gen | gpt-5.2 | 2 | 3,000 | 4,000 | $0.038 |
| Checkpoint gen | gpt-5.2 | 1 | 1,200 | 1,500 | $0.014 |
| Grading | gpt-5.2 | 5 | 10,000 | 7,500 | $0.080 |
| Pacing/queue | gpt-5.2 | 3 | 2,700 | 1,950 | $0.021 |
| Quiz stream | gpt-5.2 | 3 | 4,500 | 6,000 | $0.057 |
| Quiz preload | gemini-2.0-flash | 2 | 2,400 | 3,000 | $0.001 |
| Study notes | gpt-4o-mini | 2 | 3,000 | 6,000 | $0.004 |
| Case of Day | gpt-4o-mini | 1 | 1,000 | 1,200 | $0.001 |
| Authority retrieval | gpt-5.2 | 5 | 7,500 | 7,500 | $0.075 |
| Guardrails/AI core | gpt-5.2 | 4 | 8,000 | 8,000 | $0.080 |
| Agentic tool-use | gpt-5.2 | 2 | 5,000 | 4,000 | $0.042 |
| Fast preload | gpt-5.2 | 2 | 2,000 | 2,000 | $0.020 |
| Oral exam (daily, 15 turns) | gpt-4o-mini | 15 | 30,000 | 7,500 | $0.009 |
| Oral summary | gpt-4o-mini | 1 | 3,000 | 1,500 | $0.001 |
| Community | gpt-4o-mini | 3 | 4,500 | 5,500 | $0.004 |
| Drafting critique | claude-sonnet-4 | 2 | 6,000 | 3,000 | $0.063 |
| Voice STT | whisper-1 | 3 | 3 min | — | $0.018 |
| Voice TTS | tts-1 | 3 | 1,500 chars | — | $0.023 |
| **Daily Total** | | | | | **$1.063** |
| **Monthly Total (28 active days)** | | | | | **$29.76** |

**Revenue vs Cost (Monthly sub @ KES 1,500 = $11.54):**
- **Gross margin: -157.8%** ❌ (*Significant loss per heavy user*)

---

## 6. Cost Breakdown by Model

| Model | % of Total Cost (Moderate User) | Key Concern |
|-------|-------------------------------|-------------|
| **gpt-5.2** (all variants) | **~87%** | Dominates cost — 18 call sites |
| gpt-4o-mini | ~3% | Very cheap, could replace more gpt-5.2 calls |
| claude-sonnet-4 | ~5% (drafting users) | Only 1 call site, limited usage |
| whisper-1 / tts-1 | ~3% | Voice is expensive per-use |
| gemini-2.0-flash | <1% | Extremely cheap |

**Critical finding:** GPT-5.2 accounts for ~87% of all AI costs. The platform has 18 different call sites using GPT-5.2 where GPT-4o-mini might suffice for some use cases.

---

## 7. Revenue Projections — KSL Realistic Scenarios

### Assumptions
- KSL March 2026 cohort: ~2,200 students
- Resit pool (April 2026): ~900 students
- Platform awareness: 40% of TAM (~1,240 students)
- Trial conversion: 20% (248 paying users)
- Subscriber mix: 20% weekly, 50% monthly, 30% annual
- Usage distribution: 30% light, 50% moderate, 20% heavy

### 7.1 Conservative Scenario (200 subscribers)

| Metric | Value |
|--------|-------|
| Weekly subs (40) | KES 20,000/week → KES 80,000/mo |
| Monthly subs (100) | KES 150,000/mo |
| Annual subs (60) | KES 720,000/yr → KES 60,000/mo |
| **Total Monthly Revenue** | **KES 290,000 ($2,231)** |
| AI Cost (blended) | 60 light × $2.13 + 100 moderate × $14.07 + 40 heavy × $29.76 |
| **Total Monthly AI Cost** | **$2,725** (KES 354,250) |
| **Monthly P&L** | **-KES 64,250 (-$494)** ❌ |

### 7.2 Growth Scenario (500 subscribers)

| Metric | Value |
|--------|-------|
| Weekly subs (100) | KES 200,000/mo |
| Monthly subs (250) | KES 375,000/mo |
| Annual subs (150) | KES 150,000/mo |
| **Total Monthly Revenue** | **KES 725,000 ($5,577)** |
| AI Cost (blended) | 150 light × $2.13 + 250 moderate × $14.07 + 100 heavy × $29.76 |
| **Total Monthly AI Cost** | **$6,813** (KES 885,690) |
| **Monthly P&L** | **-KES 160,690 (-$1,236)** ❌ |

### 7.3 Optimized Scenario (500 subs + cost optimization)
*Same subscriber count but with GPT-5.2 → GPT-4o-mini migration for suitable call sites*

If 8 of 18 GPT-5.2 call sites are downgraded to GPT-4o-mini (pacing, queue, fast preload, checkpoint, assessment, quiz, community grading):

| Metric | Value |
|--------|-------|
| Revenue | **KES 725,000 ($5,577)** |
| Blended AI cost after optimization | ~40% reduction → **$4,088** (KES 531,440) |
| **Monthly P&L** | **+KES 193,560 (+$1,489)** ✅ |

---

## 8. Key Findings & Recommendations

### 8.1 The GPT-5.2 Problem

GPT-5.2 is used in **18 of 36 call sites** and accounts for **~87% of total AI cost**. Many of these call sites don't require frontier-model reasoning:

| Call Site | Currently | Recommended | Savings |
|-----------|-----------|-------------|---------|
| Pacing decision | gpt-5.2 | gpt-4o-mini | ~95% |
| Queue re-prioritization | gpt-5.2 | gpt-4o-mini | ~95% |
| Fast preload | gpt-5.2 | gpt-4o-mini | ~95% |
| Checkpoint generation | gpt-5.2 | gpt-4o-mini | ~95% |
| Assessment generation | gpt-5.2 | gpt-4o-mini | ~90% |
| Quiz stream | gpt-5.2 | gpt-4o-mini | ~90% |
| Onboarding analysis | gpt-5.2 | gpt-4o-mini | ~95% |
| Practice item generation | gpt-5.2 | gpt-4o-mini (for MCQ/short) | ~80% |

**Keep GPT-5.2 for:** Study notes, narrative rendering, grading, authority retrieval, guardrails/agentic core — where legal accuracy is critical.

### 8.2 Pricing Adjustment Needed

Current pricing is **insufficient** for moderate-to-heavy users at the current model mix:

| Recommended Pricing | Current | Proposed | Change |
|---------------------|---------|----------|--------|
| Weekly | KES 500 | KES 700 | +40% |
| Monthly | KES 1,500 | KES 2,500 | +67% |
| Annual | KES 12,000 | KES 20,000 | +67% |

Even at KES 2,500/month ($19.23), a moderate user's AI cost of $14.07 would yield a **27% gross margin** before infrastructure costs.

### 8.3 Usage Caps for Heavy Users

Consider implementing:
- **Daily AI call limits** for non-premium tiers (e.g., 50 AI queries/day)
- **Smart caching**: Cache study notes, practice items, and quiz questions — serve cached versions for identical topics
- **Batch processing**: Generate items in bulk during off-peak and cache

### 8.4 Infrastructure Costs (Non-AI)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Render (free tier) | $0 | With UptimeRobot keepalive |
| Neon PostgreSQL (free tier) | $0 | 0.5 GB storage, sufficient for now |
| Brevo (free tier) | $0 | 300 emails/day |
| Firebase Auth (free tier) | $0 | Up to 50K monthly users |
| Vercel AI SDK | $0 | OSS library |
| **Total infra** | **$0** | All on free tiers |

This is a massive advantage — the only variable cost is AI API usage.

### 8.5 Break-Even Analysis

| Scenario | Break-Even Subscribers (monthly) | At Current Pricing | At Proposed Pricing |
|----------|----------------------------------|--------------------|--------------------|
| All light users | 1 | Profitable from user #1 | — |
| Realistic mix (30/50/20) | N/A | Never profitable | ~350 subscribers |
| With optimization (40% cost cut) | ~200 | Marginally profitable | Profitable at ~120 |

---

## 9. Strategic Recommendations

### Immediate (This Week)
1. **✅ Already done: Trial oral limit → 2** (increases conversion without significant cost)
2. **Migrate suitable GPT-5.2 calls to GPT-4o-mini** via .env overrides (FAST_MODEL, ASSESSMENT_MODEL)
3. **Implement response caching** for study notes and practice items per topic

### Short-Term (This Month)
4. **Raise pricing** to KES 700/2,500/20,000 — still affordable for KSL students
5. **Add daily usage caps** (50 AI queries for weekly plan, 100 for monthly, unlimited for annual)
6. **Cache aggressively**: Study notes per syllabus node, quiz questions per skill — serve from cache before generating new

### Medium-Term (Next Quarter)
7. **Monitor per-user cost** with request logging — identify and soft-cap outlier users
8. **Batch generation**: Pre-generate items for popular topics during low-traffic hours
9. **Evaluate GPT-4o-mini fine-tuning** for Kenya-specific legal knowledge to replace more GPT-5.2 calls
10. **Group/institutional pricing** for KSL directly — guaranteed student pool at lower per-user cost

---

## 10. Appendix: Detailed Token Cost Calculations

### OpenAI Pricing Reference (mid-2025 estimates)

| Model | Input $/1M | Output $/1M | Notes |
|-------|-----------|------------|-------|
| gpt-5.2 | $2.00 | $8.00 | Frontier reasoning model |
| gpt-4o | $2.50 | $10.00 | Vision-capable |
| gpt-4o-mini | $0.15 | $0.60 | Best value for most tasks |
| whisper-1 | $0.006/min | — | Audio transcription |
| tts-1 | $15.00/1M chars | — | Text to speech |

### Anthropic Pricing Reference

| Model | Input $/1M | Output $/1M |
|-------|-----------|------------|
| claude-sonnet-4 | $3.00 | $15.00 |

### Google Pricing Reference

| Model | Input $/1M | Output $/1M |
|-------|-----------|------------|
| gemini-2.0-flash | $0.10 | $0.40 |

### Cost Formula

Per-call cost = (input_tokens / 1,000,000 × input_price) + (output_tokens / 1,000,000 × output_price)

Example: gpt-5.2 with 2,000 input + 3,000 output tokens:
= (2,000 / 1M × $2.00) + (3,000 / 1M × $8.00)
= $0.004 + $0.024 = **$0.028 per call**

---

*Report prepared by YNAI Engineering. Pricing data based on publicly available API pricing as of mid-2025. Actual costs may vary based on prompt optimization, caching, and real-world usage patterns.*
