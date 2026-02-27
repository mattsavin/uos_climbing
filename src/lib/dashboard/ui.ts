import { authState, getCurrentAcademicYear } from '../../auth';
import { renderSessions } from './sessions';
import { showToast } from '../../utils';
import { config } from '../../config';

async function copyTextWithFallback(text: string): Promise<boolean> {
    try {
        if (window.isSecureContext && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // Fall through to legacy copy fallback.
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    let copied = false;
    try {
        copied = document.execCommand('copy');
    } catch {
        copied = false;
    } finally {
        document.body.removeChild(textArea);
    }

    return copied;
}

export async function updateUI() {
    const user = authState.getUser();

    if (user) {
        const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || user.email;
        const dashboardContent = document.getElementById('dashboard-content');
        const userNameSpan = document.getElementById('user-name');
        const statusBadge = document.getElementById('status-badge');
        const userRegNo = document.getElementById('user-reg-no');
        const userRole = document.getElementById('user-role');
        const manageTypesShortcut = document.getElementById('manage-types-shortcut');
        const addSessionToggleBtn = document.getElementById('add-session-toggle-btn');
        const addSessionFormContainer = document.getElementById('add-session-form-container');
        const icalLinkAll = document.getElementById('ical-link-all') as HTMLAnchorElement | null;
        const icalLinkBooked = document.getElementById('ical-link-booked') as HTMLAnchorElement | null;
        const adminPortalCard = document.getElementById('admin-portal-card'); // Element to toggle

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
                        showToast(err.message || 'Renewal failed', 'error');
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

        if (userNameSpan) userNameSpan.textContent = displayName;
        if (userRegNo) userRegNo.textContent = user.registrationNumber || 'N/A';
        if (userRole) userRole.textContent = user.role;

        // Render individual membership types
        const membershipsContainer = document.getElementById('memberships-container');
        const addMbTypeSelect = document.getElementById('additional-membership-type') as HTMLSelectElement;
        const ALL_MEMBERSHIP_TYPES = config.membershipAddons.map((m: any) => ({
            value: m.id,
            label: m.label
        }));

        if (membershipsContainer) {
            membershipsContainer.innerHTML = '<div class="flex justify-center"><div class="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-gold"></div></div>';
            try {
                const memberships = await authState.getMyMemberships();
                const heldTypes = new Set(
                    memberships
                        .filter(m => (m.status === 'active' || m.status === 'pending') && m.membershipYear === currentYearStr)
                        .map(m => m.membershipType as string)
                );

                const hasActiveRow = memberships.some(m => m.status === 'active' && m.membershipYear === currentYearStr);
                const isCommittee = user.role === 'committee' || !!user.committeeRole || (Array.isArray(user.committeeRoles) && user.committeeRoles.length > 0);
                const derivedStatus = (hasActiveRow || isCommittee) ? 'active' : user.membershipStatus;

                if (statusBadge) {
                    statusBadge.className = 'px-4 py-3 rounded-lg text-center font-bold tracking-widest uppercase mb-4 shadow-[0_0_15px_rgba(0,0,0,0.2)]';
                    if (derivedStatus === 'active') {
                        statusBadge.classList.add('bg-brand-gold-muted/20', 'border', 'border-brand-gold-muted', 'text-brand-gold-muted');
                        statusBadge.textContent = `Active ${user.membershipYear || currentYearStr}`;
                    } else if (derivedStatus === 'pending') {
                        statusBadge.classList.add('bg-amber-500/20', 'border', 'border-amber-500', 'text-amber-500');
                        statusBadge.textContent = `Pending ${user.membershipYear || currentYearStr}`;
                    } else {
                        statusBadge.classList.add('bg-red-500/20', 'border', 'border-red-500', 'text-red-500');
                        statusBadge.textContent = 'Action Required';
                    }
                }

                if (memberships.length === 0) {
                    membershipsContainer.innerHTML = '<p class="text-xs text-slate-500 text-center uppercase tracking-wider">No memberships</p>';
                } else {
                    membershipsContainer.innerHTML = memberships.map(m => {
                        let colorClass = 'bg-slate-800 text-slate-400 border-slate-700';
                        if (m.status === 'active') colorClass = 'bg-brand-gold/10 text-brand-gold border-brand-gold/20';
                        else if (m.status === 'pending') colorClass = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
                        else if (m.status === 'rejected') colorClass = 'bg-red-500/10 text-red-400 border-red-500/20';
                        const foundMb = config.membershipTypes.find((mt: any) => mt.id === m.membershipType);
                        const typeLabel = foundMb ? foundMb.label.split(' ')[0] : m.membershipType;
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

                if (addMbTypeSelect) {
                    addMbTypeSelect.innerHTML = ALL_MEMBERSHIP_TYPES.map(t => {
                        const held = heldTypes.has(t.value);
                        return `<option value="${t.value}" ${held ? 'disabled' : ''}>${t.label}${held ? ' (already held)' : ''}</option>`;
                    }).join('');
                    const firstAvailable = addMbTypeSelect.querySelector('option:not([disabled])') as HTMLOptionElement | null;
                    if (firstAvailable) addMbTypeSelect.value = firstAvailable.value;
                }

                document.querySelectorAll<HTMLInputElement>('input[name="renewalMembershipType"]').forEach(cb => {
                    if (heldTypes.has(cb.value as string)) {
                        cb.checked = true;
                        cb.disabled = true;
                        cb.title = 'You already have this membership';
                        (cb.closest('label') as HTMLElement | null)?.style.setProperty('opacity', '0.6');
                    }
                });

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
                    showToast(e.message || 'Failed to re-request', 'error');
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

        if (reqAddMbBtn && addMbSelector && !reqAddMbBtn.hasAttribute('data-init')) {
            reqAddMbBtn.setAttribute('data-init', 'true');
            reqAddMbBtn.addEventListener('click', () => {
                addMbSelector.classList.toggle('hidden');
            });

            cancelAddMbBtn?.addEventListener('click', () => {
                addMbSelector.classList.add('hidden');
            });

            submitAddMbBtn?.addEventListener('click', async () => {
                const type = (document.getElementById('additional-membership-type') as HTMLSelectElement).value;
                try {
                    submitAddMbBtn.textContent = '...';
                    (submitAddMbBtn as HTMLButtonElement).disabled = true;
                    await authState.requestMembershipType(type, currentYearStr);
                    addMbSelector.classList.add('hidden');
                    updateUI(); // Refresh state
                } catch (e: any) {
                    showToast(e.message || 'Failed to request membership', 'error');
                } finally {
                    submitAddMbBtn.textContent = 'Request';
                    (submitAddMbBtn as HTMLButtonElement).disabled = false;
                }
            });
        }

        // Committee Portal Toggle
        const isCommittee = user.role === 'committee' || !!user.committeeRole || (Array.isArray(user.committeeRoles) && user.committeeRoles.length > 0);

        if (isCommittee) {
            if (adminPortalCard) adminPortalCard.classList.remove('hidden');
            if (manageTypesShortcut) {
                manageTypesShortcut.classList.remove('hidden');
                manageTypesShortcut.onclick = () => {
                    window.location.href = '/admin.html';
                };
            }
            if (addSessionToggleBtn) addSessionToggleBtn.classList.remove('hidden');
        } else {
            if (adminPortalCard) adminPortalCard.classList.add('hidden');
            if (manageTypesShortcut) manageTypesShortcut.classList.add('hidden');
            if (addSessionToggleBtn) addSessionToggleBtn.classList.add('hidden');
            if (addSessionFormContainer) addSessionFormContainer.classList.add('hidden');
        }

        const bookedLink = `${window.location.origin}/api/sessions/ical/${user.calendarToken}`;
        const allLink = `${window.location.origin}/api/sessions/ical/${user.calendarToken}/all`;
        if (icalLinkAll) {
            icalLinkAll.dataset.link = allLink;
            icalLinkAll.href = allLink;
        }
        if (icalLinkBooked) {
            icalLinkBooked.dataset.link = bookedLink;
            icalLinkBooked.href = bookedLink;
        }

        await renderSessions(isCommittee);

    } else {
        window.location.href = '/login.html';
    }
}

export function initGeneralHandlers() {
    const logoutBtn = document.getElementById('logout-btn');
    const icalLinkAll = document.getElementById('ical-link-all');
    const icalLinkBooked = document.getElementById('ical-link-booked');

    const attachIcalCopy = (el: HTMLElement | null, label: string) => {
        if (!el) return;
        el.addEventListener('click', async (e) => {
            e.preventDefault();
            const link = el.dataset.link;
            if (link) {
                const copied = await copyTextWithFallback(link);
                if (copied) {
                    showToast(`Copied ${label} iCal link to your clipboard!`, 'success');
                } else {
                    window.prompt(`Copy your ${label} iCal link:`, link);
                    showToast('Could not copy link. Try manually selecting it if possible.', 'error');
                }
            }
        });
    };

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await authState.logout();
            window.location.href = '/login.html';
        });
    }

    attachIcalCopy(icalLinkAll as HTMLElement | null, 'all sessions');
    attachIcalCopy(icalLinkBooked as HTMLElement | null, 'booked sessions');
}
