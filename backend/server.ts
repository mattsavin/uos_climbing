import express from 'express';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'uscc-super-secret-key-2026';

app.use(cors());
app.use(express.json());

// Initialize SQLite DB
const dbPath = join(__dirname, 'uscc.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            passwordHash TEXT NOT NULL,
            registrationNumber TEXT,
            emergencyContactName TEXT,
            emergencyContactMobile TEXT,
            pronouns TEXT,
            dietaryRequirements TEXT,
            role TEXT DEFAULT 'member',
            committeeRole TEXT,
            membershipStatus TEXT DEFAULT 'pending',
            membershipYear TEXT
        )`);

        // Migrations: add new fields if updating existing DB
        db.run('ALTER TABLE users ADD COLUMN emergencyContactName TEXT', (err) => { });
        db.run('ALTER TABLE users ADD COLUMN emergencyContactMobile TEXT', (err) => { });
        db.run('ALTER TABLE users ADD COLUMN pronouns TEXT', (err) => { });
        db.run('ALTER TABLE users ADD COLUMN dietaryRequirements TEXT', (err) => { });
        db.run('ALTER TABLE users ADD COLUMN committeeRole TEXT', (err) => { });
        db.run('ALTER TABLE users ADD COLUMN membershipYear TEXT', (err) => { });

        // Sessions Table
        db.run(`CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            date TEXT NOT NULL,
            capacity INTEGER NOT NULL,
            bookedSlots INTEGER DEFAULT 0
        )`);

        // Bookings Table
        db.run(`CREATE TABLE IF NOT EXISTS bookings (
            userId TEXT NOT NULL,
            sessionId TEXT NOT NULL,
            PRIMARY KEY (userId, sessionId),
            FOREIGN KEY (userId) REFERENCES users(id),
            FOREIGN KEY (sessionId) REFERENCES sessions(id)
        )`);

        // Candidates Table
        db.run(`CREATE TABLE IF NOT EXISTS candidates (
            userId TEXT PRIMARY KEY,
            manifesto TEXT NOT NULL,
            role TEXT NOT NULL,
            presentationLink TEXT,
            FOREIGN KEY (userId) REFERENCES users(id)
        )`);

        db.run('ALTER TABLE candidates ADD COLUMN role TEXT', (err) => { });
        db.run('ALTER TABLE candidates ADD COLUMN presentationLink TEXT', (err) => { });

        // System Config Table (for Elections open/close, etc.)
        db.run(`CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )`);

        // Votes Table
        db.run(`CREATE TABLE IF NOT EXISTS votes (
            userId TEXT PRIMARY KEY,
            candidateId TEXT NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id),
            FOREIGN KEY (candidateId) REFERENCES users(id)
        )`);

        // Create root admin if not exists
        db.get('SELECT id FROM users WHERE email = ?', ['sheffieldclimbing@gmail.com'], async (err, row) => {
            if (!row) {
                const rootHash = await bcrypt.hash('SuperSecret123!', 10);
                const currentYear = new Date().getFullYear();
                const currentMonth = new Date().getMonth();
                const membershipYear = currentMonth < 8 ? `${currentYear - 1}/${currentYear}` : `${currentYear}/${currentYear + 1}`;

                db.run(
                    'INSERT INTO users (id, name, email, passwordHash, role, membershipStatus, membershipYear) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    ['user_root', 'Root Admin', 'sheffieldclimbing@gmail.com', rootHash, 'committee', 'active', membershipYear]
                );
                console.log('Root admin created.');
            }
        });

        // Seed default config
        db.get('SELECT value FROM config WHERE key = ?', ['electionsOpen'], (err, row) => {
            if (!row) {
                db.run('INSERT INTO config (key, value) VALUES (?, ?)', ['electionsOpen', 'false']);
            }
        });

        // Seed default sessions if table is empty
        db.get('SELECT COUNT(*) as count FROM sessions', (err, row: any) => {
            if (row && row.count === 0) {
                console.log("Seeding default sessions...");
                const currentYear = new Date().getFullYear();
                const currentMonth = new Date().getMonth() + 1;
                const pad = (n: number) => n.toString().padStart(2, '0');

                const defaultSessions = [
                    ['sess_1', 'Squad', 'Advanced Lead Training', `${currentYear}-${pad(currentMonth)}-14T19:00:00`, 15, 15],
                    ['sess_2', 'Social', 'Friday Night Bouldering', `${currentYear}-${pad(currentMonth)}-16T18:00:00`, 40, 28],
                    ['sess_3', 'Rope', 'Beginner Top Rope', `${currentYear}-${pad(currentMonth)}-18T14:00:00`, 12, 12],
                    ['sess_4', 'Squad', 'NUBS Prep Simulator', `${currentYear}-${pad(currentMonth)}-21T17:30:00`, 20, 18],
                    ['sess_5', 'Social', 'Pub + Board Games', `${currentYear}-${pad(currentMonth)}-23T20:00:00`, 50, 45],
                    ['sess_6', 'Rope', 'Lead Belay Course', `${currentYear}-${pad(currentMonth)}-25T13:00:00`, 8, 4]
                ];

                const stmt = db.prepare('INSERT INTO sessions (id, type, title, date, capacity, bookedSlots) VALUES (?, ?, ?, ?, ?, ?)');
                defaultSessions.forEach(s => stmt.run(s));
                stmt.finalize();
            }
        });
    });
}

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err: any, user: any) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const requireCommittee = (req: any, res: any, next: any) => {
    if (req.user.role !== 'committee') return res.status(403).json({ error: 'Requires committee privileges' });
    next();
};

const requireKitSec = (req: any, res: any, next: any) => {
    // We fetch user from db to get their committeeRole
    db.get('SELECT committeeRole, email FROM users WHERE id = ?', [req.user.id], (err, user: any) => {
        if (err || !user) return res.status(403).json({ error: 'Unauthorized' });

        // Root admin or Kit & Safety Sec can pass
        if (user.email === 'sheffieldclimbing@gmail.com' || user.committeeRole === 'Kit & Safety Sec') {
            next();
        } else {
            return res.status(403).json({ error: 'Requires Kit & Safety Sec privileges' });
        }
    });
};

// --- AUTH ROUTES ---

app.post('/api/auth/register', async (req, res) => {
    const { name, email, registrationNumber, password } = req.body;

    if (!name || !email || !password || !registrationNumber) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const id = 'user_' + Date.now() + Math.random().toString(36).substr(2, 5);

        let role = 'member';
        let membershipStatus = 'pending';
        if (email.endsWith('@committee.sheffield.ac.uk') || email === 'sheffieldclimbing@gmail.com') {
            role = 'committee';
            membershipStatus = 'active';
        }

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const membershipYear = currentMonth < 8 ? `${currentYear - 1}/${currentYear}` : `${currentYear}/${currentYear + 1}`;

        db.run(
            'INSERT INTO users (id, name, email, passwordHash, registrationNumber, role, membershipStatus, membershipYear) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, name, email, passwordHash, registrationNumber, role, membershipStatus, membershipYear],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Email already exists' });
                    }
                    return res.status(500).json({ error: 'Database error' });
                }

                const user = { id, name, email, registrationNumber, role, committeeRole: null, membershipStatus, membershipYear };
                const token = jwt.sign(user, SECRET_KEY, { expiresIn: '24h' });
                res.json({ token, user });
            }
        );
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user: any) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) return res.status(401).json({ error: 'Invalid email or password' });

        // Don't send hash back
        const { passwordHash, ...userWithoutPassword } = user;
        const token = jwt.sign(userWithoutPassword, SECRET_KEY, { expiresIn: '24h' });

        res.json({ token, user: userWithoutPassword });
    });
});

app.get('/api/auth/me', authenticateToken, (req: any, res) => {
    db.get('SELECT id, name, email, registrationNumber, role, committeeRole, membershipStatus, membershipYear, emergencyContactName, emergencyContactMobile, pronouns, dietaryRequirements FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    });
});

app.post('/api/users/me/membership-renewal', authenticateToken, (req: any, res) => {
    const { membershipYear } = req.body;
    if (!membershipYear) return res.status(400).json({ error: 'Missing membership year' });

    db.run('UPDATE users SET membershipYear = ?, membershipStatus = ? WHERE id = ?', [membershipYear, 'pending', req.user.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, membershipYear, membershipStatus: 'pending' });
    });
});

app.put('/api/users/:id', authenticateToken, (req: any, res) => {
    if (req.user.id !== req.params.id && req.user.role !== 'committee') {
        return res.status(403).json({ error: 'Unauthorized to update this user' });
    }

    const { name, emergencyContactName, emergencyContactMobile, pronouns, dietaryRequirements } = req.body;
    db.run(
        'UPDATE users SET name = ?, emergencyContactName = ?, emergencyContactMobile = ?, pronouns = ?, dietaryRequirements = ? WHERE id = ?',
        [name, emergencyContactName, emergencyContactMobile, pronouns, dietaryRequirements, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true });
        }
    );
});

app.put('/api/users/me/password', authenticateToken, (req: any, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    db.get('SELECT passwordHash FROM users WHERE id = ?', [req.user.id], async (err, user: any) => {
        if (err || !user) return res.status(500).json({ error: 'Database error' });

        const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!validPassword) return res.status(401).json({ error: 'Current password is incorrect' });

        const newHash = await bcrypt.hash(newPassword, 10);
        db.run('UPDATE users SET passwordHash = ? WHERE id = ?', [newHash, req.user.id], function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true });
        });
    });
});

app.delete('/api/users/:id', authenticateToken, (req: any, res) => {
    const targetUserId = req.params.id;
    const isSelf = req.user.id.toString() === targetUserId.toString();
    const isCommittee = req.user.role === 'committee';

    if (!isSelf && !isCommittee) {
        return res.status(403).json({ error: 'Unauthorized to delete this user' });
    }

    if (!isSelf && isCommittee) {
        db.get('SELECT role FROM users WHERE id = ?', [targetUserId], (err, targetUser: any) => {
            if (err || !targetUser) return res.status(500).json({ error: 'User not found or database error' });
            if (targetUser.role === 'committee') {
                return res.status(403).json({ error: 'Cannot delete another committee member' });
            }
            performUserDelete(targetUserId, res);
        });
    } else {
        performUserDelete(targetUserId, res);
    }
});

function performUserDelete(userId: string, res: any) {
    db.run('DELETE FROM sessions_bookings WHERE userId = ?', [userId], () => {
        db.run('DELETE FROM votes WHERE userId = ?', [userId], () => {
            db.run('DELETE FROM candidates WHERE userId = ?', [userId], () => {
                db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    res.json({ success: true });
                });
            });
        });
    });
}

// --- ADMIN USERS ROUTES ---

app.get('/api/admin/config/elections', authenticateToken, requireCommittee, (req, res) => {
    db.get('SELECT value FROM config WHERE key = ?', ['electionsOpen'], (err, row: any) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ electionsOpen: row?.value === 'true' });
    });
});

app.post('/api/admin/config/elections', authenticateToken, requireCommittee, (req, res) => {
    const { open } = req.body;
    db.run('UPDATE config SET value = ? WHERE key = ?', [open ? 'true' : 'false', 'electionsOpen'], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, electionsOpen: open });
    });
});

app.get('/api/admin/users', authenticateToken, requireCommittee, (req, res) => {
    db.all('SELECT id, name, email, registrationNumber, role, committeeRole, membershipStatus, membershipYear, emergencyContactName, emergencyContactMobile, pronouns, dietaryRequirements FROM users', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.post('/api/admin/users/:id/approve', authenticateToken, requireCommittee, (req, res) => {
    db.run('UPDATE users SET membershipStatus = ? WHERE id = ?', ['active', req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

app.post('/api/admin/users/:id/reject', authenticateToken, requireCommittee, (req, res) => {
    db.run('UPDATE users SET membershipStatus = ? WHERE id = ?', ['rejected', req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

app.post('/api/admin/users/:id/promote', authenticateToken, requireCommittee, (req, res) => {
    db.run('UPDATE users SET role = ? WHERE id = ?', ['committee', req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

app.post('/api/admin/users/:id/demote', authenticateToken, requireCommittee, (req: any, res) => {
    // Only root admin can demote
    if (req.user.email !== 'sheffieldclimbing@gmail.com') {
        return res.status(403).json({ error: 'Only Root Admin can perform this action' });
    }

    // Cannot demote root admin
    db.get('SELECT email FROM users WHERE id = ?', [req.params.id], (err, user: any) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (user && user.email === 'sheffieldclimbing@gmail.com') {
            return res.status(403).json({ error: 'Cannot demote the Root Admin' });
        }

        db.run('UPDATE users SET role = ?, committeeRole = ? WHERE id = ?', ['member', null, req.params.id], function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true });
        });
    });
});

app.post('/api/admin/users/:id/committee-role', authenticateToken, requireCommittee, (req: any, res) => {
    // Only root admin or "Chair" could ideally do this, but for now we'll allow any committee
    const { committeeRole } = req.body;

    // Validate role is one of the allowed roles, or null/empty to clear
    const validRoles = [
        'Chair', 'Secretary', 'Treasurer', 'Welfare & Inclusions',
        'Team Captain', 'Social Sec', "Women's Captain",
        "Men's Captain", 'Publicity', 'Kit & Safety Sec'
    ];

    if (committeeRole && !validRoles.includes(committeeRole)) {
        return res.status(400).json({ error: 'Invalid committee role' });
    }

    db.run('UPDATE users SET committeeRole = ? WHERE id = ?', [committeeRole || null, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

// --- SESSIONS ROUTES ---

app.get('/api/sessions', (req, res) => {
    db.all('SELECT * FROM sessions ORDER BY date ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

app.get('/api/ical/:userId', (req, res) => {
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

app.post('/api/sessions', authenticateToken, requireCommittee, (req, res) => {
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

app.put('/api/sessions/:id', authenticateToken, requireCommittee, (req, res) => {
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

app.get('/api/users/me/bookings', authenticateToken, (req: any, res) => {
    db.all('SELECT sessionId FROM bookings WHERE userId = ?', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows.map((r: any) => r.sessionId));
    });
});

app.post('/api/sessions/:id/book', authenticateToken, (req: any, res) => {
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

app.post('/api/sessions/:id/cancel', authenticateToken, (req: any, res) => {
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

app.delete('/api/sessions/:id', authenticateToken, requireCommittee, (req, res) => {
    db.run('DELETE FROM sessions WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

// --- VOTING ROUTES ---

app.get('/api/voting/candidates', authenticateToken, (req, res) => {
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

app.post('/api/voting/apply', authenticateToken, (req: any, res) => {
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

app.get('/api/voting/status', authenticateToken, (req: any, res) => {
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

app.post('/api/voting/vote', authenticateToken, (req: any, res) => {
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

app.listen(PORT, () => {
    console.log(`USCC Backend API running on http://localhost:${PORT}`);
});
