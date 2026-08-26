import jwt from 'jsonwebtoken';
import { SECRET_KEY } from '../config';
import { dbGet } from '../utils/db';

const ROOT_ADMIN_EMAIL = (process.env.ROOT_ADMIN_EMAIL || 'committee@sheffieldclimbing.org').toLowerCase();

// Middleware to verify JWT
export const authenticateToken = (req: any, res: any, next: any) => {
    // Get token from cookies, fallback to Authorization header
    let token = req.cookies?.uscc_token;
    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.split(' ')[1];
    }

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, SECRET_KEY, (err: any, user: any) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
};

export const requireCommittee = async (req: any, res: any, next: any) => {
    const isCommitteeJWT =
        req.user.role === 'committee' ||
        !!req.user.committeeRole ||
        (Array.isArray(req.user.committeeRoles) && req.user.committeeRoles.length > 0);

    if (isCommitteeJWT) return next();

    // Fallbacks for stale tokens: users table first, then committee_roles junction.
    // DB errors resolve to "not committee" — same behaviour as the callback version,
    // which treated query failures as denial rather than 500.
    const user = await dbGet(
        'SELECT id FROM users WHERE id = ? AND (role = "committee" OR committeeRole IS NOT NULL)',
        [req.user.id]
    ).catch(() => undefined);
    if (user) return next();

    const junctionRow = await dbGet('SELECT userId FROM committee_roles WHERE userId = ? LIMIT 1', [req.user.id]).catch(
        () => undefined
    );
    if (junctionRow) return next();

    res.status(403).json({ error: 'Requires committee privileges' });
};

export const requireKitSec = async (req: any, res: any, next: any) => {
    // Fetch the latest role fields from DB in case the token is stale.
    const user = await dbGet('SELECT role, committeeRole, email FROM users WHERE id = ?', [req.user.id]).catch(
        () => undefined
    );
    if (!user) return res.status(403).json({ error: 'Unauthorized' });

    // Root admin or Kit & Safety Sec can pass
    const isRootAdmin = user.role === 'committee' && (user.email || '').toLowerCase() === ROOT_ADMIN_EMAIL;
    if (isRootAdmin || user.committeeRole === 'Kit & Safety Sec') return next();

    res.status(403).json({ error: 'Requires Kit & Safety Sec privileges' });
};
