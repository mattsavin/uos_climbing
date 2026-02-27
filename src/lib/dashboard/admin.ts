import { adminApi, authState, type User } from '../../auth';
import { escapeHTML, showToast } from '../../utils';

let confirmActionCallback: (() => Promise<void>) | null = null;
let activeRosterPage = 1;
const ITEMS_PER_PAGE = 10;
let currentSearchQuery = '';
let membershipTypeLabelMap: Record<string, string> = {};

function membershipTypeLabel(typeId: string): string {
    return membershipTypeLabelMap[typeId] || typeId;
}

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
                    showToast(err.message || 'Action failed', 'error');
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

    // Save open dropdown states before re-rendering so we don't annoy the user
    // when they check a box and the list re-renders
    const openRoleDropdowns = new Set(
        Array.from(document.querySelectorAll('details.admin-role-details[open]')).map((d: any) => d.dataset.id)
    );

    if (!pendingList || !activeList) return;

    try {
        const [membershipTypes, allUsersRaw] = await Promise.all([
            adminApi.getMembershipTypes().catch(e => { console.error('Failed to fetch membership types', e); return []; }),
            adminApi.getAllUsersRaw()
        ]);

        membershipTypeLabelMap = Object.fromEntries(
            (Array.isArray(membershipTypes) ? membershipTypes : [])
                .map((t: any) => [t.id, t.label])
        );

        if (!Array.isArray(allUsersRaw)) {
            console.error('allUsersRaw is not an array', allUsersRaw);
            pendingList.innerHTML = '<p class="p-5 text-sm text-red-400 text-center">Failed to load member data.</p>';
            activeList.innerHTML = '<p class="p-5 text-sm text-red-400 text-center">Failed to load member data.</p>';
            return;
        }

        // Flatten ALL pending membership rows (across all users)
        const pendingMemberships: any[] = [];
        allUsersRaw.forEach(u => {
            if (u.memberships && Array.isArray(u.memberships)) {
                (u.memberships as any[]).forEach(m => {
                    if (m.status === 'pending') {
                        pendingMemberships.push({ user: u, membership: m });
                    }
                });
            }
        });

        pendingList.innerHTML = pendingMemberships.length
            ? pendingMemberships.map(pm => createPendingMembershipRow(pm.user, pm.membership)).join('')
            : '<p class="p-5 text-sm text-slate-500 text-center">No pending registrations.</p>';

        // Render Active — committee members/role-holders + anyone with active membership data.
        const allActive = allUsersRaw.filter((u: any) => {
            const isCommittee = u.role === 'committee' || !!u.committeeRole || (Array.isArray(u.committeeRoles) && u.committeeRoles.length > 0);
            if (isCommittee) return true;
            const hasActiveMembershipRow = (u.memberships as any[] || []).some((m: any) => m.status === 'active');
            return hasActiveMembershipRow || u.membershipStatus === 'active';
        });

        // Apply search filter if query exists
        const filteredActive = allActive.filter(u => {
            if (!currentSearchQuery) return true;
            const q = currentSearchQuery.toLowerCase();
            const displayName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || '';
            const nameMatch = displayName.toLowerCase().includes(q);
            const emailMatch = (u.email || '').toLowerCase().includes(q);
            const regMatch = (u.registrationNumber || '').toLowerCase().includes(q);
            return nameMatch || emailMatch || regMatch;
        });

        const totalActive = filteredActive.length;

        // Optional: Render search input
        let searchHtml = `
            <div class="px-5 py-3 border-b border-white/10 bg-slate-900/30">
                <input type="text" id="roster-search-input" value="${escapeHTML(currentSearchQuery)}" placeholder="Search members by name, email, or reg no..." class="w-full bg-slate-800 text-sm text-white border border-slate-700 rounded-lg px-3 py-2 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none">
            </div>
        `;

        // Pagination logic
        const totalPages = Math.ceil(totalActive / ITEMS_PER_PAGE) || 1;
        if (activeRosterPage > totalPages) activeRosterPage = totalPages;

        const startIdx = (activeRosterPage - 1) * ITEMS_PER_PAGE;
        const endIdx = startIdx + ITEMS_PER_PAGE;
        const pagedActive = filteredActive.slice(startIdx, endIdx);

        let activeHtml = searchHtml;
        activeHtml += pagedActive.length ? pagedActive.map(u => createMemberRow(u, false)).join('') : '<p class="p-5 text-sm text-slate-500 text-center">No active members found.</p>';

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
    } catch (err: any) {
        console.error('Failed to render admin lists:', err);
        pendingList.innerHTML = '<p class="p-5 text-sm text-red-400 text-center">Failed to load member data.</p>';
        activeList.innerHTML = '<p class="p-5 text-sm text-red-400 text-center">Failed to load member data.</p>';
    }

    // Restore open state
    openRoleDropdowns.forEach(id => {
        const details = document.querySelector(`details.admin-role-details[data-id="${id}"]`) as HTMLDetailsElement | null;
        if (details) details.open = true;
    });

    // Attach search listener
    const searchInput = document.getElementById('roster-search-input') as HTMLInputElement | null;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = (e.target as HTMLInputElement).value;
            activeRosterPage = 1; // reset to first page on search
            renderAdminLists();
        });
        // Refocus to keep typing seamless
        if (currentSearchQuery) {
            searchInput.focus();
            const len = searchInput.value.length;
            searchInput.setSelectionRange(len, len);
        }
    }

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
                if (action === 'approve-membership') {
                    title = 'Approve Membership Type'; message = `Approve this specific membership type for ${name}?`;
                    actionCallback = async () => adminApi.approveMembershipRow(id);
                }
                if (action === 'reject-membership') {
                    title = 'Reject Membership Type'; message = `Reject this specific membership type for ${name}?`;
                    actionCallback = async () => adminApi.rejectMembershipRow(id);
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
                    if (id === authState.user?.id) {
                        showToast('You cannot delete your own account from the admin roster.', 'error');
                        return;
                    }
                    title = 'Delete Member'; message = `Are you absolutely sure you want to permanently delete ${escapeHTML(name)}'s account? This action cannot be undone.`;
                    actionCallback = async () => adminApi.deleteUser(id);
                }
                if (action === 'delete-membership') {
                    title = 'Remove Membership'; message = `Remove this membership from ${name}? This cannot be undone.`;
                    actionCallback = async () => adminApi.deleteMembershipRow(id);
                }

                requestAdminConfirmation(title, message, actionCallback);
            }
        });
    });

    // Attach Event Listeners to committee role checkboxes
    document.querySelectorAll('.admin-role-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const target = e.target as HTMLInputElement;
            const id = target.dataset.id;
            if (!id) return;

            // Collect all checked roles for this user
            const allChecked = Array.from(
                document.querySelectorAll<HTMLInputElement>(`.admin-role-checkbox[data-id="${id}"]:checked`)
            ).map(cb => cb.value);

            // Disable all checkboxes for this user while saving
            document.querySelectorAll<HTMLInputElement>(`.admin-role-checkbox[data-id="${id}"]`).forEach(cb => cb.disabled = true);

            try {
                await adminApi.setCommitteeRole(id, allChecked);
                // Brief visual confirmation
                setTimeout(async () => {
                    await renderAdminLists();
                }, 400);
            } catch (err: any) {
                showToast(err.message || 'Failed to update role', 'error');
                // Revert this checkbox
                target.checked = !target.checked;
                document.querySelectorAll<HTMLInputElement>(`.admin-role-checkbox[data-id="${id}"]`).forEach(cb => cb.disabled = false);
            }
        });
    });
}

