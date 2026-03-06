import { standardDbResponse } from '../utils/response';
import express from 'express';
import { db } from '../db';
import { authenticateToken, requireCommittee } from '../middleware/auth';
import { sendEmail } from '../services/email';
import {
    ROOT_ADMIN_EMAIL,
    runDb,
    getDb,
    isRootAdmin,
    parseSuRoster,
    newMembershipRowId
} from './admin.helpers';
import { getMembershipLabel, getDefaultMembershipType } from '../services/membership';

const router = express.Router();

router.get('/config/elections', authenticateToken, requireCommittee, (req, res) => {
    db.get('SELECT value FROM config WHERE key = ?', ['electionsOpen'], (err, row: any) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ electionsOpen: row?.value === 'true' });
    });
});

router.post('/config/elections', authenticateToken, requireCommittee, (req, res) => {
    const { open } = req.body;
    db.run('UPDATE config SET value = ? WHERE key = ?', [open ? 'true' : 'false', 'electionsOpen'], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, electionsOpen: open });
    });
});

/** Send a test email (root admin only) */
router.post('/test-email', authenticateToken, requireCommittee, async (req: any, res) => {
    if (!isRootAdmin(req.user)) {
        return res.status(403).json({ error: 'Only Root Admin can perform this action' });
    }

    const target = req.user.email;
    const sent = await sendEmail(
        target,
        'USCC Test Email',
        'This is a test email from the USCC admin portal.',
        '<p>This is a test email from the USCC admin portal.</p>'
    );

    res.json({
        success: true,
        sent,
        target
    });
});

/** Get all users with their membership rows joined */
router.get('/users', authenticateToken, requireCommittee, (req, res) => {
    db.all(
        'SELECT id, firstName, lastName, email, registrationNumber, role, committeeRole, membershipStatus, membershipYear, emergencyContactName, emergencyContactMobile, pronouns, dietaryRequirements FROM users',
        [],
        (err, users: any[]) => {
            if (err) return res.status(500).json({ error: 'Database error' });

            // Fetch all membership rows and attach per user
            db.all('SELECT * FROM user_memberships', [], (err2, memberships: any[]) => {
                if (err2) return res.status(500).json({ error: 'Database error' });

                // Fetch all committee roles and attach per user
                db.all('SELECT userId, role FROM committee_roles', [], (err3, committeeRoles: any[]) => {
                    if (err3) return res.status(500).json({ error: 'Database error' });

                    const membMap: Record<string, any[]> = {};
                    (memberships || []).forEach((m: any) => {
                        if (!membMap[m.userId]) membMap[m.userId] = [];
                        membMap[m.userId].push(m);
                    });

                    const rolesMap: Record<string, string[]> = {};
                    (committeeRoles || []).forEach((r: any) => {
                        if (!rolesMap[r.userId]) rolesMap[r.userId] = [];
                        rolesMap[r.userId].push(r.role);
                    });

                    const result = (users || []).map((u: any) => ({
                        ...u,
                        memberships: membMap[u.id] || [],
                        committeeRoles: rolesMap[u.id] || []
                    }));

                    res.json(result);
                });
            });
        }
    );
});

