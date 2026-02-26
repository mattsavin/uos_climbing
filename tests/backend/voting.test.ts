import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/server';
import { db } from '../../backend/db';

describe('Voting API', () => {
    let userToken: string;
    let userId: string;

    beforeAll(async () => {
        // Wait for DB initialization
        await new Promise(resolve => setTimeout(resolve, 500));

        // Create a regular user
        const userRes = await request(app)
            .post('/api/auth/register')
            .send({
                firstName: 'Voting',
                lastName: 'User',
                email: 'voter@example.com',
                password: 'Password123!', passwordConfirm: 'Password123!',
                registrationNumber: 'VOTER1'
            });
        const tokenCookie1 = userRes.headers['set-cookie']?.find((c: string) => c.startsWith('uscc_token='));
        userToken = tokenCookie1 ? tokenCookie1.split(';')[0].split('=')[1] : '';
        userId = userRes.body.user.id;
    });

    afterAll(async () => {
        db.close();
    });

    const createVoterUser = async (prefix: string) => {
        const ts = Date.now() + Math.floor(Math.random() * 1000);
        const email = `${prefix}${ts}_voter@example.com`;
        const userRes = await request(app).post('/api/auth/register').send({
            firstName: prefix + ts, lastName: 'Voting User', email, password: 'Password123!', passwordConfirm: 'Password123!', registrationNumber: `${prefix}${ts}VOTER`
        });
        const cookies = userRes.headers['set-cookie'];
        const cookieArray = Array.isArray(cookies) ? cookies : (cookies ? [cookies] : []);
        const tokenCookie = cookieArray.find((c: string) => c.startsWith('uscc_token='));
        return { token: tokenCookie ? tokenCookie.split(';')[0].split('=')[1] : (userRes.body.token || ''), id: userRes.body.user?.id || userRes.body.id || '', email };
    };

    it('should fail to apply when elections are closed', async () => {
        const { token } = await createVoterUser('apply_closed');
        const res = await request(app)
            .post('/api/voting/apply')
            .set('Authorization', `Bearer ${token}`)
            .send({
                manifesto: 'Vote for me!',
                role: 'President'
            });

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error', 'Elections are not currently open');
    });

    it('should be able to see voting status', async () => {
        const { token } = await createVoterUser('status_check');
        const res = await request(app)
            .get('/api/voting/status')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('hasVoted', false);
        expect(res.body).toHaveProperty('isCandidate', false);
        expect(res.body).toHaveProperty('electionsOpen', false);
    });

    it('should list candidates', async () => {
        const { token } = await createVoterUser('list_check');
        const res = await request(app)
            .get('/api/voting/candidates')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('should allow application when elections are open', async () => {
        const { token } = await createVoterUser('apply_open');

        // Admin opens elections
        const adminRes = await request(app).post('/api/auth/login').send({ email: 'sheffieldclimbing@gmail.com', password: 'SuperSecret123!' });
        await request(app).post('/api/admin/config/elections').set('Authorization', `Bearer ${adminRes.body.token}`).send({ open: true });

        const res = await request(app)
            .post('/api/voting/apply')
            .set('Authorization', `Bearer ${token}`)
            .send({ manifesto: 'Vote for me!', role: 'President' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should reject double application', async () => {
        const { token } = await createVoterUser('apply_double');

        // Ensure open
        const adminRes = await request(app).post('/api/auth/login').send({ email: 'sheffieldclimbing@gmail.com', password: 'SuperSecret123!' });
        await request(app).post('/api/admin/config/elections').set('Authorization', `Bearer ${adminRes.body.token}`).send({ open: true });

        // First apply
        await request(app).post('/api/voting/apply').set('Authorization', `Bearer ${token}`).send({ manifesto: 'Vote for me!', role: 'President' });

        // Second apply
        const res = await request(app)
            .post('/api/voting/apply')
            .set('Authorization', `Bearer ${token}`)
            .send({ manifesto: 'Vote for me again!', role: 'Treasurer' });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'You are already a candidate');
    });

    it('should process a valid vote', async () => {
        const voter = await createVoterUser('real_voter');
        const candidate = await createVoterUser('real_candidate');

        // Open elections
        const adminRes = await request(app).post('/api/auth/login').send({ email: 'sheffieldclimbing@gmail.com', password: 'SuperSecret123!' });
        await request(app).post('/api/admin/config/elections').set('Authorization', `Bearer ${adminRes.body.token}`).send({ open: true });

        // Apply as candidate
        await request(app).post('/api/voting/apply').set('Authorization', `Bearer ${candidate.token}`).send({ manifesto: 'A', role: 'President' });

        const res = await request(app)
            .post('/api/voting/vote')
            .set('Authorization', `Bearer ${voter.token}`)
            .send({ candidateId: candidate.id });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
    });

    it('should reject double voting', async () => {
        const voter = await createVoterUser('double_voter');
        const candidate = await createVoterUser('double_candidate');

        const adminRes = await request(app).post('/api/auth/login').send({ email: 'sheffieldclimbing@gmail.com', password: 'SuperSecret123!' });
        await request(app).post('/api/admin/config/elections').set('Authorization', `Bearer ${adminRes.body.token}`).send({ open: true });

        await request(app).post('/api/voting/apply').set('Authorization', `Bearer ${candidate.token}`).send({ manifesto: 'A', role: 'President' });

        // First vote
        await request(app).post('/api/voting/vote').set('Authorization', `Bearer ${voter.token}`).send({ candidateId: candidate.id });

        // Second vote
        const res = await request(app)
            .post('/api/voting/vote')
            .set('Authorization', `Bearer ${voter.token}`)
            .send({ candidateId: candidate.id });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'You have already voted');
    });

    it('should allow withdrawal of candidacy', async () => {
        const candidate = await createVoterUser('withdraw_candidate');

        const adminRes = await request(app).post('/api/auth/login').send({ email: 'sheffieldclimbing@gmail.com', password: 'SuperSecret123!' });
        await request(app).post('/api/admin/config/elections').set('Authorization', `Bearer ${adminRes.body.token}`).send({ open: true });

        // Apply
        await request(app).post('/api/voting/apply').set('Authorization', `Bearer ${candidate.token}`).send({ manifesto: 'Will withdraw', role: 'President' });

        // Withdraw
        const res = await request(app)
            .post('/api/voting/withdraw')
            .set('Authorization', `Bearer ${candidate.token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);

        // Verify status reflects not being a candidate
        const statusRes = await request(app).get('/api/voting/status').set('Authorization', `Bearer ${candidate.token}`);
        expect(statusRes.body).toHaveProperty('isCandidate', false);
    });
});
