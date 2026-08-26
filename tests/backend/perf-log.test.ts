import { describe, it, expect, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { slowRequestLog, SLOW_REQUEST_MS } from '../../backend/perfLog';

describe('slowRequestLog middleware (P0-B perf instrumentation)', () => {
    afterEach(() => {
        delete process.env.PERF_LOG;
        vi.restoreAllMocks();
    });

    it('emits one [PERF] JSON line for a request slower than the threshold', async () => {
        process.env.PERF_LOG = 'true';
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const app = express();
        app.use(slowRequestLog);
        app.get('/api/slow', (_req, res) => {
            setTimeout(() => res.json({ ok: true }), SLOW_REQUEST_MS + 150);
        });

        const res = await request(app).get('/api/slow');
        expect(res.status).toBe(200);

        // 'close' handler fires after supertest resolves; give it a beat.
        await new Promise((r) => setTimeout(r, 50));

        expect(logSpy).toHaveBeenCalledTimes(1);
        const line = logSpy.mock.calls[0][0] as string;
        expect(line).toMatch(/^\[PERF\] /);
        const payload = JSON.parse(line.replace('[PERF] ', ''));
        expect(payload).toMatchObject({ method: 'GET', path: '/api/slow', status: 200 });
        expect(payload.durationMs).toBeGreaterThanOrEqual(SLOW_REQUEST_MS);
    });

    it('redacts path-carried tokens (ical/verify) before logging', async () => {
        process.env.PERF_LOG = 'true';
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const app = express();
        app.use(slowRequestLog);
        app.get('/api/verify/:token', (_req, res) => {
            setTimeout(() => res.json({ ok: true }), SLOW_REQUEST_MS + 150);
        });

        await request(app).get('/api/verify/super-secret-token').expect(200);
        await new Promise((r) => setTimeout(r, 50));

        const payload = JSON.parse((logSpy.mock.calls[0][0] as string).replace('[PERF] ', ''));
        expect(payload.path).toBe('/api/verify/<redacted>');
        expect(JSON.stringify(payload)).not.toContain('super-secret-token');
    });

    it('stays quiet when a request is under the threshold', async () => {
        process.env.PERF_LOG = 'true';
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const app = express();
        app.use(slowRequestLog);
        app.get('/fast', (_req, res) => res.json({ ok: true }));

        await request(app).get('/fast');
        await new Promise((r) => setTimeout(r, 50));

        expect(logSpy).not.toHaveBeenCalled();
    });

    it('logs nothing at all when PERF_LOG is not set (dev default)', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const app = express();
        app.use(slowRequestLog);
        app.get('/slow-anyway', (_req, res) => {
            setTimeout(() => res.json({ ok: true }), SLOW_REQUEST_MS + 150);
        });

        await request(app).get('/slow-anyway');
        await new Promise((r) => setTimeout(r, 50));

        expect(logSpy).not.toHaveBeenCalled();
    });
});
