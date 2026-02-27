import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/server';
import { db } from '../../backend/db';

describe('Session Types API', () => {
    let committeeToken: string;

    beforeAll(async () => {
        // Wait for DB initialization
        await new Promise(resolve => setTimeout(resolve, 500));

        // Create and promote a committee user
        const committeeRes = await request(app)
            .post('/api/auth/register')
            .send({
                firstName: 'Committee',
                lastName: 'User',
                email: 'committee_types@example.com',
                password: 'Password123!', passwordConfirm: 'Password123!',
                registrationNumber: 'ADM_TYPES'
            });

        const committeeUserId = committeeRes.body.user?.id;

        // Promote via root admin
        const adminLoginRes = await request(app).post('/api/auth/login').send({
            email: 'committee@sheffieldclimbing.org', password: 'SuperSecret123!'
        });
        const adminCookies = adminLoginRes.headers['set-cookie'];
        const adminCookieArray = Array.isArray(adminCookies) ? adminCookies : (adminCookies ? [adminCookies] : []);
        const adminCookie = adminCookieArray.find((c: string) => c.startsWith('uscc_token='));
        const adminToken = adminCookie ? adminCookie.split(';')[0].split('=')[1] : '';

        await request(app).post(`/api/admin/users/${committeeUserId}/promote`).set('Authorization', `Bearer ${adminToken}`);

        // Re-login to get a fresh JWT
        const refreshRes = await request(app).post('/api/auth/login').send({
            email: 'committee_types@example.com', password: 'Password123!'
        });
        const refreshCookies = refreshRes.headers['set-cookie'];
        const refreshCookieArray = Array.isArray(refreshCookies) ? refreshCookies : (refreshCookies ? [refreshCookies] : []);
        const refreshCookie = refreshCookieArray.find((c: string) => c.startsWith('uscc_token='));
        committeeToken = refreshCookie ? refreshCookie.split(';')[0].split('=')[1] : '';
    });

    afterAll(async () => {
        db.close();
    });

    it('should list default session types', async () => {
        const res = await request(app).get('/api/session-types');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(5);
        expect(res.body.some((t: any) => t.id === 'Social')).toBe(true);
    });

    it('should allow committee to add a session type', async () => {
        const res = await request(app)
            .post('/api/session-types')
            .set('Authorization', `Bearer ${committeeToken}`)
            .send({ label: 'New Type' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id', 'New Type');
    });

    it('should allow committee to update a session type', async () => {
        const res = await request(app)
            .put('/api/session-types/New%20Type')
            .set('Authorization', `Bearer ${committeeToken}`)
            .send({ label: 'Updated Type' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('label', 'Updated Type');
    });

    it('should allow committee to delete a session type', async () => {
        const res = await request(app)
            .delete('/api/session-types/New%20Type')
            .set('Authorization', `Bearer ${committeeToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should prevent non-committee from adding types', async () => {
        const res = await request(app)
            .post('/api/session-types')
            .send({ label: 'Hacker Type' });

        expect(res.status).toBe(401);
    });
});
