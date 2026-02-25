import express from 'express';
import { db } from '../db';
import { authenticateToken, requireCommittee } from '../middleware/auth';

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

router.get('/users', authenticateToken, requireCommittee, (req, res) => {
    db.all('SELECT id, name, email, registrationNumber, role, committeeRole, membershipStatus, membershipYear, emergencyContactName, emergencyContactMobile, pronouns, dietaryRequirements FROM users', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

router.post('/users/:id/approve', authenticateToken, requireCommittee, (req, res) => {
    db.run('UPDATE users SET membershipStatus = ? WHERE id = ?', ['active', req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

router.post('/users/:id/reject', authenticateToken, requireCommittee, (req, res) => {
    db.run('UPDATE users SET membershipStatus = ? WHERE id = ?', ['rejected', req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

router.post('/users/:id/promote', authenticateToken, requireCommittee, (req, res) => {
    db.run('UPDATE users SET role = ? WHERE id = ?', ['committee', req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

router.post('/users/:id/demote', authenticateToken, requireCommittee, (req: any, res) => {
    // Only root admin can demote
    if (req.user.email !== 'sheffieldclimbing@gmail.com') {
        return res.status(403).json({ error: 'Only Root Admin can perform this action' });
    }

    // Cannot demote root admin
    db.get('SELECT email FROM users WHERE id = ?', [req.params.id], (err, user: any) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (user && user.email === 'sheffieldclimbing@gmail.com') {
            return res.status(403).json({ error: 'Cannot demote the Root Admin' });
        }

        db.run('UPDATE users SET role = ?, committeeRole = ? WHERE id = ?', ['member', null, req.params.id], function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true });
        });
    });
});

router.post('/users/:id/committee-role', authenticateToken, requireCommittee, (req: any, res) => {
    // Only root admin or "Chair" could ideally do this, but for now we'll allow any committee
    const { committeeRole } = req.body;

    // Validate role is one of the allowed roles, or null/empty to clear
    const validRoles = [
        'Chair', 'Secretary', 'Treasurer', 'Welfare & Inclusions',
        'Team Captain', 'Social Sec', "Women's Captain",
        "Men's Captain", 'Publicity', 'Kit & Safety Sec'
    ];

    if (committeeRole && !validRoles.includes(committeeRole)) {
        return res.status(400).json({ error: 'Invalid committee role' });
    }

    db.run('UPDATE users SET committeeRole = ? WHERE id = ?', [committeeRole || null, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

export default router;
