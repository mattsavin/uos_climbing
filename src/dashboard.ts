import './style.css';
import { authState } from './auth';
import { updateUI, initGeneralHandlers } from './lib/dashboard/ui';
import { initSessionHandlers } from './lib/dashboard/sessions';
import { initAdminConfirm } from './lib/dashboard/admin';
import { initProfileHandlers, initAccountModalHandlers } from './lib/dashboard/profile';
import { initCommitteeProfileHandlers } from './lib/dashboard/committee';
import { membershipRenewalModalHtml, accountManagerModalHtml, adminConfirmModalHtml } from './components';

document.addEventListener('DOMContentLoaded', () => {
    // Inject components
    const app = document.getElementById('app');
    if (app) {
        app.insertAdjacentHTML('beforeend', membershipRenewalModalHtml);
        app.insertAdjacentHTML('beforeend', accountManagerModalHtml);
        app.insertAdjacentHTML('beforeend', adminConfirmModalHtml);
    }
    // Listen for custom update events from modules
    window.addEventListener('dashboardUpdate', () => {
        updateUI();
    });

    // Initialize Handlers
    initGeneralHandlers();
    initSessionHandlers();
    initAdminConfirm();
    initProfileHandlers();
    initAccountModalHandlers();

    // Initial Boot
    authState.init().then(() => {
        updateUI();
        initCommitteeProfileHandlers();
    });
});
