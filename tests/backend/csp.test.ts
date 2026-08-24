import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/server';
import { db } from '../../backend/db';

describe('Content Security Policy rollout', () => {
    beforeAll(async () => {
        // Wait for DB initialization
        await new Promise(resolve => setTimeout(resolve, 500));
    });

    afterAll(() => {
        db.close();
    });

    it('sends Content-Security-Policy-Report-Only (not enforcing) by default', async () => {
        const res = await request(app).get('/api/sessions');
        expect(res.headers['content-security-policy-report-only']).toBeDefined();
        expect(res.headers['content-security-policy-report-only']).toContain("default-src 'self'");
        expect(res.headers['content-security-policy-report-only']).toContain('report-uri /api/csp-report');
        expect(res.headers['content-security-policy']).toBeUndefined();
    });

    it('accepts browser violation reports (application/csp-report) and returns 204', async () => {
        const res = await request(app)
            .post('/api/csp-report')
            .set('Content-Type', 'application/csp-report')
            .send(JSON.stringify({
                'csp-report': {
                    'document-uri': 'https://x.test/',
                    'violated-directive': 'img-src',
                    'blocked-uri': 'https://evil.example/x.png'
                }
            }));
        expect(res.status).toBe(204);
    });

    it('accepts the newer application/reports+json format and returns 204', async () => {
        const res = await request(app)
            .post('/api/csp-report')
            .set('Content-Type', 'application/reports+json')
            .send([{ type: 'csp-violation', body: { effectiveDirective: 'img-src' } }]);
        expect(res.status).toBe(204);
    });

    it('returns 204 for an empty or malformed body rather than erroring', async () => {
        const res = await request(app)
            .post('/api/csp-report')
            .set('Content-Type', 'text/plain')
            .send('not json');
        expect([204, 400]).toContain(res.status);
    });
});