router.post('/memberships/import-su-roster', authenticateToken, requireCommittee, async (req, res) => {
    try {
        const raw = (req.body?.raw || '').toString();
        if (!raw.trim()) return res.status(400).json({ error: 'No roster text provided' });

        const {
            lines,
            parsed,
            skipped,
            yearParsedFromSubscription,
            yearFallbackUsed
        } = parseSuRoster(raw);

        if (!lines.length) return res.status(400).json({ error: 'No valid lines found' });

        const defaultType = await new Promise<string | null>((resolve) => {
            getDefaultMembershipType((_err, typeId) => resolve(typeId));
        });
        if (!defaultType) return res.status(500).json({ error: 'No membership types configured' });

        if (!parsed.length) {
            return res.status(400).json({ error: 'No valid roster rows found', skipped });
        }

        let approvedExisting = 0;
        let preapprovedOnly = 0;

        for (const row of parsed) {
            const existingUser: any = await getDb(
                'SELECT id FROM users WHERE registrationNumber = ?',
                [row.registrationNumber]
            );

            if (existingUser?.id) {
                await runDb(
                    'UPDATE users SET membershipStatus = ?, membershipYear = ? WHERE id = ?',
                    ['active', row.membershipYear, existingUser.id]
                );

                await runDb(
                    'UPDATE user_memberships SET status = ? WHERE userId = ? AND membershipYear = ? AND status = ?',
                    ['active', existingUser.id, row.membershipYear, 'pending']
                );

                const basicExisting: any = await getDb(
                    'SELECT id FROM user_memberships WHERE userId = ? AND membershipType = ? AND membershipYear = ?',
                    [existingUser.id, defaultType, row.membershipYear]
                );

                if (basicExisting?.id) {
                    await runDb('UPDATE user_memberships SET status = ? WHERE id = ?', ['active', basicExisting.id]);
                } else {
                    await runDb(
                        'INSERT INTO user_memberships (id, userId, membershipType, status, membershipYear) VALUES (?, ?, ?, ?, ?)',
                        [newMembershipRowId(), existingUser.id, defaultType, 'active', row.membershipYear]
                    );
                }

                await runDb('DELETE FROM preapproved_members WHERE registrationNumber = ?', [row.registrationNumber]);
                approvedExisting++;
                continue;
            }

            await runDb(
                `INSERT INTO preapproved_members (registrationNumber, fullName, membershipYear, source, createdAt)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(registrationNumber) DO UPDATE SET
                    fullName = excluded.fullName,
                    membershipYear = excluded.membershipYear,
                    source = excluded.source,
                    createdAt = excluded.createdAt`,
                [row.registrationNumber, row.fullName, row.membershipYear, 'su_dashboard', Date.now()]
            );
            preapprovedOnly++;
        }

        res.json({
            success: true,
            totalLines: lines.length,
            parsedRows: parsed.length,
            approvedExisting,
            preapprovedOnly,
            yearParsedFromSubscription,
            yearFallbackUsed,
            skipped
        });
    } catch (err: any) {
        console.error('Failed to import SU roster:', err);
        res.status(500).json({ error: 'Failed to import SU roster' });
    }
});

router.post('/users/:id/approve', authenticateToken, requireCommittee, (req, res) => {
    db.run('UPDATE users SET membershipStatus = ? WHERE id = ?', ['active', req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });

        getDefaultMembershipType((typeErr, defaultMembershipType) => {
            if (typeErr || !defaultMembershipType) return;

            db.get('SELECT membershipYear FROM users WHERE id = ?', [req.params.id], (err2, userRow: any) => {
                if (userRow) {
                    const userId = req.params.id;
                    const year = userRow.membershipYear;
                    db.get('SELECT id FROM user_memberships WHERE userId = ? AND membershipType = ? AND membershipYear = ?',
                        [userId, defaultMembershipType, year],
                        (err3, existing: any) => {
                            if (existing) {
                                db.run('UPDATE user_memberships SET status = ? WHERE id = ?', ['active', existing.id]);
                            } else {
                                const crypto = require('crypto');
                                db.run('INSERT INTO user_memberships (id, userId, membershipType, status, membershipYear) VALUES (?, ?, ?, ?, ?)',
                                    ['umem_' + crypto.randomUUID(), userId, defaultMembershipType, 'active', year]);
                            }
                        }
                    );
                }
            });
        });

        // Notify user
        db.get('SELECT firstName, lastName, email FROM users WHERE id = ?', [req.params.id], (err3, user: any) => {
            if (user) {
                const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                sendEmail(
                    user.email,
                    'Membership Approved',
                    `Hi ${displayName},\n\nYour membership for the University of Sheffield Climbing Club has been approved.`,
                    `<p>Hi ${displayName},</p><p>Your membership for the University of Sheffield Climbing Club has been approved.</p>`
                ).catch((e: any) => console.error("Failed to send approval email:", e));
            }
        });

        res.json({ success: true });
    });
});

router.post('/users/:id/reject', authenticateToken, requireCommittee, (req, res) => {
    db.run('UPDATE users SET membershipStatus = ? WHERE id = ?', ['rejected', req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });

        getDefaultMembershipType((typeErr, defaultMembershipType) => {
            if (typeErr || !defaultMembershipType) return;
            db.get('SELECT membershipYear FROM users WHERE id = ?', [req.params.id], (err2, userRow: any) => {
                if (userRow) {
                    db.run('UPDATE user_memberships SET status = ? WHERE userId = ? AND membershipType = ? AND membershipYear = ?',
                        ['rejected', req.params.id, defaultMembershipType, userRow.membershipYear]);
                }
            });
        });

        // Notify user
        db.get('SELECT firstName, lastName, email FROM users WHERE id = ?', [req.params.id], (err3, user: any) => {
            if (user) {
                const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                sendEmail(
                    user.email,
                    'Membership Rejected',
                    `Hi ${displayName},\n\nUnfortunately, your membership for the University of Sheffield Climbing Club has been rejected.`,
                    `<p>Hi ${displayName},</p><p>Unfortunately, your membership for the University of Sheffield Climbing Club has been rejected.</p>`
                ).catch((e: any) => console.error("Failed to send rejection email:", e));
            }
        });

        res.json({ success: true });
    });
});

