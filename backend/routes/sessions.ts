import express from 'express';
import { db } from '../db';
import { authenticateToken, requireCommittee } from '../middleware/auth';

const router = express.Router();

router.get('/', (req, res) => {
    db.all('SELECT * FROM sessions ORDER BY date ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

router.get('/ical/:userId', (req, res) => {
    const userId = req.params.userId;
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) return res.status(404).send("User not found");

        db.all(`
            SELECT s.* FROM sessions s
            JOIN bookings b ON s.id = b.sessionId
            WHERE b.userId = ?
            ORDER BY s.date ASC
        `, [userId], (err, sessions) => {
            if (err) return res.status(500).send("Database error");

            let icalContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//USCC//Calendar//EN\r\n";
            sessions.forEach((s: any) => {
                const start = new Date(s.date);
                if (isNaN(start.getTime())) return;
                const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hour duration
                const formatDT = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

                icalContent += "BEGIN:VEVENT\r\n";
                icalContent += `UID:${s.id}_${userId}@sheffieldclimbing.com\r\n`;
                icalContent += `DTSTAMP:${formatDT(new Date())}\r\n`;
                icalContent += `DTSTART:${formatDT(start)}\r\n`;
                icalContent += `DTEND:${formatDT(end)}\r\n`;
                icalContent += `SUMMARY:${s.title} (${s.type})\r\n`;
                icalContent += "END:VEVENT\r\n";
            });
            icalContent += "END:VCALENDAR\r\n";

            res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="uscc_schedule.ics"`);
            res.send(icalContent);
        });
    });
});

router.post('/', authenticateToken, requireCommittee, (req, res) => {
    const { title, type, date, capacity } = req.body;
    const id = 'sess_' + Date.now();

    db.run(
        'INSERT INTO sessions (id, type, title, date, capacity, bookedSlots) VALUES (?, ?, ?, ?, ?, ?)',
        [id, type, title, date, capacity, 0],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ id, type, title, date, capacity, bookedSlots: 0 });
        }
    );
});

router.put('/:id', authenticateToken, requireCommittee, (req, res) => {
    const { title, type, date, capacity, bookedSlots } = req.body;

    db.run(
        'UPDATE sessions SET title = ?, type = ?, date = ?, capacity = ?, bookedSlots = ? WHERE id = ?',
        [title, type, date, capacity, bookedSlots, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true });
        }
    );
});

router.get('/me/bookings', authenticateToken, (req: any, res) => {
    db.all('SELECT sessionId FROM bookings WHERE userId = ?', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows.map((r: any) => r.sessionId));
    });
});

router.post('/:id/book', authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    const sessionId = req.params.id;

    db.get('SELECT * FROM bookings WHERE userId = ? AND sessionId = ?', [userId, sessionId], (err, booking) => {
        if (booking) return res.status(400).json({ error: 'Already booked this session' });

        db.get('SELECT capacity, bookedSlots FROM sessions WHERE id = ?', [sessionId], (err, session: any) => {
            if (err || !session) return res.status(404).json({ error: 'Session not found' });
            if (session.bookedSlots >= session.capacity) return res.status(400).json({ error: 'Session is full' });

            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                db.run('INSERT INTO bookings (userId, sessionId) VALUES (?, ?)', [userId, sessionId], function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Database error on booking' });
                    }
                    db.run('UPDATE sessions SET bookedSlots = bookedSlots + 1 WHERE id = ?', [sessionId], function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Database error on update' });
                        }
                        db.run('COMMIT');
                        res.json({ success: true, bookedSlots: session.bookedSlots + 1 });
                    });
                });
            });
        });
    });
});

router.post('/:id/cancel', authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    const sessionId = req.params.id;

    db.get('SELECT * FROM bookings WHERE userId = ? AND sessionId = ?', [userId, sessionId], (err, booking) => {
        if (!booking) return res.status(400).json({ error: 'You have not booked this session' });

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run('DELETE FROM bookings WHERE userId = ? AND sessionId = ?', [userId, sessionId], function (err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Database error on cancel' });
                }
                db.run('UPDATE sessions SET bookedSlots = bookedSlots - 1 WHERE id = ?', [sessionId], function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Database error on update' });
                    }
                    db.run('COMMIT');
                    res.json({ success: true });
                });
            });
        });
    });
});

router.delete('/:id', authenticateToken, requireCommittee, (req, res) => {
    db.run('DELETE FROM sessions WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

export default router;
