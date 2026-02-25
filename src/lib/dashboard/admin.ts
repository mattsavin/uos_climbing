import { adminApi, authState, type User } from '../../auth';

let confirmActionCallback: (() => Promise<void>) | null = null;
let activeRosterPage = 1;
const ITEMS_PER_PAGE = 5;

export function initAdminConfirm() {
    const adminConfirmModal = document.getElementById('admin-confirm-modal');
    const adminConfirmBackdrop = document.getElementById('admin-confirm-backdrop');
    const adminConfirmCancelBtn = document.getElementById('admin-confirm-cancel-btn');
    const adminConfirmProceedBtn = document.getElementById('admin-confirm-proceed-btn');

    function closeAdminConfirm() {
        if (adminConfirmModal) adminConfirmModal.classList.add('hidden');
        confirmActionCallback = null;
    }

    [adminConfirmCancelBtn, adminConfirmBackdrop].forEach(el => {
        if (el) el.addEventListener('click', closeAdminConfirm);
    });

    if (adminConfirmProceedBtn) {
        adminConfirmProceedBtn.addEventListener('click', async () => {
            if (confirmActionCallback) {
                try {
                    const btn = adminConfirmProceedBtn as HTMLButtonElement;
                    btn.disabled = true;
                    btn.textContent = 'Processing...';
                    await confirmActionCallback();
                } catch (err: any) {
                    alert(err.message || 'Action failed');
                } finally {
                    const btn = adminConfirmProceedBtn as HTMLButtonElement;
                    btn.disabled = false;
                    btn.textContent = 'Proceed';
                    closeAdminConfirm();
                    // We need a way to trigger UI update. 
                    // Maybe pass a callback or dispatch an event.
                    window.dispatchEvent(new CustomEvent('dashboardUpdate'));
                }
            }
        });
    }
}

export function requestAdminConfirmation(title: string, message: string, callback: () => Promise<void>) {
    const titleEl = document.getElementById('admin-confirm-title');
    const msgEl = document.getElementById('admin-confirm-message');
    const adminConfirmModal = document.getElementById('admin-confirm-modal');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    confirmActionCallback = callback;
    if (adminConfirmModal) adminConfirmModal.classList.remove('hidden');
}

export async function renderAdminLists() {
    const pendingList = document.getElementById('pending-list');
    const activeList = document.getElementById('active-list');

    if (!pendingList || !activeList) return;

    // Render Pending
    const allUsers = await adminApi.getAllUsers();
    const pending = allUsers.filter(u => u.membershipStatus === 'pending');
    pendingList.innerHTML = pending.length ? pending.map(u => createMemberRow(u, true)).join('') : '<p class="p-5 text-sm text-slate-500 text-center">No pending registrations.</p>';

    // Render Active
    const allActive = await adminApi.getActiveMembers();
    const totalActive = allActive.length;

    // Pagination logic
    const totalPages = Math.ceil(totalActive / ITEMS_PER_PAGE) || 1;
    if (activeRosterPage > totalPages) activeRosterPage = totalPages;

    const startIdx = (activeRosterPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const pagedActive = allActive.slice(startIdx, endIdx);

    let activeHtml = pagedActive.length ? pagedActive.map(u => createMemberRow(u, false)).join('') : '<p class="p-5 text-sm text-slate-500 text-center">No active members yet.</p>';

    if (totalActive > ITEMS_PER_PAGE) {
        activeHtml += `
            <div class="px-5 py-3 border-t border-slate-700 flex justify-between items-center text-xs text-slate-400">
                <div>Showing ${startIdx + 1}-${Math.min(endIdx, totalActive)} of ${totalActive} Members</div>
                <div class="flex gap-2">
                    <button class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50" ${activeRosterPage === 1 ? 'disabled' : ''} id="prev-member-page-btn">Prev</button>
                    <button class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50" ${activeRosterPage >= totalPages ? 'disabled' : ''} id="next-member-page-btn">Next</button>
                </div>
            </div>
        `;
    }

    activeList.innerHTML = activeHtml;

    // Attach pagination listeners
    const prevPageBtn = document.getElementById('prev-member-page-btn');
    const nextPageBtn = document.getElementById('next-member-page-btn');
    if (prevPageBtn) prevPageBtn.addEventListener('click', async () => { activeRosterPage--; await renderAdminLists(); });
    if (nextPageBtn) nextPageBtn.addEventListener('click', async () => { activeRosterPage++; await renderAdminLists(); });

    // Attach Event Listeners to generated action buttons
    document.querySelectorAll('.admin-action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            const button = target.closest('.admin-action-btn') as HTMLElement;
            const action = button.dataset.action;
            const id = button.dataset.id;
            const name = button.dataset.name;

            if (id && action) {
                let title = 'Confirm Action';
                let message = `Are you sure you want to perform this action?`;
                let actionCallback: () => Promise<any> = async () => { };

                if (action === 'approve') {
                    title = 'Approve Member'; message = `Are you sure you want to approve ${name} for active membership?`;
                    actionCallback = async () => adminApi.approveMember(id);
                }
                if (action === 'reject') {
                    title = 'Reject Member'; message = `Are you sure you want to reject ${name}'s membership registration?`;
                    actionCallback = async () => adminApi.rejectMember(id);
                }
                if (action === 'promote') {
                    title = 'Promote to Admin'; message = `Are you sure you want to promote ${name} to committee admin? They will have full access.`;
                    actionCallback = async () => adminApi.promoteToCommittee(id);
                }
                if (action === 'demote') {
                    title = 'Remove Admin'; message = `Are you sure you want to remove admin privileges for ${name}?`;
                    actionCallback = async () => adminApi.demoteToMember(id);
                }
                if (action === 'delete') {
                    title = 'Delete Member'; message = `Are you absolutely sure you want to permanently delete ${name}'s account? This action cannot be undone.`;
                    actionCallback = async () => adminApi.deleteUser(id);
                }

                requestAdminConfirmation(title, message, actionCallback);
            }
        });
    });

    // Attach Event Listeners to role dropdowns
    document.querySelectorAll('.admin-role-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const target = e.target as HTMLSelectElement;
            const id = target.dataset.id;
            const role = target.value || null; // empty string becomes null

            if (id) {
                try {
                    target.disabled = true;
                    await adminApi.setCommitteeRole(id, role);

                    target.style.borderColor = '#10b981'; // emerald-500
                    setTimeout(async () => {
                        await renderAdminLists();
                    }, 500);

                } catch (err: any) {
                    alert(err.message || 'Failed to update role');
                    target.disabled = false;
                    target.value = (target as any).dataset.original || ''; // revert on error
                }
            }
        });
        (select as HTMLElement).dataset.original = (select as HTMLSelectElement).value;
    });
}

