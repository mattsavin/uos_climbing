import { adminApi } from '../../auth';
import { showConfirmModal, showPromptModal, showToast } from '../../utils';

type CommitteeRole = {
    id: string;
    label: string;
};

// Helper to generate ID from label (kebab-case)
function generateIdFromLabel(label: string): string {
    return label
        .toLowerCase()
        .trim()
        .replace(/[&]/g, 'and')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

export async function renderCommitteeRoles() {
    const listContainer = document.getElementById('committee-roles-list');
    if (!listContainer) return;

    try {
        const roles = await adminApi.getAvailableRoles() as CommitteeRole[];

        if (roles.length === 0) {
            listContainer.innerHTML = '<div class="p-8 text-center text-slate-500 text-sm italic">No committee roles configured.</div>';
            return;
        }

        listContainer.innerHTML = roles.map((r: CommitteeRole) => `
            <div class="flex items-center justify-between p-4 bg-slate-800/20 hover:bg-slate-800/40 transition-colors border-b border-white/5 last:border-0">
                <div>
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-white">${r.label}</span>
                    </div>
                    <p class="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">${r.id}</p>
                </div>
                <div class="flex gap-2">
                    <button class="edit-committee-role-btn p-2 text-slate-500 hover:text-cyan-300 transition-colors"
                            data-id="${r.id}"
                            data-label="${r.label}"
                            title="Rename Role">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.586-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.414-8.586z"></path>
                        </svg>
                    </button>
                    <button class="delete-committee-role-btn p-2 transition-colors text-slate-500 hover:text-red-400"
                            data-id="${r.id}"
                            data-label="${r.label}"
                            title="Delete Role">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');

        listContainer.querySelectorAll('.edit-committee-role-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.currentTarget as HTMLElement;
                const id = target.dataset.id!;
                const existingLabel = target.dataset.label!;
                const nextLabel = await showPromptModal('Enter the updated role label:', existingLabel);
                if (!nextLabel || !nextLabel.trim() || nextLabel.trim() === existingLabel) return;

                try {
                    await adminApi.updateCommitteeRole(id, nextLabel.trim());
                    showToast('Committee role updated', 'success');
                    await renderCommitteeRoles();
                    window.dispatchEvent(new CustomEvent('dashboardUpdate'));
                } catch (err: any) {
                    showToast(err.message || 'Failed to update committee role', 'error');
                }
            });
        });

        listContainer.querySelectorAll('.delete-committee-role-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.currentTarget as HTMLElement;
                const id = target.dataset.id!;
                const label = target.dataset.label!;
                const confirmed = await showConfirmModal(`Delete the "${label}" committee role? Remove the role from all users first.`);
                if (!confirmed) return;
                try {
                    await adminApi.deleteCommitteeRole(id);
                    showToast('Committee role removed', 'success');
                    await renderCommitteeRoles();
                    window.dispatchEvent(new CustomEvent('dashboardUpdate'));
                } catch (err: any) {
                    showToast(err.message || 'Failed to delete committee role', 'error');
                }
            });
        });
    } catch (err: any) {
        listContainer.innerHTML = `<div class="p-8 text-center text-red-400 text-sm">Failed to load committee roles: ${err.message}</div>`;
    }
}

export function initCommitteeRoleHandlers() {
    const addBtn = document.getElementById('add-committee-role-btn');
    if (!addBtn) return;

    addBtn.addEventListener('click', async () => {
        const label = await showPromptModal('Enter a label for the new role:', 'e.g. Safety Officer');
        if (!label || !label.trim()) return;

        const id = generateIdFromLabel(label.trim());

        try {
            await adminApi.addCommitteeRole(id, label.trim());
            showToast('Committee role added', 'success');
            await renderCommitteeRoles();
            window.dispatchEvent(new CustomEvent('dashboardUpdate'));
        } catch (err: any) {
            showToast(err.message || 'Failed to add committee role', 'error');
        }
    });
}
