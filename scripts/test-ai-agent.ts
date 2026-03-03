/**
 * AI Agent Connectivity Test
 * 
 * Tests whether:
 * 1. OPENAI_API_KEY is configured and valid
 * 2. ANTHROPIC_API_KEY is configured and valid (used by critique engine)
 * 3. The correct models are accessible
 * 
 * Run: npx tsx scripts/test-ai-agent.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { validateModelConfig, ORCHESTRATOR_MODEL, MENTOR_MODEL, AUDITOR_MODEL, FAST_MODEL } from '../lib/ai/model-config';

async function testAIAgent() {
  console.log('===========================================');
  console.log('  YNAI AI Agent Connectivity Test');
  console.log('===========================================\n');

  // 1. Check env vars
  console.log('1. Environment Variables Check');
  console.log('─────────────────────────────────');
  const config = validateModelConfig();
  
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  console.log(`   OPENAI_API_KEY:    ${openaiKey ? '✅ SET (' + openaiKey.substring(0, 7) + '...' + openaiKey.slice(-4) + ')' : '❌ MISSING'}`);
  console.log(`   ANTHROPIC_API_KEY: ${anthropicKey ? '✅ SET (' + anthropicKey.substring(0, 7) + '...' + anthropicKey.slice(-4) + ')' : '❌ MISSING'}`);
  console.log();

  // 2. Model config
  console.log('2. Model Configuration');
  console.log('─────────────────────────────────');
  console.log(`   ORCHESTRATOR: ${ORCHESTRATOR_MODEL} (OpenAI)`);
  console.log(`   MENTOR:       ${MENTOR_MODEL} (OpenAI)`);
  console.log(`   AUDITOR:      ${AUDITOR_MODEL} (Anthropic)`);
  console.log(`   FAST:         ${FAST_MODEL} (OpenAI)`);
  console.log();

  // 3. Test OpenAI
  console.log('3. OpenAI API Test');
  console.log('─────────────────────────────────');
  if (!openaiKey) {
    console.log('   ❌ SKIPPED — No OPENAI_API_KEY');
  } else {
    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: openaiKey });
      
      const start = Date.now();
      const response = await openai.responses.create({
        model: ORCHESTRATOR_MODEL,
        input: 'Reply with exactly: "YNAI AI Agent is operational." Nothing else.',
      });
      const elapsed = Date.now() - start;
      
      const text = response.output_text || '';
      console.log(`   ✅ Response (${elapsed}ms): "${text.trim().substring(0, 80)}"`);
      console.log(`   Model used: ${ORCHESTRATOR_MODEL}`);
    } catch (err: any) {
      console.log(`   ❌ FAILED: ${err.message}`);
      if (err.status === 401) {
        console.log('   → Your OPENAI_API_KEY is invalid or expired');
      } else if (err.status === 404) {
        console.log(`   → Model "${ORCHESTRATOR_MODEL}" not found. You may need a different model.`);
        console.log('   → Try setting ORCHESTRATOR_MODEL=gpt-4o in your .env');
      } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
        console.log('   → Network error — check your internet connection');
      }
    }
  }
  console.log();

  // 4. Test Anthropic
  console.log('4. Anthropic API Test (Critique Engine)');
  console.log('─────────────────────────────────');
  if (!anthropicKey) {
    console.log('   ⚠️  SKIPPED — No ANTHROPIC_API_KEY');
    console.log('   → The critique/redline engine uses Anthropic Claude');
    console.log('   → App will work without it, but grading quality may be reduced');
  } else {
    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: anthropicKey });
      
      const start = Date.now();
      const response = await client.messages.create({
        model: AUDITOR_MODEL,
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Reply with exactly: "Critique Engine operational." Nothing else.' }],
      });
      const elapsed = Date.now() - start;
      
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      console.log(`   ✅ Response (${elapsed}ms): "${text.trim().substring(0, 80)}"`);
      console.log(`   Model used: ${AUDITOR_MODEL}`);
    } catch (err: any) {
      console.log(`   ❌ FAILED: ${err.message}`);
      if (err.status === 401) {
        console.log('   → Your ANTHROPIC_API_KEY is invalid or expired');
      } else if (err.status === 404) {
        console.log(`   → Model "${AUDITOR_MODEL}" not found. Try setting AUDITOR_MODEL=claude-sonnet-4-20250514 in .env`);
      }
    }
  }
  console.log();

  // 5. Summary
  console.log('===========================================');
  console.log('  SUMMARY');
  console.log('===========================================');
  if (!openaiKey && !anthropicKey) {
    console.log('  ❌ NO API KEYS CONFIGURED');
    console.log('  The AI agent will NOT work without at least OPENAI_API_KEY.');
    console.log();
    console.log('  HOW TO FIX:');
    console.log('  ────────────');
    console.log('  1. Open: c:\\Users\\victo\\Desktop\\Bar Exam Prep\\.env');
    console.log('  2. Set these values:');
    console.log();
    console.log('     # REQUIRED — Main AI engine (chat, study notes, mastery)');
    console.log('     OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE');
    console.log();
    console.log('     # OPTIONAL — Critique/grading engine (improves answer quality)');
    console.log('     ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE');
    console.log();
    console.log('  WHERE TO GET KEYS:');
    console.log('  • OpenAI:    https://platform.openai.com/api-keys');
    console.log('  • Anthropic: https://console.anthropic.com/settings/keys');
  } else if (!openaiKey) {
    console.log('  ❌ OPENAI_API_KEY is MISSING — this is REQUIRED');
    console.log('  The main chat agent, study notes, and mastery engine all need it.');
    console.log('  Get one at: https://platform.openai.com/api-keys');
  } else if (!anthropicKey) {
    console.log('  ⚠️  OPENAI works, but ANTHROPIC_API_KEY is missing (optional)');
    console.log('  The app will work. Critique engine grading will be limited.');
  } else {
    console.log('  ✅ Both API keys are configured');
  }
  console.log();

  // 6. Render deployment note
  console.log('  FOR RENDER DEPLOYMENT:');
  console.log('  ──────────────────────');
  console.log('  Set these same keys in Render Dashboard → Environment → Environment Variables');
  console.log('  URL: https://dashboard.render.com → your service → Environment');
  console.log();
}

testAIAgent()
  .then(() => process.exit(0))
  .catch((e) => { console.error('Test failed:', e.message); process.exit(1); });
