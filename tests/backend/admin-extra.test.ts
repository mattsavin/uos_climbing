import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/server';
import { db } from '../../backend/db';

describe('Admin Extra API', () => {
    let rootToken: string;
    let committeeToken: string;

    beforeAll(async () => {
        // Wait for DB initialization
        await new Promise(resolve => setTimeout(resolve, 500));

        // Login as the root admin
        const adminRes = await request(app).post('/api/auth/login').send({
            email: 'committee@sheffieldclimbing.org', password: 'SuperSecret123!'
        });
        const cookies = adminRes.headers['set-cookie'];
        rootToken = (cookies || []).find((c: string) => c.startsWith('uscc_token='))?.split(';')[0].split('=')[1] || '';

        // Create a non-root committee member
        const res = await request(app).post('/api/auth/register').send({
            firstName: 'Non', lastName: 'Root', email: 'nonroot_admin@example.com', password: 'Password12345!', passwordConfirm: 'Password12345!', registrationNumber: 'NRA1'
        });
        const nonRootId = res.body.user.id;
        await request(app).post(`/api/admin/users/${nonRootId}/promote`).set('Authorization', `Bearer ${rootToken}`);

        const loginRes = await request(app).post('/api/auth/login').send({
            email: 'nonroot_admin@example.com', password: 'Password12345!'
        });
        committeeToken = (loginRes.headers['set-cookie'] || []).find((c: string) => c.startsWith('uscc_token='))?.split(';')[0].split('=')[1] || '';
    });

    afterAll(async () => {
        db.close();
    });

    describe('Committee Roles Management', () => {
        const TEST_ROLE_ID = 'test_role';
        const TEST_ROLE_LABEL = 'Test Role';

        it('should allow root admin to create a committee role', async () => {
            const res = await request(app)
                .post('/api/admin/committee-roles')
                .set('Authorization', `Bearer ${rootToken}`)
                .send({ id: TEST_ROLE_ID, label: TEST_ROLE_LABEL });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should fail to create role if not root admin', async () => {
            const res = await request(app)
                .post('/api/admin/committee-roles')
                .set('Authorization', `Bearer ${committeeToken}`)
                .send({ id: 'bad_role', label: 'Bad' });

            expect(res.status).toBe(403);
        });

        it('should list available committee roles', async () => {
            const res = await request(app)
                .get('/api/admin/committee-roles')
                .set('Authorization', `Bearer ${committeeToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.some((r: any) => r.id === TEST_ROLE_ID)).toBe(true);
        });

        it('should allow root admin to update a committee role', async () => {
            const res = await request(app)
                .put(`/api/admin/committee-roles/${TEST_ROLE_ID}`)
                .set('Authorization', `Bearer ${rootToken}`)
                .send({ label: 'Updated Label' });

            expect(res.status).toBe(200);
            expect(res.body.label).toBe('Updated Label');
        });

        it('should fail to delete a role if assigned to users', async () => {
            // Assign role to a user
            const userRes = await request(app).post('/api/auth/register').send({
                firstName: 'Role', lastName: 'Holder', email: 'roleholder@example.com', password: 'Password12345!', passwordConfirm: 'Password12345!', registrationNumber: 'RH1'
            });
            await request(app).post(`/api/admin/users/${userRes.body.user.id}/committee-role`)
                .set('Authorization', `Bearer ${rootToken}`)
                .send({ committeeRoles: [TEST_ROLE_ID] });

            const res = await request(app)
                .delete(`/api/admin/committee-roles/${TEST_ROLE_ID}`)
                .set('Authorization', `Bearer ${rootToken}`);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('assigned to users');
        });

        it('should allow root admin to delete an unassigned committee role', async () => {
            const NEW_ROLE = 'temp_role';
            await request(app).post('/api/admin/committee-roles').set('Authorization', `Bearer ${rootToken}`).send({ id: NEW_ROLE, label: 'Temp' });

            const res = await request(app)
                .delete(`/api/admin/committee-roles/${NEW_ROLE}`)
                .set('Authorization', `Bearer ${rootToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('Membership Row Deletion & Status Transition', () => {
        it('should mark user as pending if their only active basic membership is deleted', async () => {
            // Create user and approve basic membership
            const res = await request(app).post('/api/auth/register').send({
                firstName: 'Pend', lastName: 'Test', email: 'pend@example.com', password: 'Password12345!', passwordConfirm: 'Password12345!', registrationNumber: 'PT1'
            });
            const userId = res.body.user.id;
            await request(app).post(`/api/admin/users/${userId}/approve`).set('Authorization', `Bearer ${rootToken}`);

            // Wait for DB
            await new Promise(r => setTimeout(r, 100));

            // Verify status is active
            const usersRes = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${rootToken}`);
            const user = usersRes.body.find((u: any) => u.id === userId);
            expect(user.membershipStatus).toBe('active');
            const membId = user.memberships[0].id;

            // Delete membership row
            await request(app).delete(`/api/admin/memberships/${membId}`).set('Authorization', `Bearer ${rootToken}`);

            // Wait for DB side effects
            await new Promise(r => setTimeout(r, 100));

            // Verify status is now pending
            const usersRes2 = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${rootToken}`);
            const user2 = usersRes2.body.find((u: any) => u.id === userId);
            expect(user2.membershipStatus).toBe('pending');
        });
    });
});
