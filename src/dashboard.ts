import './style.css';
import { authState, adminApi, type User, type Session, getCurrentAcademicYear } from './auth';
import { renderCalendarEvents } from './calendar';
import { openSessionModal } from './components/sessionModal';

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const dashboardContent = document.getElementById('dashboard-content');
    const logoutBtn = document.getElementById('logout-btn');

    // Dashboard Elements
    const userNameSpan = document.getElementById('user-name');
    const statusBadge = document.getElementById('status-badge');
    const userRegNo = document.getElementById('user-reg-no');
    const userRole = document.getElementById('user-role');
    const committeePanel = document.getElementById('committee-panel');

    // Calendar & Session Elements
    const calendarGrid = document.getElementById('calendar-grid');
    const calendarMonthDisplay = document.getElementById('calendar-month-display');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const icalLink = document.getElementById('ical-link') as HTMLAnchorElement | null;

    const addSessionToggleBtn = document.getElementById('add-session-toggle-btn');
    const addSessionFormContainer = document.getElementById('add-session-form-container');
    const addSessionForm = document.getElementById('add-session-form');
    const cancelSessionBtn = document.getElementById('cancel-session-btn');

    let currentCalendarDate = new Date();

    // Admin Panel Elements
    const pendingList = document.getElementById('pending-list');
    const activeList = document.getElementById('active-list');

    // Profile Elements
    const profileForm = document.getElementById('profile-form');
    const profileName = document.getElementById('profile-name') as HTMLInputElement;
    const profilePronouns = document.getElementById('profile-pronouns') as HTMLInputElement;
    const profileDietary = document.getElementById('profile-dietary') as HTMLInputElement;
    const profileEmergencyName = document.getElementById('profile-emergency-name') as HTMLInputElement;
    const profileEmergencyMobile = document.getElementById('profile-emergency-mobile') as HTMLInputElement;
    const profileSuccess = document.getElementById('profile-success');
    const profileError = document.getElementById('profile-error');

    // Account Manager Elements
    const accountModal = document.getElementById('account-manager-modal');
    const accountBackdrop = document.getElementById('account-manager-backdrop');
    const closeAccountBtn = document.getElementById('close-account-modal-btn');
    const openAccountBtn = document.getElementById('open-account-manager-btn');
    const tabProfile = document.getElementById('tab-profile-settings');
    const tabPassword = document.getElementById('tab-password-settings');
    const paneProfile = document.getElementById('account-profile-pane');
    const panePassword = document.getElementById('account-password-pane');

    const passwordForm = document.getElementById('password-form');
    const passCurrent = document.getElementById('password-current') as HTMLInputElement;
    const passNew = document.getElementById('password-new') as HTMLInputElement;
    const passConfirm = document.getElementById('password-confirm') as HTMLInputElement;
    const passSuccess = document.getElementById('password-success');
    const passError = document.getElementById('password-error');

    // Admin Confirm Elements
    const adminConfirmModal = document.getElementById('admin-confirm-modal');
    const adminConfirmBackdrop = document.getElementById('admin-confirm-backdrop');
    const adminConfirmCancelBtn = document.getElementById('admin-confirm-cancel-btn');
    const adminConfirmProceedBtn = document.getElementById('admin-confirm-proceed-btn');

    // Old Voting portal variables were removed

    // --- UI State Management ---
    async function updateUI() {
        const user = authState.getUser();

        if (user) {
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
                        try {
                            confirmRenewalBtn.textContent = 'Renewing...';
                            (confirmRenewalBtn as HTMLButtonElement).disabled = true;
                            await authState.confirmMembershipRenewal(currentYearStr);
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
                // slight delay to let layout shift then fade in
                setTimeout(() => {
                    dashboardContent.classList.remove('opacity-0');
                }, 50);
            }

            // Populate basic info
            if (userNameSpan) userNameSpan.textContent = user.name;
            if (userRegNo) userRegNo.textContent = user.registrationNumber || 'N/A';
            if (userRole) userRole.textContent = user.role;

            // Populate status badge
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

            // Populate profile form
            if (profileName) profileName.value = user.name || '';
            if (profilePronouns) profilePronouns.value = user.pronouns || '';
            if (profileDietary) profileDietary.value = user.dietaryRequirements || '';
            if (profileEmergencyName) profileEmergencyName.value = user.emergencyContactName || '';
            if (profileEmergencyMobile) profileEmergencyMobile.value = user.emergencyContactMobile || '';
            if (profileSuccess) profileSuccess.classList.add('hidden');
            if (profileError) profileError.classList.add('hidden');

            // Handle Committee Panel Visibility & Session Actions
            if (user.role === 'committee') {
                if (committeePanel) committeePanel.classList.remove('hidden');
                if (addSessionToggleBtn) addSessionToggleBtn.classList.remove('hidden');
                // renderAdminLists() is handled separately or hoisted.
                await renderAdminLists();
            } else {
                if (committeePanel) committeePanel.classList.add('hidden');
                if (addSessionToggleBtn) addSessionToggleBtn.classList.add('hidden');
                if (addSessionFormContainer) addSessionFormContainer.classList.add('hidden');
            }

            // Set Personal iCal Link
            if (icalLink) {
                icalLink.dataset.link = `${window.location.origin}/api/ical/${user.id}`;
            }

            // Render shared capabilities
            await renderSessions(user.role === 'committee');

        } else {
            // User shouldn't be here since auth check happens at init
            window.location.href = '/login.html';
        }
    }

    // --- Session & Calendar Management ---
    async function renderSessions(isAdmin: boolean) {
        if (!calendarGrid || !calendarMonthDisplay) return;

        const sessions = await adminApi.getSessions();
        let myBookings: string[] = [];
        if (authState.getUser()) {
            myBookings = await adminApi.getMyBookings();
        }

        renderCalendarEvents(
            calendarGrid,
            calendarMonthDisplay,
            currentCalendarDate,
            sessions,
            myBookings,
            isAdmin,
            async (session: Session, isBooked: boolean) => {
                openSessionModal({
                    session,
                    isBooked,
                    user: authState.user,
                    onBook: async (id) => {
                        await adminApi.bookSession(id);
                        await renderSessions(isAdmin);
                    },
                    onCancel: async (id) => {
                        await adminApi.cancelSession(id);
                        await renderSessions(isAdmin);
                    },
                    onEditSuccess: async () => {
                        await renderSessions(isAdmin);
                    },
                    onDeleteSuccess: async () => {
                        await renderSessions(isAdmin);
                    }
                });
            }
        );
    }

    if (prevMonthBtn) prevMonthBtn.addEventListener('click', async () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1); await renderSessions(authState.getUser()?.role === 'committee'); });
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', async () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1); await renderSessions(authState.getUser()?.role === 'committee'); });

    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = profileForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;
            if (profileSuccess) profileSuccess.classList.add('hidden');
            if (profileError) profileError.classList.add('hidden');

            try {
                if (submitBtn) submitBtn.disabled = true;
                if (submitBtn) submitBtn.textContent = 'Updating...';

                await authState.updateProfile(
                    profileName.value.trim(),
                    profileEmergencyName.value.trim(),
                    profileEmergencyMobile.value.trim(),
                    profilePronouns.value.trim(),
                    profileDietary.value.trim()
                );

                if (profileSuccess) profileSuccess.classList.remove('hidden');

                // Update header info text implicitly
                if (userNameSpan) userNameSpan.textContent = authState.user?.name || '';
            } catch (err: any) {
                if (profileError) {
                    profileError.textContent = err.message || 'Failed to update profile setting.';
                    profileError.classList.remove('hidden');
                }
            } finally {
                if (submitBtn) submitBtn.disabled = false;
                if (submitBtn) submitBtn.textContent = 'Save Profile';
            }
        });
    }

    // Account Manager Logic
    function closeAccountModal() {
        if (accountModal) accountModal.classList.add('hidden');
    }

    if (openAccountBtn) openAccountBtn.addEventListener('click', () => {
        if (accountModal) accountModal.classList.remove('hidden');
        if (profileSuccess) profileSuccess.classList.add('hidden');
        if (profileError) profileError.classList.add('hidden');
        if (passSuccess) passSuccess.classList.add('hidden');
        if (passError) passError.classList.add('hidden');
    });

    [closeAccountBtn, accountBackdrop].forEach(el => {
        if (el) el.addEventListener('click', closeAccountModal);
    });

    if (tabProfile && tabPassword && paneProfile && panePassword) {
        tabProfile.addEventListener('click', () => {
            paneProfile.classList.remove('hidden');
            panePassword.classList.add('hidden');
            tabProfile.classList.replace('text-slate-500', 'text-purple-400');
            tabProfile.classList.replace('border-transparent', 'border-purple-400');
            tabPassword.classList.replace('text-purple-400', 'text-slate-500');
            tabPassword.classList.replace('border-purple-400', 'border-transparent');
        });
        tabPassword.addEventListener('click', () => {
            panePassword.classList.remove('hidden');
            paneProfile.classList.add('hidden');
            tabPassword.classList.replace('text-slate-500', 'text-purple-400');
            tabPassword.classList.replace('border-transparent', 'border-purple-400');
            tabProfile.classList.replace('text-purple-400', 'text-slate-500');
            tabProfile.classList.replace('border-purple-400', 'border-transparent');
        });
    }

    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = passwordForm.querySelector('button[type="submit"]') as HTMLButtonElement | null;
            if (passSuccess) passSuccess.classList.add('hidden');
            if (passError) passError.classList.add('hidden');

            try {
                if (passNew.value !== passConfirm.value) {
                    throw new Error("New passwords do not match.");
                }

                if (submitBtn) submitBtn.disabled = true;
                if (submitBtn) submitBtn.textContent = 'Updating...';

                await authState.changePassword(passCurrent.value, passNew.value);

                if (passSuccess) passSuccess.classList.remove('hidden');
                (passwordForm as HTMLFormElement).reset();
            } catch (err: any) {
                if (passError) {
                    passError.textContent = err.message || 'Failed to update password.';
                    passError.classList.remove('hidden');
                }
            } finally {
                if (submitBtn) submitBtn.disabled = false;
                if (submitBtn) submitBtn.textContent = 'Update Password';
            }
        });
    }

    // Admin Confirmation Modal Logic
    let confirmActionCallback: (() => Promise<void>) | null = null;

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
                    await updateUI();
                }
            }
        });
    }

    function requestAdminConfirmation(title: string, message: string, callback: () => Promise<void>) {
        const titleEl = document.getElementById('admin-confirm-title');
        const msgEl = document.getElementById('admin-confirm-message');
        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;
        confirmActionCallback = callback;
        if (adminConfirmModal) adminConfirmModal.classList.remove('hidden');
    }

    // Handle Add Session Toggle
    if (addSessionToggleBtn && addSessionFormContainer) {
        addSessionToggleBtn.addEventListener('click', () => {
            addSessionFormContainer.classList.toggle('hidden');
        });
    }

    if (cancelSessionBtn && addSessionFormContainer) {
        cancelSessionBtn.addEventListener('click', () => {
            addSessionFormContainer.classList.add('hidden');
        });
    }

    // Handle Create Session
    if (addSessionForm) {
        addSessionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = (document.getElementById('session-title') as HTMLInputElement).value;
            const type = (document.getElementById('session-type') as HTMLSelectElement).value as any;
            const dateStr = (document.getElementById('session-date') as HTMLInputElement).value;
            const capacity = parseInt((document.getElementById('session-capacity') as HTMLInputElement).value, 10);

            if (title && type && dateStr && !isNaN(capacity)) {
                await adminApi.addSession({ title, type, date: dateStr, capacity });
                (addSessionForm as HTMLFormElement).reset();
                addSessionFormContainer?.classList.add('hidden');

                // If added session is not in currently viewed month, we might still want to rerender,
                // but usually user expects to see it. It will rerender.
                await renderSessions(true);
            }
        });
    }

    let activeRosterPage = 1;
    const ITEMS_PER_PAGE = 5;

    // --- Admin Logic ---
    async function renderAdminLists() {
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

                        // Show tiny success indication, then rerender
                        target.style.borderColor = '#10b981'; // emerald-500
                        setTimeout(async () => {
                            await renderAdminLists();
                        }, 500);

                    } catch (err: any) {
                        alert(err.message || 'Failed to update role');
                        target.disabled = false;
                        target.value = target.dataset.original || ''; // revert on error
                    }
                }
            });
            // Store original value for revert
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
                // Determine available roles for selection
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

                // Only root admin can demote, and cannot demote themselves.
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

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            authState.logout();
            await updateUI();
        });
    }

    const deleteSelfAccountBtn = document.getElementById('delete-self-account-btn');
    if (deleteSelfAccountBtn) {
        deleteSelfAccountBtn.addEventListener('click', () => {
            const pwd = prompt("Please enter your password to confirm account deletion:");
            if (pwd) {
                deleteSelfAccountBtn.textContent = 'Deleting...';
                (deleteSelfAccountBtn as HTMLButtonElement).disabled = true;
                authState.deleteAccount(pwd).then(() => {
                    window.location.href = '/login.html';
                }).catch(err => {
                    alert(err.message || "Failed to delete account");
                    deleteSelfAccountBtn.textContent = 'Delete Account';
                    (deleteSelfAccountBtn as HTMLButtonElement).disabled = false;
                });
            }
        });
    }

    if (icalLink) {
        icalLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const link = icalLink.dataset.link;
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

    // Initial Boot
    authState.init().then(() => {
        updateUI();
    });
});
