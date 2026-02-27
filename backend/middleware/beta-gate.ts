import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const BETA_ACCESS_COOKIE = 'BETA_ACCESS_TOKEN';

export const betaGate = (req: Request, res: Response, next: NextFunction) => {
    // Only apply if IS_BETA is enabled
    if (process.env.IS_BETA !== 'true') {
        return next();
    }

    // Allow access to auth API and the gate page itself
    const publicPaths = ['/api/beta-auth', '/beta-gate', '/favicon.ico'];
    if (publicPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    // Check for access token in cookies
    const token = req.cookies[BETA_ACCESS_COOKIE];

    if (!token) {
        return res.redirect('/beta-gate');
    }

    try {
        const secret = process.env.BETA_ACCESS_SECRET || 'default_beta_secret';
        jwt.verify(token, secret);
        next();
    } catch (err) {
        // Token invalid or expired
        res.clearCookie(BETA_ACCESS_COOKIE);
        res.redirect('/beta-gate');
    }
};
