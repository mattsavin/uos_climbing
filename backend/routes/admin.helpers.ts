import { randomUUID } from 'crypto';
import { db } from '../db';

export const ROOT_ADMIN_EMAIL = (process.env.ROOT_ADMIN_EMAIL || 'committee@sheffieldclimbing.org').toLowerCase();

export function isRootAdmin(user: any): boolean {
    return !!user
        && user.role === 'committee'
        && typeof user.email === 'string'
        && user.email.toLowerCase() === ROOT_ADMIN_EMAIL;
}

export function getMembershipLabel(membershipType: string, callback: (label: string) => void) {
    db.get('SELECT label FROM membership_types WHERE id = ?', [membershipType], (err, row: any) => {
        if (err || !row?.label) return callback(membershipType);
        callback(row.label);
    });
}

export function getDefaultMembershipType(callback: (err: Error | null, membershipTypeId: string | null) => void) {
    db.get(
        `SELECT id FROM membership_types
         ORDER BY CASE WHEN id = 'basic' THEN 0 ELSE 1 END, label ASC
         LIMIT 1`,
        [],
        (err, row: any) => {
            if (err) return callback(err as any, null);
            callback(null, row?.id || null);
        }
    );
}

export function getCurrentAcademicYear(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return m < 8 ? `${y - 1}/${y}` : `${y}/${y + 1}`;
}

export function academicYearFromSubscriptionText(text: string): string | null {
    const normalized = (text || '').trim();
    if (!normalized) return null;

    const m1 = normalized.match(/(\d{4})\s*[-/]\s*(\d{2,4})/);
    if (m1) {
        const startYear = Number(m1[1]);
        let endYear = Number(m1[2]);
        if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return null;
        if (m1[2].length === 2) {
            endYear = Math.floor(startYear / 100) * 100 + endYear;
        }
        if (endYear < startYear) endYear += 100;
        return `${startYear}/${endYear}`;
    }

    const m2 = normalized.match(/(^|[^\d])(\d{2})\s*[-/]\s*(\d{2})([^\d]|$)/);
    if (m2) {
        const startYear = 2000 + Number(m2[2]);
        let endYear = 2000 + Number(m2[3]);
        if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return null;
        if (endYear < startYear) endYear += 100;
        return `${startYear}/${endYear}`;
    }

    return null;
}

export function runDb(sql: string, params: any[] = []): Promise<{ changes: number }> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ changes: this.changes || 0 });
        });
    });
}

export function getDb(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

export function newMembershipRowId(): string {
    return `umem_${randomUUID()}`;
}

export function parseSuRoster(raw: string) {
    const lines = raw
        .split(/\r?\n/)
        .map((l: string) => l.trim())
        .filter(Boolean);

    const parsed: { registrationNumber: string; fullName: string; membershipYear: string }[] = [];
    const skipped: { line: string; reason: string }[] = [];
    let yearParsedFromSubscription = 0;
    let yearFallbackUsed = 0;

    for (const line of lines) {
        const tabCols = line.split('\t').map((c) => c.trim()).filter(Boolean);
        const cols = tabCols.length >= 5 ? tabCols : line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
        if (cols.length < 5) {
            skipped.push({ line, reason: 'Expected 5 columns' });
            continue;
        }

        const registrationNumber = (cols[0] || '').trim();
        const fullName = (cols[1] || '').trim();
        const subscriptionPurchased = (cols[3] || '').trim();
        const membershipYearFromSub = academicYearFromSubscriptionText(subscriptionPurchased);
        const membershipYear = membershipYearFromSub || getCurrentAcademicYear();

        if (!/^\d{6,12}$/.test(registrationNumber)) {
            skipped.push({ line, reason: 'Invalid registration number' });
            continue;
        }

        if (membershipYearFromSub) yearParsedFromSubscription++;
        else yearFallbackUsed++;

        parsed.push({ registrationNumber, fullName, membershipYear });
    }

    return {
        lines,
        parsed,
        skipped,
        yearParsedFromSubscription,
        yearFallbackUsed
    };
}