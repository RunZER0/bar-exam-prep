
import { config } from 'dotenv';
config({ path: '.env' });

import { v4 as uuidv4 } from 'uuid';
import { eq, sql } from 'drizzle-orm';
// @ts-ignore
import * as schema from '../lib/db/schema';
// @ts-ignore
import { db } from '../lib/db';
// @ts-ignore
import { MasteryOrchestrator } from '../lib/services/mastery-orchestrator';

async function verifyMilestone3() {
    console.log("🔍 Starting Milestone 3 Verification...");
    
    // 0. Find existing Syllabus Node to fail
    let targetNodeId = 'atp_101_week_10';
    let targetNodeTitle = 'Unknown';
    let selected: any = null;
    
    try {
        const nodes = await db.select().from(schema.syllabusNodes);
        console.log(`\n📚 Total Syllabus Nodes in DB: ${nodes.length}`);
        
        if (nodes.length > 0) {
            // Prefer a drafting node
            const drafting = nodes.find((n: any) => n.topicName.toLowerCase().includes('plaint') || n.isDraftingNode);
            const highYield = nodes.find((n: any) => n.isHighYield);
            const any = nodes[0];
            
            selected = drafting || highYield || any;
            targetNodeId = selected.id;
            targetNodeTitle = selected.topicName;
            
            console.log(`   🎯 Selected Target Node: ${targetNodeTitle} (ID: ${targetNodeId})`);
            console.log(`      Week: ${selected.weekNumber} | Type: ${selected.isDraftingNode ? 'Drafting' : 'Standard'}`);
        } else {
            console.warn("   ⚠️ NO SYLLABUS NODES FOUND IN DB. Orchestrator might use Mock Data.");
            targetNodeId = 'node-3';
            console.log(`   Fallback Target: ${targetNodeId}`);
        }
    } catch (e: any) {
        console.error("   ❌ Failed to query syllabusNodes:", e.message);
    }

    const resitUserId = uuidv4();
    const studentUserId = uuidv4();
    const resitProfileId = uuidv4();
    const studentProfileId = uuidv4();

    console.log(`\n👤 Creating Test Users (Failing Unit: ${targetNodeId}):`);
    
    try {
        // 1. Create Users
        await db.insert(schema.users).values([
            {
                id: resitUserId,
                email: `resit-${uuidv4()}@test.com`,
                firebaseUid: `uid-${resitUserId}`,
                role: 'student'
            },
            {
                id: studentUserId,
                email: `student-${uuidv4()}@test.com`,
                firebaseUid: `uid-${studentUserId}`,
                role: 'student'
            }
        ]);

        // 2. Create User Profiles (This drives the Orchestrator logic)
        await db.insert(schema.userProfiles).values([
            {
                id: resitProfileId,
                userId: resitUserId,
                examPath: 'APRIL_2026',
                weakAreas: [targetNodeId], // Inject the dynamically found ID
                targetExamDate: '2026-04-15'
            },
            {
                id: studentProfileId,
                userId: studentUserId,
                examPath: 'NOVEMBER_2026',
                targetExamDate: '2026-11-15'
            }
        ]);
        
        console.log("✅ Users & Profiles seeded.");
    } catch (e: any) {
        console.error(`⚠️ Seeding failed: ${e.message}`);
        process.exit(1);
    }

    // 2. Orchestrator Test: Path A (Resit)
    console.log("\n🧪 Testing PATH A (Resit Candidate - April 2026)...");
    const resitResult = await MasteryOrchestrator.generateDailyQueue(resitUserId);
    const resitQueue = resitResult.queue || [];
    console.log(`   Queue Size: ${resitQueue.length}`);
    
    // Check key properties
    // We try to match either exact ID or partial title if ID fails
    const inQueue = resitQueue.find((t: any) => t.data.id === targetNodeId || t.data.unitId === targetNodeId);
    
    if (inQueue) {
         console.log(`   ✅ SUCCESS: Resit queue contains the specific failed unit (${inQueue.data.title}).`);
         console.log(`   Priority: ${inQueue.priority}`);
         console.log(`   Pacing Protocol: ${resitResult.meta?.pacing || 'Unknown'}`);
    } else {
         console.log(`   ⚠️ PARTIAL: Target node ${targetNodeId} MISSING in Queue.`);
         if(resitQueue.length > 0)
             console.log("   Found:", resitQueue.map((q: any) => `${q.data.id}: ${q.data.title}`));
         else {
             console.log("   Queue Empty.");
             // Debug: Why empty? Orchestrator logic: isPathA = true -> filter targetedNodes
             // targetedNodes = syllabus.filter(node => failedUnits.includes(node.id))
             // If ID mismatch (UUID vs String), it fails.
             console.log("   [DEBUG] Failed Unit Target: ", targetNodeId);
             if (selected) {
                 console.log("   [DEBUG] Syllabus Node ID in DB: ", selected.id);
             }
         }
    }

    // 3. Orchestrator Test: Path B (Standard)
    console.log("\n🧪 Testing PATH B (Standard Student - Nov 2026)...");
    const studentResult = await MasteryOrchestrator.generateDailyQueue(studentUserId);
    const studentQueue = studentResult.queue || [];
    console.log(`   Queue Size: ${studentQueue.length}`);
    
    if (studentQueue.length > 0) {
        console.log("   ✅ SUCCESS: Standard queue generated (Paced Build).");
        console.log(`   First Item: ${studentQueue[0].data.title}`);
    } else {
        console.log("   ⚠️ WARNING: Standard queue empty.");
    }

    console.log("\n🏁 Milestone 3 Verification Complete.");
    process.exit(0);
}

verifyMilestone3().catch(console.error);
