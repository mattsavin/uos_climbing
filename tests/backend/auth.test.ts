import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/server';
import { db } from '../../backend/db';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Authentication API', () => {
    const testUser = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123!',
        registrationNumber: '123456'
    };

    beforeAll(async () => {
        // Wait for DB initialization if needed
        await new Promise(resolve => setTimeout(resolve, 500));
    });

    afterAll(async () => {
        // Clean up test database
        db.close();
    });

    const createAuthUser = async (prefix: string) => {
        const userRes = await request(app).post('/api/auth/register').send({
            name: `${prefix} Target User`, email: `${prefix}_target@example.com`, password: 'Password123!', registrationNumber: `${prefix}123`
        });
        return { token: userRes.body.token, id: userRes.body.user.id };
    };

    it('should register a new user', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...testUser, email: 'register_test@example.com' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body.user).toHaveProperty('email', 'register_test@example.com');
    });

    it('should login the registered user', async () => {
        // Setup state for this test independently
        await request(app).post('/api/auth/register').send({ ...testUser, email: 'login_test@example.com' });

        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'login_test@example.com',
                password: testUser.password
            });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body.user).toHaveProperty('email', 'login_test@example.com');
    });

    it('should reject login after user deletion', async () => {
        const { token, id } = await createAuthUser('Deleted');

        // Delete the user using a verified admin token (we need to be root)
        const adminRes = await request(app).post('/api/auth/login').send({
            email: 'sheffieldclimbing@gmail.com', password: 'SuperSecret123!'
        });
        await request(app).delete(`/api/users/${id}`).set('Authorization', `Bearer ${adminRes.body.token}`);

        // Try to login again
        const loginRes = await request(app).post('/api/auth/login').send({
            email: 'Deleted@example.com', password: 'Password123!'
        });

        expect(loginRes.status).toBe(401);
    });

    it('should fail to login with wrong password', async () => {
        // Setup state for this test independently
        await request(app).post('/api/auth/register').send({ ...testUser, email: 'wrong_pwd_test@example.com' });

        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'wrong_pwd_test@example.com',
                password: 'WrongPassword'
            });

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error', 'Invalid email or password');
    });

    it('should get current user profile with token', async () => {
        // Setup state for this test independently
        const registerRes = await request(app).post('/api/auth/register').send({ ...testUser, email: 'profile_test@example.com' });
        const token = registerRes.body.token;

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.user).toHaveProperty('email', 'profile_test@example.com');
    });
});
