import express from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db';
import { authenticateToken } from '../middleware/auth';
import crypto from 'crypto';

const router = express.Router();

const VALID_MEMBERSHIP_TYPES = ['basic', 'bouldering', 'comp_team'];

/** Get current user's membership rows */
router.get('/me/memberships', authenticateToken, (req: any, res) => {
    db.all('SELECT * FROM user_memberships WHERE userId = ? ORDER BY membershipYear DESC, membershipType ASC', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows || []);
    });
});

/** Get current user's full profile details */
router.get('/me/profile', authenticateToken, (req: any, res) => {
    db.get('SELECT firstName, lastName, emergencyContactName, emergencyContactMobile, pronouns, dietaryRequirements FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    });
});

/** Request an additional (or new) membership type */
router.post('/me/memberships', authenticateToken, (req: any, res) => {
    const { membershipType, membershipYear } = req.body;

    if (!membershipType) return res.status(400).json({ error: 'membershipType is required' });
    if (!VALID_MEMBERSHIP_TYPES.includes(membershipType)) {
        return res.status(400).json({ error: 'Invalid membership type' });
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const year = membershipYear || (currentMonth < 8
        ? `${currentYear - 1}/${currentYear}`
        : `${currentYear}/${currentYear + 1}`);

    const id = 'umem_' + crypto.randomUUID();
    // Committee members get auto-approved memberships
    const status = req.user.role === 'committee' ? 'active' : 'pending';

    // Try to insert; if a row already exists for (userId, membershipType, membershipYear), upgrade its status
    db.run(
        'INSERT OR IGNORE INTO user_memberships (id, userId, membershipType, status, membershipYear) VALUES (?, ?, ?, ?, ?)',
        [id, req.user.id, membershipType, status, year],
        function (this: any, err) {
            if (err) return res.status(500).json({ error: 'Database error' });

            if (this.changes === 0) {
                // Row already exists — upgrade status if the requested status is higher priority
                db.run(
                    `UPDATE user_memberships SET status = ?
                     WHERE userId = ? AND membershipType = ? AND membershipYear = ?
                       AND (status = 'rejected' OR (status = 'pending' AND ? = 'active'))`,
                    [status, req.user.id, membershipType, year, status],
                    function (err2) {
                        if (err2) return res.status(500).json({ error: 'Database error' });
                        res.json({ success: true, membershipType, status, membershipYear: year });
                    }
                );
            } else {
                res.json({ success: true, id, membershipType, status, membershipYear: year });
            }
        }
    );
});

/** Renew overall membership (resets to pending for current year, or active for committee) */
router.post('/me/membership-renewal', authenticateToken, (req: any, res) => {
    const { membershipYear, membershipTypes } = req.body;
    if (!membershipYear) return res.status(400).json({ error: 'Missing membership year' });

    // Committee members stay active; regular members go to pending
    const newStatus = req.user.role === 'committee' ? 'active' : 'pending';

    db.run('UPDATE users SET membershipYear = ?, membershipStatus = ? WHERE id = ?', [membershipYear, newStatus, req.user.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });

        // Optionally insert new membership type rows for the new year
        if (Array.isArray(membershipTypes) && membershipTypes.length > 0) {
            const validTypes = membershipTypes.filter((t: string) => VALID_MEMBERSHIP_TYPES.includes(t));
            if (validTypes.length > 0) {
                const stmt = db.prepare('INSERT INTO user_memberships (id, userId, membershipType, status, membershipYear) VALUES (?, ?, ?, ?, ?)');
                validTypes.forEach((t: string) => {
                    stmt.run(['umem_' + crypto.randomUUID(), req.user.id, t, newStatus, membershipYear]);
                });
                stmt.finalize();
            }
        }

        res.json({ success: true, membershipYear, membershipStatus: newStatus });
    });
});

