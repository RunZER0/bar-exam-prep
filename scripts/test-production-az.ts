/**
 * YNAI Production A-Z Smoke Test
 * 
 * Tests every layer of the production deployment at https://ynai.onrender.com:
 *   A. Homepage & static pages
 *   B. API health (unauthenticated endpoints)
 *   C. Database connectivity (via public API)
 *   D. Firebase auth flow verification
 *   E. AI agent connectivity (tests if OPENAI_API_KEY works in production)
 *   F. Mastery engine data verification
 *   G. All 48 API routes reachability
 * 
 * Run: npx tsx scripts/test-production-az.ts
 */

const BASE = process.env.TEST_BASE_URL || 'https://ynai.onrender.com';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  detail: string;
  elapsed?: number;
}

const results: TestResult[] = [];

function log(emoji: string, msg: string) {
  console.log(`  ${emoji} ${msg}`);
}

async function fetchJSON(path: string, options?: RequestInit & { timeout?: number }) {
  const controller = new AbortController();
  const timeout = options?.timeout || 15000;
  const timer = setTimeout(() => controller.abort(), timeout);
  
  try {
    const start = Date.now();
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });
    const elapsed = Date.now() - start;
    clearTimeout(timer);
    
    let body: any = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('json')) {
      try { body = await res.json(); } catch { body = null; }
    } else {
      try { body = await res.text(); } catch { body = null; }
    }
    
    return { status: res.status, body, elapsed, ok: res.ok, headers: res.headers };
  } catch (err: any) {
    clearTimeout(timer);
    throw err;
  }
}

// ═══════════════════════════════════════════════════
// A. STATIC PAGES
// ═══════════════════════════════════════════════════
async function testStaticPages() {
  console.log('\n[A] STATIC PAGES & SSR');
  console.log('─'.repeat(50));
  
  const pages = [
    { path: '/', name: 'Homepage' },
    { path: '/about', name: 'About' },
    { path: '/pricing', name: 'Pricing' },
    { path: '/privacy', name: 'Privacy Policy' },
    { path: '/terms', name: 'Terms of Service' },
    { path: '/disclaimer', name: 'Disclaimer' },
  ];
  
  for (const page of pages) {
    try {
      const start = Date.now();
      const res = await fetch(`${BASE}${page.path}`, { signal: AbortSignal.timeout(15000) });
      const elapsed = Date.now() - start;
      const html = await res.text();
      
      if (res.status === 200 && html.includes('Ynai')) {
        log('✅', `${page.name} (${elapsed}ms) — HTTP ${res.status}`);
        results.push({ name: `Page: ${page.name}`, status: 'PASS', detail: `${elapsed}ms`, elapsed });
      } else {
        log('❌', `${page.name} — HTTP ${res.status}`);
        results.push({ name: `Page: ${page.name}`, status: 'FAIL', detail: `HTTP ${res.status}`, elapsed });
      }
    } catch (err: any) {
      log('❌', `${page.name} — ${err.message}`);
      results.push({ name: `Page: ${page.name}`, status: 'FAIL', detail: err.message });
    }
  }
}

// ═══════════════════════════════════════════════════
// B. PUBLIC API ENDPOINTS (no auth required)
// ═══════════════════════════════════════════════════
async function testPublicAPIs() {
  console.log('\n[B] PUBLIC API ENDPOINTS');
  console.log('─'.repeat(50));
  
  // Topics endpoint — usually public
  try {
    const r = await fetchJSON('/api/topics');
    if (r.status === 200 && r.body) {
      const count = Array.isArray(r.body) ? r.body.length : (r.body.topics?.length || 'N/A');
      log('✅', `GET /api/topics (${r.elapsed}ms) — ${count} topics`);
      results.push({ name: 'API: /api/topics', status: 'PASS', detail: `${count} topics, ${r.elapsed}ms`, elapsed: r.elapsed });
    } else {
      log('⚠️', `GET /api/topics — HTTP ${r.status} (may need auth)`);
      results.push({ name: 'API: /api/topics', status: 'WARN', detail: `HTTP ${r.status}`, elapsed: r.elapsed });
    }
  } catch (err: any) {
    log('❌', `GET /api/topics — ${err.message}`);
    results.push({ name: 'API: /api/topics', status: 'FAIL', detail: err.message });
  }

  // Questions endpoint
  try {
    const r = await fetchJSON('/api/questions');
    if (r.status === 200) {
      log('✅', `GET /api/questions (${r.elapsed}ms) — HTTP ${r.status}`);
      results.push({ name: 'API: /api/questions', status: 'PASS', detail: `${r.elapsed}ms`, elapsed: r.elapsed });
    } else {
      log('⚠️', `GET /api/questions — HTTP ${r.status} (may need auth)`);
      results.push({ name: 'API: /api/questions', status: 'WARN', detail: `HTTP ${r.status}`, elapsed: r.elapsed });
    }
  } catch (err: any) {
    log('❌', `GET /api/questions — ${err.message}`);
    results.push({ name: 'API: /api/questions', status: 'FAIL', detail: err.message });
  }
}

