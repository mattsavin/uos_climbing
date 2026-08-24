import express from 'express';
import { dbAll, dbGet, dbRun } from '../utils/db';
import { authenticateToken, requireCommittee } from '../middleware/auth';
import crypto from 'crypto';

const router = express.Router();

async function getElectionsOpen(): Promise<boolean> {
    const config = await dbGet<{ value: string }>('SELECT value FROM config WHERE key = ?', ['electionsOpen']).catch(
        () => null
    );
    return !!config && config.value === 'true';
}

router.get('/candidates', authenticateToken, async (req, res) => {
    try {
        res.json(
            await dbAll(
                `
        SELECT u.id, u.name, c.manifesto, c.role, c.presentationLink,
        (SELECT COUNT(*) FROM votes v WHERE v.candidateId = u.id) as voteCount
        FROM candidates c
        JOIN users u ON c.userId = u.id
    `
            )
        );
    } catch {
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/apply', authenticateToken, async (req: any, res) => {
    const { manifesto, role, presentationLink } = req.body;
    if (!manifesto || !role) return res.status(400).json({ error: 'Manifesto and role are required' });

    if (!(await getElectionsOpen())) {
        return res.status(403).json({ error: 'Elections are not currently open' });
    }

    try {
        await dbRun('INSERT INTO candidates (userId, manifesto, role, presentationLink) VALUES (?, ?, ?, ?)', [
            req.user.id,
            manifesto,
            role,
            presentationLink || null
        ]);
        res.json({ success: true });
    } catch (err: any) {
        if (err?.message?.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'You are already a candidate' });
        }
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/withdraw', authenticateToken, async (req: any, res) => {
    if (!(await getElectionsOpen())) {
        return res.status(403).json({ error: 'Elections are not currently open' });
    }

    await dbRun('DELETE FROM candidates WHERE userId = ?', [req.user.id]).then(
        () => res.json({ success: true }),
        () => res.status(500).json({ error: 'Database error' })
    );
});

router.get('/status', authenticateToken, async (req: any, res) => {
    // Sequential lookups; original treated every query error as 500 except the
    // config check, whose failure simply meant "elections closed".
    let vote: any, candidate: any;
    try {
        vote = await dbGet('SELECT candidateId FROM votes WHERE userId = ?', [req.user.id]);
        candidate = await dbGet('SELECT manifesto, role FROM candidates WHERE userId = ?', [req.user.id]);
    } catch {
        return res.status(500).json({ error: 'Database error' });
    }
    const electionsOpen = await getElectionsOpen();

    res.json({
        hasVoted: !!vote,
        votedFor: vote?.candidateId,
        isCandidate: !!candidate,
        candidateRole: candidate?.role,
        electionsOpen
    });
});

router.post('/vote', authenticateToken, async (req: any, res) => {
    const { candidateId } = req.body;
    if (!candidateId) return res.status(400).json({ error: 'Candidate ID is required' });

    if (!(await getElectionsOpen())) {
        return res.status(403).json({ error: 'Elections are not currently open' });
    }

    try {
        await dbRun('INSERT INTO votes (userId, candidateId) VALUES (?, ?)', [req.user.id, candidateId]);
        res.json({ success: true });
    } catch (err: any) {
        if (err?.message?.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'You have already voted' });
        }
        res.status(500).json({ error: 'Database error' });
    }
});

// Committee-only full election reset. Genuinely transactional now — the old
// callback form wrapped async db.run calls in a synchronous try/catch, so
// failures were never rolled back and still returned success. Failures now
// roll back and surface as 500.
router.post('/reset', authenticateToken, requireCommittee, async (req, res) => {
    try {
        await dbRun('BEGIN TRANSACTION');
        await dbRun('DELETE FROM votes');
        await dbRun('DELETE FROM candidates');
        await dbRun('DELETE FROM referendum_votes');
        await dbRun('DELETE FROM referendums');
        await dbRun('UPDATE config SET value = ? WHERE key = ?', ['false', 'electionsOpen']);
        await dbRun('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await dbRun('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Database error during reset' });
    }
});

router.get('/referendums', authenticateToken, async (req: any, res) => {
    try {
        res.json(
            await dbAll(
                `
        SELECT r.id, r.title, r.description, r.createdAt,
        (SELECT COUNT(*) FROM referendum_votes rv WHERE rv.referendumId = r.id AND rv.choice = 'yes') as yesCount,
        (SELECT COUNT(*) FROM referendum_votes rv WHERE rv.referendumId = r.id AND rv.choice = 'no') as noCount,
        (SELECT COUNT(*) FROM referendum_votes rv WHERE rv.referendumId = r.id AND rv.choice = 'abstain') as abstainCount,
        (SELECT choice FROM referendum_votes rv WHERE rv.referendumId = r.id AND rv.userId = ?) as myVote
        FROM referendums r
        ORDER BY r.createdAt DESC
    `,
                [req.user.id]
            )
        );
    } catch {
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/referendums', authenticateToken, requireCommittee, async (req, res) => {
    const { title, description } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'Title and description are required' });

    const id = crypto.randomUUID();
    const createdAt = Date.now();

    await dbRun('INSERT INTO referendums (id, title, description, createdAt) VALUES (?, ?, ?, ?)', [
        id,
        title,
        description,
        createdAt
    ]).then(
        () => res.json({ id, title, description, createdAt }),
        () => res.status(500).json({ error: 'Database error' })
    );
});

router.delete('/referendums/:id', authenticateToken, requireCommittee, async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun('BEGIN TRANSACTION');
        await dbRun('DELETE FROM referendum_votes WHERE referendumId = ?', [id]);
        await dbRun('DELETE FROM referendums WHERE id = ?', [id]);
        await dbRun('COMMIT');
        res.json({ success: true });
    } catch {
        await dbRun('ROLLBACK').catch(() => {});
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/referendums/:id/vote', authenticateToken, async (req: any, res) => {
    const { id } = req.params;
    const { choice } = req.body;

    if (!['yes', 'no', 'abstain'].includes(choice)) {
        return res.status(400).json({ error: 'Invalid choice. Must be yes, no, or abstain.' });
    }

    if (!(await getElectionsOpen())) {
        return res.status(403).json({ error: 'Elections are not currently open' });
    }

    try {
        await dbRun('INSERT INTO referendum_votes (userId, referendumId, choice) VALUES (?, ?, ?)', [
            req.user.id,
            id,
            choice
        ]);
        res.json({ success: true });
    } catch (err: any) {
        if (err?.message?.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'You have already voted on this referendum' });
        }
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