function createMemberRow(user: User, isPending: boolean) {
    const regLabel = user.registrationNumber ? `<span class="px-2 py-0.5 mt-1 font-mono text-[10px] bg-slate-800 text-slate-300 rounded block w-fit">REG: ${user.registrationNumber}</span>` : '';

    let actions = '';
    if (isPending) {
        actions = `
            <button class="admin-action-btn p-2 text-brand-gold-muted hover:bg-brand-gold-muted/10 rounded transition-colors" data-action="approve" data-id="${user.id}" data-name="${user.name}" title="Approve Member">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            </button>
            <button class="admin-action-btn p-2 text-red-400 hover:bg-red-400/10 rounded transition-colors" data-action="reject" data-id="${user.id}" data-name="${user.name}" title="Reject Member">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        `;
    }

    let committeeRoleSelector = '';

    if (!isPending) {
        const isCommittee = user.role === 'committee';
        const isRootAdmin = authState.user?.email === 'sheffieldclimbing@gmail.com';

        if (isCommittee) {
            const roles = [
                'Chair', 'Secretary', 'Treasurer', 'Welfare & Inclusions',
                'Team Captain', 'Social Sec', "Women's Captain",
                "Men's Captain", 'Publicity', 'Kit & Safety Sec'
            ];

            let options = `<option value="">-- No Specific Role --</option>`;
            roles.forEach(r => {
                options += `<option value="${r}" ${user.committeeRole === r ? 'selected' : ''}>${r}</option>`;
            });

            committeeRoleSelector = `
                <div class="mt-2 text-xs text-slate-400 flex items-center gap-2">
                    <span>Role:</span>
                    <select class="admin-role-select bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white focus:outline-none focus:border-brand-gold w-48" data-id="${user.id}">
                        ${options}
                    </select>
                </div>
            `;

            if (isRootAdmin && user.email !== 'sheffieldclimbing@gmail.com') {
                actions = `
                    <button class="admin-action-btn text-xs font-bold px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded hover:bg-amber-500/20" data-action="demote" data-id="${user.id}" data-name="${user.name}">
                        Remove Admin
                    </button>
                `;
            }
        } else {
            actions = `
                <button class="admin-action-btn text-xs font-bold px-3 py-1 bg-brand-gold/10 text-brand-gold border border-brand-gold/30 rounded hover:bg-brand-gold/20 mr-1" data-action="promote" data-id="${user.id}" data-name="${user.name}">
                    Make Admin
                </button>
                <button class="admin-action-btn text-xs font-bold px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/30 rounded hover:bg-red-500/20" data-action="delete" data-id="${user.id}" data-name="${user.name}">
                    Delete
                </button>
            `;
        }
    }

    return `
        <div class="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
            <div>
                <h4 class="text-sm font-bold text-white">${user.name} ${user.role === 'committee' ? '<span class="text-[10px] ml-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-500 rounded uppercase tracking-widest">Admin</span>' : ''}</h4>
                <p class="text-xs text-slate-400">${user.email}</p>
                ${regLabel}
                ${committeeRoleSelector}
            </div>
            <div class="flex items-center gap-2">
                ${actions}
            </div>
        </div>
    `;
}
