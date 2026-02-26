import './style.css';
import { authState } from './auth';
import { initAdminConfirm, renderAdminLists } from './lib/dashboard/admin';
import { initSessionTypeHandlers, renderSessionTypes } from './lib/dashboard/session-types';
import { adminConfirmModalHtml } from './components';

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
    });

    // Initialize Handlers
    initAdminConfirm();
    initSessionTypeHandlers();

    // Authenticate and check permissions
    authState.init().then(() => {
        const user = authState.getUser();

        if (!user) {
            window.location.href = '/login.html';
            return;
        }

        const isCommittee = user.role === 'committee' || !!user.committeeRole || (Array.isArray(user.committeeRoles) && user.committeeRoles.length > 0);

        // Boot non-committee users back to dashboard
        if (!isCommittee && user.email !== 'sheffieldclimbing@gmail.com') {
            window.location.href = '/dashboard.html';
            return;
        }

        renderAdminLists();
        renderSessionTypes();
    });
});