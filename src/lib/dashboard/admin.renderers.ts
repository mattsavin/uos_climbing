import type { User } from '../../auth';
import { escapeHTML } from '../../utils';

type MemberRowRenderContext = {
    membershipTypeLabel: (typeId: string) => string;
    currentUserId?: string;
    currentUserEmail?: string;
};

export function createPendingMembershipRow(
    user: User,
    membership: any,
    membershipTypeLabel: (typeId: string) => string
) {
    const displayName = `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() || user.name || user.email;
    const safeName = escapeHTML(displayName);
    const safeEmail = escapeHTML(user.email);
    const safeRegNo = escapeHTML(user.registrationNumber || '');
    const regLabel = safeRegNo ? `<span class="px-2 py-0.5 mt-1 font-mono text-[10px] bg-slate-800 text-slate-300 rounded block w-fit">REG: ${safeRegNo}</span>` : '';

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

export function createMemberRow(user: User, isPending: boolean, context: MemberRowRenderContext) {
    const displayName = `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() || user.name || user.email;
    const safeName = escapeHTML(displayName);
    const safeEmail = escapeHTML(user.email);
    const safeRegNo = escapeHTML(user.registrationNumber || '');

    const regLabel = safeRegNo ? `<p class="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Reg: ${safeRegNo}</p>` : '';

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
    const isSelf = user.id === context.currentUserId;

    if (!isPending) {
        const isCommittee = user.role === 'committee' || !!user.committeeRole || (Array.isArray(user.committeeRoles) && user.committeeRoles.length > 0);
        const isRootAdmin = context.currentUserEmail === 'committee@sheffieldclimbing.org';

        if (isCommittee) {
            const ROLES = [
                'Chair', 'Secretary', 'Treasurer', 'Welfare & Inclusions',
                'Team Captain', 'Social Sec', "Women's Captain",
                "Men's Captain", 'Publicity', 'Kit & Safety Sec'
            ];

            const currentRoles: string[] = (user as any).committeeRoles || [];

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

    const memberships: any[] = (user as any).memberships || [];
    const activeMemberships = memberships.filter((m: any) => m.status === 'active' || m.status === 'rejected');
    const typeLabel = (t: string) => context.membershipTypeLabel(t);

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