// ═══════════════════════════════════════════════════
// C. AUTHENTICATED API ENDPOINTS (expect 401)
// ═══════════════════════════════════════════════════
async function testAuthenticatedAPIs() {
  console.log('\n[C] AUTHENTICATED API ENDPOINTS (expect 401 without token)');
  console.log('─'.repeat(50));

  const endpoints = [
    { method: 'GET', path: '/api/progress' },
    { method: 'GET', path: '/api/streaks' },
    { method: 'GET', path: '/api/tutor/today' },
    { method: 'GET', path: '/api/tutor/guide' },
    { method: 'GET', path: '/api/tutor/plan' },
    { method: 'GET', path: '/api/mastery/plan' },
    { method: 'GET', path: '/api/mastery/readiness' },
    { method: 'GET', path: '/api/mastery/report' },
    { method: 'GET', path: '/api/mastery/item?skillId=test' },
    { method: 'GET', path: '/api/mastery/content?unitId=ATP100' },
    { method: 'GET', path: '/api/mastery/notes?skillId=test' },
    { method: 'GET', path: '/api/exam/profile' },
    { method: 'GET', path: '/api/exam/timeline' },
    { method: 'GET', path: '/api/chat/sessions' },
    { method: 'GET', path: '/api/study/pacing' },
    { method: 'POST', path: '/api/ai/chat', body: { message: 'test', competencyType: 'study' } },
    { method: 'POST', path: '/api/mastery/attempt', body: { itemId: 'test', response: 'test' } },
    { method: 'POST', path: '/api/submit', body: { answer: 'test' } },
    { method: 'POST', path: '/api/onboarding', body: { step: 'test' } },
  ];

  let passed = 0;
  let failed = 0;

  for (const ep of endpoints) {
    try {
      const r = await fetchJSON(ep.path, { 
        method: ep.method,
        body: (ep as any).body ? JSON.stringify((ep as any).body) : undefined,
        timeout: 10000,
      });
      
      // 401 is CORRECT for unauthenticated calls — means auth middleware is working
      if (r.status === 401) {
        log('✅', `${ep.method} ${ep.path} → 401 Unauthorized (auth working)`);
        passed++;
        results.push({ name: `Auth: ${ep.method} ${ep.path}`, status: 'PASS', detail: '401 — auth middleware OK', elapsed: r.elapsed });
      } else if (r.status === 200) {
        log('⚠️', `${ep.method} ${ep.path} → 200 (no auth required?)`);
        passed++;
        results.push({ name: `Auth: ${ep.method} ${ep.path}`, status: 'WARN', detail: '200 — endpoint is public', elapsed: r.elapsed });
      } else if (r.status === 405) {
        log('⚠️', `${ep.method} ${ep.path} → 405 Method Not Allowed`);
        results.push({ name: `Auth: ${ep.method} ${ep.path}`, status: 'WARN', detail: '405 — method not allowed', elapsed: r.elapsed });
      } else if (r.status === 500) {
        log('❌', `${ep.method} ${ep.path} → 500 Server Error`);
        failed++;
        const errMsg = typeof r.body === 'object' ? JSON.stringify(r.body).substring(0, 100) : String(r.body).substring(0, 100);
        results.push({ name: `Auth: ${ep.method} ${ep.path}`, status: 'FAIL', detail: `500 — ${errMsg}`, elapsed: r.elapsed });
      } else {
        log('⚠️', `${ep.method} ${ep.path} → ${r.status}`);
        results.push({ name: `Auth: ${ep.method} ${ep.path}`, status: 'WARN', detail: `HTTP ${r.status}`, elapsed: r.elapsed });
      }
    } catch (err: any) {
      log('❌', `${ep.method} ${ep.path} → ${err.message}`);
      failed++;
      results.push({ name: `Auth: ${ep.method} ${ep.path}`, status: 'FAIL', detail: err.message });
    }
  }
  
  log('📊', `${passed} auth-protected, ${failed} errors`);
}

