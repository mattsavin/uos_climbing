import { standardDbResponse } from '../utils/response';
import express from 'express';
import { db } from '../db';
import { authenticateToken, requireCommittee } from '../middleware/auth';

const router = express.Router();


/**
 * Get all committee members.
 * Retrieves a list of users with the 'committee' role, aggregating their specific committee roles.
 *
 * @name GET/
 * @function
 * @memberof module:routers/committee
 * @param {express.Request} req - The incoming request object.
 * @param {express.Response} res - The outgoing response object.
 * @returns {void} Array of committee member objects.
 */
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

/**
 * Update current member's committee profile.
 * Allows a committee member to update specific fields like instagram, faveCrag, and bio.
 *
 * @name PUT/me
 * @function
 * @memberof module:routers/committee
 * @param {express.Request} req - The request object containing updated profile fields.
 * @param {express.Response} res - The response object.
 * @returns {void} Success status mapped by standardDbResponse.
 */
router.put('/me', authenticateToken, (req: any, res) => {
    if (req.user.role !== 'committee') {
        return res.status(403).json({ error: 'Only committee members can edit their committee profile' });
    }

    const { instagram, faveCrag, bio } = req.body;
    db.run(
        'UPDATE users SET instagram = ?, faveCrag = ?, bio = ? WHERE id = ?',
        [instagram, faveCrag, bio, req.user.id],
        standardDbResponse(res)
    );
});


/**
 * Export members with a verified membership type as CSV.
 * Fetches users who have an active status for the requested membership type and converts the result into a CSV download.
 *
 * @name GET/export/members
 * @function
 * @memberof module:routers/committee
 * @param {express.Request} req - The incoming request containing the membershipType query parameter.
 * @param {express.Response} res - The response object for initiating the file download.
 * @returns {void} The CSV string containing member details.
 */
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
