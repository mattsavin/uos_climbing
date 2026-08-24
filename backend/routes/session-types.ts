import express from 'express';
import { dbAll, dbRun } from '../utils/db';
import { authenticateToken, requireCommittee } from '../middleware/auth';

const router = express.Router();

// GET all session types
router.get('/', async (req, res) => {
    try {
        res.json(await dbAll('SELECT * FROM session_types ORDER BY label ASC'));
    } catch {
        res.status(500).json({ error: 'Database error' });
    }
});

// POST new session type (committee only)
router.post('/', authenticateToken, requireCommittee, async (req, res) => {
    const { label } = req.body;
    if (!label) return res.status(400).json({ error: 'Label is required' });

    const id = label; // Using label as ID for simplicity and backward compatibility

    try {
        await dbRun('INSERT INTO session_types (id, label) VALUES (?, ?)', [id, label]);
        res.json({ id, label });
    } catch (err: any) {
        if (err?.code === 'SQLITE_CONSTRAINT') {
            return res.status(400).json({ error: 'Session type already exists' });
        }
        res.status(500).json({ error: 'Database error' });
    }
});

// PUT update session type (committee only)
router.put('/:id', authenticateToken, requireCommittee, async (req, res) => {
    const { label } = req.body;
    if (!label) return res.status(400).json({ error: 'Label is required' });

    try {
        await dbRun('UPDATE session_types SET label = ? WHERE id = ?', [label, req.params.id]);
        res.json({ id: req.params.id, label });
    } catch {
        res.status(500).json({ error: 'Database error' });
    }
});

// DELETE session type (committee only)
router.delete('/:id', authenticateToken, requireCommittee, async (req, res) => {
    try {
        await dbRun('DELETE FROM session_types WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
