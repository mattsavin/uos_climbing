import { authState, getCurrentAcademicYear } from '../../auth';
import { renderSessions } from './sessions';
import { renderAdminLists } from './admin';

export async function updateUI() {
    const user = authState.getUser();

    if (user) {
        const dashboardContent = document.getElementById('dashboard-content');
        const userNameSpan = document.getElementById('user-name');
        const statusBadge = document.getElementById('status-badge');
        const userRegNo = document.getElementById('user-reg-no');
        const userRole = document.getElementById('user-role');
        const committeePanel = document.getElementById('committee-panel');
        const addSessionToggleBtn = document.getElementById('add-session-toggle-btn');
        const addSessionFormContainer = document.getElementById('add-session-form-container');
        const icalLink = document.getElementById('ical-link') as HTMLAnchorElement | null;

        // Check membership renewal
        const currentYearStr = getCurrentAcademicYear();
        const renewalOverlay = document.getElementById('membership-renewal-overlay');
        const confirmRenewalBtn = document.getElementById('confirm-renewal-btn');
        const renewalYearText = document.getElementById('renewal-year-text');

        if (user.membershipYear !== currentYearStr && user.email !== 'sheffieldclimbing@gmail.com') {
            if (renewalOverlay && confirmRenewalBtn && renewalYearText) {
                renewalYearText.textContent = currentYearStr;
                renewalOverlay.classList.remove('hidden');

                confirmRenewalBtn.addEventListener('click', async () => {
                    const selectedTypes: string[] = [];
                    document.querySelectorAll<HTMLInputElement>('input[name="renewalMembershipType"]:checked').forEach(cb => {
                        selectedTypes.push(cb.value);
                    });
                    if (selectedTypes.length === 0) selectedTypes.push('basic');

                    try {
                        confirmRenewalBtn.textContent = 'Renewing...';
                        (confirmRenewalBtn as HTMLButtonElement).disabled = true;

                        await authState.confirmMembershipRenewal(currentYearStr, selectedTypes);

                        renewalOverlay.classList.add('hidden');
                        updateUI();
                    } catch (err: any) {
                        alert(err.message || 'Renewal failed');
                        confirmRenewalBtn.textContent = 'Confirm Registration Renewal';
                        (confirmRenewalBtn as HTMLButtonElement).disabled = false;
                    }
                }, { once: true });
            }
        }

        if (dashboardContent) {
            dashboardContent.classList.remove('hidden');
            setTimeout(() => {
                dashboardContent.classList.remove('opacity-0');
            }, 50);
        }

        if (userNameSpan) userNameSpan.textContent = user.name;
        if (userRegNo) userRegNo.textContent = user.registrationNumber || 'N/A';
        if (userRole) userRole.textContent = user.role;

        if (statusBadge) {
            statusBadge.className = 'px-4 py-3 rounded-lg text-center font-bold tracking-widest uppercase mb-4 shadow-[0_0_15px_rgba(0,0,0,0.2)]';
            if (user.membershipStatus === 'active') {
                statusBadge.classList.add('bg-brand-gold-muted/20', 'border', 'border-brand-gold-muted', 'text-brand-gold-muted');
                statusBadge.textContent = `Active ${user.membershipYear || ''}`;
            } else if (user.membershipStatus === 'pending') {
                statusBadge.classList.add('bg-amber-500/20', 'border', 'border-amber-500', 'text-amber-500');
                statusBadge.textContent = `Pending ${user.membershipYear || ''}`;
            } else {
                statusBadge.classList.add('bg-red-500/20', 'border', 'border-red-500', 'text-red-500');
                statusBadge.textContent = 'Action Required';
            }
        }

        // Render individual membership types
        const membershipsContainer = document.getElementById('memberships-container');
        if (membershipsContainer) {
            membershipsContainer.innerHTML = '<div class="flex justify-center"><div class="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-gold"></div></div>';
            try {
                const memberships = await authState.getMyMemberships();
                if (memberships.length === 0) {
                    membershipsContainer.innerHTML = '<p class="text-xs text-slate-500 text-center uppercase tracking-wider">No memberships</p>';
                } else {
                    membershipsContainer.innerHTML = memberships.map(m => {
                        let colorClass = 'bg-slate-800 text-slate-400 border-slate-700';
                        if (m.status === 'active') colorClass = 'bg-brand-gold/10 text-brand-gold border-brand-gold/20';
                        else if (m.status === 'pending') colorClass = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
                        else if (m.status === 'rejected') colorClass = 'bg-red-500/10 text-red-400 border-red-500/20';

                        const typeLabel = { basic: 'Basic', bouldering: 'Bouldering', comp_team: 'Comp Team' }[m.membershipType] || m.membershipType;

                        return `
                        <div class="flex items-center justify-between p-2 rounded border ${colorClass} mb-2 text-xs font-bold uppercase tracking-wide">
                            <div class="flex flex-col">
                                <span>${typeLabel}</span>
                                <span class="text-[9px] opacity-70">${m.membershipYear}</span>
                            </div>
                            <span>${m.status}</span>
                        </div>
                        `;
                    }).join('');
                }
            } catch (e) {
                membershipsContainer.innerHTML = '<p class="text-xs text-red-400 text-center uppercase tracking-wider">Failed to load</p>';
            }
        }

        // Action Required Section for rejected members
        const actionRequiredContainer = document.getElementById('action-required-container');
        if (actionRequiredContainer) {
            if (user.membershipStatus === 'rejected') {
                actionRequiredContainer.classList.remove('hidden');
            } else {
                actionRequiredContainer.classList.add('hidden');
            }
        }

        const reRequestBtn = document.getElementById('re-request-btn');
        if (reRequestBtn && !reRequestBtn.hasAttribute('data-initialized')) {
            reRequestBtn.setAttribute('data-initialized', 'true');
            reRequestBtn.addEventListener('click', async () => {
                try {
                    reRequestBtn.textContent = 'Requesting...';
                    (reRequestBtn as HTMLButtonElement).disabled = true;
                    await authState.requestMembership();
                    updateUI(); // Refresh state
                } catch (e: any) {
                    alert(e.message || 'Failed to re-request');
                    reRequestBtn.textContent = 'Re-request Membership';
                    (reRequestBtn as HTMLButtonElement).disabled = false;
                }
            });
        }

        // Additional Membership Logic
        const reqAddMbBtn = document.getElementById('request-additional-membership-btn');
        const addMbSelector = document.getElementById('additional-membership-selector');
        const cancelAddMbBtn = document.getElementById('cancel-additional-membership-btn');
        const submitAddMbBtn = document.getElementById('submit-additional-membership-btn');
        const addMbTypeSelect = document.getElementById('additional-membership-type') as HTMLSelectElement;

        if (reqAddMbBtn && addMbSelector && !reqAddMbBtn.hasAttribute('data-init')) {
            reqAddMbBtn.setAttribute('data-init', 'true');
            reqAddMbBtn.addEventListener('click', () => {
                addMbSelector.classList.toggle('hidden');
            });

            cancelAddMbBtn?.addEventListener('click', () => {
                addMbSelector.classList.add('hidden');
            });

            submitAddMbBtn?.addEventListener('click', async () => {
                const type = addMbTypeSelect.value;
                try {
                    submitAddMbBtn.textContent = '...';
                    (submitAddMbBtn as HTMLButtonElement).disabled = true;
                    await authState.requestMembershipType(type, currentYearStr);
                    addMbSelector.classList.add('hidden');
                    updateUI(); // Refresh state
                } catch (e: any) {
                    alert(e.message || 'Failed to request membership');
                } finally {
                    submitAddMbBtn.textContent = 'Request';
                    (submitAddMbBtn as HTMLButtonElement).disabled = false;
                }
            });
        }

        if (user.role === 'committee') {
            if (committeePanel) committeePanel.classList.remove('hidden');
            if (addSessionToggleBtn) addSessionToggleBtn.classList.remove('hidden');
            await renderAdminLists();
        } else {
            if (committeePanel) committeePanel.classList.add('hidden');
            if (addSessionToggleBtn) addSessionToggleBtn.classList.add('hidden');
            if (addSessionFormContainer) addSessionFormContainer.classList.add('hidden');
        }

        if (icalLink) {
            icalLink.dataset.link = `${window.location.origin}/api/sessions/ical/${user.calendarToken}`;
        }

        await renderSessions(user.role === 'committee');

    } else {
        window.location.href = '/login.html';
    }
}

export function initGeneralHandlers() {
    const logoutBtn = document.getElementById('logout-btn');
    const icalLink = document.getElementById('ical-link');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await authState.logout();
            window.location.href = '/login.html';
        });
    }

    if (icalLink) {
        icalLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const link = (icalLink as HTMLElement).dataset.link;
            if (link) {
                try {
                    await navigator.clipboard.writeText(link);
                    const toast = document.getElementById('toast-notification');
                    if (toast) {
                        toast.classList.remove('translate-y-10', 'opacity-0');
                        toast.classList.add('translate-y-0', 'opacity-100');
                        setTimeout(() => {
                            toast.classList.remove('translate-y-0', 'opacity-100');
                            toast.classList.add('translate-y-10', 'opacity-0');
                        }, 3000);
                    } else {
                        alert('Copied iCal link to your clipboard!');
                    }
                } catch (err) {
                    console.error('Failed to copy text: ', err);
                    alert('Could not copy link. Try manually selecting it if possible.');
                }
            }
        });
    }
}
