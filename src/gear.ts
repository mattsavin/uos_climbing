import './style.css';
import { authState, gearApi, type GearItem } from './auth';
import { renderGearGrid, renderMyRequestsList, renderAllRequestsTable } from './lib/gear/ui';
import { showToast, showConfirmModal } from './utils';
import { gearRequestModalHtml } from './components';

let currentGear: GearItem[] = [];
let gearRequestTargetId: string | null = null;
let isKitSec = false;

document.addEventListener('DOMContentLoaded', async () => {
    // Inject components
    const app = document.getElementById('app');
    if (app) app.insertAdjacentHTML('beforeend', gearRequestModalHtml);

    await authState.init();
    const user = authState.getUser();

    if (!user) {
        window.location.href = '/login.html';
        return;
    }

    isKitSec = user.email === 'committee@sheffieldclimbing.org' || user.committeeRole === 'Kit & Safety Sec';

    if (isKitSec) {
        document.getElementById('committee-panel')?.classList.remove('hidden');
        document.getElementById('add-gear-btn')?.classList.remove('hidden');
        document.getElementById('available-qty-group')?.classList.remove('hidden');
        refreshAllRequests();
    }

    refreshGear();
    refreshMyRequests();
    setupEventListeners();
});

async function refreshGear() {
    try {
        currentGear = await gearApi.getGear();
        renderGearGrid(currentGear, isKitSec, handleEditGear, handleDeleteGear, (id, name) => {
            gearRequestTargetId = id;
            const nameEl = document.getElementById('request-gear-name');
            if (nameEl) nameEl.textContent = name;
            document.getElementById('request-modal')?.classList.remove('hidden');
        });
    } catch (err) {
        console.error('Failed to fetch gear', err);
    }
}

async function refreshMyRequests() {
    try {
        const requests = await gearApi.getMyRequests();
        renderMyRequestsList(requests);
    } catch (err) {
        console.error('Failed to fetch my requests', err);
    }
}

async function refreshAllRequests() {
    try {
        const requests = await gearApi.getAllRequests();
        renderAllRequestsTable(requests, handleRequestAction);
    } catch (err) {
        console.error('Failed to fetch all requests', err);
    }
}

async function handleRequestAction(reqId: string, action: 'approve' | 'reject' | 'return') {
    try {
        if (action === 'approve') await gearApi.approveRequest(reqId);
        if (action === 'reject') await gearApi.rejectRequest(reqId);
        if (action === 'return') await gearApi.returnRequest(reqId);

        showToast(`Request ${action}d successfully`);
        refreshAllRequests();
        refreshGear();
    } catch (err: any) {
        showToast(err.message || 'Failed to update request', 'error');
    }
}

function handleEditGear(id: string) {
    const gearItem = currentGear.find(g => g.id === id);
    if (gearItem) {
        (document.getElementById('gear-id') as HTMLInputElement).value = gearItem.id;
        (document.getElementById('gear-name') as HTMLInputElement).value = gearItem.name;
        (document.getElementById('gear-description') as HTMLInputElement).value = gearItem.description || '';
        (document.getElementById('gear-total-qty') as HTMLInputElement).value = gearItem.totalQuantity.toString();
        (document.getElementById('gear-available-qty') as HTMLInputElement).value = gearItem.availableQuantity.toString();
        document.getElementById('gear-form-container')?.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

async function handleDeleteGear(id: string) {
    const confirmed = await showConfirmModal('Are you sure you want to delete this gear? All related requests might be orphaned.');
    if (!confirmed) return;
    try {
        await gearApi.deleteGear(id);
        showToast('Gear deleted successfully.');
        refreshGear();
    } catch (err: any) {
        showToast(err.message || 'Error deleting gear', 'error');
    }
}

function setupEventListeners() {
    const addGearBtn = document.getElementById('add-gear-btn');
    const gearFormContainer = document.getElementById('gear-form-container');
    const cancelGearBtn = document.getElementById('cancel-gear-btn');
    const gearForm = document.getElementById('gear-form');

    addGearBtn?.addEventListener('click', () => {
        (gearForm as HTMLFormElement).reset();
        (document.getElementById('gear-id') as HTMLInputElement).value = '';
        gearFormContainer?.classList.toggle('hidden');
    });

    cancelGearBtn?.addEventListener('click', () => {
        gearFormContainer?.classList.add('hidden');
    });

    gearForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = (document.getElementById('gear-id') as HTMLInputElement).value;
        const name = (document.getElementById('gear-name') as HTMLInputElement).value;
        const description = (document.getElementById('gear-description') as HTMLInputElement).value;
        const totalQuantity = parseInt((document.getElementById('gear-total-qty') as HTMLInputElement).value, 10);
        const availableQtyEl = document.getElementById('gear-available-qty') as HTMLInputElement;
        const availableQuantity = id ? parseInt(availableQtyEl.value, 10) : totalQuantity;

        try {
            if (id) {
                await gearApi.updateGear(id, { name, description, totalQuantity, availableQuantity });
            } else {
                await gearApi.addGear({ name, description, totalQuantity, availableQuantity });
            }
            gearFormContainer?.classList.add('hidden');
            showToast(id ? 'Gear updated' : 'Gear added');
            refreshGear();
        } catch (err: any) {
            showToast(err.message || 'Failed to save gear', 'error');
        }
    });

    const requestModal = document.getElementById('request-modal');
    const cancelRequestBtn = document.getElementById('cancel-request-btn');
    const confirmRequestBtn = document.getElementById('confirm-request-btn');
    const requestBackdrop = document.getElementById('request-modal-backdrop');

    const closeModal = () => {
        requestModal?.classList.add('hidden');
        gearRequestTargetId = null;
    };

    [cancelRequestBtn, requestBackdrop].forEach(el => {
        if (el) el.addEventListener('click', closeModal);
    });

    confirmRequestBtn?.addEventListener('click', async () => {
        if (!gearRequestTargetId) return;

        (confirmRequestBtn as HTMLButtonElement).disabled = true;
        const oldText = confirmRequestBtn.innerText;
        confirmRequestBtn.innerText = 'Requesting...';

        try {
            await gearApi.requestGear(gearRequestTargetId);
            closeModal();
            showToast('Request submitted!');
            refreshMyRequests();
        } catch (err: any) {
            showToast(err.message || 'Failed to submit request', 'error');
        } finally {
            (confirmRequestBtn as HTMLButtonElement).disabled = false;
            confirmRequestBtn.innerText = oldText;
        }
    });
}
