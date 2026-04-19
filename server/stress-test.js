/**
 * CivicLens — Stress Test Script
 * Submits 25 tickets rapidly, then verifies GET /api/tickets count + GET /api/stats consistency.
 *
 * Usage:  node stress-test.js [baseUrl]
 * Default baseUrl: http://localhost:3001
 */

const BASE_URL = process.argv[2] || 'http://localhost:3001';

const CATEGORIES = ['pothole', 'garbage', 'broken_streetlight', 'waterlogging', 'other'];
const TOTAL_TICKETS = 25;

function randomCoord(min, max) {
    return +(min + Math.random() * (max - min)).toFixed(4);
}

function buildTicketPayload(index) {
    const cat = CATEGORIES[index % CATEGORIES.length];
    return {
        description: `Stress-test ticket #${index + 1} — ${cat} issue`,
        photoUrl: `https://example.com/stress-test/ticket-${index + 1}.jpg`,
        longitude: randomCoord(72, 88),
        latitude: randomCoord(10, 30),
    };
}

async function submitTicket(payload) {
    const res = await fetch(`${BASE_URL}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`POST /api/tickets failed (${res.status}): ${body}`);
    }
    return res.json();
}

async function getTickets() {
    const res = await fetch(`${BASE_URL}/api/tickets?limit=100`);
    return res.json();
}

async function getStats() {
    const res = await fetch(`${BASE_URL}/api/stats`);
    return res.json();
}

async function run() {
    console.log(`\n=== CivicLens Stress Test ===`);
    console.log(`Target: ${BASE_URL}`);
    console.log(`Tickets to submit: ${TOTAL_TICKETS}\n`);

    // ── 1. Get baseline count ─────────────────────
    const before = await getTickets();
    const baselineCount = before.total ?? before.count ?? 0;
    console.log(`Baseline ticket count: ${baselineCount}`);

    // ── 2. Submit tickets concurrently in batches of 5 ─────
    const start = Date.now();
    let successCount = 0;
    let failCount = 0;

    for (let batch = 0; batch < TOTAL_TICKETS; batch += 5) {
        const batchSize = Math.min(5, TOTAL_TICKETS - batch);
        const promises = [];
        for (let i = 0; i < batchSize; i++) {
            promises.push(
                submitTicket(buildTicketPayload(batch + i))
                    .then(() => { successCount++; })
                    .catch((err) => {
                        failCount++;
                        console.error(`  [FAIL] Ticket #${batch + i + 1}: ${err.message}`);
                    })
            );
        }
        await Promise.all(promises);
        process.stdout.write(`  Submitted ${Math.min(batch + batchSize, TOTAL_TICKETS)}/${TOTAL_TICKETS}\r`);
    }

    const elapsed = Date.now() - start;
    console.log(`\n\nSubmission complete in ${elapsed}ms`);
    console.log(`  Success: ${successCount}  |  Failed: ${failCount}`);

    // ── 3. Verify ticket count ────────────────────
    const after = await getTickets();
    const afterCount = after.total ?? after.count ?? 0;
    const newTickets = afterCount - baselineCount;

    console.log(`\n--- Verification ---`);
    console.log(`Tickets before: ${baselineCount}`);
    console.log(`Tickets after:  ${afterCount}`);
    console.log(`New tickets:    ${newTickets}  (expected: ${successCount})`);

    if (newTickets === successCount) {
        console.log(`✅ PASS — All submitted tickets accounted for.`);
    } else {
        console.log(`❌ FAIL — Count mismatch! Expected ${successCount} new, got ${newTickets}.`);
    }

    // ── 4. Verify stats consistency ───────────────
    const stats = await getStats();
    const statsData = stats.data ?? stats;
    const statsTotal = statsData.total ?? 0;
    const byStatus = statsData.byStatus ?? {};
    const statusSum = (byStatus.open ?? 0) + (byStatus.in_progress ?? 0) + (byStatus.resolved ?? 0);

    console.log(`\n--- Stats Consistency ---`);
    console.log(`Stats total:      ${statsTotal}`);
    console.log(`Status sum:       ${statusSum}  (open=${byStatus.open} + in_progress=${byStatus.in_progress} + resolved=${byStatus.resolved})`);
    console.log(`Avg severity:     ${statsData.avgSeverity ?? 'N/A'}`);
    console.log(`Categories:       ${JSON.stringify(statsData.byCategory ?? {})}`);

    if (statsTotal === statusSum) {
        console.log(`✅ PASS — Stats totals are consistent.`);
    } else {
        console.log(`❌ FAIL — Stats total (${statsTotal}) ≠ status sum (${statusSum}).`);
    }

    console.log(`\n=== Stress Test Complete ===\n`);
}

run().catch((err) => {
    console.error('Stress test crashed:', err);
    process.exit(1);
});
