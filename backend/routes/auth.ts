import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { db } from '../db';
import { SECRET_KEY } from '../config';
import { authenticateToken } from '../middleware/auth';
import { sendEmail } from '../services/email';

const IS_TEST = process.env.NODE_ENV === 'test';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const AUTH_RATE_LIMIT_ENABLED = process.env.AUTH_RATE_LIMIT_ENABLED === 'true';

// Create the limiter once at module init — express-rate-limit forbids per-request creation
const _rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Keep local development usable by default; enable explicitly via AUTH_RATE_LIMIT_ENABLED=true
    if (IS_TEST || (!IS_PRODUCTION && !AUTH_RATE_LIMIT_ENABLED)) return next();
    return _rateLimiter(req, res, next);
};

const router = express.Router();

const cookieOptions = {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true' || (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false'),
    sameSite: 'strict' as const,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
};

/** Generate a cryptographically secure 6-digit OTP */
function generateOTP(): string {
    return crypto.randomInt(100000, 999999).toString();
}

function getMembershipTypeIds(callback: (err: Error | null, ids: string[]) => void) {
    db.all('SELECT id FROM membership_types', [], (err, rows: any[]) => {
        if (err) return callback(err as any, []);
        callback(null, (rows || []).map((r: any) => r.id));
    });
}

router.post('/register', authLimiter, async (req, res) => {
    const { firstName, lastName, email, registrationNumber, password, passwordConfirm, membershipTypes } = req.body;
    const normalizedEmail = (email || '').toString().trim().toLowerCase();

    if (!firstName || !lastName || !normalizedEmail || !password || !passwordConfirm || !registrationNumber) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (password !== passwordConfirm) {
        return res.status(400).json({ error: 'Passwords do not match' });
    }

    getMembershipTypeIds(async (typeErr, membershipTypeIds) => {
        if (typeErr) return res.status(500).json({ error: 'Database error' });

        const defaultMembership = membershipTypeIds.includes('basic')
            ? 'basic'
            : membershipTypeIds[0];
        if (!defaultMembership) {
            return res.status(500).json({ error: 'No membership types configured' });
        }

        // Validate & default membership types
        let types: string[] = Array.isArray(membershipTypes) && membershipTypes.length > 0
            ? membershipTypes.filter((t: string) => membershipTypeIds.includes(t))
            : [defaultMembership];
        if (types.length === 0) types = [defaultMembership];

        try {
            const passwordHash = await bcrypt.hash(password, 10);
            const id = 'user_' + Date.now() + Math.random().toString(36).substr(2, 5);

            let role = 'member';
            let membershipStatus = 'pending';
            // Root admin email is pre-verified
            const isRootAdmin = normalizedEmail === 'committee@sheffieldclimbing.org';
            if (!IS_TEST && !isRootAdmin && !normalizedEmail.endsWith('@sheffield.ac.uk')) {
                return res.status(400).json({ error: 'Please register with your @sheffield.ac.uk email address.' });
            }
            if (isRootAdmin) {
                role = 'committee';
                membershipStatus = 'active';
            }

            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth();
            const membershipYear = currentMonth < 8 ? `${currentYear - 1}/${currentYear}` : `${currentYear}/${currentYear + 1}`;

            const calendarToken = crypto.randomUUID();
            // In test env or for root admin, mark as verified immediately
            const emailVerified = (IS_TEST || isRootAdmin) ? 1 : 0;

            db.run(
                'INSERT INTO users (id, firstName, lastName, name, email, passwordHash, registrationNumber, role, membershipStatus, membershipYear, calendarToken, emailVerified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, firstName, lastName, `${firstName} ${lastName}`, normalizedEmail, passwordHash, registrationNumber, role, membershipStatus, membershipYear, calendarToken, emailVerified],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            return res.status(400).json({ error: 'Email already exists' });
                        }
                        return res.status(500).json({ error: 'Database error' });
                    }

                    // Insert user_memberships rows
                    const membershipRowStatus = (IS_TEST || isRootAdmin) ? 'active' : 'pending';
                    const stmt = db.prepare('INSERT INTO user_memberships (id, userId, membershipType, status, membershipYear) VALUES (?, ?, ?, ?, ?)');
                    types.forEach((t: string) => {
                        stmt.run(['umem_' + Date.now() + Math.random().toString(36).substr(2, 5), id, t, membershipRowStatus, membershipYear]);
                    });
                    stmt.finalize();

                    const user = { id, firstName, lastName, email: normalizedEmail, registrationNumber, role, committeeRole: null, membershipStatus, membershipYear, calendarToken };

                    if (IS_TEST || isRootAdmin) {
                        // In test environment or for root admin: skip email verification, return token immediately
                        const token = jwt.sign(user, SECRET_KEY, { expiresIn: '24h' });
                        res.cookie('uscc_token', token, cookieOptions);
                        return res.json({ user, token });
                    }

                    // Production/dev: send OTP, do not return a token yet
                    const otp = generateOTP();
                    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

                    db.run(
                        'INSERT OR REPLACE INTO email_verifications (userId, code, expiresAt) VALUES (?, ?, ?)',
                        [id, otp, expiresAt],
                        (otpErr) => {
                            if (otpErr) {
                                return res.status(500).json({ error: 'Failed to create verification code' });
                            }

                            // Send verification email (fire-and-forget)
                            sendEmail(
                                normalizedEmail,
                                'Verify your USCC email address',
                                `Hi ${firstName},\n\nYour verification code is: ${otp}\n\nThis code expires in 15 minutes.\n\nIf you did not register for the University of Sheffield Climbing Club, please ignore this email.`,
                                `<p>Hi ${firstName},</p><p>Your verification code is:</p><h2 style="letter-spacing:8px;font-size:32px;">${otp}</h2><p>This code expires in 15 minutes.</p><p style="color:#999;font-size:12px;">If you did not register for the University of Sheffield Climbing Club, please ignore this email.</p>`
                            ).catch(e => console.error('Failed to send verification email:', e));

                            res.json({ pendingVerification: true, userId: id });
                        }
                    );
                }
            );
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });
});

