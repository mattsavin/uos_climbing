import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/server';
import { db } from '../../backend/db';

describe('Membership Types API', () => {
    let committeeToken: string;

    beforeAll(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));

        const committeeRes = await request(app)
            .post('/api/auth/register')
            .send({
                firstName: 'Membership',
                lastName: 'Admin',
                email: 'committee_membership_types@example.com',
                password: 'Password123!', passwordConfirm: 'Password123!',
                registrationNumber: 'ADM_MEM_TYPES'
            });

        const committeeUserId = committeeRes.body.user?.id;

        const adminLoginRes = await request(app).post('/api/auth/login').send({
            email: 'committee@sheffieldclimbing.org', password: 'SuperSecret123!'
        });
        const adminCookies = adminLoginRes.headers['set-cookie'];
        const adminCookieArray = Array.isArray(adminCookies) ? adminCookies : (adminCookies ? [adminCookies] : []);
        const adminCookie = adminCookieArray.find((c: string) => c.startsWith('uscc_token='));
        const adminToken = adminCookie ? adminCookie.split(';')[0].split('=')[1] : '';

        await request(app).post(`/api/admin/users/${committeeUserId}/promote`).set('Authorization', `Bearer ${adminToken}`);

        const refreshRes = await request(app).post('/api/auth/login').send({
            email: 'committee_membership_types@example.com', password: 'Password123!'
        });
        const refreshCookies = refreshRes.headers['set-cookie'];
        const refreshCookieArray = Array.isArray(refreshCookies) ? refreshCookies : (refreshCookies ? [refreshCookies] : []);
        const refreshCookie = refreshCookieArray.find((c: string) => c.startsWith('uscc_token='));
        committeeToken = refreshCookie ? refreshCookie.split(';')[0].split('=')[1] : '';
    });

    afterAll(async () => {
        db.close();
    });

    it('should list default membership types', async () => {
        const res = await request(app).get('/api/membership-types');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((t: any) => t.id === 'basic')).toBe(true);
    });

    it('should allow committee to add, update, and delete a membership type', async () => {
        const addRes = await request(app)
            .post('/api/membership-types')
            .set('Authorization', `Bearer ${committeeToken}`)
            .send({ label: 'Coach Access' });

        expect(addRes.status).toBe(200);
        expect(addRes.body).toHaveProperty('id', 'coach_access');

        const updateRes = await request(app)
            .put('/api/membership-types/coach_access')
            .set('Authorization', `Bearer ${committeeToken}`)
            .send({ label: 'Coach Pass' });

        expect(updateRes.status).toBe(200);
        expect(updateRes.body).toHaveProperty('label', 'Coach Pass');

        const deleteRes = await request(app)
            .delete('/api/membership-types/coach_access')
            .set('Authorization', `Bearer ${committeeToken}`);

        expect(deleteRes.status).toBe(200);
        expect(deleteRes.body).toHaveProperty('success', true);
    });

    it('should prevent non-committee from changing membership types', async () => {
        const res = await request(app).post('/api/membership-types').send({ label: 'Hacker Type' });
        expect(res.status).toBe(401);
    });
});
