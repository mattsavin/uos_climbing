import { apiFetch } from '../api/http';

interface AuditEntry {
    id: string;
    actorEmail: string | null;
    action: string;
    entityType: string | null;
    entityId: string | null;
    details: Record<string, unknown> | null;
    createdAt: number;
}

function escapeHTML(s: unknown): string {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function loadAuditLog(): Promise<void> {
    const list = document.getElementById('audit-log-list');
    if (!list) return;

    try {
        const entries: AuditEntry[] = await apiFetch('/api/admin/audit-log?limit=50');
        if (!entries.length) {
            list.innerHTML = '<p class="text-slate-500 text-center py-4">No activity recorded yet.</p>';
            return;
        }
        list.innerHTML = entries
            .map(e => {
                const when = new Date(e.createdAt).toLocaleString('en-GB');
                return `<div class="py-2 flex flex-col gap-0.5">
                    <span class="text-white font-bold">${escapeHTML(e.action)}</span>
                    <span class="text-slate-400">${escapeHTML(e.actorEmail ?? 'unknown')} &middot; ${escapeHTML(when)}</span>
                </div>`;
            })
            .join('');
    } catch {
        list.innerHTML = '<p class="text-red-400 text-center py-4">Failed to load audit log.</p>';
    }
}

export function initAuditLogViewer(): void {
    document.getElementById('load-audit-log-btn')?.addEventListener('click', () => void loadAuditLog());
    void loadAuditLog();
}
