import { adminApi, authState, getCurrentAcademicYear, type MembershipType } from '../../auth';
import { renderSessions } from './sessions';
import { showToast } from '../../utils';

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

        let membershipTypes: MembershipType[] = [];
        try {
            membershipTypes = await adminApi.getMembershipTypes();
        } catch {
            membershipTypes = [];
        }

        const defaultMembershipType = membershipTypes.find(t => t.id === 'basic')?.id || membershipTypes[0]?.id || 'basic';
        const membershipTypeLabelMap = Object.fromEntries(membershipTypes.map(t => [t.id, t.label]));

        const renewalMembershipTypesContainer = document.getElementById('renewal-membership-types');
        if (renewalMembershipTypesContainer) {
            if (membershipTypes.length === 0) {
                renewalMembershipTypesContainer.innerHTML = '<p class="text-xs text-red-400">No membership types configured.</p>';
            } else {
                renewalMembershipTypesContainer.innerHTML = membershipTypes.map(t => `
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" name="renewalMembershipType" value="${t.id}" ${t.id === defaultMembershipType ? 'checked' : ''}
                            class="mt-0.5 accent-brand-gold w-4 h-4 shrink-0" />
                        <div>
                            <span class="text-white text-xs font-bold">${t.label}</span>
                        </div>
                    </label>
                `).join('');
            }
        }

        // Check membership renewal
        const currentYearStr = getCurrentAcademicYear();
        const renewalOverlay = document.getElementById('membership-renewal-overlay');
        const confirmRenewalBtn = document.getElementById('confirm-renewal-btn');
        const renewalYearText = document.getElementById('renewal-year-text');

        if (user.membershipYear !== currentYearStr && user.email !== 'committee@sheffieldclimbing.org') {
            if (renewalOverlay && confirmRenewalBtn && renewalYearText) {
                renewalYearText.textContent = currentYearStr;
                renewalOverlay.classList.remove('hidden');

                confirmRenewalBtn.addEventListener('click', async () => {
                    const selectedTypes: string[] = [];
                    document.querySelectorAll<HTMLInputElement>('input[name="renewalMembershipType"]:checked').forEach(cb => {
                        selectedTypes.push(cb.value);
                    });
                    if (selectedTypes.length === 0) selectedTypes.push(defaultMembershipType);

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
        const ALL_MEMBERSHIP_TYPES = membershipTypes.map((m: any) => ({
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
                        const typeLabel = membershipTypeLabelMap[m.membershipType] || m.membershipType;
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

        // --- NEW: Membership Card Population ---
        const membershipCardContainer = document.getElementById('membership-card-container');
        if (membershipCardContainer) {
            const hasActiveMembership = (user.membershipStatus === 'active' || user.role === 'committee');
            if (hasActiveMembership) {
                membershipCardContainer.classList.remove('hidden');
                const cardName = document.getElementById('card-user-name');
                const cardReg = document.getElementById('card-user-reg');
                const cardYear = document.getElementById('card-academic-year');

                if (cardName) cardName.textContent = displayName;
                if (cardReg) cardReg.textContent = `ID: ${user.registrationNumber || '12345678'}`;
                if (cardYear) cardYear.textContent = user.membershipYear || currentYearStr;
            } else {
                membershipCardContainer.classList.add('hidden');
            }
        }

        // --- NEW: Skills Tracker Initialisation ---
        initSkillsTracker(user.id || user.email);

    } else {
        window.location.href = '/login.html';
    }
}

function initSkillsTracker(userId: string) {
    const list = document.getElementById('skills-tracker-list');
    if (!list) return;

    const storageKey = `uos_climb_skills_${userId}`;
    const skills = [
        { id: 'registered', label: 'Registered at Local Wall' },
        { id: 'belay', label: 'Learned to Belay (Ropes)' },
        { id: 'first_blue', label: 'Sent first Blue V1-V2' },
        { id: 'first_lead', label: 'First Outdoor Lead (Peak)' },
        { id: 'v5', label: 'Sent a Purple (V4-V5)' },
        { id: 'comp', label: 'Entered First Competition' }
    ];

    let completed: string[] = JSON.parse(localStorage.getItem(storageKey) || '[]');

    const render = () => {
        list.innerHTML = skills.map(skill => {
            const isDone = completed.includes(skill.id);
            return `
                <div class="flex items-center gap-3 group cursor-pointer skill-item" data-id="${skill.id}">
                    <div class="w-5 h-5 rounded border border-white/10 flex items-center justify-center group-hover:bg-white/5 transition-colors ${isDone ? 'bg-cyan-500/20 border-cyan-500/50' : ''}">
                        ${isDone ? '<svg class="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>' : ''}
                    </div>
                    <span class="text-xs ${isDone ? 'text-white font-bold' : 'text-slate-400'} transition-colors">${skill.label}</span>
                </div>
            `;
        }).join('');

        // Update progress bar
        const progressPercent = Math.round((completed.length / skills.length) * 100);
        const progressText = document.querySelector('#skills-tracker-list + div span:last-child');
        const progressBar = document.querySelector('#skills-tracker-list + div + div div');

        if (progressText) progressText.textContent = `${completed.length}/${skills.length}`;
        if (progressBar) (progressBar as HTMLElement).style.width = `${progressPercent}%`;

        // Add click listeners
        list.querySelectorAll('.skill-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                if (!id) return;
                if (completed.includes(id)) {
                    completed = completed.filter(i => i !== id);
                } else {
                    completed.push(id);
                }
                localStorage.setItem(storageKey, JSON.stringify(completed));
                render();
            });
        });
    };

    render();
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
