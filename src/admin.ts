import './style.css';
import { adminApi, authState } from './auth';
import { initAdminConfirm, renderAdminLists } from './lib/dashboard/admin';
import { initSessionTypeHandlers, renderSessionTypes } from './lib/dashboard/session-types';
import { initMembershipTypeHandlers, renderMembershipTypes } from './lib/dashboard/membership-types';
import { adminConfirmModalHtml } from './components';
import { showToast } from './utils';

document.addEventListener('DOMContentLoaded', () => {
    // Inject components
    const app = document.getElementById('app');
    if (app) {
        app.insertAdjacentHTML('beforeend', adminConfirmModalHtml);
    }

    // Listen for custom update events
    window.addEventListener('dashboardUpdate', () => {
        renderAdminLists();
        renderSessionTypes();
        renderMembershipTypes();
    });

    // Initialize Handlers
    initAdminConfirm();
    initSessionTypeHandlers();
    initMembershipTypeHandlers();

    // Authenticate and check permissions
    authState.init().then(() => {
        const user = authState.getUser();
        const rootTestEmailBtn = document.getElementById('root-send-test-email-btn') as HTMLButtonElement | null;
        if (!user) {
            window.location.href = '/login.html';
            return;
        }

        const isCommittee = user.role === 'committee' || !!user.committeeRole || (Array.isArray(user.committeeRoles) && user.committeeRoles.length > 0);

        // Boot non-committee users back to dashboard
        if (!isCommittee && user.email !== 'committee@sheffieldclimbing.org') {
            window.location.href = '/dashboard.html';
            return;
        }

        const userEmail = (user.email || '').toLowerCase().trim();
        const isRootAdmin = userEmail === 'committee@sheffieldclimbing.org';

        if (isRootAdmin && rootTestEmailBtn) {
            rootTestEmailBtn.classList.remove('hidden');
            // Remove any existing listener before adding (though unlikely here)
            const newBtn = rootTestEmailBtn.cloneNode(true) as HTMLButtonElement;
            rootTestEmailBtn.parentNode?.replaceChild(newBtn, rootTestEmailBtn);

            newBtn.addEventListener('click', async () => {
                newBtn.disabled = true;
                const prevText = newBtn.textContent || 'Send Test Email';
                newBtn.textContent = 'Sending...';
                try {
                    const result = await adminApi.sendTestEmail() as any;
                    if (result?.sent) {
                        showToast(`Test email sent to ${result.target}`, 'success');
                    } else {
                        showToast('Email provider is not configured, test send skipped.', 'error');
                    }
                } catch (err: any) {
                    showToast(err.message || 'Failed to send test email', 'error');
                } finally {
                    newBtn.disabled = false;
                    newBtn.textContent = prevText;
                }
            });
        }

        renderAdminLists();
        renderSessionTypes();
        renderMembershipTypes();
    });
});
