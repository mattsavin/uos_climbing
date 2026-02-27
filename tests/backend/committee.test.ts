import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/server';
import { db } from '../../backend/db';
import path from 'path';
import fs from 'fs';

describe('Committee API', () => {
    let rootToken: string;
    let committeeToken: string;
    let committeeId: string;
    let memberToken: string;

    beforeAll(async () => {
        // Wait for DB
        await new Promise(resolve => setTimeout(resolve, 500));

        // Login as root
        const adminRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'committee@sheffieldclimbing.org',
                password: 'SuperSecret123!'
            });
        const cookies = adminRes.headers['set-cookie'];
        const cookieArray = Array.isArray(cookies) ? cookies : (cookies ? [cookies] : []);
        const adminCookie = cookieArray.find((c: string) => c.startsWith('uscc_token='));
        rootToken = adminCookie ? adminCookie.split(';')[0].split('=')[1] : '';

        // Create a committee user
        const commEmail = `comm_${Date.now()}@example.com`;
        const regRes = await request(app).post('/api/auth/register').send({
            firstName: 'Comm', lastName: 'User', email: commEmail,
            password: 'Password123!', passwordConfirm: 'Password123!',
            registrationNumber: 'COMM123'
        });
        committeeId = regRes.body.user.id;

        // Promote to committee
        await request(app).post(`/api/admin/users/${committeeId}/promote`).set('Authorization', `Bearer ${rootToken}`);

        // Assign a role
        await request(app).post(`/api/admin/users/${committeeId}/committee-role`).set('Authorization', `Bearer ${rootToken}`).send({
            committeeRoles: ['Social Sec']
        });

        const loginRes = await request(app).post('/api/auth/login').send({
            email: commEmail, password: 'Password123!'
        });
        const commCookies = loginRes.headers['set-cookie'];
        const commCookieArray = Array.isArray(commCookies) ? commCookies : (commCookies ? [commCookies] : []);
        const commCookie = commCookieArray.find((c: string) => c.startsWith('uscc_token='));
        committeeToken = commCookie ? commCookie.split(';')[0].split('=')[1] : '';

        // Create a regular member
        const memEmail = `mem_${Date.now()}@example.com`;
        const memRegRes = await request(app).post('/api/auth/register').send({
            firstName: 'Mem', lastName: 'User', email: memEmail,
            password: 'Password123!', passwordConfirm: 'Password123!',
            registrationNumber: 'MEM123'
        });
        const memCookies = memRegRes.headers['set-cookie'];
        const memCookieArray = Array.isArray(memCookies) ? memCookies : (memCookies ? [memCookies] : []);
        const memCookie = memCookieArray.find((c: string) => c.startsWith('uscc_token='));
        memberToken = memCookie ? memCookie.split(';')[0].split('=')[1] : '';
    });

    afterAll(async () => {
        db.close();
    });

    it('should fetch all committee members', async () => {
        const res = await request(app).get('/api/committee');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(2); // root + our test comm
        const root = res.body.find((u: any) => u.email === 'committee@sheffieldclimbing.org');
        expect(root).toBeDefined();
        // Sensitive fields should be hidden
        expect(root).not.toHaveProperty('passwordHash');
        expect(root.email).toBe('committee@sheffieldclimbing.org');
    });

    it('should allow committee member to update their own profile', async () => {
        const res = await request(app)
            .put('/api/committee/me')
            .set('Authorization', `Bearer ${committeeToken}`)
            .send({
                instagram: 'test_insta',
                faveCrag: 'Stanage Popular',
                bio: 'Love crimps and cracks.'
            });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        // Verify in DB
        const checkRes = await request(app).get('/api/committee');
        const me = checkRes.body.find((u: any) => u.firstName === 'Comm');
        expect(me.instagram).toBe('test_insta');
        expect(me.faveCrag).toBe('Stanage Popular');
        expect(me.bio).toBe('Love crimps and cracks.');
    });

    it('should prevent regular member from updating committee profile', async () => {
        const res = await request(app)
            .put('/api/committee/me')
            .set('Authorization', `Bearer ${memberToken}`)
            .send({ bio: 'I am an impostor' });

        expect(res.status).toBe(403);
    });

    it('should allow uploading a profile photo', async () => {
        // Create a dummy image file
        const dummyImagePath = path.join(__dirname, 'dummy.png');
        fs.writeFileSync(dummyImagePath, 'dummy content');

        const res = await request(app)
            .post('/api/committee/me/photo')
            .set('Authorization', `Bearer ${committeeToken}`)
            .attach('photo', dummyImagePath);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('photoPath');
        expect(res.body.photoPath).toContain('/uploads/profile-photos/');

        // Verify file exists
        const fullPath = path.join(process.cwd(), res.body.photoPath);
        expect(fs.existsSync(fullPath)).toBe(true);

        // Cleanup
        fs.unlinkSync(dummyImagePath);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    });

    it('should fail photo upload if not authorized', async () => {
        const res = await request(app)
            .post('/api/committee/me/photo')
            .set('Authorization', `Bearer ${memberToken}`);

        expect(res.status).toBe(403);
    });
});
