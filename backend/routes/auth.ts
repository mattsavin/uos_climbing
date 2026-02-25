import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { SECRET_KEY } from '../config';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/register', async (req, res) => {
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

router.post('/login', (req, res) => {
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

router.get('/me', authenticateToken, (req: any, res) => {
    db.get('SELECT id, name, email, registrationNumber, role, committeeRole, membershipStatus, membershipYear, emergencyContactName, emergencyContactMobile, pronouns, dietaryRequirements FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    });
});

export default router;
