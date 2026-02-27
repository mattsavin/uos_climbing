import express from 'express';
import { db } from '../db';

const router = express.Router();

/**
 * GET /api/verify/:id
 * Public route to verify a member's status by their ID or registration number.
 * Returns minimal information for privacy.
 */
router.get('/:id', (req, res) => {
    const userIdOrReg = req.params.id;

    const query = `
        SELECT firstName, lastName, registrationNumber, membershipStatus, membershipYear, profilePhoto
        FROM users
        WHERE id = ? OR registrationNumber = ?
    `;

    db.get(query, [userIdOrReg, userIdOrReg], (err, user: any) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'Member not found' });

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
            registrationNumber: user.registrationNumber,
            status: user.membershipStatus,
            expiryDate: expiryDate,
            profilePhoto: user.profilePhoto,
            isActive: user.membershipStatus === 'active'
        });
    });
});

export default router;