function createPendingMembershipRow(user: User, membership: any) {
    const displayName = `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() || user.name || user.email;
    const safeName = escapeHTML(displayName);
    const safeEmail = escapeHTML(user.email);
    const safeRegNo = escapeHTML(user.registrationNumber || '');
    const regLabel = safeRegNo ? `<span class="px-2 py-0.5 mt-1 font-mono text-[10px] bg-slate-800 text-slate-300 rounded block w-fit">REG: ${safeRegNo}</span>` : '';

    // For pending memberships, we approve/reject the specific row
    const typeLabel = membershipTypeLabel(membership.membershipType as string);

    const actions = `
        <button class="admin-action-btn p-2 text-brand-gold-muted hover:bg-brand-gold-muted/10 rounded transition-colors" data-action="approve-membership" data-id="${membership.id}" data-name="${safeName} (${typeLabel})" title="Approve Membership">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
        </button>
        <button class="admin-action-btn p-2 text-red-400 hover:bg-red-400/10 rounded transition-colors" data-action="reject-membership" data-id="${membership.id}" data-name="${safeName} (${typeLabel})" title="Reject Membership">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
    `;

    return `
        <div class="p-4 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
            <div>
                <h4 class="text-sm font-bold text-white">${safeName}</h4>
                <p class="text-xs text-slate-400">${safeEmail}</p>
                ${regLabel}
            </div>
            <div class="flex items-center gap-4">
                <div class="text-right">
                    <span class="block text-xs font-bold text-brand-gold">${typeLabel}</span>
                    <span class="block text-[10px] text-slate-500">${membership.membershipYear}</span>
                </div>
                <div class="flex gap-1 ml-2 border-l border-white/10 pl-3">
                    ${actions}
                </div>
            </div>
        </div>
    `;
}

function createMemberRow(user: User, isPending: boolean) {
    const displayName = `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() || user.name || user.email;
    const safeName = escapeHTML(displayName);
    const safeEmail = escapeHTML(user.email);
    const safeRegNo = escapeHTML(user.registrationNumber || '');

    const regLabel = safeRegNo ? `<p class="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Reg: ${safeRegNo}</p>` : '';

    // Contact mapping helpers
    const pronounsLabel = user.pronouns ? `<span class="bg-white/10 text-slate-300 px-1.5 py-0.5 rounded ml-1">${escapeHTML(user.pronouns)}</span>` : '';
    const dietLabel = user.dietaryRequirements ? `<p class="text-[10px] text-red-300 mt-1 max-w-[200px] truncate" title="Dietary: ${escapeHTML(user.dietaryRequirements)}">⚠️ ${escapeHTML(user.dietaryRequirements)}</p>` : '';
    const emergencyInfo = (!isPending && (user.emergencyContactName || user.emergencyContactMobile))
        ? `<div class="mt-1 flex items-center gap-1.5 text-[9px] text-slate-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded w-max">
             <span class="text-red-400">🚨 ICE:</span>
             <span class="font-bold text-white">${escapeHTML(user.emergencyContactName || 'Unknown')}</span>
             <span>${escapeHTML(user.emergencyContactMobile || 'No number')}</span>
           </div>`
        : '';

    let actions = '';
    let committeeRoleSelector = '';
    const isSelf = user.id === authState.user?.id;

    if (!isPending) {
        const isCommittee = user.role === 'committee' || !!user.committeeRole || (Array.isArray(user.committeeRoles) && user.committeeRoles.length > 0);
        const isRootAdmin = authState.user?.email === 'committee@sheffieldclimbing.org';

        if (isCommittee) {
            const ROLES = [
                'Chair', 'Secretary', 'Treasurer', 'Welfare & Inclusions',
                'Team Captain', 'Social Sec', "Women's Captain",
                "Men's Captain", 'Publicity', 'Kit & Safety Sec'
            ];

            const currentRoles: string[] = (user as any).committeeRoles || [];

            // Build checkbox list for each possible role
            const checkboxRows = ROLES.map(r => {
                const checked = currentRoles.includes(r) ? 'checked' : '';
                const safeRole = escapeHTML(r);
                return `
                    <label class="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-pointer text-xs text-slate-300">
                        <input type="checkbox" class="admin-role-checkbox accent-amber-400 w-3.5 h-3.5 rounded" data-id="${user.id}" value="${safeRole}" ${checked}>
                        <span>${safeRole}</span>
                    </label>`;
            }).join('');

            const rolesBadge = currentRoles.length > 0
                ? `<span class="text-[10px] text-amber-400/80">${escapeHTML(currentRoles.join(', '))}</span>`
                : `<span class="text-[10px] text-slate-500">No specific roles</span>`;

            committeeRoleSelector = `
                <div class="mt-2">
                    <div class="mb-1">${rolesBadge}</div>
                    <details class="group admin-role-details" data-id="${user.id}">
                        <summary class="text-xs text-slate-400 cursor-pointer list-none flex items-center gap-1 hover:text-slate-200">
                            <svg class="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                            Edit Roles
                        </summary>
                        <div class="mt-1 pl-1 grid grid-cols-2 gap-0.5 border border-white/10 rounded p-2 bg-slate-900/50">
                            ${checkboxRows}
                        </div>
                    </details>
                </div>
            `;

            if (isRootAdmin && user.email !== 'committee@sheffieldclimbing.org') {
                actions = `
                    <button class="admin-action-btn text-xs font-bold px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded hover:bg-amber-500/20" data-action="demote" data-id="${user.id}" data-name="${safeName}">
                        Remove Admin
                    </button>
                `;
            }
        } else {
            actions = `
                <button class="admin-action-btn text-xs font-bold px-3 py-1 bg-brand-gold/10 text-brand-gold border border-brand-gold/30 rounded hover:bg-brand-gold/20 mr-1" data-action="promote" data-id="${user.id}" data-name="${safeName}">
                    Make Admin
                </button>
                ${isSelf ? '' : `
                <button class="admin-action-btn text-xs font-bold px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/30 rounded hover:bg-red-500/20" data-action="delete" data-id="${user.id}" data-name="${safeName}">
                    Delete
                </button>
                `}
            `;
        }
    }

    // Active roster row...
    const memberships: any[] = (user as any).memberships || [];
    const activeMemberships = memberships.filter((m: any) => m.status === 'active' || m.status === 'rejected');
    const typeLabel = (t: string) => membershipTypeLabel(t);

    const membershipsList = activeMemberships.length > 0 ? `
        <div class="mt-2">
            <details class="group">
                <summary class="text-xs text-slate-400 cursor-pointer list-none flex items-center gap-1 hover:text-slate-200">
                    <svg class="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                    Memberships (${activeMemberships.length})
                </summary>
                <div class="mt-1 space-y-1">
                    ${activeMemberships.map((m: any) => {
        const statusColor = m.status === 'active' ? 'text-emerald-400' : 'text-red-400';
        return `<div class="flex items-center justify-between px-2 py-1 rounded bg-slate-900/50 border border-white/5">
                            <span class="text-xs text-slate-300">${escapeHTML(typeLabel(m.membershipType))}</span>
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] ${statusColor}">${m.status}</span>
                                <button class="admin-action-btn text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded px-1 py-0.5 text-[10px] font-bold leading-none" data-action="delete-membership" data-id="${m.id}" data-name="${escapeHTML(safeName)} (${escapeHTML(typeLabel(m.membershipType))})" title="Remove membership">×</button>
                            </div>
                        </div>`;
    }).join('')}
                </div>
            </details>
        </div>
    ` : '';

    return `
        <div class="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
            <div>
                <h4 class="text-sm font-bold text-white">${safeName}${pronounsLabel} ${user.role === 'committee' ? '<span class="text-[10px] ml-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-500 rounded uppercase tracking-widest">Admin</span>' : ''}</h4>
                <p class="text-xs text-slate-400">${safeEmail}</p>
                ${regLabel}
                ${dietLabel}
                ${emergencyInfo}
                ${committeeRoleSelector}
                ${membershipsList}
            </div>
            <div class="flex flex-col items-end gap-2">
                <div class="flex items-center gap-2">${actions}</div>
            </div>
        </div>
    `;
}
