import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.NODE_ENV === 'test'
    ? ':memory:'
    : (process.env.NODE_ENV === 'production' ? '/data/uscc.db' : join(__dirname, 'uscc.db'));
export const db = new sqlite3.Database(dbPath, (err) => {
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
            firstName TEXT,
            lastName TEXT,
            name TEXT, -- Keep for backward compatibility during migration
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
            membershipYear TEXT,
            calendarToken TEXT UNIQUE,
            emailVerified INTEGER DEFAULT 0
        )`);

        // Email Verifications Table (OTP storage)
        db.run(`CREATE TABLE IF NOT EXISTS email_verifications (
            userId TEXT NOT NULL,
            code TEXT NOT NULL,
            expiresAt INTEGER NOT NULL,
            PRIMARY KEY (userId)
        )`);

        // Password Reset Tokens Table
        db.run(`CREATE TABLE IF NOT EXISTS password_resets (
            token TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            expiresAt INTEGER NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id)
        )`);

        // User Memberships Table (many-to-many: one user can hold multiple membership types)
        db.run(`CREATE TABLE IF NOT EXISTS user_memberships (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            membershipType TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            membershipYear TEXT NOT NULL,
            UNIQUE (userId, membershipType, membershipYear),
            FOREIGN KEY (userId) REFERENCES users(id)
        )`);

        // Migration: add unique index to existing DBs and deduplicate rows first
        // (keep the row with the highest-priority status: active > pending > rejected)
        db.run(`
            DELETE FROM user_memberships
            WHERE id NOT IN (
                SELECT id FROM user_memberships AS um1
                WHERE id = (
                    SELECT id FROM user_memberships AS um2
                    WHERE um2.userId = um1.userId
                      AND um2.membershipType = um1.membershipType
                      AND um2.membershipYear = um1.membershipYear
                    ORDER BY
                        CASE status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END ASC,
                        rowid DESC
                    LIMIT 1
                )
            )
        `, (err) => {
            // Create unique index after deduplication (safe to run even if already exists)
            db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_memberships_unique
                ON user_memberships (userId, membershipType, membershipYear)`);
        });

        // Migrations: add new fields if updating existing DB
        db.run('ALTER TABLE users ADD COLUMN firstName TEXT', (err) => {
            if (!err) {
                // If we successfully added firstName, also try adding lastName and migrating data
                db.run('ALTER TABLE users ADD COLUMN lastName TEXT', (err2) => {
                    db.all('SELECT id, name FROM users WHERE (firstName IS NULL OR firstName = "") AND name IS NOT NULL', [], (err3, rows) => {
                        if (!err3 && rows && rows.length > 0) {
                            const stmt = db.prepare('UPDATE users SET firstName = ?, lastName = ? WHERE id = ?');
                            rows.forEach((row: any) => {
                                const parts = (row.name || '').trim().split(' ');
                                const f = parts[0] || '';
                                const l = parts.slice(1).join(' ') || '';
                                stmt.run([f, l, row.id]);
                            });
                            stmt.finalize();
                        }
                    });
                });
            }
        });
        db.run('ALTER TABLE users ADD COLUMN lastName TEXT', (err) => { });
        db.run('ALTER TABLE users ADD COLUMN emergencyContactName TEXT', (err) => { });
        db.run('ALTER TABLE users ADD COLUMN emergencyContactMobile TEXT', (err) => { });
        db.run('ALTER TABLE users ADD COLUMN pronouns TEXT', (err) => { });
        db.run('ALTER TABLE users ADD COLUMN dietaryRequirements TEXT', (err) => { });
        db.run('ALTER TABLE users ADD COLUMN committeeRole TEXT', (err) => { });
        db.run('ALTER TABLE users ADD COLUMN membershipYear TEXT', (err) => { });
        db.run('ALTER TABLE users ADD COLUMN emailVerified INTEGER DEFAULT 0', (err) => { });
        db.run('ALTER TABLE users ADD COLUMN calendarToken TEXT', (err) => {
            // If the column was just added, populate existing users with tokens
            if (!err) {
                db.all('SELECT id FROM users WHERE calendarToken IS NULL', [], (err, rows) => {
                    if (!err && rows) {
                        const stmt = db.prepare('UPDATE users SET calendarToken = ? WHERE id = ?');
                        rows.forEach((row: any) => stmt.run([crypto.randomUUID(), row.id]));
                        stmt.finalize();
                    }
                });
            }
        });

        // Sessions Table
        db.run(`CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            date TEXT NOT NULL,
            capacity INTEGER NOT NULL,
            bookedSlots INTEGER DEFAULT 0,
            requiredMembership TEXT DEFAULT 'basic'
        )`);

        db.run('ALTER TABLE sessions ADD COLUMN requiredMembership TEXT DEFAULT "basic"', (err) => { });

        // Bookings Table
        db.run(`CREATE TABLE IF NOT EXISTS bookings (
            userId TEXT NOT NULL,
            sessionId TEXT NOT NULL,
            PRIMARY KEY (userId, sessionId),
            FOREIGN KEY (userId) REFERENCES users(id),
            FOREIGN KEY (sessionId) REFERENCES sessions(id)
        )`);

        // Committee Roles Table (many-to-many: one user can hold multiple committee roles)
        db.run(`CREATE TABLE IF NOT EXISTS committee_roles (
            userId TEXT NOT NULL,
            role   TEXT NOT NULL,
            PRIMARY KEY (userId, role),
            FOREIGN KEY (userId) REFERENCES users(id)
        )`);

        // Migration: seed committee_roles from legacy committeeRole column
        db.run(`INSERT OR IGNORE INTO committee_roles (userId, role)
            SELECT id, committeeRole FROM users
            WHERE committeeRole IS NOT NULL AND committeeRole != ''`);

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

        // Referendums Table
        db.run(`CREATE TABLE IF NOT EXISTS referendums (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            createdAt INTEGER NOT NULL
        )`);

        // Referendum Votes Table
        db.run(`CREATE TABLE IF NOT EXISTS referendum_votes (
            userId TEXT NOT NULL,
            referendumId TEXT NOT NULL,
            choice TEXT NOT NULL, -- 'yes', 'no', 'abstain'
            PRIMARY KEY (userId, referendumId),
            FOREIGN KEY (userId) REFERENCES users(id),
            FOREIGN KEY (referendumId) REFERENCES referendums(id)
        )`);

        // Gear Table
        db.run(`CREATE TABLE IF NOT EXISTS gear (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            totalQuantity INTEGER NOT NULL DEFAULT 1,
            availableQuantity INTEGER NOT NULL DEFAULT 1
        )`);

        // Gear Requests Table
        db.run(`CREATE TABLE IF NOT EXISTS gear_requests (
            id TEXT PRIMARY KEY,
            userId TEXT NOT NULL,
            gearId TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            requestDate TEXT NOT NULL,
            returnDate TEXT,
            FOREIGN KEY (userId) REFERENCES users(id),
            FOREIGN KEY (gearId) REFERENCES gear(id)
        )`);

        // Create root admin if not exists
        db.get('SELECT id, membershipYear FROM users WHERE email = ?', ['sheffieldclimbing@gmail.com'], async (err, row: any) => {
            if (!row) {
                const rootHash = await bcrypt.hash('SuperSecret123!', 10);
                const currentYear = new Date().getFullYear();
                const currentMonth = new Date().getMonth();
                const membershipYear = currentMonth < 8 ? `${currentYear - 1}/${currentYear}` : `${currentYear}/${currentYear + 1}`;

                db.run(
                    'INSERT INTO users (id, firstName, lastName, name, email, passwordHash, role, membershipStatus, membershipYear, calendarToken, emailVerified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    ['user_root', 'Root', 'Admin', 'Root Admin', 'sheffieldclimbing@gmail.com', rootHash, 'committee', 'active', membershipYear, crypto.randomUUID(), 1],
                    () => {
                        // Insert the active basic membership row for the root admin
                        db.run(
                            'INSERT OR IGNORE INTO user_memberships (id, userId, membershipType, status, membershipYear) VALUES (?, ?, ?, ?, ?)',
                            ['umem_root', 'user_root', 'basic', 'active', membershipYear]
                        );
                    }
                );
                console.log('Root admin created.');
            } else {
                // Ensure existing root admin is always marked as active + verified
                db.run('UPDATE users SET emailVerified = 1, membershipStatus = ? WHERE email = ?', ['active', 'sheffieldclimbing@gmail.com']);
                // Upgrade any existing basic memberships to active (avoids pending+active duplicates)
                db.run(
                    'UPDATE user_memberships SET status = ? WHERE userId = ? AND membershipType = ?',
                    ['active', 'user_root', 'basic'],
                    function (this: any) {
                        // If no rows were updated, insert a fresh active row
                        if (this.changes === 0) {
                            const currentYear = new Date().getFullYear();
                            const currentMonth = new Date().getMonth();
                            const membershipYear = currentMonth < 8 ? `${currentYear - 1}/${currentYear}` : `${currentYear}/${currentYear + 1}`;
                            db.run(
                                'INSERT OR IGNORE INTO user_memberships (id, userId, membershipType, status, membershipYear) VALUES (?, ?, ?, ?, ?)',
                                ['umem_root', 'user_root', 'basic', 'active', row.membershipYear || membershipYear]
                            );
                        }
                    }
                );
            }
        });

        // Seed default config
        db.get('SELECT value FROM config WHERE key = ?', ['electionsOpen'], (err, row) => {
            if (!row) {
                db.run('INSERT INTO config (key, value) VALUES (?, ?)', ['electionsOpen', 'false']);
            }
        });

        // Session Types Table
        db.run(`CREATE TABLE IF NOT EXISTS session_types (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL
        )`);

        // Seed default session types if table is empty
        db.get('SELECT COUNT(*) as count FROM session_types', (err, row: any) => {
            if (row && row.count === 0) {
                console.log("Seeding default session types...");
                const defaultTypes = [
                    ['Competition', 'Competition'],
                    ['Social', 'Social'],
                    ['Training Session (Bouldering)', 'Training Session (Bouldering)'],
                    ['Training Session (Roped)', 'Training Session (Roped)'],
                    ['Meeting', 'Meeting']
                ];
                const stmt = db.prepare('INSERT INTO session_types (id, label) VALUES (?, ?)');
                defaultTypes.forEach(t => stmt.run(t));
                stmt.finalize();
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
                    ['sess_1', 'Squad', 'Advanced Lead Training', `${currentYear}-${pad(currentMonth)}-14T19:00:00`, 15, 15, 'comp_team'],
                    ['sess_2', 'Social', 'Friday Night Bouldering', `${currentYear}-${pad(currentMonth)}-16T18:00:00`, 40, 28, 'basic'],
                    ['sess_3', 'Rope', 'Beginner Top Rope', `${currentYear}-${pad(currentMonth)}-18T14:00:00`, 12, 12, 'basic'],
                    ['sess_4', 'Squad', 'NUBS Prep Simulator', `${currentYear}-${pad(currentMonth)}-21T17:30:00`, 20, 18, 'comp_team'],
                    ['sess_5', 'Social', 'Pub + Board Games', `${currentYear}-${pad(currentMonth)}-23T20:00:00`, 50, 45, 'basic'],
                    ['sess_6', 'Rope', 'Lead Belay Course', `${currentYear}-${pad(currentMonth)}-25T13:00:00`, 8, 4, 'basic']
                ];

                const stmt = db.prepare('INSERT INTO sessions (id, type, title, date, capacity, bookedSlots, requiredMembership) VALUES (?, ?, ?, ?, ?, ?, ?)');
                defaultSessions.forEach(s => stmt.run(s));
                stmt.finalize();
            }
        });

        // Seed default gear if table is empty
        db.get('SELECT COUNT(*) as count FROM gear', (err, row: any) => {
            if (row && row.count === 0) {
                console.log("Seeding default gear...");
                const defaultGear = [
                    ['gear_1', 'Petzl Corax Harness (Size M)', 'Versatile and easy to use harness', 5, 5],
                    ['gear_2', 'Black Diamond Momentum Harness (Size L)', 'Comfortable all-around harness', 3, 3],
                    ['gear_3', 'Petzl Boreo Helmet', 'Durable helmet for all climbing styles', 10, 10],
                    ['gear_4', 'DMM Bug Belay Device', 'Classic ATC style belay device with carabiner', 8, 8]
                ];

                const stmt = db.prepare('INSERT INTO gear (id, name, description, totalQuantity, availableQuantity) VALUES (?, ?, ?, ?, ?)');
                defaultGear.forEach(g => stmt.run(g));
                stmt.finalize();
            }
        });
    });
}
