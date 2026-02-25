import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/server';
import { db } from '../../backend/db';

describe('Admin API', () => {
    let rootToken: string;
    let userToken: string;
    let targetUserId: string;

    beforeAll(async () => {
        // Wait for DB initialization
        await new Promise(resolve => setTimeout(resolve, 500));

        // Create a regular user who will be the target of admin actions
        const userRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Target User',
                email: 'target@example.com',
                password: 'Password123!',
                registrationNumber: 'TGT123'
            });
        userToken = userRes.body.token;
        targetUserId = userRes.body.user.id;

        // Login as the root admin
        const adminRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'sheffieldclimbing@gmail.com',
                password: 'SuperSecret123!'
            });
        rootToken = adminRes.body.token;
    });

    afterAll(async () => {
        db.close();
    });

    const createTargetUser = async (prefix: string) => {
        const userRes = await request(app).post('/api/auth/register').send({
            name: `${prefix} Target User`, email: `${prefix}_target@example.com`, password: 'Password123!', registrationNumber: `${prefix}123`
        });
        return { token: userRes.body.token, id: userRes.body.user.id };
    };

    it('should list all users for committee', async () => {
        const { id } = await createTargetUser('list');
        const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${rootToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((u: any) => u.id === id)).toBe(true);
    });

    it('should allow committee to approve user', async () => {
        const { id } = await createTargetUser('approve');
        const res = await request(app).post(`/api/admin/users/${id}/approve`).set('Authorization', `Bearer ${rootToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should allow root admin to assign committee roles', async () => {
        const { id } = await createTargetUser('assign_role');
        const res = await request(app).post(`/api/admin/users/${id}/committee-role`)
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ committeeRole: 'Treasurer' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should fail to assign invalid committee role', async () => {
        const { id } = await createTargetUser('invalid_role');
        const res = await request(app).post(`/api/admin/users/${id}/committee-role`)
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ committeeRole: 'Emperor' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Invalid committee role');
    });

    it('should allow committee to reject user', async () => {
        const { id } = await createTargetUser('reject');
        const res = await request(app).post(`/api/admin/users/${id}/reject`).set('Authorization', `Bearer ${rootToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should allow root admin to demote a user', async () => {
        const { id } = await createTargetUser('demote');
        await request(app).post(`/api/admin/users/${id}/promote`).set('Authorization', `Bearer ${rootToken}`);

        const res = await request(app).post(`/api/admin/users/${id}/demote`).set('Authorization', `Bearer ${rootToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should prevent non-root admin from demoting', async () => {
        const { id } = await createTargetUser('non_root_demote');
        // userToken was created in beforeAll
        const res = await request(app).post(`/api/admin/users/${id}/demote`).set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(403);
    });

    it('should fail if unauthorized user tries to access admin routes', async () => {
        const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${userToken}`);
        expect(res.status).toBe(403);
    });

    it('should toggle election config', async () => {
        const resOn = await request(app).post('/api/admin/config/elections').set('Authorization', `Bearer ${rootToken}`).send({ open: true });
        expect(resOn.status).toBe(200);

        const resGet = await request(app).get('/api/admin/config/elections').set('Authorization', `Bearer ${rootToken}`);
        expect(resGet.body).toHaveProperty('electionsOpen', true);
    });

    it('should reject invalid committee role', async () => {
        const targetRes = await request(app).post('/api/auth/register').send({
            name: 'Role Test', email: 'role@ex.com', password: 'pwd', registrationNumber: 'R1'
        });
        const res = await request(app)
            .post(`/api/admin/users/${targetRes.body.user.id}/committee-role`)
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ committeeRole: 'Fake Role' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Invalid committee role');
    });

    it('should clear committee role if none provided', async () => {
        const targetRes = await request(app).post('/api/auth/register').send({
            name: 'Role Clear', email: 'clear@ex.com', password: 'pwd', registrationNumber: 'RC1'
        });
        const res = await request(app)
            .post(`/api/admin/users/${targetRes.body.user.id}/committee-role`)
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ committeeRole: null });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    describe('Database Errors', () => {
        it('should handle config DB errors', async () => {
            const { vi } = await import('vitest');
            const spy = vi.spyOn(db, 'get').mockImplementationOnce((query, params, cb) => cb(new Error('DB Error'), null));
            const res = await request(app).get('/api/admin/config/elections').set('Authorization', `Bearer ${rootToken}`);
            expect(res.status).toBe(500);
            spy.mockRestore();
        });

        it('should handle config update DB errors', async () => {
            const { vi } = await import('vitest');
            const spy = vi.spyOn(db, 'run').mockImplementationOnce((query, params, cb) => cb.call({}, new Error('DB Error')));
            const res = await request(app).post('/api/admin/config/elections').set('Authorization', `Bearer ${rootToken}`).send({ open: true });
            expect(res.status).toBe(500);
            spy.mockRestore();
        });

        it('should handle users GET DB errors', async () => {
            const { vi } = await import('vitest');
            const spy = vi.spyOn(db, 'all').mockImplementationOnce((query, params, cb) => cb(new Error('DB Error'), null));
            const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${rootToken}`);
            expect(res.status).toBe(500);
            spy.mockRestore();
        });

        it('should handle user approve DB errors', async () => {
            const { vi } = await import('vitest');
            const spy = vi.spyOn(db, 'run').mockImplementationOnce((query, params, cb) => cb.call({}, new Error('DB Error')));
            const res = await request(app).post('/api/admin/users/1/approve').set('Authorization', `Bearer ${rootToken}`);
            expect(res.status).toBe(500);
            spy.mockRestore();
        });

        it('should handle user reject DB errors', async () => {
            const { vi } = await import('vitest');
            const spy = vi.spyOn(db, 'run').mockImplementationOnce((query, params, cb) => cb.call({}, new Error('DB Error')));
            const res = await request(app).post('/api/admin/users/1/reject').set('Authorization', `Bearer ${rootToken}`);
            expect(res.status).toBe(500);
            spy.mockRestore();
        });

        it('should handle user promote DB errors', async () => {
            const { vi } = await import('vitest');
            const spy = vi.spyOn(db, 'run').mockImplementationOnce((query, params, cb) => cb.call({}, new Error('DB Error')));
            const res = await request(app).post('/api/admin/users/1/promote').set('Authorization', `Bearer ${rootToken}`);
            expect(res.status).toBe(500);
            spy.mockRestore();
        });

        it('should handle user demote DB GET errors', async () => {
            const { vi } = await import('vitest');
            const spy = vi.spyOn(db, 'get').mockImplementationOnce((query, params, cb) => cb(new Error('DB Error'), null));
            const res = await request(app).post('/api/admin/users/1/demote').set('Authorization', `Bearer ${rootToken}`);
            expect(res.status).toBe(500);
            spy.mockRestore();
        });

        it('should handle user demote DB RUN errors', async () => {
            const { vi } = await import('vitest');
            const spyGet = vi.spyOn(db, 'get').mockImplementationOnce((query, params, cb) => cb(null, { email: 'user@test.com' }));
            const spyRun = vi.spyOn(db, 'run').mockImplementationOnce((query, params, cb) => cb.call({}, new Error('DB Error')));
            const res = await request(app).post('/api/admin/users/1/demote').set('Authorization', `Bearer ${rootToken}`);
            expect(res.status).toBe(500);
            spyGet.mockRestore();
            spyRun.mockRestore();
        });

        it('should handle committee role DB errors', async () => {
            const { vi } = await import('vitest');
            const spy = vi.spyOn(db, 'run').mockImplementationOnce((query, params, cb) => cb.call({}, new Error('DB Error')));
            const res = await request(app).post('/api/admin/users/1/committee-role').set('Authorization', `Bearer ${rootToken}`).send({ committeeRole: 'Chair' });
            expect(res.status).toBe(500);
            spy.mockRestore();
        });
    });
});