/** Re-request membership (e.g. after rejection) */
router.post('/me/request-membership', authenticateToken, (req: any, res) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const membershipYear = currentMonth < 8
        ? `${currentYear - 1}/${currentYear}`
        : `${currentYear}/${currentYear + 1}`;

    db.run(
        'UPDATE users SET membershipStatus = ?, membershipYear = ? WHERE id = ?',
        ['pending', membershipYear, req.user.id],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });

            // Upsert the 'basic' membership row so it appears in the admin pending list
            db.get('SELECT id FROM user_memberships WHERE userId = ? AND membershipType = ? AND membershipYear = ?',
                [req.user.id, 'basic', membershipYear],
                (err2, row: any) => {
                    if (row) {
                        // Row exists — update its status back to pending
                        db.run('UPDATE user_memberships SET status = ? WHERE id = ?', ['pending', row.id]);
                    } else {
                        // No row for this year yet — insert a fresh pending one
                        db.run('INSERT INTO user_memberships (id, userId, membershipType, status, membershipYear) VALUES (?, ?, ?, ?, ?)',
                            ['umem_' + crypto.randomUUID(), req.user.id, 'basic', 'pending', membershipYear]);
                    }
                }
            );

            res.json({ success: true, membershipStatus: 'pending', membershipYear });
        }
    );
});

router.put('/:id', authenticateToken, (req: any, res) => {
    if (req.user.id !== req.params.id && req.user.role !== 'committee') {
        return res.status(403).json({ error: 'Unauthorized to update this user' });
    }

    const { firstName, lastName, emergencyContactName, emergencyContactMobile, pronouns, dietaryRequirements } = req.body;
    db.run(
        'UPDATE users SET firstName = ?, lastName = ?, name = ?, emergencyContactName = ?, emergencyContactMobile = ?, pronouns = ?, dietaryRequirements = ? WHERE id = ?',
        [firstName, lastName, `${firstName} ${lastName}`.trim(), emergencyContactName, emergencyContactMobile, pronouns, dietaryRequirements, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true });
        }
    );
});

router.put('/me/password', authenticateToken, (req: any, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    db.get('SELECT passwordHash FROM users WHERE id = ?', [req.user.id], async (err, user: any) => {
        if (err || !user) return res.status(500).json({ error: 'Database error' });

        const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!validPassword) return res.status(401).json({ error: 'Current password is incorrect' });

        const newHash = await bcrypt.hash(newPassword, 10);
        db.run('UPDATE users SET passwordHash = ? WHERE id = ?', [newHash, req.user.id], function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true });
        });
    });
});

router.delete('/:id', authenticateToken, (req: any, res) => {
    const targetUserId = req.params.id;
    const isSelf = req.user.id.toString() === targetUserId.toString();
    const isCommittee = req.user.role === 'committee';

    if (!isSelf && !isCommittee) {
        return res.status(403).json({ error: 'Unauthorized to delete this user' });
    }

    if (!isSelf && isCommittee) {
        db.get('SELECT role FROM users WHERE id = ?', [targetUserId], (err, targetUser: any) => {
            if (err || !targetUser) return res.status(500).json({ error: 'User not found or database error' });
            if (targetUser.role === 'committee') {
                return res.status(403).json({ error: 'Cannot delete another committee member' });
            }
            performUserDelete(targetUserId, res);
        });
    } else {
        performUserDelete(targetUserId, res);
    }
});

function performUserDelete(userId: string, res: any) {
    db.run('DELETE FROM bookings WHERE userId = ?', [userId], () => {
        db.run('DELETE FROM votes WHERE userId = ?', [userId], () => {
            db.run('DELETE FROM candidates WHERE userId = ?', [userId], () => {
                db.run('DELETE FROM user_memberships WHERE userId = ?', [userId], () => {
                    db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
                        if (err) return res.status(500).json({ error: 'Database error' });
                        res.json({ success: true });
                    });
                });
            });
        });
    });
}

export default router;