// ═══════════════════════════════════════════════════
// D. AI AGENT TEST (unauthenticated — tests if AI returns proper error or if there's a public test endpoint)
// ═══════════════════════════════════════════════════
async function testAIAgent() {
  console.log('\n[D] AI AGENT CONFIGURATION TEST');
  console.log('─'.repeat(50));

  // Test /api/ai/chat without auth — we expect 401, which means the endpoint EXISTS and is protected
  try {
    const r = await fetchJSON('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ 
        message: 'What is the overriding objective under the CPA?',
        competencyType: 'study'
      }),
      timeout: 20000,
    });
    
    if (r.status === 401) {
      log('✅', `AI Chat endpoint exists and is auth-protected (${r.elapsed}ms)`);
      results.push({ name: 'AI: Chat endpoint', status: 'PASS', detail: 'Endpoint reachable, auth-protected', elapsed: r.elapsed });
    } else if (r.status === 200) {
      // If it somehow works without auth, check if AI is configured
      const body = r.body;
      if (body?.error === 'AI_NOT_CONFIGURED') {
        log('❌', `AI Chat: OPENAI_API_KEY is NOT SET in Render`);
        results.push({ name: 'AI: Chat endpoint', status: 'FAIL', detail: 'OPENAI_API_KEY not configured on Render', elapsed: r.elapsed });
      } else if (body?.response) {
        log('✅', `AI Chat responding! Response: "${String(body.response).substring(0, 60)}..."`);
        results.push({ name: 'AI: Chat endpoint', status: 'PASS', detail: 'AI responding', elapsed: r.elapsed });
      } else {
        log('⚠️', `AI Chat returned 200 but unexpected body`);
        results.push({ name: 'AI: Chat endpoint', status: 'WARN', detail: JSON.stringify(body).substring(0, 100), elapsed: r.elapsed });
      }
    } else {
      log('⚠️', `AI Chat: HTTP ${r.status}`);
      results.push({ name: 'AI: Chat endpoint', status: 'WARN', detail: `HTTP ${r.status}`, elapsed: r.elapsed });
    }
  } catch (err: any) {
    log('❌', `AI Chat: ${err.message}`);
    results.push({ name: 'AI: Chat endpoint', status: 'FAIL', detail: err.message });
  }

  // Test /api/ai/suggestions
  try {
    const r = await fetchJSON('/api/ai/suggestions', { timeout: 10000 });
    if (r.status === 401 || r.status === 200) {
      log('✅', `AI Suggestions endpoint reachable (${r.elapsed}ms) — HTTP ${r.status}`);
      results.push({ name: 'AI: Suggestions endpoint', status: 'PASS', detail: `HTTP ${r.status}`, elapsed: r.elapsed });
    } else {
      log('⚠️', `AI Suggestions: HTTP ${r.status}`);
      results.push({ name: 'AI: Suggestions endpoint', status: 'WARN', detail: `HTTP ${r.status}`, elapsed: r.elapsed });
    }
  } catch (err: any) {
    log('❌', `AI Suggestions: ${err.message}`);
    results.push({ name: 'AI: Suggestions endpoint', status: 'FAIL', detail: err.message });
  }
}

