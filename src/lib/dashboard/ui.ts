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
            icalLink.dataset.link = `${window.location.origin}/api/ical/${user.id}`;
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
            authState.logout();
            await updateUI();
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
