import jwt from 'jsonwebtoken';
import { SECRET_KEY } from '../config';
import { db } from '../db';

// Middleware to verify JWT
export const authenticateToken = (req: any, res: any, next: any) => {
    // Get token from cookies, fallback to Authorization header
    let token = req.cookies?.uscc_token;
    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.split(' ')[1];
    }

    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err: any, user: any) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

export const requireCommittee = (req: any, res: any, next: any) => {
    if (req.user.role !== 'committee') return res.status(403).json({ error: 'Requires committee privileges' });
    next();
};

export const requireKitSec = (req: any, res: any, next: any) => {
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
