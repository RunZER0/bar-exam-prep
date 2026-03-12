# YNAI.co.ke — Per-User Monthly AI API Cost Analysis

**Date:** March 12, 2026  
**Scope:** Feature-by-feature cost breakdown with before/after optimization comparison

---

## 1. Model Pricing Reference

| Model | Input ($/1M tokens) | Output ($/1M tokens) | Role |
|-------|---------------------|----------------------|------|
| **gpt-5.2** | $1.75 | $14.00 | Frontier (mastery, grading, assessment, research) |
| **gpt-5.2-mini** | $0.15 | $0.60 | Workhorse (chat, quizzes, oral, banter, notes, routing) |
| **claude-sonnet-4.6** | $3.00 | $15.00 | Auditor (research validation, drafting critique) |
| **gpt-4o-mini-tts** | $0.60 input | $10.00/1M audio tokens | Text-to-speech with persona instructions |
| **gpt-4o-mini-transcribe** | — | $0.003/minute | Speech-to-text |

**Key pricing change:** gpt-5.2-mini dropped from $0.25/$2.00 to **$0.15/$0.60** — a **70% reduction on output tokens** (which dominate cost).

---

## 2. Recent Optimizations Applied

| # | Optimization | Impact |
|---|-------------|--------|
| 1 | **Smart Chat Router** — 70% of smart chat + clarify queries routed to gpt-5.2-mini | Smart chat per-query cost: $0.031 → $0.010 blended |
| 2 | **FAST_MODEL downgrade** — gpt-5.2 → gpt-5.2-mini for preload calls | Per call: $0.016 → $0.0003 |
| 3 | **Speech migration** — whisper-1 → gpt-4o-mini-transcribe, tts-1 → gpt-4o-mini-tts | STT: $0.006 → $0.003/min (50% cheaper) |
| 4 | **AI Challenges reduced** — 9/day → 4/day (shared across all users) | Daily shared cost: $0.004 → $0.002 |
| 5 | **AI Tutor removed** — was using gpt-5.2 at ~$0.031/call | Eliminates ~$0.06/day for active tutor users |
| 6 | **gpt-5.2-mini price drop** — $0.25/$2.00 → $0.15/$0.60 | All 15 mini call sites ~70% cheaper |

---

## 3. Per-Call Cost Register (Updated)

### gpt-5.2 calls (unchanged — $1.75/$14.00)

| # | Call Site | ~Input Tokens | ~Output Tokens | Cost/Call |
|---|----------|---------------|----------------|----------|
| 7 | Mastery practice items | 300 | 300 | $0.005 |
| 8 | Assessment generation | 1,000 | 1,450 | $0.022 |
| 9 | Checkpoint generation | 720 | 900 | $0.014 |
| 10 | Grading (per written answer) | 1,300 | 380 | $0.008 |
| 11 | Pacing decision | 610 | 50 | $0.002 |
| 12 | Queue reorder | 800 | 200 | $0.004 |
| 22–24 | Research authority retrieval (×3) | — | — | $0.024 ea |
| 25 | Research mentor + web search | — | — | $0.031 |
| 26 | Research auditor (claude-sonnet-4.6) | — | — | $0.032 |
| 27–28 | Guardrails agentic tool-use | — | — | $0.033 ea |
| 33b | Drafting exercise grading | — | — | $0.025 |
| 33c | Drafting critique (claude-sonnet-4.6) | — | — | $0.032 |
| 37 | Onboarding analysis (one-time) | — | — | $0.016 |

### gpt-5.2-mini calls (NEW pricing — $0.15/$0.60)

