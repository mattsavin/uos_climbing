import express from 'express';
import crypto from 'crypto';
import { dbAll, dbGet, dbRun } from '../utils/db';
import { authenticateToken, requireCommittee } from '../middleware/auth';
import { logAudit } from '../services/audit';

/**
 * Trips API — docs/TRIPS_PLAN.md, phase 1.
 *
 * CRUD + roster reads only; member signup flow, payment tracking and
 * confirmation emails land in phases 2–3. Money fields are committee
 * bookkeeping records, never handled payments.
 */

const TRIP_STATUSES = ['open', 'closed', 'cancelled', 'completed'];
const VISIBILITIES = ['all', 'committee_only'];

const router = express.Router();

function isCommitteeUser(user: any): boolean {
    return (
        user.role === 'committee' ||
        !!user.committeeRole ||
        (Array.isArray(user.committeeRoles) && user.committeeRoles.length > 0)
    );
}

interface TripInput {
    title?: string;
    destination?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    meetupPoint?: string;
    costBreakdown?: Record<string, number> | string | null;
    totalCostPerPerson?: number;
    depositAmount?: number;
    capacity?: number;
    signupClosesAt?: string;
    requiredMembership?: string;
    visibility?: string;
    status?: string;
}

/** Validate create/edit payload; returns the error message or null if valid. */
function validateTrip(body: TripInput): string | null {
    const { title, destination, startDate, endDate, capacity, totalCostPerPerson, signupClosesAt } = body;

    if (!title || !destination || !startDate || !endDate || !signupClosesAt) {
        return 'Title, destination, start/end dates and sign-up deadline are required';
    }
    for (const d of [startDate, endDate, signupClosesAt]) {
        if (isNaN(new Date(d as string).getTime())) {
            return 'Dates must be valid ISO timestamps';
        }
    }
    if (new Date(endDate as string) < new Date(startDate as string)) {
        return 'End date cannot be before start date';
    }
    if (!Number.isFinite(capacity) || (capacity as number) < 1) {
        return 'Capacity must be a positive number';
    }
    if (!Number.isFinite(totalCostPerPerson) || (totalCostPerPerson as number) < 0) {
        return 'Total cost per person must be zero or more';
    }
    if (body.depositAmount !== undefined && body.depositAmount !== null) {
        if (!Number.isFinite(body.depositAmount) || body.depositAmount < 0) {
            return 'Deposit amount must be zero or more';
        }
        if (body.depositAmount > (totalCostPerPerson as number)) {
            return 'Deposit cannot exceed total cost per person';
        }
    }
    if (body.status !== undefined && !TRIP_STATUSES.includes(body.status)) {
        return `Status must be one of: ${TRIP_STATUSES.join(', ')}`;
    }
    if (body.visibility !== undefined && !VISIBILITIES.includes(body.visibility)) {
        return `Visibility must be one of: ${VISIBILITIES.join(', ')}`;
    }
    return null;
}

/** Normalise costBreakdown (object → JSON string, passthrough, or null). */
function normaliseCostBreakdown(cb: TripInput['costBreakdown']): string | null {
    if (cb === undefined || cb === null || cb === '') return null;
    if (typeof cb === 'string') return cb;
    return JSON.stringify(cb);
}

