import express from 'express';
import { db } from '../db';
import { dbAll, dbGet, dbRun } from '../utils/db';
import { authenticateToken, requireKitSec } from '../middleware/auth';
import { sendEmail } from '../services/email';
import crypto from 'crypto';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
    try {
        res.json(await dbAll('SELECT * FROM gear ORDER BY name ASC'));
    } catch {
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/', authenticateToken, requireKitSec, async (req, res) => {
    const { name, description, totalQuantity } = req.body;
    const id = 'gear_' + crypto.randomUUID();

    try {
        await dbRun(
            'INSERT INTO gear (id, name, description, totalQuantity, availableQuantity) VALUES (?, ?, ?, ?, ?)',
            [id, name, description, totalQuantity, totalQuantity]
        );
        res.json({ id, name, description, totalQuantity, availableQuantity: totalQuantity });
    } catch {
        res.status(500).json({ error: 'Database error' });
    }
});

router.put('/:id', authenticateToken, requireKitSec, async (req, res) => {
    const { name, description, totalQuantity, availableQuantity } = req.body;

    await dbRun('UPDATE gear SET name = ?, description = ?, totalQuantity = ?, availableQuantity = ? WHERE id = ?', [
        name,
        description,
        totalQuantity,
        availableQuantity,
        req.params.id
    ]).then(
        () => res.json({ success: true }),
        () => res.status(500).json({ error: 'Database error' })
    );
});

router.delete('/:id', authenticateToken, requireKitSec, async (req, res) => {
    await dbRun('DELETE FROM gear WHERE id = ?', [req.params.id]).then(
        () => res.json({ success: true }),
        () => res.status(500).json({ error: 'Database error' })
    );
});

router.get('/requests', authenticateToken, requireKitSec, async (req, res) => {
    try {
        res.json(
            await dbAll(
                `
        SELECT r.*, u.name as userName, u.email as userEmail, g.name as gearName 
        FROM gear_requests r
        JOIN users u ON r.userId = u.id
        JOIN gear g ON r.gearId = g.id
        ORDER BY r.requestDate DESC
    `
            )
        );
    } catch {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/me/requests', authenticateToken, async (req: any, res) => {
    // Changed from /api/users/me/gear-requests
    try {
        res.json(
            await dbAll(
                `
        SELECT r.*, g.name as gearName 
        FROM gear_requests r
        JOIN gear g ON r.gearId = g.id
        WHERE r.userId = ?
        ORDER BY r.requestDate DESC
    `,
                [req.user.id]
            )
        );
    } catch {
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/:id/request', authenticateToken, async (req: any, res) => {
    const userId = req.user.id;
    const gearId = req.params.id;
    const requestId = 'req_' + crypto.randomUUID();
    const requestDate = new Date().toISOString();

    const gear = await dbGet<{ availableQuantity: number }>('SELECT availableQuantity FROM gear WHERE id = ?', [
        gearId
    ]).catch(() => undefined);
    if (!gear) return res.status(404).json({ error: 'Gear not found' });
    if (gear.availableQuantity <= 0) return res.status(400).json({ error: 'Gear out of stock' });

    const inserted = await dbRun(
        'INSERT INTO gear_requests (id, userId, gearId, status, requestDate) VALUES (?, ?, ?, ?, ?)',
        [requestId, userId, gearId, 'pending', requestDate]
    ).catch(() => null);
    if (inserted === null) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, requestId });
});

router.post('/requests/:request_id/approve', authenticateToken, requireKitSec, async (req, res) => {
    const requestId = req.params.request_id;
    const request = await dbGet<any>(
        'SELECT r.gearId, r.status, u.name, u.email FROM gear_requests r LEFT JOIN users u ON r.userId = u.id WHERE r.id = ?',
        [requestId]
    ).catch(() => undefined);

    if (request === undefined) return res.status(500).json({ error: 'Database error' });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });

    // Transactional: serialize + BEGIN/COMMIT so concurrent approvals cannot both
    // decrement stock. Kept callback-based deliberately (see utils/db.ts).
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(
            "UPDATE gear_requests SET status = 'approved' WHERE id = ? AND status = 'pending'",
            [requestId],
            function (err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'DB Error' });
                }
                if (this.changes === 0) {
                    db.run('ROLLBACK');
                    return res.status(400).json({ error: 'Request is no longer pending' });
                }

                db.run(
                    'UPDATE gear SET availableQuantity = availableQuantity - 1 WHERE id = ?',
                    [request.gearId],
                    function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'DB Error' });
                        }

                        db.run('COMMIT');

                        if (request.email) {
                            sendEmail(
                                request.email,
                                'Gear Request Approved',
                                `Hi ${request.name || 'User'},\n\nYour gear request has been approved. Please collect it from the Kit Sec.`,
                                `<p>Hi ${request.name || 'User'},</p><p>Your gear request has been approved. Please collect it from the Kit Sec.</p>`
                            ).catch((e: any) => console.error('Failed to send approval email:', e));
                        }

                        res.json({ success: true });
                    }
                );
            }
        );
    });
});

router.post('/requests/:request_id/reject', authenticateToken, requireKitSec, async (req, res) => {
    const requestId = req.params.request_id;
    const request = await dbGet<any>(
        'SELECT r.status, u.name, u.email FROM gear_requests r LEFT JOIN users u ON r.userId = u.id WHERE r.id = ?',
        [requestId]
    ).catch(() => undefined);

    if (request === undefined) return res.status(500).json({ error: 'Database error' });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });

    const { changes } = await dbRun(
        "UPDATE gear_requests SET status = 'rejected' WHERE id = ? AND status = 'pending'",
        [requestId]
    ).catch(() => ({ changes: -1 }));

    if (changes < 0) return res.status(500).json({ error: 'Database error' });
    if (changes === 0) return res.status(400).json({ error: 'Request is no longer pending' });

    if (request.email) {
        sendEmail(
            request.email,
            'Gear Request Rejected',
            `Hi ${request.name || 'User'},\n\nUnfortunately, your gear request has been rejected.`,
            `<p>Hi ${request.name || 'User'},</p><p>Unfortunately, your gear request has been rejected.</p>`
        ).catch((e: any) => console.error('Failed to send rejection email:', e));
    }

    res.json({ success: true });
});

router.post('/requests/:request_id/return', authenticateToken, requireKitSec, async (req, res) => {
    const requestId = req.params.request_id;
    const returnDate = new Date().toISOString();

    const request = await dbGet<{ gearId: string; status: string }>(
        'SELECT gearId, status FROM gear_requests WHERE id = ?',
        [requestId]
    ).catch(() => undefined);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'approved') return res.status(400).json({ error: 'Request is not approved' });

    // Transactional: same rationale as approve
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(
            "UPDATE gear_requests SET status = 'returned', returnDate = ? WHERE id = ? AND status = 'approved'",
            [returnDate, requestId],
            function (err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'DB Error' });
                }
                if (this.changes === 0) {
                    db.run('ROLLBACK');
                    return res.status(400).json({ error: 'Request is no longer approved' });
                }

                db.run(
                    'UPDATE gear SET availableQuantity = availableQuantity + 1 WHERE id = ?',
                    [request.gearId],
                    function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'DB Error' });
                        }

                        db.run('COMMIT');
                        res.json({ success: true });
                    }
                );
            }
        );
    });
});

export default router;
