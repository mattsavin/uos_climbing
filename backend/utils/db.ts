import { db } from '../db';

/**
 * Promisified SQLite helpers.
 *
 * New code should prefer these over raw db.get/db.all/db.run callbacks —
 * they flatten the callback pyramids that made auth flows hard to follow,
 * while preserving identical error semantics (reject on DB error).
 *
 * NOT for transactional blocks (booking/cancel/attendee removal): those
 * intentionally use db.serialize() with BEGIN/COMMIT so concurrent requests
 * cannot interleave statements between transaction boundaries. Keep them
 * callback-based unless transactions are redesigned deliberately.
 */

/** db.get — resolves with the row, or undefined when no row matches; rejects on DB error. */
export function dbGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err: Error | null, row: T) => (err ? reject(err) : resolve(row)));
    });
}

/** db.all — resolves with all matching rows (empty array if none); rejects on DB error. */
export function dbAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err: Error | null, rows: T[]) => (err ? reject(err) : resolve(rows ?? [])));
    });
}

export interface RunResult {
    changes: number;
}

/**
 * db.run — resolves with { changes }; rejects on DB error.
 * Use this for INSERT/UPDATE/DELETE where affected-row counts matter
 * (e.g. capacity-guarded booking updates rely on changes === 0).
 */
export function dbRun(sql: string, params: any[] = []): Promise<RunResult> {
    return new Promise((resolve, reject) => {
        // Non-arrow function is required here: `this` carries sqlite3's run metadata.
        db.run(sql, params, function (this: RunResult, err: Error | null) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
        });
    });
}
