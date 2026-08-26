#!/usr/bin/env node
/**
 * Load test: the "sessions-open rush".
 *
 * Boots the real server in production mode (local, isolated DB) and drives
 * three scenarios with plain fetch — no external load-test dependencies:
 *
 *   1. browse        — read traffic: static page + sessions API
 *   2. login storm   — N concurrent bcrypt logins (the real CPU cost)
 *   3. booking rush  — N users race one capacity-C session; asserts
 *                      exactly C succeed, zero oversell, zero 500s
 *
 * Usage:  node tests/load/rush.mjs [--users 100] [--capacity 20] [--ramp 5]
 *
 * Exit code is non-zero if any scenario fails its assertions.
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import bcrypt from 'bcrypt';

const args = Object.fromEntries(
    process.argv.slice(2).reduce((acc, a, i, arr) => {
        if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
        return acc;
    }, [])
);

const USERS = Number(args.users ?? 100);
const CAPACITY = Number(args.capacity ?? 20);
const PORT = 3198;
const BASE = `http://127.0.0.1:${PORT}`;
const SECRET = 'load-test-secret';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'uos-load-'));
const DIST = path.resolve(process.cwd(), 'dist');

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist/ missing — run `npm run build` first');
    process.exit(1);
}

const latency = [];
let errors5xx = 0;
let errors4xx = 0;

// Each request presents a distinct source IP via X-Forwarded-For (trust proxy
// is enabled in production mode), mirroring a real distributed rush. A rotating
// pool is used per REQUEST rather than per virtual user: a single busy VU would
// otherwise exhaust the global rate-limit bucket (1000 req/IP/15min) mid-scenario
// and pollute later scenarios sharing the same VU index.
const IP_POOL = 500;
let ipCounter = 0;
const vuIp = (i) => `10.${Math.floor(i / 250) % 250}.${i % 250}.${((i * 7) % 250) + 1}`;
const nextIp = () => vuIp(ipCounter++ % IP_POOL);

async function timed(path, opts = {}) {
    const start = performance.now();
    opts.headers = { 'X-Forwarded-For': nextIp(), ...(opts.headers || {}) };
    try {
        const res = await fetch(`${BASE}${path}`, opts);
        latency.push(performance.now() - start);
        if (res.status >= 500) errors5xx++;
        else if (res.status >= 400) errors4xx++;
        return res;
    } catch {
        errors5xx++;
        latency.push(performance.now() - start);
        return null;
    }
}

function pct(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor((sorted.length - 1) * p)] ?? 0;
}

function report(name, count, elapsedMs) {
    const rps = (count / (elapsedMs / 1000)).toFixed(0);
    console.log(
        `  ${name.padEnd(14)} ${String(count).padStart(6)} req  ${String(rps).padStart(6)} rps  ` +
            `p50 ${pct(latency.slice(-count), 0.5).toFixed(0)}ms  p95 ${pct(latency.slice(-count), 0.95).toFixed(0)}ms  ` +
            `p99 ${pct(latency.slice(-count), 0.99).toFixed(0)}ms  4xx ${errors4xx}  5xx ${errors5xx}`
    );
}

// --- server boot -----------------------------------------------------------
const server = spawn('npx', ['tsx', 'backend/server.ts'], {
    cwd: process.cwd(),
    env: {
        ...process.env,
        NODE_ENV: 'production',
        JWT_SECRET: SECRET,
        PORT: String(PORT),
        UPLOAD_BASE_DIR: TMP,
        DB_PATH: path.join(TMP, 'uscc.db')
    },
    stdio: ['ignore', 'ignore', fs.openSync(path.join(TMP, 'server-stderr.log'), 'a')]
});

async function waitForHealth() {
    for (let i = 0; i < 60; i++) {
        try {
            const r = await fetch(`${BASE}/api/health`);
            if (r.ok) return;
        } catch {
            // not up yet — retry until deadline
        }
        await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error('server never became healthy');
}

function sign(user) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
        JSON.stringify({ ...user, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })
    ).toString('base64url');
    const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${sig}`;
}

// --- seeding ----------------------------------------------------------------
async function seed() {
    const { default: Database } = await import('sqlite3');
    const db = new Database.Database(path.join(TMP, 'uscc.db'));
    await new Promise((resolve) =>
        db.serialize(() => {
            db.wait(() => resolve());
        })
    );
    const run = (sql, params = []) =>
        new Promise((resolve, reject) =>
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            })
        );

    const year = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
    const realHash = await bcrypt.hash('Password123!', 12); // one real hash reused by all seeded users
    const stmtUsers = [];
    for (let i = 0; i < USERS; i++) {
        stmtUsers.push({
            id: `user_load_${i}`,
            email: `load_${i}@sheffield.ac.uk`,
            firstName: `Load${i}`
        });
    }

    for (const u of stmtUsers) {
        await run(
            `INSERT INTO users (id, firstName, lastName, name, email, passwordHash, role, membershipStatus, membershipYear, emailVerified)
             VALUES (?, ?, 'User', ?, ?, ?, 'member', 'active', ?, 1)`,
            [u.id, u.firstName, `${u.firstName} User`, u.email, realHash, year]
        );
        await run(
            `INSERT OR IGNORE INTO user_memberships (id, userId, membershipType, status, membershipYear)
             VALUES (?, ?, 'basic', 'active', ?)`,
            [`umem_${u.id}`, u.id, year]
        );
    }

    await run(
        `INSERT INTO sessions (id, type, title, date, capacity, bookedSlots, requiredMembership, visibility, registrationVisibility)
         VALUES ('sess_rush', 'Social', 'Rush Test Session', ?, ?, 0, 'basic', 'all', 'all')`,
        [new Date(Date.now() + 7 * 86400 * 1000).toISOString(), CAPACITY]
    );

    const count = await new Promise((resolve) =>
        db.get('SELECT COUNT(*) AS c FROM users WHERE id LIKE "user_load_%"', (e, r) => resolve(r.c))
    );
    db.close();
    return count;
}

// --- scenarios --------------------------------------------------------------
async function scenarioBrowse(tokens) {
    console.log(`\n▶ browse: ${tokens.length} virtual users, 15s mixed reads`);
    latency.length = 0;
    errors4xx = 0;
    errors5xx = 0;
    const start = performance.now();
    let count = 0;
    const deadline = start + 15000;
    const worker = async () => {
        while (performance.now() < deadline) {
            await timed('/api/sessions');
            count++;
            await timed('/');
            count++;
        }
    };
    await Promise.all(Array.from({ length: 25 }, () => worker()));
    report('browse', count, performance.now() - start);
    return errors5xx === 0;
}

async function scenarioLoginStorm() {
    console.log(`\n▶ login storm: ${USERS} concurrent bcrypt logins`);
    latency.length = 0;
    errors4xx = 0;
    errors5xx = 0;
    const start = performance.now();
    const results = await Promise.all(
        Array.from({ length: USERS }, (_, i) =>
            timed('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: `load_${i}@sheffield.ac.uk`, password: 'Password123!' })
            })
        )
    );
    const ok = results.filter((r) => r && r.status === 200).length;
    report('login', USERS, performance.now() - start);
    console.log(`  → ${ok}/${USERS} logins succeeded`);
    return ok === USERS && errors5xx === 0;
}

async function scenarioBookingRush(tokens) {
    console.log(`\n▶ booking rush: ${tokens.length} users race one capacity-${CAPACITY} session`);
    latency.length = 0;
    errors4xx = 0;
    errors5xx = 0;
    const start = performance.now();

    // fire all at once
    const results = await Promise.all(
        tokens.map((t) =>
            timed('/api/sessions/sess_rush/book', { method: 'POST', headers: { Authorization: `Bearer ${t}` } })
        )
    );
    const elapsed = performance.now() - start;

    const byStatus = {};
    results.forEach((r) => {
        const s = r ? r.status : 0;
        byStatus[s] = (byStatus[s] || 0) + 1;
    });
    report('rush', tokens.length, elapsed);
    console.log(`  → status breakdown:`, byStatus);

    // verify no oversell via the API itself
    const check = await fetch(`${BASE}/api/sessions/sess_rush/book`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens[0]}` }
    });
    const fullOrBooked = check.status; // 400 full (if capacity met) or 400 already-booked
    const oversold = byStatus[200] > CAPACITY || fullOrBooked === 200;
    const no500 = errors5xx === 0;
    const exactFill = byStatus[200] === CAPACITY;

    console.log(
        `  → successes: ${byStatus[200] ?? 0}/${CAPACITY} expected | oversell: ${oversold ? 'YES ❌' : 'no ✅'} | 5xx: ${errors5xx}`
    );
    return exactFill && !oversold && no500;
}

// --- main -------------------------------------------------------------------
try {
    console.log('booting production-mode server…');
    await waitForHealth();
    const seeded = await seed();
    console.log(`seeded ${seeded} users + 1 capacity-${CAPACITY} session`);
    await new Promise((r) => setTimeout(r, 500));

    const tokens = Array.from({ length: USERS }, (_, i) =>
        sign({
            id: `user_load_${i}`,
            name: `Load${i} User`,
            email: `load_${i}@sheffield.ac.uk`,
            role: 'member',
            membershipStatus: 'active',
            membershipYear: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`
        })
    );

    const r1 = await scenarioBrowse(tokens.slice(0, 25));
    const r2 = await scenarioLoginStorm();
    const r3 = await scenarioBookingRush(tokens);

    console.log('\n════════ VERDICT ════════');
    console.log(`  browse:        ${r1 ? 'PASS' : 'FAIL'}`);
    console.log(`  login storm:   ${r2 ? 'PASS' : 'FAIL'}`);
    console.log(`  booking rush:  ${r3 ? 'PASS' : 'FAIL'}  (no oversell, exact fill, no 5xx)`);
    process.exitCode = r1 && r2 && r3 ? 0 : 1;
} catch (e) {
    console.error('load test failed:', e.message);
    process.exitCode = 1;
} finally {
    server.kill('SIGTERM');
}
