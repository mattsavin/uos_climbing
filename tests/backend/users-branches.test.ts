import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import { app } from '../../backend/server';
import { db } from '../../backend/db';

describe('Users Route Branches', () => {
    let userToken = '';
    let rootToken = '';
    let userId = '';

    beforeAll(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const userRes = await request(app).post('/api/auth/register').send({
            firstName: 'Photo',
            lastName: 'User',
            email: `users_branches_${Date.now()}@example.com`,
            password: 'Password123!',
            passwordConfirm: 'Password123!',
            registrationNumber: `UB${Date.now()}`
        });
        userId = userRes.body.user.id;
        const userCookies = userRes.headers['set-cookie'] as string[] | undefined;
        const userCookie = (userCookies || []).find((c) => c.startsWith('uscc_token='));
        userToken = userCookie ? userCookie.split(';')[0].split('=')[1] : '';

        const adminRes = await request(app).post('/api/auth/login').send({
            email: 'committee@sheffieldclimbing.org',
            password: 'SuperSecret123!'
        });
        const adminCookies = adminRes.headers['set-cookie'] as string[] | undefined;
        const adminCookie = (adminCookies || []).find((c) => c.startsWith('uscc_token='));
        rootToken = adminCookie ? adminCookie.split(';')[0].split('=')[1] : '';
    });

    afterAll(async () => {
        db.close();
    });

    it('returns 400 when uploading profile photo without a file', async () => {
        const res = await request(app)
            .post('/api/users/me/photo')
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('No file uploaded');
    });

    it('returns 400 for invalid profile photo file type', async () => {
        const res = await request(app)
            .post('/api/users/me/photo')
            .set('Authorization', `Bearer ${userToken}`)
            .attach('photo', Buffer.from('not an image'), 'bad.txt');

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Only images');
    });

    it('returns 500 when membership list query fails', async () => {
        const spy = vi
            .spyOn(db, 'all')
            .mockImplementationOnce((_sql: string, _params: any[], cb: any) => cb(new Error('DB Error'), null));

        const res = await request(app)
            .get('/api/users/me/memberships')
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Database error');
        spy.mockRestore();
    });

    it('returns 500 when committee delete target lookup fails', async () => {
        const spy = vi
            .spyOn(db, 'get')
            .mockImplementationOnce((_sql: string, _params: any[], cb: any) => cb(new Error('DB Error'), null));

        const res = await request(app)
            .delete(`/api/users/${userId}`)
            .set('Authorization', `Bearer ${rootToken}`);

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('User not found or database error');
        spy.mockRestore();
    });

    it('returns 400 for missing membershipType and 500 when type lookup fails', async () => {
        const missingTypeRes = await request(app)
            .post('/api/users/me/memberships')
            .set('Authorization', `Bearer ${userToken}`)
            .send({});
        expect(missingTypeRes.status).toBe(400);
        expect(missingTypeRes.body.error).toBe('membershipType is required');

        const spy = vi
            .spyOn(db, 'all')
            .mockImplementationOnce((_sql: string, _params: any[], cb: any) => cb(new Error('DB Error'), null));

        const dbErrRes = await request(app)
            .post('/api/users/me/memberships')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ membershipType: 'basic' });
        expect(dbErrRes.status).toBe(500);
        expect(dbErrRes.body.error).toBe('Database error');
        spy.mockRestore();
    });

    it('returns 500 for request-membership when no membership types are configured', async () => {
        const originalAll = db.all.bind(db);
        const spy = vi.spyOn(db, 'all').mockImplementation((sql: any, params: any, cb: any) => {
            if (typeof sql === 'string' && sql.includes('SELECT id FROM membership_types')) {
                cb(null, []);
                return db as any;
            }
            return originalAll(sql, params as any, cb as any);
        });

        const res = await request(app)
            .post('/api/users/me/request-membership')
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('No membership types configured');
        spy.mockRestore();
    });

    it('returns 500 when profile photo DB update fails', async () => {
        const originalRun = db.run.bind(db);
        const spy = vi.spyOn(db, 'run').mockImplementation((sql: any, params: any, cb: any) => {
            const callback = typeof params === 'function' ? params : cb;
            if (typeof sql === 'string' && sql.includes('UPDATE users SET profilePhoto = ?')) {
                if (callback) callback.call({}, new Error('DB Error'));
                return db as any;
            }
            return originalRun(sql, params as any, cb as any);
        });

        const validImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
        const res = await request(app)
            .post('/api/users/me/photo')
            .set('Authorization', `Bearer ${userToken}`)
            .attach('photo', validImage, 'dummy.png');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Database error');
        spy.mockRestore();
    });

    it('continues successfully when deleting old profile photo throws', async () => {
        const getSpy = vi
            .spyOn(db, 'get')
            .mockImplementationOnce((_sql: string, _params: any[], cb: any) =>
                cb(null, { profilePhoto: '/uploads/profile-photos/old-file.png' }));
        const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true as any);
        const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {
            throw new Error('unlink failed');
        });

        const validImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
        const res = await request(app)
            .post('/api/users/me/photo')
            .set('Authorization', `Bearer ${userToken}`)
            .attach('photo', validImage, 'dummy2.png');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        getSpy.mockRestore();
        existsSpy.mockRestore();
        unlinkSpy.mockRestore();
    });
});
