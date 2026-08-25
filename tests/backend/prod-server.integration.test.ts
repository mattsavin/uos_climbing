import { describe, it, expect, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * End-to-end production-mode server integration test.
 *
 * Boots the real server as a child process with NODE_ENV=production (plus
 * UPLOAD_BASE_DIR/DB_PATH overrides so it can run outside a container) and
 * asserts the routing behaviours that only exist in the production branch:
 *
 *  - /api/health answers ok
 *  - known clean routes serve their HTML entries
 *  - unknown browser routes get HTTP 404 + the branded page
 *  - unknown API routes get JSON 404
 *
 * Requires `npm run build` artifacts (dist/) — CI builds before testing;
 * locally this suite self-skips when dist is absent.
 */

const DIST = path.resolve(process.cwd(), 'dist');
const distReady = fs.existsSync(path.join(DIST, 'index.html'));

const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'uos-prodit-'));

let child: ReturnType<typeof spawn> | null = null;

async function waitForHealth(timeoutMs = 20000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(`${BASE}/api/health`);
            if (res.ok) return;
        } catch {
            /* not up yet */
        }
        await new Promise(r => setTimeout(r, 300));
    }
    throw new Error('server did not become healthy in time');
}

describe.skipIf(!distReady)('production server (child process integration)', () => {
    afterAll(() => {
        child?.kill('SIGTERM');
    });

    it('boots in production mode and serves production-only behaviours', async () => {
        child = spawn('npx', ['tsx', 'backend/server.ts'], {
            cwd: path.resolve(__dirname, '../..'),
            env: {
                ...process.env,
                NODE_ENV: 'production',
                JWT_SECRET: 'integration-test-secret',
                PORT: String(PORT),
                UPLOAD_BASE_DIR: TMP,
                DB_PATH: path.join(TMP, 'uscc.db')
            },
            stdio: 'ignore'
        });

        await waitForHealth();

        // 1. Health endpoint reflects DB connectivity
        const health = await fetch(`${BASE}/api/health`).then(r => r.json());
        expect(health).toMatchObject({ ok: true, db: true });

        // 2. Known clean route serves its entry file
        const schedule = await fetch(`${BASE}/schedule`);
        expect(schedule.status).toBe(200);
        const scheduleBody = await schedule.text();
        expect(scheduleBody).toContain('<title>Schedule | USMC</title>');

        // 3. Unknown browser request -> branded 404 page with correct status
        const missing = await fetch(`${BASE}/definitely-not-a-page`, {
            headers: { Accept: 'text/html' }
        });
        expect(missing.status).toBe(404);
        expect(await missing.text()).toContain('gone off-route');

        // 4. Unknown API route -> JSON 404 contract
        const apiMiss = await fetch(`${BASE}/api/definitely-not-a-route`);
        expect(apiMiss.status).toBe(404);
        expect(await apiMiss.json()).toHaveProperty('error');

        // 5. Verify deep link still routes to its page
        const verify = await fetch(`${BASE}/verify/some-token`);
        expect(verify.status).toBe(200);
        expect(await verify.text()).toContain('<title>Verify Membership | USMC</title>');
    }, 40000);
});
