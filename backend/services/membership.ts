import { db } from '../db';

export function getMembershipTypeIds(callback: (err: Error | null, ids: string[]) => void) {
    db.all('SELECT id FROM membership_types', [], (err, rows: any[]) => {
        if (err) return callback(err as any, []);
        callback(null, (rows || []).map((r: any) => r.id));
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

export function getMembershipLabel(membershipType: string, callback: (label: string) => void) {
    db.get('SELECT label FROM membership_types WHERE id = ?', [membershipType], (err, row: any) => {
        if (err || !row?.label) return callback(membershipType);
        callback(row.label);
    });
}