| # | Call Site | Old Cost ($0.25/$2.00) | **New Cost ($0.15/$0.60)** | Reduction |
|---|----------|----------------------|--------------------------|-----------|
| 1 | Standard chat | $0.001 | **$0.0003** | −70% |
| 2 | Smart chat (when routed to mini) | — | **$0.0014** | new |
| 13–16 | Oral exam exchange | $0.001 | **$0.0003** | −70% |
| 17 | Oral session summary | $0.002 | **$0.0006** | −70% |
| 18 | Quiz streaming | $0.004 | **$0.0012** | −70% |
| 19 | Quiz preload | $0.001 | **$0.0003** | −70% |
| 20 | Quick study notes | $0.006 | **$0.0018** | −70% |
| 21 | Case of the Day | $0.003 | **$0.0009** | −70% |
| 29 | Fast preload (was gpt-5.2) | $0.016 | **$0.0003** | −98% |
| 30 | Challenge generation (shared) | $0.004 | **$0.0012** | −70% |
| 31 | Challenge review | $0.001 | **$0.0003** | −70% |
| 32 | Challenge grading | $0.002 | **$0.0006** | −70% |
| 33 | Drafting scenario gen | $0.002 | **$0.0006** | −70% |
| 38 | Banter content | $0.002 | **$0.0006** | −70% |

### Voice I/O

| Call Site | Cost |
|-----------|------|
| STT (gpt-4o-mini-transcribe) | $0.003/min (~$0.001 per 15-sec input) |
| TTS (gpt-4o-mini-tts, ~10 sec output) | ~$0.005/call (300 text tokens + 500 audio tokens) |

---

## 4. Moderate User — Feature-by-Feature Breakdown (1–2 hrs/day, 30 days)

### BEFORE optimizations (report baseline — gpt-5.2-mini at $0.25/$2.00, no router)

| Feature | Usage/Day | Cost/Call | Daily Cost | Monthly |
|---------|----------|----------|------------|---------|
| Standard chat (10×) | 10 | $0.001 | $0.010 | $0.30 |
| Smart chat (2×) — all gpt-5.2 | 2 | $0.031 | $0.062 | $1.86 |
| Mastery Hub (full session) | 5 calls | varies | $0.060 | $1.80 |
| Study notes (2×) | 2 | $0.006 | $0.012 | $0.36 |
| Quiz session (2×) | 2 | $0.004 | $0.008 | $0.24 |
| Oral exam (1×/week) | 0.14 sess. | $0.128/sess | $0.018 | $0.54 |
| Research query (1×) | 3 calls | varies | $0.087 | $2.61 |
| Drafting training (1×/week) | 0.14 sess. | $0.029/sess | $0.004 | $0.12 |
| Case of the Day | 1 | $0.003 | $0.003 | $0.09 |
| Banter (1×) | 1 | $0.002 | $0.002 | $0.06 |
| Preload (FAST = gpt-5.2) | 1 | $0.016 | $0.016 | $0.48 |
| Community challenges | 0.14 | $0.007/wk | $0.001 | $0.03 |
| **TOTAL** | | | **$0.283** | **$8.49** |

### AFTER optimizations (new mini pricing + router + FAST_MODEL downgrade)

| Feature | Usage/Day | Cost/Call | Daily Cost | Monthly | Δ vs Before |
|---------|----------|----------|------------|---------|-------------|
| Standard chat (10×) | 10 | $0.0003 | $0.003 | $0.09 | −$0.21 |
| Smart chat (2×) — 70% mini, 30% gpt-5.2 | 2 | $0.010 blend | $0.021 | $0.63 | **−$1.23** |
| Mastery Hub (full session) | 5 calls | varies | $0.060 | $1.80 | $0.00 |
| Study notes (2×) | 2 | $0.0018 | $0.004 | $0.11 | −$0.25 |
| Quiz session (2×) | 2 | $0.0012 | $0.002 | $0.07 | −$0.17 |
| Oral exam (1×/week) | 0.14 sess. | $0.021/sess | $0.003 | $0.09 | −$0.45 |
| Research query (1×) | 3 calls | varies | $0.087 | $2.61 | $0.00 |
| Drafting training (1×/week) | 0.14 sess. | $0.026/sess | $0.004 | $0.11 | −$0.01 |
| Case of the Day | 1 | $0.0009 | $0.001 | $0.03 | −$0.06 |
| Banter (1×) | 1 | $0.0006 | $0.001 | $0.02 | −$0.04 |
| Preload (FAST = gpt-5.2-mini) | 1 | $0.0003 | $0.0003 | $0.01 | **−$0.47** |
| Community challenges | 0.14 | $0.002/wk | $0.0001 | $0.004 | −$0.03 |
| **TOTAL** | | | **$0.186** | **$5.59** | **−$2.90** |