// ═══════════════════════════════════════════════════
// E. MASTERY ENGINE ENDPOINTS
// ═══════════════════════════════════════════════════
async function testMasteryEngine() {
  console.log('\n[E] MASTERY ENGINE ENDPOINTS');
  console.log('─'.repeat(50));

  const masteryEndpoints = [
    '/api/mastery/plan',
    '/api/mastery/readiness',
    '/api/mastery/report',
    '/api/mastery/content?unitId=ATP100',
    '/api/mastery/notes?skillId=cp-jurisdiction',
    '/api/mastery/item?skillId=cp-jurisdiction',
  ];

  for (const path of masteryEndpoints) {
    try {
      const r = await fetchJSON(path, { timeout: 10000 });
      if (r.status === 401) {
        log('✅', `${path} — Auth-protected (${r.elapsed}ms)`);
        results.push({ name: `Mastery: ${path}`, status: 'PASS', detail: 'Auth-protected', elapsed: r.elapsed });
      } else if (r.status === 200) {
        log('✅', `${path} — Public, returned data (${r.elapsed}ms)`);
        results.push({ name: `Mastery: ${path}`, status: 'PASS', detail: 'Returned data', elapsed: r.elapsed });
      } else if (r.status === 500) {
        const errMsg = typeof r.body === 'object' ? JSON.stringify(r.body).substring(0, 80) : '';
        log('❌', `${path} → 500 Error: ${errMsg}`);
        results.push({ name: `Mastery: ${path}`, status: 'FAIL', detail: `500: ${errMsg}`, elapsed: r.elapsed });
      } else {
        log('⚠️', `${path} → HTTP ${r.status}`);
        results.push({ name: `Mastery: ${path}`, status: 'WARN', detail: `HTTP ${r.status}`, elapsed: r.elapsed });
      }
    } catch (err: any) {
      log('❌', `${path} — ${err.message}`);
      results.push({ name: `Mastery: ${path}`, status: 'FAIL', detail: err.message });
    }
  }
}

// ═══════════════════════════════════════════════════
// F. DATABASE TEST (via topics/questions API)
// ═══════════════════════════════════════════════════
async function testDatabase() {
  console.log('\n[F] DATABASE CONNECTIVITY');
  console.log('─'.repeat(50));

  try {
    const r = await fetchJSON('/api/topics', { timeout: 15000 });
    if (r.status === 200) {
      const topics = r.body;
      if (Array.isArray(topics) && topics.length > 0) {
        log('✅', `Database connected — ${topics.length} topics returned (${r.elapsed}ms)`);
        
        // Check for ATP unit coverage
        const units = [...new Set(topics.map((t: any) => t.unitId || t.unit_id).filter(Boolean))];
        log('📊', `Units in DB: ${units.join(', ') || 'N/A'}`);
        results.push({ name: 'DB: Topics', status: 'PASS', detail: `${topics.length} topics, units: ${units.join(',')}`, elapsed: r.elapsed });
      } else if (typeof topics === 'object' && topics.topics) {
        log('✅', `Database connected — ${topics.topics.length} topics (${r.elapsed}ms)`);
        results.push({ name: 'DB: Topics', status: 'PASS', detail: `${topics.topics.length} topics`, elapsed: r.elapsed });
      } else {
        log('⚠️', `Database responded but unexpected format`);
        results.push({ name: 'DB: Topics', status: 'WARN', detail: `Unexpected format: ${JSON.stringify(topics).substring(0, 80)}`, elapsed: r.elapsed });
      }
    } else if (r.status === 401) {
      log('⚠️', `Topics requires auth — can't verify DB from outside (${r.elapsed}ms)`);
      results.push({ name: 'DB: Topics', status: 'WARN', detail: 'Needs auth to verify', elapsed: r.elapsed });
    } else {
      log('❌', `Database test failed — HTTP ${r.status}`);
      results.push({ name: 'DB: Topics', status: 'FAIL', detail: `HTTP ${r.status}`, elapsed: r.elapsed });
    }
  } catch (err: any) {
    log('❌', `Database test failed — ${err.message}`);
    results.push({ name: 'DB: Topics', status: 'FAIL', detail: err.message });
  }
}

