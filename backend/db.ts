import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcrypt';

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