> **Monthly savings: $2.90/user (−34.2%)**

### Savings Attribution

| Optimization | Monthly Savings | % of Total Savings |
|-------------|----------------|-------------------|
| Smart Chat Router (70% → mini) | $1.23 | 42.4% |
| gpt-5.2-mini price drop ($0.25/$2.00 → $0.15/$0.60) | $0.77 | 26.6% |
| FAST_MODEL downgrade (gpt-5.2 → mini) | $0.47 | 16.2% |
| Oral exam (mini + speech savings) | $0.45 | 15.5% |
| **Total** | **$2.90** | **100%** |

---

## 5. All User Profiles — Before vs After

| | Light User | Moderate User | Heavy User |
|--|-----------|---------------|------------|
| **Profile** | ~30 min/day, basic features | 1–2 hrs/day, multiple features | 3+ hrs/day, power user |
| **BEFORE** | $1.11/mo | $8.49/mo | $22.47/mo |
| **AFTER** | $0.80/mo | $5.59/mo | $17.70/mo |
| **Savings** | −$0.31 (−28%) | −$2.90 (−34%) | −$4.77 (−21%) |
| **Cost driver** | Mastery (gpt-5.2) | Research + mastery + smart chat | Research (3×) + mastery (deep) |

> Heavy user savings are lower in percentage because research (gpt-5.2 + claude-sonnet-4.6) dominates their cost at $0.261/day and is unaffected by mini pricing changes.

---

## 6. Platform Shared Costs

These costs are incurred once regardless of user count:

| Shared Resource | Frequency | BEFORE | AFTER | Notes |
|----------------|-----------|--------|-------|-------|
| AI challenge generation | Daily | $0.004/day ($0.12/mo) | $0.002/day ($0.06/mo) | 9 → 4 challenges; mini price drop |
| Challenge review queue | Per submission | $0.001/review | $0.0003/review | Mini price drop |
| Challenge grading | Per submission | $0.002/grade | $0.0006/grade | Mini price drop |
| AI thread generation | Occasional | ~$0.002/thread | ~$0.0006/thread | Mini price drop |
| **Total shared/mo** | | **~$0.15/mo** | **~$0.07/mo** | |

Per-user shared cost allocation:

| Subscribers | Shared Cost/User/Month |
|-------------|----------------------|
| 50 | $0.0014 |
| 200 | $0.00035 |
| 500 | $0.00014 |

> Shared costs are **negligible** — less than $0.01/user/month at any scale.

---

## 7. Gross Margin Analysis by Pricing Tier

### Moderate User (50% of users)

| Tier | Price (KES) | Revenue/Mo | AI Cost/Mo | Gross Margin | Margin % |
|------|------------|-----------|-----------|-------------|----------|
| | | | **BEFORE → AFTER** | **BEFORE → AFTER** | **BEFORE → AFTER** |
| **Light** | 1,500 | $11.54 | $8.49 → **$5.59** | +$3.05 → **+$5.95** | 26% → **52%** |
| **Standard** | 2,000 | $15.38 | $8.49 → **$5.59** | +$6.89 → **+$9.79** | 45% → **64%** |
| **Premium** | 2,500 | $19.23 | $8.49 → **$5.59** | +$10.74 → **+$13.64** | 56% → **71%** |

### Light User (30% of users)

| Tier | Revenue/Mo | AI Cost/Mo | Gross Margin | Margin % |
|------|-----------|-----------|-------------|----------|
| Light | $11.54 | **$0.80** | **+$10.74** | **93%** |
| Standard | $15.38 | **$0.80** | **+$14.58** | **95%** |
| Premium | $19.23 | **$0.80** | **+$18.43** | **96%** |

### Heavy User (20% of users)

