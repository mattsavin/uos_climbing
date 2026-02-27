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
    const isCommitteeJWT = req.user.role === 'committee' || !!req.user.committeeRole || (Array.isArray(req.user.committeeRoles) && req.user.committeeRoles.length > 0);

    if (isCommitteeJWT) {
        return next();
    }

    // Fallback: check DB in case of stale token
    db.get('SELECT id FROM users WHERE id = ? AND (role = "committee" OR committeeRole IS NOT NULL)', [req.user.id], (err, row) => {
        if (!err && row) {
            return next();
        }

        // Secondary fallback: check committee_roles junction table
        db.get('SELECT userId FROM committee_roles WHERE userId = ? LIMIT 1', [req.user.id], (err2, row2) => {
            if (!err2 && row2) {
                return next();
            }
            res.status(403).json({ error: 'Requires committee privileges' });
        });
    });
};

export const requireKitSec = (req: any, res: any, next: any) => {
    // We fetch user from db to get their committeeRole
    db.get('SELECT committeeRole, email FROM users WHERE id = ?', [req.user.id], (err, user: any) => {
        if (err || !user) return res.status(403).json({ error: 'Unauthorized' });

        // Root admin or Kit & Safety Sec can pass
        if (user.email === 'committee@sheffieldclimbing.org' || user.committeeRole === 'Kit & Safety Sec') {
            next();
        } else {
            return res.status(403).json({ error: 'Requires Kit & Safety Sec privileges' });
        }
    });
};
