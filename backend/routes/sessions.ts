import { standardDbResponse } from '../utils/response';
import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { authenticateToken, requireCommittee } from '../middleware/auth';
import { SECRET_KEY } from '../config';
import { getDefaultMembershipType, getMembershipLabel } from '../services/membership';
const router = express.Router();



/**
 * Helper to asynchronous query the database to verify if a given membership string ID is valid.
 * @param {string} membershipType - The membership ID to validate against `membership_types`.
 * @param {Function} callback - Error-first callback yielding boolean true if exists.
 */
function membershipTypeExists(membershipType: string, callback: (err: Error | null, exists: boolean) => void) {
    db.get('SELECT id FROM membership_types WHERE id = ?', [membershipType], (err, row: any) => {
        if (err) return callback(err as any, false);
        callback(null, !!row);
    });
}



/**
 * Constructs an RFC 5545 compliant iCalendar string for the user's sessions.
 * Converts database rows into discrete VEVENT blocks.
 *
 * @param {string} userId - ID of the user generating the token (used for unique payload tracking).
 * @param {any[]} sessions - Array of joined session objects from the database.
 * @returns {string} The raw string representing the `.ics` file content.
 */
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
        if (s.location) {
            icalContent += `LOCATION:${s.location}\r\n`;
        }
        icalContent += "END:VEVENT\r\n";
    });
    icalContent += "END:VCALENDAR\r\n";
    return icalContent;
}

/**
 * GET /api/sessions/
 * Retrieves all sessions. If the requestor holds committee privileges, unlisted/committee-only
 * sessions are included. Unauthenticated requests receive only public/basic visibility sessions.
 */
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

/**
 * POST /api/sessions/
 * Committee Only. Creates a new club session to be displayed on the calendar.
 * Automatically checks and maps default 'basic' membership constraints if unspecified.
 */
router.post('/', authenticateToken, requireCommittee, (req, res) => {
    const { title, type, date, capacity, location, requiredMembership, visibility, registrationVisibility } = req.body;
    const id = 'sess_' + Date.now();
    const eventVisibility = visibility === 'committee_only' ? 'committee_only' : 'all';
    const eventRegistrationVisibility = registrationVisibility === 'committee_only' ? 'committee_only' : 'all';
    getDefaultMembershipType((typeErr, defaultMembershipType) => {
        if (typeErr) return res.status(500).json({ error: 'Database error' });
        if (!defaultMembershipType) return res.status(500).json({ error: 'No membership types configured' });

        const reqMemb = requiredMembership || defaultMembershipType;
        membershipTypeExists(reqMemb, (existsErr, exists) => {
            if (existsErr) return res.status(500).json({ error: 'Database error' });
            if (!exists) return res.status(400).json({ error: 'Invalid required membership type' });

            db.run(
                'INSERT INTO sessions (id, type, title, date, capacity, bookedSlots, location, requiredMembership, visibility, registrationVisibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, type, title, date, capacity, 0, location || null, reqMemb, eventVisibility, eventRegistrationVisibility],
                function (err) {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    res.json({
                        id,
                        type,
                        title,
                        date,
                        capacity,
                        bookedSlots: 0,
                        location: location || undefined,
                        requiredMembership: reqMemb,
                        visibility: eventVisibility,
                        registrationVisibility: eventRegistrationVisibility
                    });
                }
            );
        });
    });
});

router.put('/:id', authenticateToken, requireCommittee, (req, res) => {
    const { title, type, date, capacity, bookedSlots, location, requiredMembership, visibility, registrationVisibility } = req.body;
    const eventVisibility = visibility === 'committee_only' ? 'committee_only' : 'all';
    const eventRegistrationVisibility = registrationVisibility === 'committee_only' ? 'committee_only' : 'all';
    getDefaultMembershipType((typeErr, defaultMembershipType) => {
        if (typeErr) return res.status(500).json({ error: 'Database error' });
        if (!defaultMembershipType) return res.status(500).json({ error: 'No membership types configured' });

        const reqMemb = requiredMembership || defaultMembershipType;
        membershipTypeExists(reqMemb, (existsErr, exists) => {
            if (existsErr) return res.status(500).json({ error: 'Database error' });
            if (!exists) return res.status(400).json({ error: 'Invalid required membership type' });

            db.run(
                'UPDATE sessions SET title = ?, type = ?, date = ?, capacity = ?, bookedSlots = ?, location = ?, requiredMembership = ?, visibility = ?, registrationVisibility = ? WHERE id = ?',
                [title, type, date, capacity, bookedSlots, location || null, reqMemb, eventVisibility, eventRegistrationVisibility, req.params.id],
                standardDbResponse(res)
            );
        });
    });
});

