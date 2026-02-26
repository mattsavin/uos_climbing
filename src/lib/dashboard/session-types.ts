import { adminApi } from '../../auth';
import { showToast, showConfirmModal, showPromptModal } from '../../utils';

export async function renderSessionTypes() {
    const listContainer = document.getElementById('session-types-list');
    if (!listContainer) return;

    try {
        const types = await adminApi.getSessionTypes();

        if (types.length === 0) {
            listContainer.innerHTML = '<div class="p-8 text-center text-slate-500 text-sm italic">No custom session types defined.</div>';
            return;
        }

        listContainer.innerHTML = types.map(t => `
            <div class="flex items-center justify-between p-4 bg-slate-800/20 hover:bg-slate-800/40 transition-colors">
                <div>
                    <span class="text-sm font-bold text-white">${t.label}</span>
                    <span class="block text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">ID: ${t.id}</span>
                </div>
                <div class="flex gap-2">
                    <button class="delete-type-btn p-2 text-slate-500 hover:text-red-400 transition-colors" data-id="${t.id}" title="Delete Type">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
        `).join('');

        // Attach listeners
        listContainer.querySelectorAll('.delete-type-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = (e.currentTarget as HTMLElement).dataset.id!;
                const confirmed = await showConfirmModal(`Are you sure you want to delete the "${id}" session type? This may affect existing sessions with this type.`);
                if (confirmed) {
                    try {
                        await adminApi.deleteSessionType(id);
                        showToast('Session type removed', 'success');
                        await renderSessionTypes();
                        // Trigger update of session dropdowns and filters
                        window.dispatchEvent(new CustomEvent('dashboardUpdate'));
                    } catch (err: any) {
                        showToast(err.message || 'Failed to delete type', 'error');
                    }
                }
            });
        });

    } catch (err: any) {
        listContainer.innerHTML = `<div class="p-8 text-center text-red-400 text-sm">Failed to load session types: ${err.message}</div>`;
    }
}

export function initSessionTypeHandlers() {
    const addBtn = document.getElementById('add-session-type-btn');
    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            const label = await showPromptModal('Enter a label for the new session type:', 'e.g. Lead Workshop');
            if (label && label.trim()) {
                try {
                    await adminApi.addSessionType(label.trim());
                    showToast('Session type added', 'success');
                    await renderSessionTypes();
                    // Trigger update of session dropdowns and filters
                    window.dispatchEvent(new CustomEvent('dashboardUpdate'));
                } catch (err: any) {
                    showToast(err.message || 'Failed to add type', 'error');
                }
            }
        });
    }
}
