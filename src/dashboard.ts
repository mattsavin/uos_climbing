/**
 * Dashboard Entry Point
 * Initializes the main dashboard interface by injecting modal components,
 * registering global update events, and starting specific module handlers (sessions, profile, admin).
 * Fetches the user's initial auth state payload upon booting.
 * 
 * @module Dashboard
 */
import './style.css';
import { authState } from './auth';
import { updateUI, initGeneralHandlers } from './lib/dashboard/ui';
import { initSessionHandlers } from './lib/dashboard/sessions';
import { initAdminConfirm } from './lib/dashboard/admin';
import { initProfileHandlers, initAccountModalHandlers } from './lib/dashboard/profile';
import { initProfilePhotoCropEditor } from './lib/dashboard/profile.photoEditor';
import { initCommitteeProfileHandlers } from './lib/dashboard/committee';
import { membershipRenewalModalHtml, accountManagerModalHtml, adminConfirmModalHtml, membershipCardModalHtml, profilePhotoCropModalHtml } from './components';

document.addEventListener('DOMContentLoaded', () => {
    // Inject components
    // The dashboard relies on HTML String injection to keep the primary DOM payload light.
    // Modals are hidden by default and activated via their respective UI controllers.
    const app = document.getElementById('app');
    if (app) {
        app.insertAdjacentHTML('beforeend', membershipRenewalModalHtml);
        app.insertAdjacentHTML('beforeend', accountManagerModalHtml);
        app.insertAdjacentHTML('beforeend', profilePhotoCropModalHtml);
        app.insertAdjacentHTML('beforeend', adminConfirmModalHtml);
        app.insertAdjacentHTML('beforeend', membershipCardModalHtml);
    }
    // Listen for custom update events from modules
    // This pub-sub pattern allows deeply nested components to trigger top-level UI refreshes
    window.addEventListener('dashboardUpdate', () => {
        updateUI();
    });

    // Initialize Handlers
    // Binds event listeners to static DOM elements that already exist in the HTML skeleton
    initGeneralHandlers();
    initSessionHandlers();
    initAdminConfirm();
    initProfileHandlers();
    initAccountModalHandlers();
    const photoCropEditor = initProfilePhotoCropEditor();

    // Initial Boot
    // Resolving auth state guarantees the user payload is hydrated before any secure UI renders
    authState.init().then(() => {
        updateUI();
        // Committee handlers often require DOM nodes that are only injected *after* auth resolves
        initCommitteeProfileHandlers(photoCropEditor);
    });
});