router.post('/login', authLimiter, (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = (email || '').toString().trim().toLowerCase();

    if (!normalizedEmail || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [normalizedEmail], async (err, user: any) => {
        if (err) {
            console.error('Login database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!user) {
            console.warn(`Login failed: user not found for email "${normalizedEmail}"`);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            console.warn(`Login failed: incorrect password for email "${normalizedEmail}"`);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Block login if email is not verified (unless test env)
        if (!IS_TEST && !user.emailVerified) {
            return res.status(403).json({
                error: 'Email not verified. Please check your inbox for a verification code.',
                pendingVerification: true,
                userId: user.id
            });
        }

        // Don't send hash back
        const { passwordHash, ...userWithoutPassword } = user;
        const token = jwt.sign(userWithoutPassword, SECRET_KEY, { expiresIn: '24h' });

        res.cookie('uscc_token', token, cookieOptions);
        res.json({ user: userWithoutPassword, token });
    });
});

/** Verify a user's email with their OTP code */
router.post('/verify-email', authLimiter, (req, res) => {
    const { userId, code } = req.body;

    if (!userId || !code) {
        return res.status(400).json({ error: 'Missing userId or code' });
    }

    db.get('SELECT * FROM email_verifications WHERE userId = ?', [userId], (err, row: any) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(400).json({ error: 'Invalid or expired code' });

        if (row.code !== code.trim()) {
            return res.status(400).json({ error: 'Invalid or expired code' });
        }

        if (Date.now() > row.expiresAt) {
            return res.status(400).json({ error: 'Invalid or expired code' });
        }

        // Mark user as verified and remove the OTP record
        db.run('UPDATE users SET emailVerified = 1 WHERE id = ?', [userId], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'Database error' });

            db.run('DELETE FROM email_verifications WHERE userId = ?', [userId]);

            // Fetch the full user to sign the JWT
            db.get(
                'SELECT id, firstName, lastName, email, registrationNumber, role, committeeRole, membershipStatus, membershipYear, calendarToken FROM users WHERE id = ?',
                [userId],
                (fetchErr, user: any) => {
                    if (fetchErr || !user) return res.status(500).json({ error: 'Database error' });

                    // Send welcome email now that they've verified
                    sendEmail(
                        user.email,
                        'Welcome to USCC!',
                        `Hi ${user.firstName},\n\nWelcome to the University of Sheffield Climbing Club! Your email has been verified and your registration is complete.`,
                        `<p>Hi ${user.firstName},</p><p>Welcome to the University of Sheffield Climbing Club! Your email has been verified and your registration is complete.</p>`
                    ).catch(e => console.error('Failed to send welcome email:', e));

                    const token = jwt.sign(user, SECRET_KEY, { expiresIn: '24h' });
                    res.cookie('uscc_token', token, cookieOptions);
                    res.json({ user, token });
                }
            );
        });
    });
});