router.get('/', authenticateToken, async (req: any, res) => {
    try {
        // Mirrors sessions listing: committee-only trips hidden from members.
        const sql = isCommitteeUser(req.user)
            ? 'SELECT * FROM trips ORDER BY startDate ASC'
            : "SELECT * FROM trips WHERE COALESCE(visibility, 'all') != 'committee_only' AND status != 'cancelled' ORDER BY startDate ASC";
        res.json(await dbAll(sql));
    } catch {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/:id', authenticateToken, async (req: any, res) => {
    try {
        const trip = await dbGet<any>('SELECT * FROM trips WHERE id = ?', [req.params.id]);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });

        if (trip.visibility === 'committee_only' && !isCommitteeUser(req.user)) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        // Own signup embedded so the member view needs no second request
        const mySignup = await dbGet(
            'SELECT id, paymentStatus, paidAmount, signedUpAt, cancelledAt FROM trip_signups WHERE tripId = ? AND userId = ?',
            [req.params.id, req.user.id]
        );

        let signups: { taken: number }[] = [{ taken: 0 }];
        if (isCommitteeUser(req.user)) {
            signups = (await dbAll<{ taken: number }>(
                'SELECT COUNT(*) AS taken FROM trip_signups WHERE tripId = ? AND cancelledAt IS NULL',
                [req.params.id]
            )) as any[];
        }

        res.json({ ...trip, mySignup: mySignup ?? null, ...(signups[0] ? { spotsTaken: signups[0].taken } : {}) });
    } catch {
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/', authenticateToken, requireCommittee, async (req: any, res) => {
    const invalid = validateTrip(req.body);
    if (invalid) return res.status(400).json({ error: invalid });

    const id = 'trip_' + crypto.randomUUID();
    try {
        await dbRun(
            `INSERT INTO trips (id, title, destination, description, startDate, endDate, meetupPoint, costBreakdown, totalCostPerPerson, depositAmount, capacity, signupClosesAt, requiredMembership, visibility, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                req.body.title,
                req.body.destination,
                req.body.description || null,
                req.body.startDate,
                req.body.endDate,
                req.body.meetupPoint || null,
                normaliseCostBreakdown(req.body.costBreakdown),
                req.body.totalCostPerPerson,
                req.body.depositAmount ?? 0,
                req.body.capacity,
                req.body.signupClosesAt,
                req.body.requiredMembership || 'basic',
                req.body.visibility === 'committee_only' ? 'committee_only' : 'all',
                req.body.status && TRIP_STATUSES.includes(req.body.status) ? req.body.status : 'open'
            ]
        );
        void logAudit(req.user, 'trip.create', 'trip', id, { title: req.body.title });
        res.json({ success: true, id });
    } catch {
        res.status(500).json({ error: 'Database error' });
    }
});

router.put('/:id', authenticateToken, requireCommittee, async (req: any, res) => {
    const invalid = validateTrip(req.body);
    if (invalid) return res.status(400).json({ error: invalid });

    try {
        const { changes } = await dbRun(
            `UPDATE trips SET title = ?, destination = ?, description = ?, startDate = ?, endDate = ?, meetupPoint = ?, costBreakdown = ?, totalCostPerPerson = ?, depositAmount = ?, capacity = ?, signupClosesAt = ?, requiredMembership = ?, visibility = ?, status = ?
             WHERE id = ?`,
            [
                req.body.title,
                req.body.destination,
                req.body.description || null,
                req.body.startDate,
                req.body.endDate,
                req.body.meetupPoint || null,
                normaliseCostBreakdown(req.body.costBreakdown),
                req.body.totalCostPerPerson,
                req.body.depositAmount ?? 0,
                req.body.capacity,
                req.body.signupClosesAt,
                req.body.requiredMembership || 'basic',
                req.body.visibility === 'committee_only' ? 'committee_only' : 'all',
                req.body.status && TRIP_STATUSES.includes(req.body.status) ? req.body.status : 'open',
                req.params.id
            ]
        );
        if (changes === 0) return res.status(404).json({ error: 'Trip not found' });
        void logAudit(req.user, 'trip.update', 'trip', req.params.id, { title: req.body.title });
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Database error' });
    }
});

// Soft cancel: row survives with status='cancelled' so payment history and
// audit references stay intact. Signup/cancellation emails arrive in phase 2.
router.delete('/:id', authenticateToken, requireCommittee, async (req: any, res) => {
    try {
        const { changes } = await dbRun("UPDATE trips SET status = 'cancelled' WHERE id = ?", [req.params.id]);
        if (changes === 0) return res.status(404).json({ error: 'Trip not found' });
        void logAudit(req.user, 'trip.cancel', 'trip', req.params.id);
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Database error' });
    }
});

// Roster read (payment mutations are phase 3). Includes soft-cancelled rows:
// committee bookkeeping needs the full payment history.
router.get('/:id/signups', authenticateToken, requireCommittee, async (req, res) => {
    try {
        const trip = await dbGet<{ id: string }>('SELECT id FROM trips WHERE id = ?', [req.params.id]);
        if (!trip) return res.status(404).json({ error: 'Trip not found' });

        res.json(
            await dbAll(
                `
        SELECT ts.id, ts.userId, ts.signedUpAt, ts.paymentStatus, ts.paidAmount, ts.cancelledAt,
               u.name, u.email, u.registrationNumber
        FROM trip_signups ts
        JOIN users u ON u.id = ts.userId
        WHERE ts.tripId = ?
        ORDER BY ts.signedUpAt ASC
    `,
                [req.params.id]
            )
        );
    } catch {
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;
