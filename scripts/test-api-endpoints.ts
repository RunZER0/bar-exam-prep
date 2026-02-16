/**
 * Test the actual API endpoints via HTTP
 * Run: npx tsx scripts/test-api-endpoints.ts
 */

const BASE_URL = 'http://localhost:3002';

async function testAPIs() {
  console.log('🌐 TESTING API ENDPOINTS\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test Readiness API
  console.log('1️⃣ Testing /api/mastery/readiness...');
  try {
    const res = await fetch(`${BASE_URL}/api/mastery/readiness`);
    const data = await res.json();
    if (res.ok) {
      console.log(`   ✓ Status: ${res.status}`);
      console.log(`   ✓ Units returned: ${data.units?.length || 0}`);
      if (data.units?.length > 0) {
        const unit = data.units[0];
        console.log(`   ✓ First unit: ${unit.unitId} - ${unit.name}`);
        console.log(`   ✓ Readiness: ${unit.readinessPercent?.toFixed(1) ?? 0}%`);
        console.log(`   ✓ Skills: ${unit.skillCount}`);
      }
    } else {
      console.log(`   ❌ Error: ${data.error}`);
    }
  } catch (err: any) {
    console.log(`   ❌ Failed: ${err.message}`);
  }
  console.log('');

  // Test Plan API
  console.log('2️⃣ Testing /api/mastery/plan...');
  try {
    const res = await fetch(`${BASE_URL}/api/mastery/plan`);
    const data = await res.json();
    if (res.ok) {
      console.log(`   ✓ Status: ${res.status}`);
      console.log(`   ✓ Plan units: ${data.units?.length || 0}`);
      if (data.units?.length > 0) {
        const firstUnit = data.units[0];
        console.log(`   ✓ First unit: ${firstUnit.unitId}`);
        console.log(`   ✓ Skills in plan: ${firstUnit.skills?.length || 0}`);
      }
    } else {
      console.log(`   ❌ Error: ${data.error}`);
    }
  } catch (err: any) {
    console.log(`   ❌ Failed: ${err.message}`);
  }
  console.log('');

  // Test Attempt GET API
  console.log('3️⃣ Testing /api/mastery/attempt (GET)...');
  try {
    const res = await fetch(`${BASE_URL}/api/mastery/attempt?limit=5`);
    const data = await res.json();
    if (res.ok) {
      console.log(`   ✓ Status: ${res.status}`);
      console.log(`   ✓ Attempts returned: ${data.attempts?.length || 0}`);
      if (data.attempts?.length > 0) {
        const att = data.attempts[0];
        console.log(`   ✓ Latest: ${att.format} - Score: ${(att.scoreNorm * 100).toFixed(0)}%`);
      }
    } else {
      console.log(`   ❌ Error: ${data.error}`);
    }
  } catch (err: any) {
    console.log(`   ❌ Failed: ${err.message}`);
  }
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ API TESTS COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

testAPIs();
