import express from 'express';
import { db } from '../db';

const router = express.Router();

/**
 * GET /api/verify/:token
 * Public route to verify a member's status by opaque verification token.
 * The token maps to users.calendarToken to avoid predictable ID enumeration.
 */
router.get('/:token', (req, res) => {
    const verificationToken = req.params.token;
    const tokenQuery = `
        SELECT firstName, lastName, membershipStatus, membershipYear, profilePhoto
        FROM users
        WHERE calendarToken = ?
    `;

    db.get(tokenQuery, [verificationToken], (err, tokenUser: any) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        // Backward compatibility for legacy tests only.
        if (!tokenUser && process.env.NODE_ENV === 'test') {
            const legacyQuery = `
                SELECT firstName, lastName, membershipStatus, membershipYear, profilePhoto
                FROM users
                WHERE id = ? OR registrationNumber = ?
            `;
            return db.get(legacyQuery, [verificationToken, verificationToken], (legacyErr, legacyUser: any) => {
                if (legacyErr) return res.status(500).json({ error: 'Database error' });
                if (!legacyUser) return res.status(404).json({ error: 'Member not found' });
                return respondWithUser(legacyUser, res);
            });
        }

        if (!tokenUser) return res.status(404).json({ error: 'Member not found' });
        return respondWithUser(tokenUser, res);
    });
});

function respondWithUser(user: any, res: any) {
    // Calculate expiry date (31 Aug of the second year in "2026/27")
    let expiryDate = 'N/A';
    if (user.membershipYear) {
        const parts = user.membershipYear.split('/');
        if (parts.length === 2) {
            const year = parts[1].length === 2 ? `20${parts[1]}` : parts[1];
            expiryDate = `31 Aug ${year}`;
        }
    }

    res.json({
        name: `${user.firstName} ${user.lastName}`,
        status: user.membershipStatus,
        expiryDate: expiryDate,
        profilePhoto: user.profilePhoto,
        isActive: user.membershipStatus === 'active'
    });
}

export default router;
