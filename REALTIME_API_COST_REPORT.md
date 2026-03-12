# YNAI — Realtime API Cost & Viability Report
### Board Document · Multimodal Pricing Analysis
**Platform:** ynai.co.ke — Kenya Bar Exam Preparation  
**Architecture:** Next.js 14.2.35 · Neon PostgreSQL · Firebase Auth · Paystack · Render  
**Affected Features:** Oral Examinations (3-Panel) + Devil's Advocate  
**Report Date:** March 2026

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Current Voice Pipeline — Architecture & Costs](#2-current-voice-pipeline)
3. [Realtime API — Pricing Breakdown](#3-realtime-api-pricing)
4. [Per-Session Cost Comparison](#4-per-session-cost-comparison)
5. [Monthly Cost Impact — By User Tier](#5-monthly-cost-impact)
6. [Full P&L Impact — Blended Scenarios](#6-full-pl-impact)
7. [Strategic Options](#7-strategic-options)
8. [Recommendation](#8-recommendation)
9. [Appendix — Calculation Methodology](#9-appendix)

---

## 1. Executive Summary

OpenAI's Realtime API enables true speech-to-speech AI with sub-second latency, natural interruptions, and conversational flow — eliminating the separate STT → LLM → TTS pipeline. This report evaluates whether upgrading Oral Examinations and Devil's Advocate to the Realtime API is economically viable given our implemented pricing tiers and weekly session limits.

### Bottom Line

| Metric | Current Pipeline | Realtime Mini | Realtime Standard |
|--------|-----------------|---------------|-------------------|
| **Per-session cost (voice, 15 min)** | **$0.14** | **$1.15** | **$3.46** |
| **Cost multiplier** | 1× | **8.2×** | **24.7×** |
| **Moderate user monthly oral cost** | $2.42 | **$19.78** | **$59.41** |
| **Standard tier profitable?** | ✅ Yes | ❌ No | ❌ No |
| **Premium tier profitable?** | ✅ Yes | ❌ No | ❌ No |

**Verdict:** The Realtime API is **not economically viable** as a default replacement at current pricing and subscription tiers. The cost increase is 8–25× per session, turning profitable tiers into significant losses. However, a **hybrid add-on model** is viable — offering Realtime "Live Courtroom" sessions at KES 250–350 per session generates 30–50% margin.

---

## 2. Current Voice Pipeline

### Architecture (Status Quo)

```
Student speaks → [whisper-1 STT] → text → [gpt-4o-mini chat] → text → [tts-1 TTS] → AI speaks
```

Three separate API calls per voice turn, each billed independently:

| Step | Model | Pricing | Per-Turn Cost |
|------|-------|---------|---------------|
| 1. Speech-to-Text | whisper-1 | $0.006/minute | ~$0.005 (45 sec) |
| 2. AI Response | gpt-4o-mini | $0.15/$0.60 per 1M tokens | ~$0.001 |
| 3. Text-to-Speech | tts-1 | $15.00/1M characters | ~$0.005 (~350 chars) |
| **Per-turn total** | | | **~$0.011** |

### Per-Session Cost (Current Pipeline)

| Session Format | Turns | Duration | Voice Cost | Text-Only Cost |
|----------------|-------|----------|------------|----------------|
| Short session | 8 | ~10 min | **$0.09** | $0.005 |
| Standard session | 12 | ~15 min | **$0.14** | $0.007 |
| Long session | 15 | ~18 min | **$0.17** | $0.009 |

> Text-only sessions (no STT/TTS) cost essentially nothing — gpt-4o-mini is extremely cheap for these conversations.

### Current Monthly Oral Costs by User Type

Based on implemented weekly limits from `pricing.ts`:

| Tier | oral_exam limit | oral_devil limit | Total sessions/week | Realistic usage/week | Monthly voice cost |
|------|----------------|-----------------|--------------------|-----------------------|-------------------|
| Light | 2 | 2 | 4 max | ~2 (50% voice) | **$0.60** |
| Standard | 4 | 4 | 8 max | ~4 (60% voice) | **$1.45** |
| Premium | 6 | 6 | 12 max | ~6 (75% voice) | **$2.71** |

> "Realistic usage" accounts for the fact that not every user maxes out every weekly limit, and some sessions are text-only.

---

## 3. Realtime API Pricing

### Available Models & Rates (March 2026)

#### Audio Tokens (Primary Cost Driver for Oral Features)

| Model | Audio Input | Cached Audio Input | Audio Output |
|-------|------------|-------------------|-------------|
| **gpt-realtime-mini** | $10.00/1M | $0.30/1M | $20.00/1M |
| **gpt-realtime** | $32.00/1M | $0.40/1M | $64.00/1M |
| **gpt-realtime-1.5** | $32.00/1M | $0.40/1M | $64.00/1M |

#### Text Tokens (System Prompts & Context)

| Model | Text Input | Cached Text Input | Text Output |
|-------|-----------|-------------------|------------|
| gpt-realtime-mini | $0.60/1M | $0.06/1M | $2.40/1M |
| gpt-realtime | $4.00/1M | $0.40/1M | $16.00/1M |
| gpt-realtime-1.5 | $4.00/1M | $0.40/1M | $16.00/1M |

#### Image Tokens (Not Applicable for Oral Features)

| Model | Image Input | Cached Image Input |
|-------|-----------|-------------------|
| gpt-realtime-mini | $0.80/1M | $0.08/1M |
| gpt-realtime | $5.00/1M | $0.50/1M |

> Image modality is irrelevant for oral exams but could be used if we ever send visual evidence/documents during sessions.

### Key Pricing Observations

1. **Audio output is the dominant cost** — $20–$64 per 1M tokens, no caching possible on output.
2. **Cached audio input is 97% cheaper** than fresh input — aggressive caching is critical.
3. **Text is relatively cheap** — system prompts cost almost nothing even at 2,500 tokens.
4. **gpt-realtime-mini is 3.2× cheaper** than gpt-realtime on audio — the obvious choice.

---

## 4. Per-Session Cost Comparison

### Audio Token Assumptions

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Audio tokenization rate | ~100 tokens/second | OpenAI documentation estimate |
| Student speaking time per turn | ~45 seconds | Typical oral exam answer length |
| AI speaking time per turn | ~20 seconds | Varies by response length (30% short, 40% medium, 30% long) |
| System prompt (text) | ~2,500 tokens | Devil's Advocate / Examiner persona prompts |
| Caching | Yes | System prompt cached from turn 2; prior audio cached each turn |

### Detailed Token Counts — Standard 12-Turn Session (15 min)

| Token Category | Fresh Tokens | Cached Tokens | Total |
|---------------|-------------|---------------|-------|
| **Student audio input** (new each turn) | 54,000 (12 × 4,500) | — | 54,000 |
| **Cached audio** (prior turns' audio) | — | 429,000 | 429,000 |
| **AI audio output** | — | — | 24,000 (12 × 2,000) |
| **Text input** (system prompt) | 2,500 (turn 1) | 27,500 (turns 2–12) | 30,000 |
| **Text output** (reasoning) | — | — | ~500 |

> Cached audio grows quadratically: each new turn caches all previous turns' audio. Total cached = 6,500 × (1+2+…+11) = 429,000 tokens.

### Cost Per Session — All Models

| Model | Fresh Audio In | Cached Audio In | Audio Out | Text (all) | **Total** |
|-------|---------------|----------------|-----------|------------|-----------|
| **gpt-realtime-mini** | $0.540 | $0.129 | $0.480 | $0.003 | **$1.15** |
| **gpt-realtime** | $1.728 | $0.172 | $1.536 | $0.020 | **$3.46** |
| **gpt-realtime-1.5** | $1.728 | $0.172 | $1.536 | $0.020 | **$3.46** |

### Cost Per Session — Shorter 8-Turn Session (10 min)

| Token Category | Fresh Tokens | Cached Tokens |
|---------------|-------------|---------------|
| Student audio input | 36,000 | — |
| Cached audio (prior turns) | — | 182,000 |
| AI audio output | 16,000 | — |
| Text | 2,500 fresh | 17,500 cached |

| Model | Fresh Audio In | Cached Audio In | Audio Out | Text | **Total** |
|-------|---------------|----------------|-----------|------|-----------|
| **gpt-realtime-mini** | $0.360 | $0.055 | $0.320 | $0.003 | **$0.74** |
| **gpt-realtime** | $1.152 | $0.073 | $1.024 | $0.018 | **$2.27** |

### Side-by-Side: Current vs. Realtime API

| Session Type | Current Pipeline | Realtime Mini | Realtime Standard | Cost Multiplier (Mini) |
|-------------|-----------------|---------------|-------------------|----------------------|
| 8-turn, 10 min (voice) | $0.09 | $0.74 | $2.27 | **8.2×** |
| 12-turn, 15 min (voice) | $0.14 | $1.15 | $3.46 | **8.2×** |
| 15-turn, 18 min (voice) | $0.17 | $1.50 | $4.50 | **8.8×** |
| Text-only 12 turns | $0.007 | N/A | N/A | N/A |

### Where the Realtime Money Goes (Mini, 12-Turn)

| Component | Cost | % of Total |
|-----------|------|-----------|
| Audio output (AI speaking) | $0.480 | 42% |
| Fresh audio input (student speaking) | $0.540 | 47% |
| Cached audio (conversation history) | $0.129 | 11% |
| Text (system prompt + reasoning) | $0.003 | <1% |

> **Insight:** Audio output ($20/1M tokens) and fresh audio input ($10/1M tokens) together account for 89% of session cost. No optimization strategy can address output costs — they are fixed per token generated.

---

## 5. Monthly Cost Impact — By User Tier

### Scenario: Replace ALL Voice Sessions with gpt-realtime-mini

Using realistic usage patterns (not maxing every weekly limit) and 4.3 weeks/month:

| Tier | Voice Sessions/Week | Monthly Sessions | Current Monthly Oral | **Realtime Mini Monthly Oral** | **Delta** |
|------|--------------------|-----------------|--------------------|-------------------------------|-----------|
| Light | ~2 | 8.6 | $0.60 | **$9.89** | +$9.29 |
| Standard | ~4 | 17.2 | $1.45 | **$19.78** | +$18.33 |
| Premium | ~6 | 25.8 | $2.71 | **$29.67** | +$26.96 |

### Impact on Total User Cost (Monthly, Moderate User)

From the existing board report, a moderate user's total monthly AI cost is **$13.38** with current oral costs of ~$0.87/month (accounting for ~1 voice session/week avg).

| Scenario | Oral Cost | Other Features | Total Monthly AI Cost | Standard Tier Revenue ($15.38) | Margin |
|----------|----------|----------------|----------------------|-------------------------------|--------|
| **Current pipeline** | $1.45 | $12.51 | **$13.96** | $15.38 | **+$1.42 (+9%)** ✅ |
| **Realtime Mini (4/wk)** | $19.78 | $12.51 | **$32.29** | $15.38 | **-$16.91 (-110%)** ❌ |
| **Realtime Mini (2/wk)** | $9.89 | $12.51 | **$22.40** | $15.38 | **-$7.02 (-46%)** ❌ |
| **Realtime Std (4/wk)** | $59.41 | $12.51 | **$71.92** | $15.38 | **-$56.54 (-368%)** ❌ |

> Even limiting Standard-tier users to just 2 Realtime sessions/week still results in a 46% loss.

---

## 6. Full P&L Impact — Blended Scenarios

### Assumptions
- 300 subscribers (conservative estimate)
- User distribution: 30% light, 50% moderate, 20% heavy
- Tier distribution: 40% Light, 40% Standard, 20% Premium
- Weighted ARPU: $14.62/user/month (from current board report)

### Scenario 1: Status Quo (Keep Current Pipeline)

| Metric | Value |
|--------|-------|
| Monthly revenue (300 users) | $4,386 |
| Blended AI cost/user (with limits) | $12.61 |
| Total monthly AI cost | $3,783 |
| **Monthly profit** | **+$603 (+13.7%)** ✅ |

### Scenario 2: Full Realtime Mini Migration (All Voice = Realtime)

Replace whisper-1 + gpt-4o-mini + tts-1 with gpt-realtime-mini for ALL voice sessions.

| User Type | Count | Current AI Cost | New Oral Cost | New Total Cost |
|-----------|-------|----------------|---------------|----------------|
| Light (2 sessions/wk voice) | 90 | $3.06 | +$9.29 | $12.35 |
| Moderate (4 sessions/wk voice) | 150 | $13.38 | +$18.33 | $31.71 |
| Heavy (6 sessions/wk voice) | 60 | $25.00 (capped) | +$26.96 | $51.96 |

| Metric | Value |
|--------|-------|
| Monthly revenue | $4,386 |
| Total monthly AI cost | $8,282 |
| **Monthly P&L** | **-$3,896 (-89%)** ❌ |

> **Full migration to Realtime loses ~$3,900/month.** The oral cost alone ($2.5K additional) exceeds any pricing adjustment we could realistically make.

### Scenario 3: Realtime Mini — Premium Tier Only, 2 Sessions/Week Limit

Only Premium subscribers get Realtime voice. Other tiers stay on current pipeline.

| User Type | Count | Monthly AI Cost |
|-----------|-------|----------------|
| Light (current pipeline) | 120 | $3.06 |
| Standard (current pipeline) | 120 | $13.38 |
| Premium (2 Realtime/wk + rest current) | 60 | $13.38 + $9.89 = $23.27 |

| Metric | Value |
|--------|-------|
| Monthly revenue | $4,386 |
| Total monthly AI cost | $4,326 |
| **Monthly P&L** | **+$60 (+1.4%)** ⚠️ Breakeven |

> Including 2 Realtime sessions/week for Premium-only eats nearly all margin. Still technically profitable but leaves no room for growth investment.

### Scenario 4: Realtime as Premium Add-On (KES 300/session)

Keep current pipeline as default for ALL tiers. Offer "Live Courtroom" Realtime sessions as an add-on at KES 300 ($2.31) per session.

| Assumption | Value |
|-----------|-------|
| Add-on uptake | 15% of users (45 users) |
| Avg add-on sessions/month | 4 per user |
| Add-on revenue | 45 × 4 × $2.31 = $415/month |
| Add-on cost | 45 × 4 × $1.15 = $207/month |
| **Add-on profit** | **+$208/month (50% margin)** |

| Metric | Value |
|--------|-------|
| Base monthly profit (current pipeline) | +$603 |
| Add-on profit | +$208 |
| **Total monthly profit** | **+$811 (+16.8%)** ✅ |

### Scenario 5: New "Courtroom" Tier (Above Premium)

Create a 4th subscription tier with Realtime API access included:

| Tier | Price (KES/month) | Price (USD) | Realtime Sessions/Week |
|------|-------------------|-------------|----------------------|
| Light | 1,500 | $11.54 | 0 (current pipeline) |
| Standard | 2,000 | $15.38 | 0 (current pipeline) |
| Premium | 2,500 | $19.23 | 0 (current pipeline) |
| **Courtroom** | **5,000** | **$38.46** | **4** (gpt-realtime-mini) |

| Assumption | Value |
|-----------|-------|
| Courtroom subscribers | 30 (10% of 300) |
| Monthly AI cost per Courtroom user | $13.38 + $19.78 = $33.16 |
| Revenue: 30 × $38.46 | $1,154 |
| Cost: 30 × $33.16 | $995 |
| **Courtroom tier profit** | **+$159/month (+14%)** |
| Combined with base (270 users) | **+$603 + $159 = +$762** ✅ |

---

## 7. Strategic Options

### Option A: Stay on Current Pipeline ✅ RECOMMENDED

| Pros | Cons |
|------|------|
| Profitable at all subscriber levels | 1–2 second response latency |
| Known, stable costs | No natural interruptions |
| Well-tested architecture | Turn-by-turn interaction (press-to-talk) |
| whisper-1 + gpt-4o-mini + tts-1 are mature | Students know it's text-converted, not "live" |

**Cost impact:** $0 change. Maintain current +13.7% blended margin.

### Option B: Hybrid — Add-On "Live Courtroom" Sessions ✅ VIABLE

Keep current pipeline as default. Offer gpt-realtime-mini sessions as premium add-ons:

| Feature | Detail |
|---------|--------|
| Name | "Live Courtroom Mode" |
| Pricing | KES 300/session ($2.31) single · KES 1,200 ($9.23) 5-pack |
| Model | gpt-realtime-mini |
| Session limit | 10 minutes (8 turns) to reduce per-session cost to ~$0.74 |
| Availability | All paid tiers (add-on purchase) |
| UX | Labeled as "Premium Experience" — sub-second responses, natural flow |

| Metric | Value |
|--------|-------|
| Per-session cost (10 min) | $0.74 |
| Per-session revenue | $2.31 |
| **Margin per session** | **$1.57 (68%)** ✅ |
| At 5-pack: cost = $3.70, revenue = $9.23 | **Margin: $5.53 (60%)** |

**Projected monthly add-on revenue (300 users, 15% uptake, 4 sessions/user):**
- Revenue: $415 · Cost: $133 · **Profit: +$282/month**

### Option C: Realtime in Premium Tier Only ⚠️ MARGINAL

Include 2 gpt-realtime-mini sessions/week in the Premium tier. Other tiers unaffected.

| Metric | Value |
|--------|-------|
| Premium oral cost increase | +$9.89/user/month |
| Premium users at 20% of 300 | 60 users |
| Additional cost | $593/month |
| No additional revenue | — |
| **Impact on total profit** | +$603 – $593 = **+$10/month** ⚠️ |

> Barely breakeven. Would need to raise Premium price to KES 3,500 ($26.92) to restore healthy margin.

### Option D: New "Courtroom" Tier ⚠️ HIGH PRICE RISK

A 4th tier at KES 5,000/month ($38.46) including 4 Realtime sessions/week.

| Metric | Value |
|--------|-------|
| **Gross margin per user** | **+$5.30/month (14%)** |
| **Risk** | KES 5,000 may exceed KSL student budgets |
| **Opportunity** | Positions product as premium; advocates/firms may pay |

> Only viable if we can attract non-student customers (practising advocates, firms training pupils). KSL students spending KES 15,000–30,000/month total are unlikely to allocate KES 5,000 to exam prep.

### Option E: Full Realtime Migration ❌ NOT VIABLE

Replace ALL oral voice sessions with gpt-realtime-mini across all tiers.

| Metric | Value |
|--------|-------|
| Monthly loss at 300 users | **-$3,896** |
| Required pricing to break even | Light: KES 2,500 · Standard: KES 4,500 · Premium: KES 6,000 |
| **Feasibility** | ❌ Pricing 2–3× too high for KSL market |

---

## 8. Recommendation

### Immediate Action: Option A + B (Hybrid Add-On)

1. **Keep current pipeline** (whisper-1 → gpt-4o-mini → tts-1) as the default for all oral sessions across all tiers.

2. **Launch "Live Courtroom Mode"** as an add-on using gpt-realtime-mini:
   - KES 300 per session ($2.31) / KES 1,200 for 5-pack ($9.23)
   - 10-minute sessions (8 turns) to optimize costs
   - Available to all paid tiers via add-on purchase
   - Marketing: "Experience sub-second AI responses. Practice like you're in a real courtroom."

3. **Engineering effort:** Moderate — requires:
   - New Realtime API WebSocket integration endpoint
   - Client-side WebRTC/audio streaming (replaces record → upload → play flow)
   - Session timer + turn limiter (8-turn cap)
   - Add-on purchase flow (already exists — extend `ADDON_PRICES` and `ADDON_PACKS`)

### Projected Combined P&L (300 subscribers + add-ons)

| Line Item | Monthly |
|-----------|---------|
| Base subscription revenue | $4,386 |
| Base AI cost (current pipeline) | -$3,783 |
| Add-on revenue (15% uptake, 4 sessions/user) | +$415 |
| Add-on cost (Realtime Mini) | -$133 |
| **Total monthly profit** | **+$885 (+17.5%)** ✅ |
| **vs. Status Quo (+$603)** | **+47% profit increase** |

### Wait-and-Watch Triggers

Monitor these benchmarks to reconsider full Realtime migration:

| Trigger | Current | Target for Migration |
|---------|---------|---------------------|
| gpt-realtime-mini audio output price | $20.00/1M | ≤ $5.00/1M (4× reduction) |
| gpt-realtime-mini audio input price | $10.00/1M | ≤ $3.00/1M (3× reduction) |
| Session cost at these prices | $1.15 | ~$0.30 (comparable to current $0.14) |
| Subscriber count | 300 | 800+ (economies of scale allow lower margins) |

> OpenAI has historically reduced prices 50–80% within 12–18 months of launch. Monitor quarterly.

---

## 9. Appendix — Calculation Methodology

### Audio Token Rate

OpenAI Realtime API tokenizes audio at approximately **100 tokens per second**. Some documentation references ~128 tokens/sec. We use 100 as a conservative estimate; actual costs may be 28% higher.

### Session Structure Assumptions

| Parameter | 8-Turn (Short) | 12-Turn (Standard) | 15-Turn (Extended) |
|-----------|---------------|--------------------|--------------------|
| Duration | ~10 min | ~15 min | ~18 min |
| Student speaking/turn | 45 sec | 45 sec | 45 sec |
| AI speaking/turn | 20 sec | 20 sec | 20 sec |
| Total student audio | 360 sec | 540 sec | 675 sec |
| Total AI audio | 160 sec | 240 sec | 300 sec |
| Student audio tokens | 36,000 | 54,000 | 67,500 |
| AI audio tokens (output) | 16,000 | 24,000 | 30,000 |

### Caching Model

In a multi-turn Realtime session, **all prior audio tokens are cached** for subsequent turns. The cache grows quadratically:

- Each turn adds ~6,500 tokens to cache (4,500 student + 2,000 AI)
- Turn N sees `6,500 × (N-1)` cached tokens from prior turns
- Total cached tokens across a 12-turn session: `6,500 × Σ(1..11)` = **429,000 tokens**

Cached audio is billed at **$0.30/1M** (gpt-realtime-mini) vs. **$10.00/1M** fresh — a 97% discount. This significantly reduces the cost of conversation context but doesn't help with output or fresh input costs.

### Current Pipeline Cost Formula

```
Per turn = whisper_cost + gpt4o_mini_cost + tts_cost
         = ($0.006/min × 0.75 min) + (tokens_in/1M × $0.15 + tokens_out/1M × $0.60) + (chars/1M × $15)
         = $0.0045 + $0.0005 + $0.005
         = ~$0.011/turn
```

### Realtime API Cost Formula

```
Per session = fresh_audio_in + cached_audio_in + audio_out + text_in + text_out
            = (student_audio_tokens/1M × $10) + (cached_tokens/1M × $0.30) + (ai_audio_tokens/1M × $20) + text_costs
```

### Revenue Reference (Implemented Tiers)

| Tier | KES/Month | USD/Month | Weekly Oral Limit | Weekly Devil Limit |
|------|-----------|-----------|------------------|--------------------|
| Light | 1,500 | $11.54 | 2 | 2 |
| Standard | 2,000 | $15.38 | 4 | 4 |
| Premium | 2,500 | $19.23 | 6 | 6 |

### Existing Add-On Pricing (for context)

| Feature | Single Pass (KES) | 5-Pack (KES) |
|---------|------------------|-------------|
| Oral Exam | 100 | 400 |
| Devil's Advocate | 100 | 400 |

> Proposed Realtime add-on (KES 300/session, KES 1,200/5-pack) is 3× current add-on pricing, justified by the qualitative experience upgrade and significantly higher AI cost.

### Model Comparison for Oral Features

| Metric | whisper+4o-mini+tts | gpt-realtime-mini | gpt-realtime |
|--------|--------------------|--------------------|-------------|
| Latency | 1.5–3 sec | <500ms | <500ms |
| Interruptions | No (turn-based) | Yes (natural) | Yes (natural) |
| Voice quality | Good (tts-1) | Excellent (native) | Excellent (native) |
| Emotional tone awareness | No | Yes (audio-native) | Yes (audio-native) |
| Cost per 15-min session | $0.14 | $1.15 | $3.46 |
| Annual cost at 4 sessions/week | $29 | $238 | $717 |

---

### Sensitivity Analysis — What If Prices Drop?

| Audio Output Price (Mini) | Session Cost (12-turn) | Viable as Default? |
|--------------------------|----------------------|-------------------|
| $20.00 (current) | $1.15 | ❌ No |
| $10.00 (50% cut) | $0.73 | ❌ No (still 5.2× current) |
| $5.00 (75% cut) | $0.50 | ⚠️ Marginal (Premium only) |
| $2.50 (87.5% cut) | $0.35 | ✅ Yes (close to current voice cost) |

> At 87.5% price reduction on audio output (from $20 to $2.50/1M), Realtime sessions would cost ~$0.35 — comparable to current voice sessions. This level of price reduction is plausible within 18–24 months based on OpenAI's pricing history.

---

*Report prepared by YNAI Engineering for board pricing review.*  
*Pricing data: OpenAI Realtime API public pricing, March 2026.*  
*All costs in USD at KES 130 = $1 exchange rate.*
