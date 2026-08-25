import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/server';
import { db } from '../../backend/db';

describe('GET /api/health', () => {
    beforeAll(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
    });

    afterAll(() => {
        db.close();
    });

    it('returns ok:true with db reachable', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.db).toBe(true);
        expect(typeof res.body.uptime).toBe('number');
    });

    it('answers 503 (not hang) when the database never responds', async () => {
        // Simulate the sqlite3 "database never opened" state: callbacks queued forever.
        const spy = vi.spyOn(db, 'get').mockImplementation(() => db);

        const res = await request(app).get('/api/health').timeout({ response: 5000 });
        expect(res.status).toBe(503);
        expect(res.body.ok).toBe(false);

        spy.mockRestore();
    }, 10000);

    it('answers 503 when the database errors', async () => {
        const spy = vi.spyOn(db, 'get').mockImplementation((_sql: any, _params: any, cb: any) => cb(new Error('boom')));

        const res = await request(app).get('/api/health');
        expect(res.status).toBe(503);
        expect(res.body.db).toBe(false);

        spy.mockRestore();
    });
});