router.post('/users/:id/promote', authenticateToken, requireCommittee, (req, res) => {
    db.run('UPDATE users SET role = ? WHERE id = ?', ['committee', req.params.id], standardDbResponse(res));
});

router.post('/users/:id/demote', authenticateToken, requireCommittee, (req: any, res) => {
    // Only root admin can demote
    if (!isRootAdmin(req.user)) {
        return res.status(403).json({ error: 'Only Root Admin can perform this action' });
    }

    // Cannot demote root admin
    db.get('SELECT email FROM users WHERE id = ?', [req.params.id], (err, user: any) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (user && typeof user.email === 'string' && user.email.toLowerCase() === ROOT_ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Cannot demote the Root Admin' });
        }

        db.run('UPDATE users SET role = ?, committeeRole = ? WHERE id = ?', ['member', null, req.params.id], function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            // Also clear all committee roles from the junction table
            db.run('DELETE FROM committee_roles WHERE userId = ?', [req.params.id]);
            res.json({ success: true });
        });
    });
});

router.post('/users/:id/committee-role', authenticateToken, requireCommittee, (req: any, res) => {
    // Accept either committeeRoles (array) or legacy committeeRole (string) for backward compat
    let roles: string[] = [];
    if (Array.isArray(req.body.committeeRoles)) {
        roles = req.body.committeeRoles;
    } else if (req.body.committeeRole !== undefined) {
        // Legacy single-role path
        roles = req.body.committeeRole ? [req.body.committeeRole] : [];
    }

    // Validate all roles against available roles from database
    db.all('SELECT id FROM available_roles', [], (err, validRolesRows: any[]) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        const validRoles = (validRolesRows || []).map(r => r.id);

        const invalidRole = roles.find(r => !validRoles.includes(r));
        if (invalidRole) {
            return res.status(400).json({ error: 'Invalid committee role' });
        }

        const legacyRole = roles.length > 0 ? roles[0] : null;

        // Update legacy column for backward compatibility, then replace committee_roles rows
        db.run('UPDATE users SET committeeRole = ? WHERE id = ?', [legacyRole, req.params.id], function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });

            db.run('DELETE FROM committee_roles WHERE userId = ?', [req.params.id], function (err2) {
                if (err2) return res.status(500).json({ error: 'Database error' });

                if (roles.length === 0) {
                    return res.json({ success: true });
                }

                const stmt = db.prepare('INSERT OR IGNORE INTO committee_roles (userId, role) VALUES (?, ?)');
                roles.forEach(r => stmt.run([req.params.id, r]));
                stmt.finalize((err3: any) => {
                    if (err3) return res.status(500).json({ error: 'Database error' });
                    res.json({ success: true });
                });
            });
        });
    });
});

/** Approve a specific user_memberships row */
router.post('/memberships/:id/approve', authenticateToken, requireCommittee, (req, res) => {
    db.get('SELECT * FROM user_memberships WHERE id = ?', [req.params.id], (err, row: any) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'Membership row not found' });

        db.run('UPDATE user_memberships SET status = ? WHERE id = ?', ['active', req.params.id], function (err2) {
            if (err2) return res.status(500).json({ error: 'Database error' });

            // If this is a 'basic' membership approval, also set the user's top-level membershipStatus to active
            if (row.membershipType === 'basic') {
                db.run('UPDATE users SET membershipStatus = ? WHERE id = ?', ['active', row.userId]);
            }

            // Notify the user
            db.get('SELECT firstName, lastName, email FROM users WHERE id = ?', [row.userId], (e, user: any) => {
                if (user) {
                    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                    getMembershipLabel(row.membershipType, (typeLabel) => {
                        sendEmail(
                            user.email,
                            'Membership Type Approved',
                            `Hi ${displayName},\n\nYour ${typeLabel} membership for ${row.membershipYear} has been approved.`,
                            `<p>Hi ${displayName},</p><p>Your <strong>${typeLabel}</strong> membership for ${row.membershipYear} has been approved.</p>`
                        ).catch((e: any) => console.error('Failed to send membership approval email:', e));
                    });
                }
            });

            res.json({ success: true });
        });
    });
});