router.get('/me/bookings', authenticateToken, (req: any, res) => {
    db.all('SELECT sessionId FROM bookings WHERE userId = ?', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows.map((r: any) => r.sessionId));
    });
});

/**
 * POST /api/sessions/:id/book
 * Authenticated Endpoint. Allows a user to enroll in a climbing session if:
 * 1. The session is not full (capacity check).
 * 2. The session date is in the future.
 * 3. The user holds the required active `membershipType` (or is a committee admin bypassing).
 * Uses SQLite `BEGIN TRANSACTION` to prevent race conditions on capacity counters.
 */
router.post('/:id/book', authenticateToken, (req: any, res) => {
    const userId = req.user.id;
    const sessionId = req.params.id;

    db.get('SELECT * FROM bookings WHERE userId = ? AND sessionId = ?', [userId, sessionId], (err, booking) => {
        if (booking) return res.status(400).json({ error: 'Already booked this session' });

        db.get('SELECT capacity, bookedSlots, requiredMembership, visibility, registrationVisibility, date FROM sessions WHERE id = ?', [sessionId], (err, session: any) => {
            if (err || !session) return res.status(404).json({ error: 'Session not found' });

            const sessionDate = new Date(session.date);
            if (sessionDate < new Date()) {
                return res.status(400).json({ error: 'Cannot book a past session.' });
            }

            if (session.bookedSlots >= session.capacity) return res.status(400).json({ error: 'Session is full' });

            const isCommittee = req.user.role === 'committee'
                || !!req.user.committeeRole
                || (Array.isArray(req.user.committeeRoles) && req.user.committeeRoles.length > 0);
            const registrationIsCommitteeOnly = (session.registrationVisibility || 'all') === 'committee_only';
            if (registrationIsCommitteeOnly && !isCommittee) {
                return res.status(403).json({ error: 'Registration for this session is for committee members only.' });
            }

            const reqMemb = session.requiredMembership || 'basic';

            db.get('SELECT * FROM user_memberships WHERE userId = ? AND membershipType = ? AND status = "active"', [userId, reqMemb], (err2, userMemb) => {
                if (err2) return res.status(500).json({ error: 'Database error checking membership' });
                // Enforce requirement unless they are root admin testing it
                if (!registrationIsCommitteeOnly && !userMemb && req.user.email !== 'committee@sheffieldclimbing.org') {
                    return getMembershipLabel(reqMemb, (typeLabel) => {
                        return res.status(403).json({ error: `This session requires an active ${typeLabel} membership.` });
                    });
                }

                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');
                    db.run('INSERT INTO bookings (userId, sessionId) VALUES (?, ?)', [userId, sessionId], function (err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Database error on booking' });
                        }
                        db.run('UPDATE sessions SET bookedSlots = bookedSlots + 1 WHERE id = ? AND bookedSlots < capacity', [sessionId], function (err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: 'Database error on update' });
                            }
                            if (this.changes === 0) {
                                db.run('ROLLBACK');
                                return res.status(400).json({ error: 'Session is full' });
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

/**
 * POST /api/sessions/:id/cancel
 * Authenticated Endpoint. Removes a user's booking from a session, decrementing the
 * capacity counter safely via a database transaction.
 */
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
                if (this.changes === 0) {
                    db.run('ROLLBACK');
                    return res.status(400).json({ error: 'You have not booked this session' });
                }
                db.run('UPDATE sessions SET bookedSlots = bookedSlots - 1 WHERE id = ? AND bookedSlots > 0', [sessionId], function (err) {
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

router.get('/:id/attendees', authenticateToken, requireCommittee, (req, res) => {
    db.all(`
        SELECT u.id, u.firstName, u.lastName, u.name, u.email, u.registrationNumber 
        FROM users u
        JOIN bookings b ON u.id = b.userId
        WHERE b.sessionId = ?
    `, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

router.delete('/:id/attendees/:userId', authenticateToken, requireCommittee, (req, res) => {
    const sessionId = req.params.id;
    const userId = req.params.userId;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('DELETE FROM bookings WHERE userId = ? AND sessionId = ?', [userId, sessionId], function (err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Database error' });
            }
            if (this.changes === 0) {
                db.run('ROLLBACK');
                return res.status(404).json({ error: 'Booking not found' });
            }
            db.run('UPDATE sessions SET bookedSlots = bookedSlots - 1 WHERE id = ? AND bookedSlots > 0', [sessionId], function (err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Database error' });
                }
                db.run('COMMIT');
                res.json({ success: true });
            });
        });
    });
});

router.delete('/:id', authenticateToken, requireCommittee, (req, res) => {
    db.run('DELETE FROM sessions WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (this.changes === 0) return res.status(404).json({ error: 'Session not found' });
        res.json({ success: true });
    });
});

export default router;
