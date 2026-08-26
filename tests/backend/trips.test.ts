import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/server';
import { db } from '../../backend/db';

/**
 * Trips API — phase 1 (docs/TRIPS_PLAN.md): CRUD + roster reads.
 * Signup flow, payments and emails are phases 2–3 and intentionally absent.
 */
describe('Trips API', () => {
    let userToken: string;
    let committeeToken: string;

    const futureIso = (daysAhead: number) => {
        const d = new Date();
        d.setDate(d.getDate() + daysAhead);
        d.setHours(18, 0, 0, 0);
        return d.toISOString();
    };

    const validTrip = () => ({
        title: 'Peak District Weekend',
        destination: 'Stanage Edge',
        description: 'Gritstone trad and bouldering',
        startDate: futureIso(14),
        endDate: futureIso(16),
        meetupPoint: 'Hicks Building car park',
        costBreakdown: { transport: 15, bunkhouse: 25 },
        totalCostPerPerson: 40,
        depositAmount: 20,
        capacity: 12,
        signupClosesAt: futureIso(10),
        requiredMembership: 'basic',
        visibility: 'all'
    });

    beforeAll(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const userRes = await request(app).post('/api/auth/register').send({
            firstName: 'Trip',
            lastName: 'User',
            email: 'trip_user@example.com',
            password: 'Password123!',
            passwordConfirm: 'Password123!',
            registrationNumber: 'TRIPU1'
        });
        const cookie1 = (userRes.headers['set-cookie'] as any)?.find((c: string) => c.startsWith('uscc_token='));
        userToken = cookie1 ? cookie1.split(';')[0].split('=')[1] : userRes.body.token || '';

        const committeeRes = await request(app).post('/api/auth/register').send({
            firstName: 'Trip',
            lastName: 'Committee',
            email: 'trip_committee@example.com',
            password: 'Password123!',
            passwordConfirm: 'Password123!',
            registrationNumber: 'TRIPC1'
        });
        const committeeUserId = committeeRes.body.user?.id || '';

        const adminRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'committee@sheffieldclimbing.org', password: 'SuperSecret123!' });
        const adminCookieArray = Array.isArray(adminRes.headers['set-cookie'])
            ? adminRes.headers['set-cookie']
            : adminRes.headers['set-cookie']
              ? [adminRes.headers['set-cookie']]
              : [];
        const adminToken = adminCookieArray
            .find((c: string) => c.startsWith('uscc_token='))
            ?.split(';')[0]
            .split('=')[1];

        await request(app)
            .post(`/api/admin/users/${committeeUserId}/promote`)
            .set('Authorization', `Bearer ${adminToken}`);

        const refresh = await request(app)
            .post('/api/auth/login')
            .send({ email: 'trip_committee@example.com', password: 'Password123!' });
        const refreshArray = Array.isArray(refresh.headers['set-cookie'])
            ? refresh.headers['set-cookie']
            : refresh.headers['set-cookie']
              ? [refresh.headers['set-cookie']]
              : [];
        committeeToken =
            refreshArray
                .find((c: string) => c.startsWith('uscc_token='))
                ?.split(';')[0]
                .split('=')[1] || '';
    });

    afterAll(async () => {
        db.close();
    });

    const createTrip = async (overrides: Record<string, any> = {}, token = committeeToken) => {
        const res = await request(app)
            .post('/api/trips')
            .set('Authorization', `Bearer ${token}`)
            .send({ ...validTrip(), ...overrides });
        return res;
    };

    it('rejects unauthenticated listing and non-committee mutations', async () => {
        const noAuth = await request(app).get('/api/trips');
        expect(noAuth.status).toBe(401);

        const memberCreate = await createTrip({}, userToken);
        expect(memberCreate.status).toBe(403);
    });

    it('creates a trip with defaults and writes an audit row', async () => {
        const res = await createTrip();
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.id).toMatch(/^trip_/);

        const audit = await new Promise<any>((resolve) =>
            db.get('SELECT action FROM audit_log WHERE entityId = ?', [res.body.id], (e, r) => resolve(r))
        );
        expect(audit?.action).toBe('trip.create');
    });

    it('validates the create payload', async () => {
        const missing = await createTrip({ title: undefined });
        expect(missing.status).toBe(400);
        expect(missing.body.error).toContain('required');

        const badDate = await createTrip({ endDate: 'not-a-date' });
        expect(badDate.status).toBe(400);

        const inverted = await createTrip({ endDate: futureIso(13) });
        expect(inverted.status).toBe(400);
        expect(inverted.body.error).toContain('End date');

        const zeroCapacity = await createTrip({ capacity: 0 });
        expect(zeroCapacity.status).toBe(400);

        const negativeCost = await createTrip({ totalCostPerPerson: -5 });
        expect(negativeCost.status).toBe(400);

        const bigDeposit = await createTrip({ depositAmount: 999 });
        expect(bigDeposit.status).toBe(400);
        expect(bigDeposit.body.error).toContain('Deposit');

        const badStatus = await createTrip({ status: 'paused' });
        expect(badStatus.status).toBe(400);

        const badVisibility = await createTrip({ visibility: 'secret' });
        expect(badVisibility.status).toBe(400);
    });

    it('hides committee-only trips from members in list and detail', async () => {
        const created = await createTrip({ title: 'Committee Recce', visibility: 'committee_only' });
        const tripId = created.body.id;

        const memberList = await request(app).get('/api/trips').set('Authorization', `Bearer ${userToken}`);
        expect(memberList.status).toBe(200);
        expect(memberList.body.some((t: any) => t.id === tripId)).toBe(false);

        const committeeList = await request(app).get('/api/trips').set('Authorization', `Bearer ${committeeToken}`);
        expect(committeeList.body.some((t: any) => t.id === tripId)).toBe(true);

        const memberDetail = await request(app).get(`/api/trips/${tripId}`).set('Authorization', `Bearer ${userToken}`);
        expect(memberDetail.status).toBe(404);

        const committeeDetail = await request(app)
            .get(`/api/trips/${tripId}`)
            .set('Authorization', `Bearer ${committeeToken}`);
        expect(committeeDetail.status).toBe(200);
        expect(committeeDetail.body.spotsTaken).toBe(0);
    });

    it('returns 404 for unknown trips on all routes', async () => {
        for (const [method, path] of [
            ['get', '/api/trips/trip_nope'],
            ['put', '/api/trips/trip_nope'],
            ['delete', '/api/trips/trip_nope'],
            ['get', '/api/trips/trip_nope/signups']
        ] as const) {
            const req = (request(app) as any)[method](path);
            const res = await req.set('Authorization', `Bearer ${committeeToken}`).send(validTrip());
            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Trip not found');
        }
    });

    it('updates a trip with audit coverage', async () => {
        const created = await createTrip({ title: 'Before Edit' });
        const tripId = created.body.id;

        const updated = await request(app)
            .put(`/api/trips/${tripId}`)
            .set('Authorization', `Bearer ${committeeToken}`)
            .send({ ...validTrip(), title: 'After Edit', capacity: 15 });
        expect(updated.status).toBe(200);

        const detail = await request(app).get(`/api/trips/${tripId}`).set('Authorization', `Bearer ${committeeToken}`);
        expect(detail.body.title).toBe('After Edit');
        expect(detail.body.capacity).toBe(15);
        // costBreakdown round-trips as JSON
        expect(JSON.parse(detail.body.costBreakdown)).toEqual({ transport: 15, bunkhouse: 25 });

        const audit = await new Promise<any>((resolve) =>
            db.get("SELECT details FROM audit_log WHERE action = 'trip.update' AND entityId = ?", [tripId], (e, r) =>
                resolve(r)
            )
        );
        expect(audit?.details).toContain('After Edit');
    });

    it('soft-cancels instead of deleting, preserving the row', async () => {
        const created = await createTrip({ title: 'Doomed Trip' });
        const tripId = created.body.id;

        const cancelled = await request(app)
            .delete(`/api/trips/${tripId}`)
            .set('Authorization', `Bearer ${committeeToken}`);
        expect(cancelled.status).toBe(200);

        // Row still exists for committee bookkeeping...
        const detail = await request(app).get(`/api/trips/${tripId}`).set('Authorization', `Bearer ${committeeToken}`);
        expect(detail.status).toBe(200);
        expect(detail.body.status).toBe('cancelled');
        // ...but disappears from the member-facing list
        const memberList = await request(app).get('/api/trips').set('Authorization', `Bearer ${userToken}`);
        expect(memberList.body.some((t: any) => t.id === tripId)).toBe(false);

        const audit = await new Promise<any>((resolve) =>
            db.get("SELECT id FROM audit_log WHERE action = 'trip.cancel' AND entityId = ?", [tripId], (e, r) =>
                resolve(r)
            )
        );
        expect(audit).toBeTruthy();
    });

    it('roster endpoint returns signups ordered by time (empty roster)', async () => {
        const created = await createTrip();
        const roster = await request(app)
            .get(`/api/trips/${created.body.id}/signups`)
            .set('Authorization', `Bearer ${committeeToken}`);
        expect(roster.status).toBe(200);
        expect(roster.body).toEqual([]);

        const memberRoster = await request(app)
            .get(`/api/trips/${created.body.id}/signups`)
            .set('Authorization', `Bearer ${userToken}`);
        expect(memberRoster.status).toBe(403);
    });

    // --- phase 2: member signup flow ---------------------------------------

    const registerAndLogin = async (label: string) => {
        const email = `tripsignup_${label}_${Date.now()}@example.com`;
        await request(app)
            .post('/api/auth/register')
            .send({
                firstName: 'Trip',
                lastName: 'Signee',
                email,
                password: 'Password123!',
                passwordConfirm: 'Password123!',
                registrationNumber: 'TS' + Math.floor(Math.random() * 1000000)
            });
        const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
        return res.body.token as string;
    };

    it('member signs up, sees own signup embedded, double-signup rejected', async () => {
        const tripId = (await createTrip()).body.id;

        const signup = await request(app)
            .post(`/api/trips/${tripId}/signup`)
            .set('Authorization', `Bearer ${userToken}`);
        expect(signup.status).toBe(200);

        const dupe = await request(app).post(`/api/trips/${tripId}/signup`).set('Authorization', `Bearer ${userToken}`);
        expect(dupe.status).toBe(400);
        expect(dupe.body.error).toBe('You are already signed up to this trip');

        const detail = await request(app).get(`/api/trips/${tripId}`).set('Authorization', `Bearer ${userToken}`);
        expect(detail.body.mySignup).toBeTruthy();
        expect(detail.body.mySignup.cancelledAt).toBeNull();

        const committeeDetail = await request(app)
            .get(`/api/trips/${tripId}`)
            .set('Authorization', `Bearer ${committeeToken}`);
        expect(committeeDetail.body.spotsTaken).toBe(1);

        // Roster now shows the member
        const roster = await request(app)
            .get(`/api/trips/${tripId}/signups`)
            .set('Authorization', `Bearer ${committeeToken}`);
        expect(roster.body.length).toBe(1);
    });

    it('rejects signups on closed, non-open and full trips', async () => {
        const closedTrip = (await createTrip({ signupClosesAt: futureIso(-1) })).body.id;
        const closed = await request(app)
            .post(`/api/trips/${closedTrip}/signup`)
            .set('Authorization', `Bearer ${userToken}`);
        expect(closed.status).toBe(400);
        expect(closed.body.error).toContain('closed');

        const cancelledTrip = (await createTrip()).body.id;
        await request(app).delete(`/api/trips/${cancelledTrip}`).set('Authorization', `Bearer ${committeeToken}`);
        const cancelled = await request(app)
            .post(`/api/trips/${cancelledTrip}/signup`)
            .set('Authorization', `Bearer ${userToken}`);
        expect(cancelled.status).toBe(400);
        expect(cancelled.body.error).toContain('not open');

        const tinyTrip = (await createTrip({ capacity: 1 })).body.id;
        const first = await request(app)
            .post(`/api/trips/${tinyTrip}/signup`)
            .set('Authorization', `Bearer ${userToken}`);
        expect(first.status).toBe(200);
        const secondToken = await registerAndLogin('full');
        const second = await request(app)
            .post(`/api/trips/${tinyTrip}/signup`)
            .set('Authorization', `Bearer ${secondToken}`);
        expect(second.status).toBe(400);
        expect(second.body.error).toBe('Trip is full');
    });

    it('enforces membership requirements on signup', async () => {
        const squadTrip = (await createTrip({ requiredMembership: 'comp_team' })).body.id;
        const denied = await request(app)
            .post(`/api/trips/${squadTrip}/signup`)
            .set('Authorization', `Bearer ${userToken}`);
        expect(denied.status).toBe(403);
        expect(denied.body.error).toContain('membership');
    });

    it('racing members cannot oversell capacity', async () => {
        const CAP = 5;
        const raceTrip = (await createTrip({ capacity: CAP })).body.id;
        const tokens = await Promise.all(Array.from({ length: 12 }, (_, i) => registerAndLogin(`race${i}`)));

        const results = await Promise.all(
            tokens.map((t) => request(app).post(`/api/trips/${raceTrip}/signup`).set('Authorization', `Bearer ${t}`))
        );
        const ok = results.filter((r) => r.status === 200).length;
        const full = results.filter((r) => r.status === 400 && r.body.error === 'Trip is full').length;
        expect(ok).toBe(CAP);
        expect(full).toBe(12 - CAP);

        const committeeDetail = await request(app)
            .get(`/api/trips/${raceTrip}`)
            .set('Authorization', `Bearer ${committeeToken}`);
        expect(committeeDetail.body.spotsTaken).toBe(CAP);
    }, 30000);

    it('cancel-signup releases the spot; late cancels are audited; revival works', async () => {
        // Before deadline: clean cancel, no audit flag
        const openTrip = (await createTrip({ capacity: 2 })).body.id;
        await request(app).post(`/api/trips/${openTrip}/signup`).set('Authorization', `Bearer ${userToken}`);
        const cancel = await request(app)
            .post(`/api/trips/${openTrip}/cancel-signup`)
            .set('Authorization', `Bearer ${userToken}`);
        expect(cancel.status).toBe(200);
        expect(cancel.body.lateCancel).toBe(false);

        const notSignedUp = await request(app)
            .post(`/api/trips/${openTrip}/cancel-signup`)
            .set('Authorization', `Bearer ${userToken}`);
        expect(notSignedUp.status).toBe(400);

        // Spot released — on a capacity-1 trip someone else takes the last
        // place, so the original member's revival must hit the capacity guard.
        const onePlace = (await createTrip({ title: 'One Place', capacity: 1 })).body.id;
        await request(app).post(`/api/trips/${onePlace}/signup`).set('Authorization', `Bearer ${userToken}`);
        await request(app).post(`/api/trips/${onePlace}/cancel-signup`).set('Authorization', `Bearer ${userToken}`);
        const otherToken = await registerAndLogin('release');
        const tookSpot = await request(app)
            .post(`/api/trips/${onePlace}/signup`)
            .set('Authorization', `Bearer ${otherToken}`);
        expect(tookSpot.status).toBe(200);
        const blockedRevive = await request(app)
            .post(`/api/trips/${onePlace}/signup`)
            .set('Authorization', `Bearer ${userToken}`);
        expect(blockedRevive.status).toBe(400);
        expect(blockedRevive.body.error).toBe('Trip is full');

        // When space remains, revival restores the original row (the UNIQUE
        // constraint would block a fresh INSERT) without duplicating history.
        const roomyTrip = (await createTrip({ title: 'Roomy', capacity: 5 })).body.id;
        await request(app).post(`/api/trips/${roomyTrip}/signup`).set('Authorization', `Bearer ${userToken}`);
        await request(app).post(`/api/trips/${roomyTrip}/cancel-signup`).set('Authorization', `Bearer ${userToken}`);
        const revived = await request(app)
            .post(`/api/trips/${roomyTrip}/signup`)
            .set('Authorization', `Bearer ${userToken}`);
        expect(revived.status).toBe(200);
        const rosterAfterRevive = await request(app)
            .get(`/api/trips/${roomyTrip}/signups`)
            .set('Authorization', `Bearer ${committeeToken}`);
        expect(rosterAfterRevive.body.length).toBe(1);
        expect(rosterAfterRevive.body[0].cancelledAt).toBeNull();

        const fullTrip = (await createTrip({ capacity: 5 })).body.id;
        await request(app).post(`/api/trips/${fullTrip}/signup`).set('Authorization', `Bearer ${userToken}`);
        // After deadline: lateCancel flagged in response + audit log
        const lateTripId = (await createTrip({ title: 'Late Trip' })).body.id;
        await request(app).post(`/api/trips/${lateTripId}/signup`).set('Authorization', `Bearer ${userToken}`);
        // Force the deadline into the past
        await new Promise((resolve) =>
            db.run('UPDATE trips SET signupClosesAt = ? WHERE id = ?', [futureIso(-1), lateTripId], () => resolve(null))
        );
        const late = await request(app)
            .post(`/api/trips/${lateTripId}/cancel-signup`)
            .set('Authorization', `Bearer ${userToken}`);
        expect(late.status).toBe(200);
        expect(late.body.lateCancel).toBe(true);

        const audit = await new Promise<any>((resolve) =>
            db.get(
                "SELECT id FROM audit_log WHERE action = 'trip.cancel-late' AND entityId = ?",
                [lateTripId],
                (e, r) => resolve(r)
            )
        );
        expect(audit).toBeTruthy();
    });

    it('cancelled signups do not count toward capacity or roster presence', async () => {
        const tripId = (await createTrip({ capacity: 3 })).body.id;
        const tokenA = await registerAndLogin('cancelsA');
        await request(app).post(`/api/trips/${tripId}/signup`).set('Authorization', `Bearer ${tokenA}`);
        await request(app).post(`/api/trips/${tripId}/cancel-signup`).set('Authorization', `Bearer ${tokenA}`);

        const detail = await request(app).get(`/api/trips/${tripId}`).set('Authorization', `Bearer ${committeeToken}`);
        expect(detail.body.spotsTaken).toBe(0);

        // Roster still shows the row for bookkeeping, with cancelledAt set
        const roster = await request(app)
            .get(`/api/trips/${tripId}/signups`)
            .set('Authorization', `Bearer ${committeeToken}`);
        expect(roster.body.length).toBe(1);
        expect(roster.body[0].cancelledAt).toBeTruthy();
    });
});
