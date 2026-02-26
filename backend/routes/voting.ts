import express from 'express';
import { db } from '../db';
import { authenticateToken, requireCommittee } from '../middleware/auth';
import crypto from 'crypto';

const router = express.Router();

router.get('/candidates', authenticateToken, (req, res) => {
    db.all(`
        SELECT u.id, u.name, c.manifesto, c.role, c.presentationLink,
        (SELECT COUNT(*) FROM votes v WHERE v.candidateId = u.id) as voteCount
        FROM candidates c
        JOIN users u ON c.userId = u.id
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

router.post('/apply', authenticateToken, (req: any, res) => {
    const { manifesto, role, presentationLink } = req.body;
    if (!manifesto || !role) return res.status(400).json({ error: 'Manifesto and role are required' });

    db.get('SELECT value FROM config WHERE key = ?', ['electionsOpen'], (err, config: any) => {
        if (err || !config || config.value !== 'true') {
            return res.status(403).json({ error: 'Elections are not currently open' });
        }

        db.run('INSERT INTO candidates (userId, manifesto, role, presentationLink) VALUES (?, ?, ?, ?)', [req.user.id, manifesto, role, presentationLink || null], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'You are already a candidate' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ success: true });
        });
    });
});
router.post('/withdraw', authenticateToken, (req: any, res) => {
    db.get('SELECT value FROM config WHERE key = ?', ['electionsOpen'], (err, config: any) => {
        if (err || !config || config.value !== 'true') {
            return res.status(403).json({ error: 'Elections are not currently open' });
        }

        db.run('DELETE FROM candidates WHERE userId = ?', [req.user.id], function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true });
        });
    });
});

router.get('/status', authenticateToken, (req: any, res) => {
    db.get('SELECT candidateId FROM votes WHERE userId = ?', [req.user.id], (err, vote: any) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        db.get('SELECT manifesto, role FROM candidates WHERE userId = ?', [req.user.id], (err, candidate: any) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            db.get('SELECT value FROM config WHERE key = ?', ['electionsOpen'], (err, config: any) => {
                const electionsOpen = config && config.value === 'true';
                res.json({
                    hasVoted: !!vote,
                    votedFor: vote?.candidateId,
                    isCandidate: !!candidate,
                    candidateRole: candidate?.role,
                    electionsOpen
                });
            });
        });
    });
});

router.post('/vote', authenticateToken, (req: any, res) => {
    const { candidateId } = req.body;
    if (!candidateId) return res.status(400).json({ error: 'Candidate ID is required' });

    db.get('SELECT value FROM config WHERE key = ?', ['electionsOpen'], (err, config: any) => {
        if (err || !config || config.value !== 'true') {
            return res.status(403).json({ error: 'Elections are not currently open' });
        }

        db.run('INSERT INTO votes (userId, candidateId) VALUES (?, ?)', [req.user.id, candidateId], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'You have already voted' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ success: true });
        });
    });
});

router.post('/reset', authenticateToken, requireCommittee, (req, res) => {
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        try {
            db.run('DELETE FROM votes');
            db.run('DELETE FROM candidates');
            db.run('DELETE FROM referendum_votes');
            db.run('DELETE FROM referendums');
            db.run('UPDATE config SET value = ? WHERE key = ?', ['false', 'electionsOpen']);
            db.run('COMMIT');
            res.json({ success: true });
        } catch (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: 'Database error during reset' });
        }
    });
});

router.get('/referendums', authenticateToken, (req: any, res) => {
    db.all(`
        SELECT r.id, r.title, r.description, r.createdAt,
        (SELECT COUNT(*) FROM referendum_votes rv WHERE rv.referendumId = r.id AND rv.choice = 'yes') as yesCount,
        (SELECT COUNT(*) FROM referendum_votes rv WHERE rv.referendumId = r.id AND rv.choice = 'no') as noCount,
        (SELECT COUNT(*) FROM referendum_votes rv WHERE rv.referendumId = r.id AND rv.choice = 'abstain') as abstainCount,
        (SELECT choice FROM referendum_votes rv WHERE rv.referendumId = r.id AND rv.userId = ?) as myVote
        FROM referendums r
        ORDER BY r.createdAt DESC
    `, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

router.post('/referendums', authenticateToken, requireCommittee, (req, res) => {
    const { title, description } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'Title and description are required' });

    const id = crypto.randomUUID();
    const createdAt = Date.now();

    db.run('INSERT INTO referendums (id, title, description, createdAt) VALUES (?, ?, ?, ?)', [id, title, description, createdAt], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ id, title, description, createdAt });
    });
});

router.delete('/referendums/:id', authenticateToken, requireCommittee, (req, res) => {
    const { id } = req.params;
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        try {
            db.run('DELETE FROM referendum_votes WHERE referendumId = ?', [id]);
            db.run('DELETE FROM referendums WHERE id = ?', [id]);
            db.run('COMMIT');
            res.json({ success: true });
        } catch (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: 'Database error' });
        }
    });
});

router.post('/referendums/:id/vote', authenticateToken, (req: any, res) => {
    const { id } = req.params;
    const { choice } = req.body;

    if (!['yes', 'no', 'abstain'].includes(choice)) {
        return res.status(400).json({ error: 'Invalid choice. Must be yes, no, or abstain.' });
    }

    db.get('SELECT value FROM config WHERE key = ?', ['electionsOpen'], (err, config: any) => {
        if (err || !config || config.value !== 'true') {
            return res.status(403).json({ error: 'Elections are not currently open' });
        }

        db.run('INSERT INTO referendum_votes (userId, referendumId, choice) VALUES (?, ?, ?)', [req.user.id, id, choice], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'You have already voted on this referendum' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ success: true });
        });
    });
});

export default router;
