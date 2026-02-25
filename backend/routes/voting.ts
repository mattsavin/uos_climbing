import express from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.get('/candidates', authenticateToken, (req, res) => {
    db.all(`
        SELECT u.id, u.name, c.manifesto,
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

export default router;
