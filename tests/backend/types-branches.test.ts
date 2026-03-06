import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/server';
import { db } from '../../backend/db';

describe('Membership/Session Types Branch Coverage', () => {
    let rootToken = '';

    beforeAll(async () => {
        let iterations = 0;
        while (iterations < 20) {
            const adminRes = await request(app).post('/api/auth/login').send({
                email: 'committee@sheffieldclimbing.org',
                password: 'SuperSecret123!'
            });
            const cookies = adminRes.headers['set-cookie'] as unknown as string[] | undefined;
            const tokenCookie = (cookies || []).find((c) => c.startsWith('uscc_token='));
            if (tokenCookie) {
                rootToken = tokenCookie.split(';')[0].split('=')[1];
                break;
            }
            await new Promise((r) => setTimeout(r, 200));
            iterations++;
        }
        if (!rootToken) {
            throw new Error('Failed to obtain rootToken: login did not succeed after retries');
        }
    });

    afterAll(async () => {
        db.close();
    });

    it('session-types: rejects missing label on create', async () => {
        const res = await request(app)
            .post('/api/session-types')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Label is required');
    });

    it('session-types: rejects duplicates and missing label on update', async () => {
        const label = `Branch Type ${Date.now()}`;
        const createRes = await request(app)
            .post('/api/session-types')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ label });
        expect(createRes.status).toBe(200);

        const duplicateRes = await request(app)
            .post('/api/session-types')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ label });
        expect(duplicateRes.status).toBe(400);
        expect(duplicateRes.body.error).toBe('Session type already exists');

        const updateRes = await request(app)
            .put(`/api/session-types/${encodeURIComponent(label)}`)
            .set('Authorization', `Bearer ${rootToken}`)
            .send({});
        expect(updateRes.status).toBe(400);
        expect(updateRes.body.error).toBe('Label is required');
    });

    it('session-types: returns 500 for non-constraint insert DB errors', async () => {
        const spy = vi
            .spyOn(db, 'run')
            .mockImplementationOnce((_sql: string, _params: any[], cb: any) => {
                cb.call({}, new Error('DB Error'));
                return db as any;
            });
        const res = await request(app)
            .post('/api/session-types')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ label: `Err Type ${Date.now()}` });
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Database error');
        spy.mockRestore();
    });

    it('membership-types: rejects missing label and invalid normalized id', async () => {
        const missingLabelRes = await request(app)
            .post('/api/membership-types')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({});
        expect(missingLabelRes.status).toBe(400);
        expect(missingLabelRes.body.error).toBe('Label is required');

        const invalidIdRes = await request(app)
            .post('/api/membership-types')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ id: '!!!', label: 'Valid Label' });
        expect(invalidIdRes.status).toBe(400);
        expect(invalidIdRes.body.error).toBe('Invalid membership type id');
    });

    it('membership-types: duplicate create, update unknown, and protected delete branches', async () => {
        const label = `Coverage Type ${Date.now()}`;
        const createRes = await request(app)
            .post('/api/membership-types')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ label });
        expect(createRes.status).toBe(200);

        const duplicateRes = await request(app)
            .post('/api/membership-types')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ label });
        expect(duplicateRes.status).toBe(400);
        expect(duplicateRes.body.error).toBe('Membership type already exists');

        const unknownUpdateRes = await request(app)
            .put('/api/membership-types/does_not_exist')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ label: 'X' });
        expect(unknownUpdateRes.status).toBe(404);
        expect(unknownUpdateRes.body.error).toBe('Membership type not found');

        const deleteBasicRes = await request(app)
            .delete('/api/membership-types/basic')
            .set('Authorization', `Bearer ${rootToken}`);
        expect(deleteBasicRes.status).toBe(400);
        expect(deleteBasicRes.body.error).toBe('The basic membership type cannot be deleted');
    });

    it('membership-types: enforces at least one type remains when count query reports one', async () => {
        const originalGet = db.get.bind(db);
        const spy = vi.spyOn(db, 'get').mockImplementation((sql: any, params: any, cb: any) => {
            if (typeof sql === 'string' && sql.includes('SELECT COUNT(*)')) {
                if (cb) cb(null, { count: 1 });
                return db as any;
            }
            return originalGet(sql, params, cb);
        });
        const res = await request(app)
            .delete('/api/membership-types/some_type')
            .set('Authorization', `Bearer ${rootToken}`);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('At least one membership type must remain');
        spy.mockRestore();
    });

    it('membership-types: returns 500 on generic create and count-query DB errors', async () => {
        const createSpy = vi
            .spyOn(db, 'run')
            .mockImplementationOnce((_sql: string, _params: any[], cb: any) => {
                cb.call({}, new Error('DB Error'));
                return db as any;
            });
        const createRes = await request(app)
            .post('/api/membership-types')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ label: `Err Membership ${Date.now()}` });
        expect(createRes.status).toBe(500);
        expect(createRes.body.error).toBe('Database error');
        createSpy.mockRestore();

        const originalGet = db.get.bind(db);
        const countSpy = vi.spyOn(db, 'get').mockImplementation((sql: any, params: any, cb: any) => {
            if (typeof sql === 'string' && sql.includes('SELECT COUNT(*)')) {
                if (cb) cb(new Error('DB Error'), null);
                return db as any;
            }
            return originalGet(sql, params, cb);
        });
        const deleteRes = await request(app)
            .delete('/api/membership-types/some_type')
            .set('Authorization', `Bearer ${rootToken}`);
        expect(deleteRes.status).toBe(500);
        expect(deleteRes.body.error).toBe('Database error');
        countSpy.mockRestore();
    });

    it('membership-types: returns 404 when delete affects no rows and count allows deletion', async () => {
        const originalGet = db.get.bind(db);
        const countSpy = vi.spyOn(db, 'get').mockImplementation((sql: any, params: any, cb: any) => {
            if (typeof sql === 'string' && sql.includes('SELECT COUNT(*)')) {
                if (cb) cb(null, { count: 2 });
                return db as any;
            }
            return originalGet(sql, params, cb);
        });
        const runSpy = vi
            .spyOn(db, 'run')
            .mockImplementationOnce((_sql: string, _params: any[], cb: any) => {
                cb.call({ changes: 0 }, null);
                return db as any;
            });

        const res = await request(app)
            .delete('/api/membership-types/nonexistent_for_404')
            .set('Authorization', `Bearer ${rootToken}`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Membership type not found');

        countSpy.mockRestore();
        runSpy.mockRestore();
    });
});