| Tier | Revenue/Mo | AI Cost/Mo | Gross Margin | Margin % |
|------|-----------|-----------|-------------|----------|
| Light | $11.54 | **$17.70** | **−$6.16** | **−53%** |
| Standard | $15.38 | **$17.70** | **−$2.32** | **−15%** |
| Premium | $19.23 | **$17.70** | **+$1.53** | **+8%** |

> **Critical improvement:** Heavy users are now **profitable on Premium tier** (+$1.53 vs −$3.24 before). Standard tier loss narrows from −$7.09 to **−$2.32**. With weekly feature limits capping heavy users to ~$14/mo, Standard tier also becomes profitable for heavy users (+$1.38).

---

## 8. Blended Margin Projection

**Assumptions:** 30% light / 50% moderate / 20% heavy users · 40% Light / 40% Standard / 20% Premium tier mix

### Weighted ARPU
$(0.40 × \$11.54) + (0.40 × \$15.38) + (0.20 × \$19.23) = \$14.62\text{/user/month}$

### Weighted Cost (AFTER)
$(0.30 × \$0.80) + (0.50 × \$5.59) + (0.20 × \$17.70) = \$6.57\text{/user/month}$

### Blended Margin
$\$14.62 - \$6.57 = +\$8.05\text{/user/month (55.1\% margin)}$

### With Weekly Feature Limits (heavy users capped at ~$14/mo)
$(0.30 × \$0.80) + (0.50 × \$5.59) + (0.20 × \$14.00) = \$5.84$

$\$14.62 - \$5.84 = +\$8.78\text{/user/month (60.1\% margin)}$

### Before vs After Comparison

| Metric | BEFORE | AFTER | AFTER + Limits |
|--------|--------|-------|----------------|
| Weighted cost/user | $9.07 | **$6.57** | **$5.84** |
| Blended margin | +$5.55 | **+$8.05** | **+$8.78** |
| Margin % | 38.0% | **55.1%** | **60.1%** |
| At 200 subscribers | +$1,110/mo | **+$1,610/mo** | **+$1,756/mo** |
| At 500 subscribers | +$2,775/mo | **+$4,025/mo** | **+$4,390/mo** |

---

## 9. Cost Concentration Analysis

**Where does the money actually go?** (Moderate user, $5.59/month)

| Model | Monthly Spend | % of Total | Call Sites |
|-------|--------------|-----------|------------|
| **gpt-5.2** | $4.44 | 79.4% | Mastery (assessment, grading, checkpoint), research, smart chat (30%), drafting grading |
| **claude-sonnet-4.6** | $0.72 | 12.9% | Research auditor, drafting critique |
| **gpt-5.2-mini** | $0.31 | 5.5% | Chat, quizzes, oral, notes, banter, routing, preload |
| **Voice (STT+TTS)** | $0.12 | 2.1% | Oral exams, voice chat input |
| **Total** | **$5.59** | **100%** | |

> **gpt-5.2 still drives ~80% of costs.** Further optimization requires either (a) downgrading more gpt-5.2 call sites to mini (pacing, queue reorder — est. −$0.50/mo), or (b) reducing research/mastery usage frequency through better caching or pre-generation.

---

## 10. Summary

| Metric | Value |
|--------|-------|
| **Moderate user monthly AI cost** | **$5.59** (was $8.49) |
| **Light user monthly AI cost** | **$0.80** (was $1.11) |
| **Heavy user monthly AI cost** | **$17.70** (was $22.47) |
| **Total savings (moderate)** | **−$2.90/mo (−34%)** |
| **Biggest savings lever** | Smart Chat Router (−$1.23/mo, 42% of savings) |
| **Blended margin (all tiers)** | **+$8.05/user/mo (55.1%)** (was +$5.55, 38.0%) |
| **Break-even at Standard tier** | All user types profitable (heavy users need weekly limits) |
| **Remaining cost concentration** | gpt-5.2 = 79% of all AI spend |

---

*Analysis based on token-audited per-call costs from the Board System Report, updated model pricing as of March 2026, and confirmed architecture changes (smart chat router, FAST_MODEL downgrade, challenge reduction, AI Tutor removal).*
