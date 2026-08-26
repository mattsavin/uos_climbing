import crypto from 'crypto';
import { dbRun } from '../utils/db';

export interface AuditActor {
    id?: string;
    email?: string;
}

/**
 * Append a row to the admin audit trail.
 *
 * Fire-and-forget by design: audit failures are logged but must never break
 * the action being audited (the primary mutation may have already committed).
 * Never store PII beyond the actor's own identity and the action metadata.
 */
export async function logAudit(
    actor: AuditActor | undefined | null,
    action: string,
    entityType?: string,
    entityId?: string,
    details?: Record<string, unknown>
): Promise<void> {
    try {
        await dbRun(
            'INSERT INTO audit_log (id, actorId, actorEmail, action, entityType, entityId, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                'audit_' + crypto.randomUUID(),
                actor?.id ?? null,
                actor?.email ?? null,
                action,
                entityType ?? null,
                entityId ?? null,
                details ? JSON.stringify(details) : null,
                Date.now()
            ]
        );
    } catch (err) {
        console.error(`[audit] failed to record "${action}":`, err);
    }
}
