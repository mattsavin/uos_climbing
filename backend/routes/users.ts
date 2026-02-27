import express from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db';
import { authenticateToken } from '../middleware/auth';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

function getMembershipTypeIds(callback: (err: Error | null, ids: string[]) => void) {
    db.all('SELECT id FROM membership_types', [], (err, rows: any[]) => {
        if (err) return callback(err as any, []);
        callback(null, (rows || []).map((r: any) => r.id));
    });
}

// Configure multer for profile photo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads/profile-photos');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only images (jpeg, jpg, png, webp) are allowed!'));
    }
});

/** Get current user's membership rows */
router.get('/me/memberships', authenticateToken, (req: any, res) => {
    db.all('SELECT * FROM user_memberships WHERE userId = ? ORDER BY membershipYear DESC, membershipType ASC', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows || []);
    });
});

/** Get current user's full profile details */
router.get('/me/profile', authenticateToken, (req: any, res) => {
    db.get('SELECT firstName, lastName, emergencyContactName, emergencyContactMobile, pronouns, dietaryRequirements, profilePhoto, registrationNumber, membershipStatus, membershipYear FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    });
});

/** POST /api/users/me/photo - Upload profile photo */
router.post('/me/photo', authenticateToken, (req: any, res) => {
    upload.single('photo')(req, res, (uploadErr: any) => {
        if (uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Photo too large. Max size is 5MB.' });
        }
        if (uploadErr) {
            return res.status(400).json({ error: uploadErr.message || 'Invalid image upload.' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const photoPath = `/uploads/profile-photos/${req.file.filename}`;

        // Get old photo to delete it
        db.get('SELECT profilePhoto FROM users WHERE id = ?', [req.user.id], (err, user: any) => {
            if (!err && user && user.profilePhoto) {
                const oldPath = path.join(process.cwd(), user.profilePhoto);
                if (fs.existsSync(oldPath)) {
                    try {
                        fs.unlinkSync(oldPath);
                    } catch (e) {
                        console.error('Failed to delete old photo:', e);
                    }
                }
            }

            db.run('UPDATE users SET profilePhoto = ? WHERE id = ?', [photoPath, req.user.id], (err) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                res.json({ success: true, photoPath });
            });
        });
    });
});

/** Request an additional (or new) membership type */
router.post('/me/memberships', authenticateToken, (req: any, res) => {
    const { membershipType, membershipYear } = req.body;

    if (!membershipType) return res.status(400).json({ error: 'membershipType is required' });
    getMembershipTypeIds((typeErr, membershipTypeIds) => {
        if (typeErr) return res.status(500).json({ error: 'Database error' });
        if (!membershipTypeIds.includes(membershipType)) {
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
});

/** Renew overall membership (resets to pending for current year, or active for committee) */
router.post('/me/membership-renewal', authenticateToken, (req: any, res) => {
    const { membershipYear, membershipTypes } = req.body;
    if (!membershipYear) return res.status(400).json({ error: 'Missing membership year' });

    // Committee members stay active; regular members go to pending
    const newStatus = req.user.role === 'committee' ? 'active' : 'pending';

    getMembershipTypeIds((typeErr, membershipTypeIds) => {
        if (typeErr) return res.status(500).json({ error: 'Database error' });

        db.run('UPDATE users SET membershipYear = ?, membershipStatus = ? WHERE id = ?', [membershipYear, newStatus, req.user.id], function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });

            // Optionally insert new membership type rows for the new year
            if (Array.isArray(membershipTypes) && membershipTypes.length > 0) {
                const validTypes = membershipTypes.filter((t: string) => membershipTypeIds.includes(t));
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
});

/** Re-request membership (e.g. after rejection) */
router.post('/me/request-membership', authenticateToken, (req: any, res) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const membershipYear = currentMonth < 8
        ? `${currentYear - 1}/${currentYear}`
        : `${currentYear}/${currentYear + 1}`;

    getMembershipTypeIds((typeErr, membershipTypeIds) => {
        if (typeErr) return res.status(500).json({ error: 'Database error' });
        const defaultMembershipType = membershipTypeIds.includes('basic') ? 'basic' : membershipTypeIds[0];
        if (!defaultMembershipType) {
            return res.status(500).json({ error: 'No membership types configured' });
        }

        db.run(
            'UPDATE users SET membershipStatus = ?, membershipYear = ? WHERE id = ?',
            ['pending', membershipYear, req.user.id],
            function (err) {
                if (err) return res.status(500).json({ error: 'Database error' });

                // Upsert a default membership row so it appears in the admin pending list
                db.get('SELECT id FROM user_memberships WHERE userId = ? AND membershipType = ? AND membershipYear = ?',
                    [req.user.id, defaultMembershipType, membershipYear],
                    (err2, row: any) => {
                        if (row) {
                            // Row exists — update its status back to pending
                            db.run('UPDATE user_memberships SET status = ? WHERE id = ?', ['pending', row.id]);
                        } else {
                            // No row for this year yet — insert a fresh pending one
                            db.run('INSERT INTO user_memberships (id, userId, membershipType, status, membershipYear) VALUES (?, ?, ?, ?, ?)',
                                ['umem_' + crypto.randomUUID(), req.user.id, defaultMembershipType, 'pending', membershipYear]);
                        }
                    }
                );

                res.json({ success: true, membershipStatus: 'pending', membershipYear });
            }
        );
    });
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