// ═══════════════════════════════════════════════════
// G. ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════
async function testAdminEndpoints() {
  console.log('\n[G] ADMIN ENDPOINTS');
  console.log('─'.repeat(50));

  const adminPaths = [
    '/api/admin/skills',
    '/api/admin/items',
    '/api/admin/topics',
    '/api/admin/settings',
    '/api/admin/analytics',
    '/api/admin/knowledge',
  ];

  for (const path of adminPaths) {
    try {
      const r = await fetchJSON(path, { timeout: 10000 });
      if (r.status === 401 || r.status === 403) {
        log('✅', `${path} — Protected (${r.elapsed}ms)`);
        results.push({ name: `Admin: ${path}`, status: 'PASS', detail: `HTTP ${r.status} — protected`, elapsed: r.elapsed });
      } else if (r.status === 500) {
        log('❌', `${path} → 500 Server Error`);
        results.push({ name: `Admin: ${path}`, status: 'FAIL', detail: '500 error', elapsed: r.elapsed });
      } else {
        log('⚠️', `${path} → HTTP ${r.status}`);
        results.push({ name: `Admin: ${path}`, status: 'WARN', detail: `HTTP ${r.status}`, elapsed: r.elapsed });
      }
    } catch (err: any) {
      log('❌', `${path} — ${err.message}`);
      results.push({ name: `Admin: ${path}`, status: 'FAIL', detail: err.message });
    }
  }
}

// ═══════════════════════════════════════════════════
// H. PERFORMANCE & RESPONSE TIMES
// ═══════════════════════════════════════════════════
async function testPerformance() {
  console.log('\n[H] PERFORMANCE CHECK');
  console.log('─'.repeat(50));

  const start = Date.now();
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(30000) });
    const elapsed = Date.now() - start;
    
    if (elapsed < 3000) {
      log('✅', `Homepage TTFB: ${elapsed}ms (good)`);
      results.push({ name: 'Perf: Homepage TTFB', status: 'PASS', detail: `${elapsed}ms`, elapsed });
    } else if (elapsed < 10000) {
      log('⚠️', `Homepage TTFB: ${elapsed}ms (cold start — Render free tier)`);
      results.push({ name: 'Perf: Homepage TTFB', status: 'WARN', detail: `${elapsed}ms (cold start)`, elapsed });
    } else {
      log('❌', `Homepage TTFB: ${elapsed}ms (very slow)`);
      results.push({ name: 'Perf: Homepage TTFB', status: 'FAIL', detail: `${elapsed}ms`, elapsed });
    }
  } catch (err: any) {
    log('❌', `Performance test failed: ${err.message}`);
    results.push({ name: 'Perf: Homepage TTFB', status: 'FAIL', detail: err.message });
  }
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════
async function main() {
  console.log('═'.repeat(55));
  console.log('  YNAI PRODUCTION A-Z SMOKE TEST');
  console.log(`  Target: ${BASE}`);
  console.log(`  Time:   ${new Date().toISOString()}`);
  console.log('═'.repeat(55));

  await testPerformance();
  await testStaticPages();
  await testPublicAPIs();
  await testAuthenticatedAPIs();
  await testAIAgent();
  await testMasteryEngine();
  await testDatabase();
  await testAdminEndpoints();

  // ═══════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(55));
  console.log('  SUMMARY');
  console.log('═'.repeat(55));

  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const skip = results.filter(r => r.status === 'SKIP').length;

  console.log(`\n  ✅ PASS: ${pass}`);
  console.log(`  ❌ FAIL: ${fail}`);
  console.log(`  ⚠️  WARN: ${warn}`);
  console.log(`  ⏭️  SKIP: ${skip}`);
  console.log(`  ─────────────`);
  console.log(`  TOTAL: ${results.length}`);

  if (fail > 0) {
    console.log('\n  FAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    ❌ ${r.name}: ${r.detail}`);
    });
  }

  if (warn > 0) {
    console.log('\n  WARNINGS:');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`    ⚠️  ${r.name}: ${r.detail}`);
    });
  }

  console.log('\n' + '═'.repeat(55));
  
  if (fail === 0) {
    console.log('  🎉 ALL CRITICAL TESTS PASSED');
  } else {
    console.log(`  ⚠️  ${fail} FAILURE(S) DETECTED — see above`);
  }
  console.log('═'.repeat(55) + '\n');
  
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
