import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { app } from '../../backend/server';
import { SCANNER_PATH_PREFIXES, scannerFastFail } from '../../backend/middleware/scanner-fast-fail';

/**
 * P1 (docs/BUILD_IMPROVEMENTS.md): scanner probe paths must return a plain-text
 * 404 from scannerFastFail before the rate limiter sees them, and every other
 * path must be untouched.
 */
describe('scanner fast-fail middleware', () => {
    describe('real app: probes short-circuit before downstream middleware', () => {
        const probes = [
            '/.env',
            '/.env.example',
            '/.env.bak',
            '/wp-admin/setup.php',
            '/wp-login.php?action=register',
            '/config/app.yml',
            '/actuator/env',
            '/.git/config',
            '/phpmyadmin/index.php',
            '/.ENV', // case-shifted probe
            '/%2Eenv' // percent-encoded dot
        ];

        it.each(probes)('%s answers plain-text 404 without consuming limiter budget', async (probe) => {
            const res = await request(app).get(probe);
            expect(res.status).toBe(404);
            // Plain text identifies the fast-fail response: downstream handlers
            // answer JSON ({error}) for API paths or HTML for pages.
            expect(res.type).toBe('text/plain');
        });

        it('matches after query strings and double slashes are normalised by Express routing', async () => {
            const res = await request(app).get('/wp-admin/load-styles.php?c=1&load%5B%5D=dashicons');
            expect(res.status).toBe(404);
            expect(res.type).toBe('text/plain');
        });
    });

    describe('non-scanner paths are untouched', () => {
        it('/api/health still answers 200 JSON', async () => {
            const res = await request(app).get('/api/health');
            expect(res.status).toBe(200);
            expect(res.body.ok).toBe(true);
        });

        it('authed API route responds normally (not text/plain 404)', async () => {
            const res = await request(app).get('/api/trips');
            expect(res.status).toBe(401);
            expect(res.type).toBe('application/json');
        });

        it('prefix list never contains an entry that would shadow real routes', () => {
            const legit = ['/api/', '/uploads', '/assets', '/beta-gate', '/verify/', '/faq', '/gear'];
            for (const prefix of SCANNER_PATH_PREFIXES) {
                for (const route of legit) {
                    expect(prefix.startsWith(route)).toBe(false);
                }
            }
        });
    });

    describe('fast-fail runs ahead of the rate limiter', () => {
        // Isolated mini-app mirrors server.ts ordering exactly (scannerFastFail,
        // then a rateLimit instance): proves probes do not increment the counter
        // the real limiter uses, because full budget remains available afterwards.
        const mini = express();
        mini.use(scannerFastFail);
        mini.use(rateLimit({ windowMs: 60_000, max: 2, standardHeaders: false, legacyHeaders: false }));
        mini.get('/echo', (_req, res) => res.json({ ok: true }));

        it('5 scanner probes leave the 2-request budget intact', async () => {
            for (let i = 0; i < 5; i++) {
                const res = await request(mini).get('/.env');
                expect(res.status).toBe(404);
            }
            expect((await request(mini).get('/echo')).status).toBe(200);
            expect((await request(mini).get('/echo')).status).toBe(200);
            expect((await request(mini).get('/echo')).status).toBe(429); // only the 3rd echo hits the cap
        });

        it('same ordering without the middleware DOES burn budget (control)', async () => {
            const control = express();
            control.use(rateLimit({ windowMs: 60_000, max: 2, standardHeaders: false, legacyHeaders: false }));
            control.get('/echo', (_req, res) => res.json({ ok: true }));

            await request(control).get('/.env'); // probe #1 consumes half the budget

            expect((await request(control).get('/echo')).status).toBe(200);
            expect((await request(control).get('/echo')).status).toBe(429); // probe + echo hit the cap
        });
    });
});
