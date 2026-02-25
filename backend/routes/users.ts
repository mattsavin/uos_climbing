import express from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/me/membership-renewal', authenticateToken, (req: any, res) => {
    const { membershipYear } = req.body;
    if (!membershipYear) return res.status(400).json({ error: 'Missing membership year' });

    db.run('UPDATE users SET membershipYear = ?, membershipStatus = ? WHERE id = ?', [membershipYear, 'pending', req.user.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, membershipYear, membershipStatus: 'pending' });
    });
});

router.put('/:id', authenticateToken, (req: any, res) => {
    if (req.user.id !== req.params.id && req.user.role !== 'committee') {
        return res.status(403).json({ error: 'Unauthorized to update this user' });
    }

    const { name, emergencyContactName, emergencyContactMobile, pronouns, dietaryRequirements } = req.body;
    db.run(
        'UPDATE users SET name = ?, emergencyContactName = ?, emergencyContactMobile = ?, pronouns = ?, dietaryRequirements = ? WHERE id = ?',
        [name, emergencyContactName, emergencyContactMobile, pronouns, dietaryRequirements, req.params.id],
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
    db.run('DELETE FROM bookings WHERE userId = ?', [userId], () => { // Fixed table name from sessions_bookings to bookings
        db.run('DELETE FROM votes WHERE userId = ?', [userId], () => {
            db.run('DELETE FROM candidates WHERE userId = ?', [userId], () => {
                db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
                    if (err) return res.status(500).json({ error: 'Database error' });
                    res.json({ success: true });
                });
            });
        });
    });
}

export default router;
