import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/server';
import { db } from '../../backend/db';
import bcrypt from 'bcrypt';

describe('Users API', () => {
    let rootToken: string;

    beforeAll(async () => {
        // Wait for DB initialization if needed
        await new Promise(resolve => setTimeout(resolve, 500));

        // Login as the pre-seeded root admin
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

    const createTestUser = async (prefix: string) => {
        const userRes = await request(app).post('/api/auth/register').send({
            name: `${prefix} Test User`,
            email: `${prefix}_user@example.com`,
            password: 'Password123!',
            registrationNumber: `${prefix}123`
        });
        return { token: userRes.body.token, id: userRes.body.user.id };
    };

    it('should submit membership renewal', async () => {
        const { token } = await createTestUser('renewal');
        const res = await request(app)
            .post('/api/users/me/membership-renewal')
            .set('Authorization', `Bearer ${token}`)
            .send({ membershipYear: '2026/2027' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('membershipStatus', 'pending');
    });

    it('should fail renewal without membership year', async () => {
        const { token } = await createTestUser('renewal_fail');
        const res = await request(app)
            .post('/api/users/me/membership-renewal')
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Missing membership year');
    });

    it('should update user profile', async () => {
        const { token, id } = await createTestUser('update');
        const res = await request(app)
            .put(`/api/users/${id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Updated Name',
                emergencyContactName: 'John Doe',
                emergencyContactMobile: '01234567890',
                pronouns: 'They/Them',
                dietaryRequirements: 'Vegan'
            });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        // Verify update
        const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
        expect(meRes.body.user).toHaveProperty('name', 'Updated Name');
        expect(meRes.body.user).toHaveProperty('pronouns', 'They/Them');
    });

    it('should allow committee to update another user', async () => {
        const target = await createTestUser('target_update');
        const res = await request(app)
            .put(`/api/users/${target.id}`)
            .set('Authorization', `Bearer ${rootToken}`)
            .send({
                name: 'Committee Updated Name'
            });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should prevent non-committee from updating another user', async () => {
        const target = await createTestUser('target_fail');
        const attacker = await createTestUser('attacker');

        const res = await request(app)
            .put(`/api/users/${target.id}`)
            .set('Authorization', `Bearer ${attacker.token}`)
            .send({
                name: 'Hacked'
            });

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error', 'Unauthorized to update this user');
    });

    it('should update password with correct current password', async () => {
        const { token } = await createTestUser('pwd_success');
        const res = await request(app)
            .put('/api/users/me/password')
            .set('Authorization', `Bearer ${token}`)
            .send({
                currentPassword: 'Password123!',
                newPassword: 'NewPassword1!'
            });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        // Verify login works with new password
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'pwd_success_user@example.com',
                password: 'NewPassword1!'
            });
        expect(loginRes.status).toBe(200);
    });

    it('should fail password update with incorrect current password', async () => {
        const { token } = await createTestUser('pwd_fail');
        const res = await request(app)
            .put('/api/users/me/password')
            .set('Authorization', `Bearer ${token}`)
            .send({
                currentPassword: 'WrongPassword!',
                newPassword: 'NewPassword1!'
            });

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error', 'Current password is incorrect');
    });

    it('should fail password update missing fields', async () => {
        const { token } = await createTestUser('pwd_missing');
        const res = await request(app)
            .put('/api/users/me/password')
            .set('Authorization', `Bearer ${token}`)
            .send({
                newPassword: 'NewPassword1!'
            });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Missing required fields');
    });

    it('should allow user to delete themselves', async () => {
        const { token, id } = await createTestUser('delete_self');
        const res = await request(app)
            .delete(`/api/users/${id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        // Verify deletion
        const loginRes = await request(app).post('/api/auth/login').send({
            email: 'delete_self_user@example.com', password: 'Password123!'
        });
        expect(loginRes.status).toBe(401);
    });

    it('should prevent user from deleting someone else', async () => {
        const target = await createTestUser('delete_target');
        const attacker = await createTestUser('delete_attacker');

        const res = await request(app)
            .delete(`/api/users/${target.id}`)
            .set('Authorization', `Bearer ${attacker.token}`);

        expect(res.status).toBe(403);
    });

    it('should allow committee to delete regular user', async () => {
        const target = await createTestUser('committee_delete_target');
        const res = await request(app)
            .delete(`/api/users/${target.id}`)
            .set('Authorization', `Bearer ${rootToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should prevent committee from deleting another committee member', async () => {
        const target = await createTestUser('committee_safe');
        // Promote target
        await request(app).post(`/api/admin/users/${target.id}/promote`).set('Authorization', `Bearer ${rootToken}`);

        const res = await request(app)
            .delete(`/api/users/${target.id}`)
            .set('Authorization', `Bearer ${rootToken}`);

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error', 'Cannot delete another committee member');
    });

    describe('Database Errors', () => {
        it('should handle renewal DB errors', async () => {
            const { vi } = await import('vitest');
            const { token } = await createTestUser('db_renewal');
            const spy = vi.spyOn(db, 'run').mockImplementationOnce((query, params, cb) => cb.call({}, new Error('DB Error')));
            const res = await request(app).post('/api/users/me/membership-renewal').set('Authorization', `Bearer ${token}`).send({ membershipYear: '2027/2028' });
            expect(res.status).toBe(500);
            spy.mockRestore();
        });

        it('should handle profile update DB errors', async () => {
            const { vi } = await import('vitest');
            const { token, id } = await createTestUser('db_update');
            const spy = vi.spyOn(db, 'run').mockImplementationOnce((query, params, cb) => cb.call({}, new Error('DB Error')));
            const res = await request(app).put(`/api/users/${id}`).set('Authorization', `Bearer ${token}`).send({ name: 'A' });
            expect(res.status).toBe(500);
            spy.mockRestore();
        });

        it('should handle password update DB GET errors', async () => {
            const { vi } = await import('vitest');
            const { token } = await createTestUser('db_pwd_get');
            const spy = vi.spyOn(db, 'get').mockImplementationOnce((query, params, cb) => cb(new Error('DB Error'), null));
            const res = await request(app).put('/api/users/me/password').set('Authorization', `Bearer ${token}`).send({ currentPassword: '1', newPassword: '2' });
            expect(res.status).toBe(500);
            spy.mockRestore();
        });

        it('should handle password update DB RUN errors', async () => {
            const { vi } = await import('vitest');
            const { token } = await createTestUser('db_pwd_run');
            const spyRun = vi.spyOn(db, 'run').mockImplementationOnce((query, params, cb) => cb.call({}, new Error('DB Error')));
            const res = await request(app).put('/api/users/me/password').set('Authorization', `Bearer ${token}`).send({ currentPassword: 'Password123!', newPassword: '2' });
            expect(res.status).toBe(500);
            spyRun.mockRestore();
        });

        it('should handle committee delete DB GET errors', async () => {
            const { vi } = await import('vitest');
            const { id } = await createTestUser('db_del_get');
            const spy = vi.spyOn(db, 'get').mockImplementationOnce((query, params, cb) => cb(new Error('DB Error'), null));
            const res = await request(app).delete(`/api/users/${id}`).set('Authorization', `Bearer ${rootToken}`);
            expect(res.status).toBe(500);
            spy.mockRestore();
        });

        it('should handle user delete DB RUN errors', async () => {
            const { vi } = await import('vitest');
            const { token, id } = await createTestUser('db_del_run');
            // Mock the final DELETE statement to fail
            const spyRun = vi.spyOn(db, 'run')
                .mockImplementationOnce((query, params, cb) => cb.call({}, null)) // bookings
                .mockImplementationOnce((query, params, cb) => cb.call({}, null)) // votes
                .mockImplementationOnce((query, params, cb) => cb.call({}, null)) // candidates
                .mockImplementationOnce((query, params, cb) => cb.call({}, new Error('DB Error'))); // users -> FAIL

            const res = await request(app).delete(`/api/users/${id}`).set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(500);
            spyRun.mockRestore();
        });
    });
});
