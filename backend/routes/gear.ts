import express from 'express';
import { db } from '../db';
import { authenticateToken, requireKitSec } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
    db.all('SELECT * FROM gear ORDER BY name ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

router.post('/', authenticateToken, requireKitSec, (req, res) => {
    const { name, description, totalQuantity } = req.body;
    const id = 'gear_' + Date.now();

    db.run(
        'INSERT INTO gear (id, name, description, totalQuantity, availableQuantity) VALUES (?, ?, ?, ?, ?)',
        [id, name, description, totalQuantity, totalQuantity],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ id, name, description, totalQuantity, availableQuantity: totalQuantity });
        }
    );
});

router.put('/:id', authenticateToken, requireKitSec, (req, res) => {
    const { name, description, totalQuantity, availableQuantity } = req.body;

    db.run(
        'UPDATE gear SET name = ?, description = ?, totalQuantity = ?, availableQuantity = ? WHERE id = ?',
        [name, description, totalQuantity, availableQuantity, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true });
        }
    );
});

router.delete('/:id', authenticateToken, requireKitSec, (req, res) => {
    db.run('DELETE FROM gear WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

router.get('/requests', authenticateToken, requireKitSec, (req, res) => {
    db.all(`
        SELECT r.*, u.name as userName, u.email as userEmail, g.name as gearName 
        FROM gear_requests r
        JOIN users u ON r.userId = u.id
        JOIN gear g ON r.gearId = g.id
        ORDER BY r.requestDate DESC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

router.get('/me/requests', authenticateToken, (req: any, res) => { // Changed from /api/users/me/gear-requests
    db.all(`
        SELECT r.*, g.name as gearName 
        FROM gear_requests r
        JOIN gear g ON r.gearId = g.id
        WHERE r.userId = ?
        ORDER BY r.requestDate DESC
    `, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

router.post('/:id/request', authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    const gearId = req.params.id;
    const requestId = 'req_' + Date.now();
    const requestDate = new Date().toISOString();

    db.get('SELECT availableQuantity FROM gear WHERE id = ?', [gearId], (err, gear: any) => {
        if (err || !gear) return res.status(404).json({ error: 'Gear not found' });
        if (gear.availableQuantity <= 0) return res.status(400).json({ error: 'Gear out of stock' });

        db.run('INSERT INTO gear_requests (id, userId, gearId, status, requestDate) VALUES (?, ?, ?, ?, ?)',
            [requestId, userId, gearId, 'pending', requestDate],
            function (err) {
                if (err) return res.status(500).json({ error: 'Database error' });
                res.json({ success: true, requestId });
            }
        );
    });
});

router.post('/requests/:request_id/approve', authenticateToken, requireKitSec, (req, res) => {
    const requestId = req.params.request_id;
    db.get('SELECT gearId, status FROM gear_requests WHERE id = ?', [requestId], (err, request: any) => {
        if (err || !request) return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run("UPDATE gear_requests SET status = 'approved' WHERE id = ?", [requestId], function (err) {
                if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: 'DB Error' }); }

                db.run('UPDATE gear SET availableQuantity = availableQuantity - 1 WHERE id = ?', [request.gearId], function (err) {
                    if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: 'DB Error' }); }

                    db.run('COMMIT');
                    res.json({ success: true });
                });
            });
        });
    });
});

router.post('/requests/:request_id/reject', authenticateToken, requireKitSec, (req, res) => {
    const requestId = req.params.request_id;
    db.run("UPDATE gear_requests SET status = 'rejected' WHERE id = ? AND status = 'pending'", [requestId], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

router.post('/requests/:request_id/return', authenticateToken, requireKitSec, (req, res) => {
    const requestId = req.params.request_id;
    const returnDate = new Date().toISOString();

    db.get("SELECT gearId, status FROM gear_requests WHERE id = ?", [requestId], (err, request: any) => {
        if (err || !request) return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'approved') return res.status(400).json({ error: 'Request is not approved' });

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run("UPDATE gear_requests SET status = 'returned', returnDate = ? WHERE id = ?", [returnDate, requestId], function (err) {
                if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: 'DB Error' }); }

                db.run('UPDATE gear SET availableQuantity = availableQuantity + 1 WHERE id = ?', [request.gearId], function (err) {
                    if (err) { db.run('ROLLBACK'); return res.status(500).json({ error: 'DB Error' }); }

                    db.run('COMMIT');
                    res.json({ success: true });
                });
            });
        });
    });
});

export default router;
