import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/server';
import { db } from '../../backend/db';

describe('Middleware Auth API', () => {
    let memToken: string;
    let comToken: string;
    let kitToken: string;

    beforeAll(async () => {
        // Wait for DB initialization
        await new Promise(resolve => setTimeout(resolve, 500));

        // Create a regular user
        const u1 = await request(app).post('/api/auth/register').send({
            name: 'Member', email: 'mem@ex.com', password: 'Password123!', registrationNumber: 'MEM1'
        });
        memToken = u1.body.token;

        // Create committee
        const u2 = await request(app).post('/api/auth/register').send({
            name: 'Com', email: 'com@committee.sheffield.ac.uk', password: 'Password123!', registrationNumber: 'COM2'
        });
        comToken = u2.body.token;

        // Create kit sec (needs promotion by admin)
        const u3 = await request(app).post('/api/auth/register').send({
            name: 'Kit', email: 'kit@ex.com', password: 'Password123!', registrationNumber: 'KIT3'
        });
        kitToken = u3.body.token;
        const kitId = u3.body.user.id;

        // Login Admin
        const adminRes = await request(app).post('/api/auth/login').send({
            email: 'sheffieldclimbing@gmail.com', password: 'SuperSecret123!'
        });
        const rootToken = adminRes.body.token;

        // Promote Kit
        await request(app).post(`/api/admin/users/${kitId}/promote`).set('Authorization', `Bearer ${rootToken}`);
        await request(app).post(`/api/admin/users/${kitId}/committee-role`).set('Authorization', `Bearer ${rootToken}`).send({ committeeRole: 'Kit & Safety Sec' });
    });

    afterAll(async () => {
        db.close();
    });

    const createRoleUser = async (roleType: 'member' | 'committee' | 'kit') => {
        const ts = Date.now();
        const base = { password: 'Password123!' };

        if (roleType === 'member') {
            const res = await request(app).post('/api/auth/register').send({
                ...base, name: 'Mem', email: `mem${ts}@ex.com`, registrationNumber: `M${ts}`
            });
            return res.body.token;
        } else if (roleType === 'committee') {
            const res = await request(app).post('/api/auth/register').send({
                ...base, name: 'Com', email: `com${ts}@committee.sheffield.ac.uk`, registrationNumber: `C${ts}`
            });
            return res.body.token;
        } else {
            // Kit Sec
            const res = await request(app).post('/api/auth/register').send({
                ...base, name: 'Kit', email: `kit${ts}@ex.com`, registrationNumber: `K${ts}`
            });
            const token = res.body.token;
            const kitId = res.body.user.id;

            const adminRes = await request(app).post('/api/auth/login').send({
                email: 'sheffieldclimbing@gmail.com', password: 'SuperSecret123!'
            });
            const rootToken = adminRes.body.token;

            await request(app).post(`/api/admin/users/${kitId}/promote`).set('Authorization', `Bearer ${rootToken}`);
            await request(app).post(`/api/admin/users/${kitId}/committee-role`).set('Authorization', `Bearer ${rootToken}`).send({ committeeRole: 'Kit & Safety Sec' });
            return token;
        }
    };

    it('requires auth token for protected routes', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });

    it('blocks regular members from accessing admin routes', async () => {
        const memToken = await createRoleUser('member');
        const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${memToken}`);
        expect(res.status).toBe(403);
    });

    it('allows committee members to access admin routes', async () => {
        const comToken = await createRoleUser('committee');
        const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${comToken}`);
        expect(res.status).toBe(200);
    });

    it('blocks regular committee members from creating gear', async () => {
        const comToken = await createRoleUser('committee');
        const res = await request(app).post('/api/gear').set('Authorization', `Bearer ${comToken}`).send({ name: 'Rope' });
        expect(res.status).toBe(403);
    });

    it('allows Kit & Safety Sec to create gear', async () => {
        const kitToken = await createRoleUser('kit');
        const res = await request(app).post('/api/gear').set('Authorization', `Bearer ${kitToken}`).send({ name: 'Rope', totalQuantity: 1, description: 'Test' });
        expect(res.status).toBe(200);
    });
});
