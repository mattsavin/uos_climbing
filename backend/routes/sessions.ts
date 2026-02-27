import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { authenticateToken, requireCommittee } from '../middleware/auth';
import { SECRET_KEY } from '../config';

const router = express.Router();

function buildIcalContent(userId: string, sessions: any[]) {
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
    return icalContent;
}

router.get('/', (req, res) => {
    // Optional auth: public users can list sessions, but committee-only sessions
    // are only visible to committee users.
    let token: string | undefined = (req as any).cookies?.uscc_token;
    if (!token) {
        const authHeader = req.headers['authorization'];
        if (typeof authHeader === 'string') {
            token = authHeader.split(' ')[1];
        }
    }

    let isCommittee = false;
    if (token) {
        try {
            const user: any = jwt.verify(token, SECRET_KEY);
            isCommittee = user.role === 'committee'
                || !!user.committeeRole
                || (Array.isArray(user.committeeRoles) && user.committeeRoles.length > 0);
        } catch {
            isCommittee = false;
        }
    }

    const sql = isCommittee
        ? 'SELECT * FROM sessions ORDER BY date ASC'
        : 'SELECT * FROM sessions WHERE COALESCE(visibility, "all") != "committee_only" ORDER BY date ASC';

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

router.get('/ical/:calendarToken', (req, res) => {
    const calendarToken = req.params.calendarToken;
    db.get('SELECT id FROM users WHERE calendarToken = ?', [calendarToken], (err, user: any) => {
        if (err || !user) return res.status(404).send("User not found");
        const userId = user.id;

        db.all(`
            SELECT s.* FROM sessions s
            JOIN bookings b ON s.id = b.sessionId
            WHERE b.userId = ?
            ORDER BY s.date ASC
        `, [userId], (err2, sessions) => {
            if (err2) return res.status(500).send("Database error");

            const icalContent = buildIcalContent(userId, sessions);
            res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="uscc_schedule_booked.ics"`);
            res.send(icalContent);
        });
    });
});

router.get('/ical/:calendarToken/all', (req, res) => {
    const calendarToken = req.params.calendarToken;
    db.get('SELECT id, role, committeeRole FROM users WHERE calendarToken = ?', [calendarToken], (err, user: any) => {
        if (err || !user) return res.status(404).send("User not found");
        const userId = user.id;

        db.all('SELECT role FROM committee_roles WHERE userId = ?', [userId], (rolesErr, roles: any[]) => {
            if (rolesErr) return res.status(500).send("Database error");

            const isCommittee = user.role === 'committee'
                || !!user.committeeRole
                || (Array.isArray(roles) && roles.length > 0);

            const sql = isCommittee
                ? 'SELECT * FROM sessions ORDER BY date ASC'
                : 'SELECT * FROM sessions WHERE COALESCE(visibility, "all") != "committee_only" ORDER BY date ASC';

            db.all(sql, [], (err2, sessions) => {
                if (err2) return res.status(500).send("Database error");
                const icalContent = buildIcalContent(userId, sessions);
                res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="uscc_schedule_all.ics"`);
                res.send(icalContent);
            });
        });
    });
});

router.post('/', authenticateToken, requireCommittee, (req, res) => {
    const { title, type, date, capacity, requiredMembership, visibility } = req.body;
    const id = 'sess_' + Date.now();
    const reqMemb = requiredMembership || 'basic';
    const eventVisibility = visibility === 'committee_only' ? 'committee_only' : 'all';

    db.run(
        'INSERT INTO sessions (id, type, title, date, capacity, bookedSlots, requiredMembership, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, type, title, date, capacity, 0, reqMemb, eventVisibility],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ id, type, title, date, capacity, bookedSlots: 0, requiredMembership: reqMemb, visibility: eventVisibility });
        }
    );
});

router.put('/:id', authenticateToken, requireCommittee, (req, res) => {
    const { title, type, date, capacity, bookedSlots, requiredMembership, visibility } = req.body;
    const reqMemb = requiredMembership || 'basic';
    const eventVisibility = visibility === 'committee_only' ? 'committee_only' : 'all';

    db.run(
        'UPDATE sessions SET title = ?, type = ?, date = ?, capacity = ?, bookedSlots = ?, requiredMembership = ?, visibility = ? WHERE id = ?',
        [title, type, date, capacity, bookedSlots, reqMemb, eventVisibility, req.params.id],
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

        db.get('SELECT capacity, bookedSlots, requiredMembership, visibility FROM sessions WHERE id = ?', [sessionId], (err, session: any) => {
            if (err || !session) return res.status(404).json({ error: 'Session not found' });
            if (session.bookedSlots >= session.capacity) return res.status(400).json({ error: 'Session is full' });

            const isCommittee = req.user.role === 'committee'
                || !!req.user.committeeRole
                || (Array.isArray(req.user.committeeRoles) && req.user.committeeRoles.length > 0);
            const isCommitteeOnly = (session.visibility || 'all') === 'committee_only';
            if (isCommitteeOnly && !isCommittee) {
                return res.status(403).json({ error: 'This session is for committee members only.' });
            }

            const reqMemb = session.requiredMembership || 'basic';

            db.get('SELECT * FROM user_memberships WHERE userId = ? AND membershipType = ? AND status = "active"', [userId, reqMemb], (err2, userMemb) => {
                if (err2) return res.status(500).json({ error: 'Database error checking membership' });
                // Enforce requirement unless they are root admin testing it
                if (!isCommitteeOnly && !userMemb && req.user.email !== 'sheffieldclimbing@gmail.com') {
                    const typeLabel = { basic: 'Basic', bouldering: 'Bouldering', comp_team: 'Comp Team' }[reqMemb] || reqMemb;
                    return res.status(403).json({ error: `This session requires an active ${typeLabel} membership.` });
                }

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
