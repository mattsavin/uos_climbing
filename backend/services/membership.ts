import { db } from '../db';

/**
 * Fetch a list of active membership type IDs.
 *
 * @param {(err: Error | null, ids: string[]) => void} callback - A callback yielding the array of string IDs.
 */
export function getMembershipTypeIds(callback: (err: Error | null, ids: string[]) => void) {
    db.all('SELECT id FROM membership_types', [], (err, rows: any[]) => {
        if (err) return callback(err as any, []);
        callback(null, (rows || []).map((r: any) => r.id));
    });
}

/**
 * Fetch the 'default' membership type. 
 * Prioritizes 'basic' if available, otherwise falls back to the first alphabetical type.
 *
 * @param {(err: Error | null, membershipTypeId: string | null) => void} callback - A callback yielding the default type ID.
 */
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

/**
 * Map a raw membershipType ID to its human-readable label.
 * Falls back to the raw ID if not found in the database.
 *
 * @param {string} membershipType - The ID of the membership type (e.g., 'comp_team').
 * @param {(label: string) => void} callback - A callback yielding the resolved label.
 */
export function getMembershipLabel(membershipType: string, callback: (label: string) => void) {
    db.get('SELECT label FROM membership_types WHERE id = ?', [membershipType], (err, row: any) => {
        if (err || !row?.label) return callback(membershipType);
        callback(row.label);
    });
}
