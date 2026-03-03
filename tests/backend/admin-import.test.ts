import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/server';
import { db } from '../../backend/db';

describe('Admin SU Roster Import API', () => {
    let rootToken = '';
    let committeeToken = '';

    beforeAll(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const adminRes = await request(app).post('/api/auth/login').send({
            email: 'committee@sheffieldclimbing.org',
            password: 'SuperSecret123!'
        });
        const cookies = adminRes.headers['set-cookie'] as string[] | undefined;
        const tokenCookie = (cookies || []).find((c) => c.startsWith('uscc_token='));
        rootToken = tokenCookie ? tokenCookie.split(';')[0].split('=')[1] : '';

        const nonRootEmail = `import_non_root_${Date.now()}@example.com`;
        const createRes = await request(app).post('/api/auth/register').send({
            firstName: 'Import',
            lastName: 'Committee',
            email: nonRootEmail,
            password: 'Password123!',
            passwordConfirm: 'Password123!',
            registrationNumber: `${Date.now()}11`
        });
        const nonRootId = createRes.body.user.id;
        await request(app)
            .post(`/api/admin/users/${nonRootId}/promote`)
            .set('Authorization', `Bearer ${rootToken}`);
        const loginRes = await request(app).post('/api/auth/login').send({
            email: nonRootEmail,
            password: 'Password123!'
        });
        const nonRootCookies = loginRes.headers['set-cookie'] as string[] | undefined;
        const nonRootCookie = (nonRootCookies || []).find((c) => c.startsWith('uscc_token='));
        committeeToken = nonRootCookie ? nonRootCookie.split(';')[0].split('=')[1] : '';
    });

    afterAll(async () => {
        db.close();
    });

    it('imports mixed roster rows and reports parsed/skipped/year parsing stats', async () => {
        const existingReg = '123456789';
        const existingEmail = `import_existing_${Date.now()}@example.com`;
        await request(app).post('/api/auth/register').send({
            firstName: 'Import',
            lastName: 'Existing',
            email: existingEmail,
            password: 'Password123!',
            passwordConfirm: 'Password123!',
            registrationNumber: existingReg
        });

        const raw = [
            `${existingReg}\tExisting User\tx\tClub Membership 2025-26\tx`,
            `234567890\tNew User\tx\tNo year text here\tx`,
            `bad_reg\tInvalid User\tx\t2025/2026\tx`,
            `too\tfew\tcols`
        ].join('\n');

        const res = await request(app)
            .post('/api/admin/memberships/import-su-roster')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ raw });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.parsedRows).toBe(2);
        expect(res.body.approvedExisting).toBe(1);
        expect(res.body.preapprovedOnly).toBe(1);
        expect(res.body.yearParsedFromSubscription).toBe(1);
        expect(res.body.yearFallbackUsed).toBe(1);
        expect(Array.isArray(res.body.skipped)).toBe(true);
        expect(res.body.skipped.length).toBe(2);
    });

    it('returns 400 when no roster text is provided', async () => {
        const res = await request(app)
            .post('/api/admin/memberships/import-su-roster')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ raw: '   ' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('No roster text provided');
    });

    it('returns 400 when no valid roster rows can be parsed', async () => {
        const raw = [
            `bad_reg\tInvalid User\tx\t2025/2026\tx`,
            `also\ttoo\tshort`
        ].join('\n');

        const res = await request(app)
            .post('/api/admin/memberships/import-su-roster')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ raw });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('No valid roster rows found');
        expect(Array.isArray(res.body.skipped)).toBe(true);
        expect(res.body.skipped.length).toBeGreaterThan(0);
    });

    it('returns 500 when roster import DB operations fail', async () => {
        const existingReg = '987654321';
        await request(app).post('/api/auth/register').send({
            firstName: 'Import',
            lastName: 'Error',
            email: `import_error_${Date.now()}@example.com`,
            password: 'Password123!',
            passwordConfirm: 'Password123!',
            registrationNumber: existingReg
        });

        const spy = (await import('vitest')).vi
            .spyOn(db, 'run')
            .mockImplementationOnce((sql: any, params: any, cb: any) => {
                const callback = typeof params === 'function' ? params : cb;
                if (callback) callback.call({}, new Error('DB Error'));
                return db as any;
            });

        const res = await request(app)
            .post('/api/admin/memberships/import-su-roster')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ raw: `${existingReg}\tExisting User\tx\tClub Membership 2025-26\tx` });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to import SU roster');
        spy.mockRestore();
    });

    it('covers committee-role update/delete edge branches', async () => {
        const missingLabelRes = await request(app)
            .put('/api/admin/committee-roles/does_not_exist')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({});
        expect(missingLabelRes.status).toBe(400);
        expect(missingLabelRes.body.error).toBe('Label is required');

        const unknownUpdateRes = await request(app)
            .put('/api/admin/committee-roles/does_not_exist')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ label: 'X' });
        expect(unknownUpdateRes.status).toBe(404);
        expect(unknownUpdateRes.body.error).toBe('Role not found');

        const nonRootDeleteRes = await request(app)
            .delete('/api/admin/committee-roles/does_not_exist')
            .set('Authorization', `Bearer ${committeeToken}`);
        expect(nonRootDeleteRes.status).toBe(403);
        expect(nonRootDeleteRes.body.error).toBe('Only Root Admin can perform this action');

        const rootDeleteRes = await request(app)
            .delete('/api/admin/committee-roles/does_not_exist')
            .set('Authorization', `Bearer ${rootToken}`);
        expect(rootDeleteRes.status).toBe(404);
        expect(rootDeleteRes.body.error).toBe('Role not found');
    });

    it('covers committee-role create DB error branches', async () => {
        const uniqueSpy = (await import('vitest')).vi
            .spyOn(db, 'run')
            .mockImplementationOnce((_sql: any, _params: any, cb: any) => {
                cb.call({}, { message: 'UNIQUE constraint failed: available_roles.id' });
                return db as any;
            });
        const uniqueRes = await request(app)
            .post('/api/admin/committee-roles')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ id: `dup_${Date.now()}`, label: 'Dup' });
        expect(uniqueRes.status).toBe(400);
        expect(uniqueRes.body.error).toBe('Role ID already exists');
        uniqueSpy.mockRestore();

        const genericSpy = (await import('vitest')).vi
            .spyOn(db, 'run')
            .mockImplementationOnce((_sql: any, _params: any, cb: any) => {
                cb.call({}, new Error('DB Error'));
                return db as any;
            });
        const genericRes = await request(app)
            .post('/api/admin/committee-roles')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ id: `err_${Date.now()}`, label: 'Err' });
        expect(genericRes.status).toBe(500);
        expect(genericRes.body.error).toBe('Database error');
        genericSpy.mockRestore();
    });

    it('prevents non-root committee members from demoting users', async () => {
        const targetRes = await request(app).post('/api/auth/register').send({
            firstName: 'Demote',
            lastName: 'Target',
            email: `demote_target_${Date.now()}@example.com`,
            password: 'Password123!',
            passwordConfirm: 'Password123!',
            registrationNumber: `${Date.now()}99`
        });
        const res = await request(app)
            .post(`/api/admin/users/${targetRes.body.user.id}/demote`)
            .set('Authorization', `Bearer ${committeeToken}`);
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Only Root Admin can perform this action');
    });
});
