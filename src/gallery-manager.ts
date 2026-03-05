import './style.css';
import { authState } from './auth';
import { initGalleryHandlers, renderGalleryList } from './lib/dashboard/gallery';
import { initAdminConfirm } from './lib/dashboard/admin';
import { adminConfirmModalHtml } from './components';

document.addEventListener('DOMContentLoaded', () => {
    // Inject components
    const app = document.getElementById('app');
    if (app) {
        app.insertAdjacentHTML('beforeend', adminConfirmModalHtml);
    }

    initAdminConfirm();

    // Initial Boot
    authState.init().then(() => {
        const user = authState.getUser();
        if (!user) {
            window.location.href = '/login';
            return;
        }
        if (user.role !== 'committee' && (user.role as string) !== 'admin' && (user.role as string) !== 'root') {
            window.location.href = '/dashboard';
            return;
        }

        initGalleryHandlers();
        renderGalleryList();
    });
});
