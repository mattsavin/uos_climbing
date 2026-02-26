import { type GearItem, type GearRequest } from '../../auth';
import { escapeHTML } from '../../utils';

export function getStatusBadge(status: string) {
    if (status === 'pending') return '<span class="px-2 py-1 bg-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-wider rounded">Pending</span>';
    if (status === 'approved') return '<span class="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded">Approved - Active</span>';
    if (status === 'rejected') return '<span class="px-2 py-1 bg-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-wider rounded">Rejected</span>';
    if (status === 'returned') return '<span class="px-2 py-1 bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-wider rounded">Returned</span>';
    return `<span class="px-2 py-1 bg-slate-700 text-slate-400 text-[10px] uppercase rounded">${status}</span>`;
}

export function renderGearGrid(gearList: GearItem[], isKitSec: boolean, onEdit: (id: string) => void, onDelete: (id: string) => void, onRequest: (id: string, name: string) => void) {
    const grid = document.getElementById('gear-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (gearList.length === 0) {
        grid.innerHTML = '<div class="col-span-1 md:col-span-2 text-center text-slate-500 py-8">No gear available in the inventory.</div>';
        return;
    }

    gearList.forEach(gear => {
        const outOfStock = gear.availableQuantity <= 0;
        const safeName = escapeHTML(gear.name);
        const safeDesc = escapeHTML(gear.description);

        let actionsHtml = '';
        if (isKitSec) {
            actionsHtml = `
                <div class="mt-4 flex gap-2">
                    <button class="edit-gear-btn text-xs font-bold text-slate-400 hover:text-white underline decoration-dashed underline-offset-4 decoration-slate-600 transition-colors" data-id="${gear.id}">Edit</button>
                    <button class="delete-gear-btn text-xs font-bold text-red-400 hover:text-red-300 underline decoration-dashed underline-offset-4 decoration-red-500/50 transition-colors ml-auto" data-id="${gear.id}">Delete</button>
                </div>
            `;
        }

        const btnClass = outOfStock
            ? "w-full py-2 bg-slate-700 text-slate-400 cursor-not-allowed text-sm font-bold rounded-lg uppercase tracking-wider"
            : "w-full btn-primary !bg-emerald-500 hover:!bg-emerald-400 !border-emerald-500 !py-2 !text-sm request-gear-btn shadow-[0_0_15px_rgba(16,185,129,0.2)]";

        const card = document.createElement('div');
        card.className = "bg-slate-800/80 border border-white/5 rounded-xl p-5 hover:border-emerald-500/30 transition-colors flex flex-col";
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-bold text-white text-lg">${safeName}</h4>
                <span class="text-xs font-black uppercase tracking-wider px-2 py-1 rounded ${outOfStock ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}">
                    ${gear.availableQuantity} / ${gear.totalQuantity} Left
                </span>
            </div>
            <p class="text-sm text-slate-400 mb-6 flex-grow">${safeDesc || 'No description provided.'}</p>
            <button class="${btnClass}" ${outOfStock ? 'disabled' : ''} data-id="${gear.id}" data-name="${safeName}">
                ${outOfStock ? 'Out of Stock' : 'Request to Hire'}
            </button>
            ${actionsHtml}
        `;
        grid.appendChild(card);
    });

    // Attach listeners
    grid.querySelectorAll('.request-gear-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            onRequest(target.dataset.id!, target.dataset.name!);
        });
    });

    grid.querySelectorAll('.edit-gear-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            onEdit(target.dataset.id!);
        });
    });

    grid.querySelectorAll('.delete-gear-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLButtonElement;
            onDelete(target.dataset.id!);
        });
    });
}

export function renderMyRequestsList(requests: GearRequest[]) {
    const list = document.getElementById('my-requests-list');
    if (!list) return;

    list.innerHTML = '';

    if (requests.length === 0) {
        list.innerHTML = '<div class="text-slate-500 text-sm text-center py-8">You have no gear requests.</div>';
        return;
    }

    requests.forEach(req => {
        const dateStr = new Date(req.requestDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const safeGearName = escapeHTML(req.gearName);

        const el = document.createElement('div');
        el.className = "py-3 flex justify-between items-center";
        el.innerHTML = `
            <div>
                <p class="text-sm font-bold text-white">${safeGearName}</p>
                <p class="text-xs text-slate-500 mt-1">Requested on ${dateStr}</p>
            </div>
            <div>
                ${getStatusBadge(req.status)}
            </div>
        `;
        list.appendChild(el);
    });
}

export function renderAllRequestsTable(requests: GearRequest[], onAction: (reqId: string, action: 'approve' | 'reject' | 'return') => void) {
    const list = document.getElementById('all-requests-list');
    if (!list) return;

    list.innerHTML = '';

    if (requests.length === 0) {
        list.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-500">No requests found.</td></tr>';
        return;
    }

    requests.forEach(req => {
        const dateStr = new Date(req.requestDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const safeUserName = escapeHTML(req.userName);
        const safeUserEmail = escapeHTML(req.userEmail);
        const safeGearName = escapeHTML(req.gearName);

        let actionBtn = '-';
        if (req.status === 'pending') {
            actionBtn = `
                <div class="flex gap-2 justify-end">
                    <button class="approve-req-btn text-xs font-bold text-emerald-400 hover:text-emerald-300 underline decoration-dashed underline-offset-2 transition-colors" data-id="${req.id}">Approve</button>
                    <button class="reject-req-btn text-xs font-bold text-red-400 hover:text-red-300 underline decoration-dashed underline-offset-2 transition-colors" data-id="${req.id}">Reject</button>
                </div>
            `;
        } else if (req.status === 'approved') {
            actionBtn = `
                <button class="return-req-btn text-xs font-bold text-blue-400 hover:text-blue-300 underline decoration-dashed underline-offset-2 transition-colors float-right" data-id="${req.id}">Mark Returned</button>
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-4 py-3 border-b border-white/5 whitespace-nowrap">
                <p class="text-white font-bold">${safeUserName}</p>
                <p class="text-xs text-slate-500">${safeUserEmail}</p>
            </td>
            <td class="px-4 py-3 border-b border-white/5 text-slate-300">${safeGearName}</td>
            <td class="px-4 py-3 border-b border-white/5 text-slate-300 whitespace-nowrap">${dateStr}</td>
            <td class="px-4 py-3 border-b border-white/5 whitespace-nowrap">${getStatusBadge(req.status)}</td>
            <td class="px-4 py-3 border-b border-white/5 whitespace-nowrap align-middle">
                ${actionBtn}
            </td>
        `;
        list.appendChild(tr);
    });

    list.querySelectorAll('.approve-req-btn').forEach(btn => {
        btn.addEventListener('click', () => onAction((btn as HTMLElement).dataset.id!, 'approve'));
    });
    list.querySelectorAll('.reject-req-btn').forEach(btn => {
        btn.addEventListener('click', () => onAction((btn as HTMLElement).dataset.id!, 'reject'));
    });
    list.querySelectorAll('.return-req-btn').forEach(btn => {
        btn.addEventListener('click', () => onAction((btn as HTMLElement).dataset.id!, 'return'));
    });
}

