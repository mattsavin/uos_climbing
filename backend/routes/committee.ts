import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db';
import { authenticateToken, requireCommittee } from '../middleware/auth';
import crypto from 'crypto';
import { UPLOAD_BASE_DIR } from '../config';

const router = express.Router();

// Configure multer for profile photo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(UPLOAD_BASE_DIR, 'profile-photos');
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

/** GET /api/committee - Get all committee members */
router.get('/', (req, res) => {
    const query = `
        SELECT u.id, u.firstName, u.lastName, u.name, u.email, u.instagram, u.faveCrag, u.bio, u.profilePhoto, u.committeeRole,
               GROUP_CONCAT(cr.role, ', ') as roles
        FROM users u
        LEFT JOIN committee_roles cr ON u.id = cr.userId
        WHERE u.role = 'committee'
        GROUP BY u.id
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows || []);
    });
});

/** PUT /api/committee/me - Update current member's profile */
router.put('/me', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'committee') {
        return res.status(403).json({ error: 'Only committee members can edit their committee profile' });
    }

    const { instagram, faveCrag, bio } = req.body;
    db.run(
        'UPDATE users SET instagram = ?, faveCrag = ?, bio = ? WHERE id = ?',
        [instagram, faveCrag, bio, req.user.id],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true });
        }
    );
});

/** POST /api/committee/me/photo - Upload profile photo */
router.post('/me/photo', authenticateToken, (req: any, res) => {
    upload.single('photo')(req, res, (uploadErr: any) => {
        if (uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Photo too large. Max size is 5MB.' });
        }
        if (uploadErr) {
            return res.status(400).json({ error: uploadErr.message || 'Invalid image upload.' });
        }

        if (req.user.role !== 'committee') {
            return res.status(403).json({ error: 'Only committee members can upload profile photos' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const photoPath = `/uploads/profile-photos/${req.file.filename}`;

        // Get old photo to delete it
        db.get('SELECT profilePhoto FROM users WHERE id = ?', [req.user.id], (err, user: any) => {
            if (!err && user && user.profilePhoto) {
                const oldPath = path.join(UPLOAD_BASE_DIR, user.profilePhoto.replace(/^\/uploads\//, ''));
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }

            db.run('UPDATE users SET profilePhoto = ? WHERE id = ?', [photoPath, req.user.id], (err) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                res.json({ success: true, photoPath });
            });
        });
    });
});

/** GET /api/committee/export/members - Export members with verified membership type as CSV */
router.get('/export/members', authenticateToken, requireCommittee, (req: any, res) => {
    const membershipType = req.query.membershipType as string;

    if (!membershipType) {
        return res.status(400).json({ error: 'membershipType query parameter is required' });
    }

    // Query for users with active membership of the specified type
    const query = `
        SELECT 
            u.id,
            u.firstName,
            u.lastName,
            u.email,
            u.registrationNumber,
            u.emergencyContactName,
            u.emergencyContactMobile,
            u.pronouns,
            u.dietaryRequirements,
            um.membershipType,
            um.status as membershipStatus,
            um.membershipYear
        FROM users u
        INNER JOIN user_memberships um ON u.id = um.userId
        WHERE um.membershipType = ? AND um.status = 'active'
        ORDER BY u.lastName ASC, u.firstName ASC
    `;

    db.all(query, [membershipType], (err, rows: any[]) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        // Convert to CSV
        const headers = ['id', 'firstName', 'lastName', 'email', 'registrationNumber', 'emergencyContactName', 'emergencyContactMobile', 'pronouns', 'dietaryRequirements', 'membershipType', 'membershipStatus', 'membershipYear'];
        const csvContent = convertToCSV(rows || [], headers);

        // Set appropriate headers for CSV download
        const filename = `members-${membershipType}-${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvContent);
    });
});

// Helper function to escape CSV values
function escapeCSV(value: any): string {
    if (value === null || value === undefined) {
        return '';
    }
    const stringValue = String(value);
    // Escape quotes and wrap in quotes if necessary
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

// Helper function to convert data to CSV string
function convertToCSV(data: any[], headers: string[]): string {
    const headerRow = headers.join(',');
    const rows = data.map(row =>
        headers.map(header => escapeCSV(row[header])).join(',')
    );
    return [headerRow, ...rows].join('\n');
}

export default router;
