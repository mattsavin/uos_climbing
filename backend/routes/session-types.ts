import express from 'express';
import { db } from '../db';
import { authenticateToken, requireCommittee } from '../middleware/auth';

const router = express.Router();

// GET all session types
router.get('/', (req, res) => {
    db.all('SELECT * FROM session_types ORDER BY label ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// POST new session type (committee only)
router.post('/', authenticateToken, requireCommittee, (req, res) => {
    const { label } = req.body;
    if (!label) return res.status(400).json({ error: 'Label is required' });

    const id = label; // Using label as ID for simplicity and backward compatibility

    db.run(
        'INSERT INTO session_types (id, label) VALUES (?, ?)',
        [id, label],
        function (err) {
            if (err) {
                if ((err as any).code === 'SQLITE_CONSTRAINT') {
                    return res.status(400).json({ error: 'Session type already exists' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ id, label });
        }
    );
});

// PUT update session type (committee only)
router.put('/:id', authenticateToken, requireCommittee, (req, res) => {
    const { label } = req.body;
    if (!label) return res.status(400).json({ error: 'Label is required' });

    db.run(
        'UPDATE session_types SET label = ? WHERE id = ?',
        [label, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ id: req.params.id, label });
        }
    );
});

// DELETE session type (committee only)
router.delete('/:id', authenticateToken, requireCommittee, (req, res) => {
    db.run('DELETE FROM session_types WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

export default router;