/** Reject a specific user_memberships row */
router.post('/memberships/:id/reject', authenticateToken, requireCommittee, (req, res) => {
    db.get('SELECT * FROM user_memberships WHERE id = ?', [req.params.id], (err, row: any) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'Membership row not found' });

        db.run('UPDATE user_memberships SET status = ? WHERE id = ?', ['rejected', req.params.id], function (err2) {
            if (err2) return res.status(500).json({ error: 'Database error' });

            // If this is a 'basic' membership rejection, also set the user's top-level membershipStatus to rejected
            if (row.membershipType === 'basic') {
                db.run('UPDATE users SET membershipStatus = ? WHERE id = ?', ['rejected', row.userId]);
            }

            // Notify the user
            db.get('SELECT firstName, lastName, email FROM users WHERE id = ?', [row.userId], (e, user: any) => {
                if (user) {
                    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                    getMembershipLabel(row.membershipType, (typeLabel) => {
                        sendEmail(
                            user.email,
                            'Membership Type Request Rejected',
                            `Hi ${displayName},\n\nYour request for ${typeLabel} membership for ${row.membershipYear} has been rejected.`,
                            `<p>Hi ${displayName},</p><p>Your request for <strong>${typeLabel}</strong> membership for ${row.membershipYear} has been rejected.</p>`
                        ).catch((e: any) => console.error('Failed to send membership rejection email:', e));
                    });
                }
            });

            res.json({ success: true });
        });
    });
});

/** Delete a specific user_memberships row */
router.delete('/memberships/:id', authenticateToken, requireCommittee, (req, res) => {
    db.get('SELECT * FROM user_memberships WHERE id = ?', [req.params.id], (err, row: any) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'Membership row not found' });

        db.run('DELETE FROM user_memberships WHERE id = ?', [req.params.id], function (err2) {
            if (err2) return res.status(500).json({ error: 'Database error' });

            // If we just deleted the user's only active basic membership, mark them as pending
            if (row.membershipType === 'basic') {
                db.get(
                    'SELECT id FROM user_memberships WHERE userId = ? AND membershipType = ? AND status = ?',
                    [row.userId, 'basic', 'active'],
                    (err3, remaining: any) => {
                        if (!remaining) {
                            db.run('UPDATE users SET membershipStatus = ? WHERE id = ?', ['pending', row.userId]);
                        }
                    }
                );
            }

            res.json({ success: true });
        });
    });
});

/** Get all available committee roles (committee members can read) */
router.get('/committee-roles', authenticateToken, requireCommittee, (req: any, res) => {
    db.all('SELECT id, label FROM available_roles ORDER BY id ASC', [], (err, rows: any[]) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows || []);
    });
});

/** Create a new committee role (root admin only) */
router.post('/committee-roles', authenticateToken, requireCommittee, (req: any, res) => {
    if (!isRootAdmin(req.user)) {
        return res.status(403).json({ error: 'Only Root Admin can perform this action' });
    }

    const { id, label } = req.body;
    if (!id || !label) {
        return res.status(400).json({ error: 'Role ID and label are required' });
    }

    db.run('INSERT INTO available_roles (id, label) VALUES (?, ?)', [id, label], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ error: 'Role ID already exists' });
            }
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, id, label });
    });
});

/** Update a committee role (root admin only) */
router.put('/committee-roles/:id', authenticateToken, requireCommittee, (req: any, res) => {
    if (!isRootAdmin(req.user)) {
        return res.status(403).json({ error: 'Only Root Admin can perform this action' });
    }

    const { label } = req.body;
    if (!label) {
        return res.status(400).json({ error: 'Label is required' });
    }

    db.run('UPDATE available_roles SET label = ? WHERE id = ?', [label, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }
        res.json({ success: true, id: req.params.id, label });
    });
});

/** Delete a committee role (root admin only) */
router.delete('/committee-roles/:id', authenticateToken, requireCommittee, (req: any, res) => {
    if (!isRootAdmin(req.user)) {
        return res.status(403).json({ error: 'Only Root Admin can perform this action' });
    }

    // Check if any users currently hold this role
    db.get('SELECT COUNT(*) as count FROM committee_roles WHERE role = ?', [req.params.id], (err, row: any) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        if (row && row.count > 0) {
            return res.status(400).json({ error: 'Cannot delete a role that is assigned to users. Remove the role from all users first.' });
        }

        db.run('DELETE FROM available_roles WHERE id = ?', [req.params.id], function (err2) {
            if (err2) return res.status(500).json({ error: 'Database error' });
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Role not found' });
            }
            res.json({ success: true });
        });
    });
});

export default router;
