import express from 'express';
import { db } from '../db';
import { authenticateToken, requireCommittee } from '../middleware/auth';

const router = express.Router();

function normalizeMembershipTypeId(input: string): string {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

router.get('/', (req, res) => {
    db.all('SELECT * FROM membership_types ORDER BY label ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows || []);
    });
});

router.post('/', authenticateToken, requireCommittee, (req, res) => {
    const label = (req.body?.label || '').toString().trim();
    const providedId = (req.body?.id || '').toString().trim();
    const id = normalizeMembershipTypeId(providedId || label);

    if (!label) return res.status(400).json({ error: 'Label is required' });
    if (!id) return res.status(400).json({ error: 'Invalid membership type id' });

    db.run(
        'INSERT INTO membership_types (id, label) VALUES (?, ?)',
        [id, label],
        function (err) {
            if (err) {
                if ((err as any).code === 'SQLITE_CONSTRAINT') {
                    return res.status(400).json({ error: 'Membership type already exists' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ id, label });
        }
    );
});

router.put('/:id', authenticateToken, requireCommittee, (req, res) => {
    const label = (req.body?.label || '').toString().trim();
    if (!label) return res.status(400).json({ error: 'Label is required' });

    db.run(
        'UPDATE membership_types SET label = ? WHERE id = ?',
        [label, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (this.changes === 0) return res.status(404).json({ error: 'Membership type not found' });
            res.json({ id: req.params.id, label });
        }
    );
});

router.delete('/:id', authenticateToken, requireCommittee, (req, res) => {
    if (req.params.id === 'basic') {
        return res.status(400).json({ error: 'The basic membership type cannot be deleted' });
    }

    db.get('SELECT COUNT(*) AS count FROM membership_types', [], (countErr, countRow: any) => {
        if (countErr) return res.status(500).json({ error: 'Database error' });
        if ((countRow?.count || 0) <= 1) {
            return res.status(400).json({ error: 'At least one membership type must remain' });
        }

        db.run('DELETE FROM membership_types WHERE id = ?', [req.params.id], function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (this.changes === 0) return res.status(404).json({ error: 'Membership type not found' });
            res.json({ success: true });
        });
    });
});

export default router;