/** Re-send a verification OTP to the user */
router.post('/request-verification', authLimiter, (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }

    db.get('SELECT id, name, email, emailVerified FROM users WHERE id = ?', [userId], (err, user: any) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.emailVerified) {
            return res.status(400).json({ error: 'Email is already verified' });
        }

        const otp = generateOTP();
        const expiresAt = Date.now() + 15 * 60 * 1000;

        db.run(
            'INSERT OR REPLACE INTO email_verifications (userId, code, expiresAt) VALUES (?, ?, ?)',
            [user.id, otp, expiresAt],
            (otpErr) => {
                if (otpErr) return res.status(500).json({ error: 'Database error' });

                sendEmail(
                    user.email,
                    'Your new USCC verification code',
                    `Hi ${user.firstName},\n\nYour new verification code is: ${otp}\n\nThis code expires in 15 minutes.`,
                    `<p>Hi ${user.firstName},</p><p>Your new verification code is:</p><h2 style="letter-spacing:8px;font-size:32px;">${otp}</h2><p>This code expires in 15 minutes.</p>`
                ).catch(e => console.error('Failed to send verification email:', e));

                res.json({ success: true });
            }
        );
    });
});

/**
 * Forgot Password — generates a reset token and emails a link.
 * Always returns 200 regardless of whether the email exists (prevents enumeration).
 */
router.post('/forgot-password', authLimiter, (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Always respond 200 first to prevent email enumeration
    res.json({ success: true, message: 'If that email is registered, you will receive a reset link shortly.' });

    db.get('SELECT id, firstName, lastName, email FROM users WHERE email = ?', [email], (err, user: any) => {
        if (err || !user) return; // silently ignore unknown emails

        const token = crypto.randomUUID();
        const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

        db.run(
            'INSERT OR REPLACE INTO password_resets (token, userId, expiresAt) VALUES (?, ?, ?)',
            [token, user.id, expiresAt],
            (dbErr) => {
                if (dbErr) return;

                const forwardedProtoRaw = req.headers['x-forwarded-proto'];
                const forwardedProto = typeof forwardedProtoRaw === 'string'
                    ? forwardedProtoRaw.split(',')[0].trim()
                    : '';
                const inferredProto = forwardedProto || req.protocol || 'http';
                const inferredHost = req.get('host') || '';
                const inferredBaseUrl = inferredHost ? `${inferredProto}://${inferredHost}` : '';
                const baseUrl = process.env.APP_URL || inferredBaseUrl || 'http://localhost:5173';
                const resetLink = `${baseUrl}/login.html?reset_token=${token}`;

                sendEmail(
                    user.email,
                    'Reset your USCC password',
                    `Hi ${user.firstName},\n\nClick the link below to reset your password (expires in 15 minutes):\n\n${resetLink}\n\nIf you did not request a password reset, please ignore this email.`,
                    `<p>Hi ${user.firstName},</p><p>Click the button below to reset your password. This link expires in <strong>15 minutes</strong>.</p><p style="text-align:center;margin:32px 0;"><a href="${resetLink}" style="background:#fdb913;color:#1a1a2e;padding:14px 28px;border-radius:8px;font-weight:900;text-decoration:none;letter-spacing:1px;font-size:14px;">Reset Password</a></p><p style="color:#999;font-size:12px;">If you did not request a password reset, please ignore this email.</p>`
                ).catch(e => console.error('Failed to send reset email:', e));
            }
        );
    });
});

/** Reset Password — exchange a valid token for a new password */
router.post('/reset-password', authLimiter, (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    db.get('SELECT * FROM password_resets WHERE token = ?', [token], async (err, row: any) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(400).json({ error: 'Invalid or expired reset token' });

        if (Date.now() > row.expiresAt) {
            db.run('DELETE FROM password_resets WHERE token = ?', [token]);
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        try {
            const newHash = await bcrypt.hash(newPassword, 10);
            db.run('UPDATE users SET passwordHash = ? WHERE id = ?', [newHash, row.userId], (updateErr) => {
                if (updateErr) return res.status(500).json({ error: 'Database error' });
                db.run('DELETE FROM password_resets WHERE token = ?', [token]);
                res.json({ success: true });
            });
        } catch {
            res.status(500).json({ error: 'Server error' });
        }
    });
});

router.post('/logout', (req, res) => {
    res.clearCookie('uscc_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.json({ success: true });
});

router.get('/me', authenticateToken, (req: any, res) => {
    db.get(
        'SELECT id, firstName, lastName, name, email, registrationNumber, role, committeeRole, membershipStatus, membershipYear, emergencyContactName, emergencyContactMobile, pronouns, dietaryRequirements, calendarToken, instagram, faveCrag, bio, profilePhoto FROM users WHERE id = ?',
        [req.user.id],
        (err, user: any) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        user.name = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

        db.all('SELECT role FROM committee_roles WHERE userId = ?', [req.user.id], (errRoles, rows: any[]) => {
            if (!errRoles && rows) {
                user.committeeRoles = rows.map(r => r.role);
            } else {
                user.committeeRoles = [];
            }
            res.json({ user });
        });
    });
});

export default router;
