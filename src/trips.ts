import './style.css';
import { authState } from './auth';
import { tripsApi, type Trip } from './lib/api/trips';
import { escapeHTML, showToast, showConfirmModal } from './utils';

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });

const paymentLabel = (s?: string) =>
    ({ unpaid: 'Unpaid', 'deposit-paid': 'Deposit paid', paid: 'Paid in full' })[s || 'unpaid'] ?? 'Unpaid';

const chip = (cls: string, text: string) =>
    `<span class="inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-wide ${cls}">${text}</span>`;

function statusBadge(trip: Trip): string {
    if (trip.status === 'cancelled') return chip('bg-red-500/10 border border-red-500/40 text-red-400', 'Cancelled');
    const closed = new Date(trip.signupClosesAt) <= new Date();
    if (closed) return chip('bg-slate-500/10 border border-slate-500/40 text-slate-300', 'Sign-ups closed');
    return chip(
        'bg-emerald-500/10 border border-emerald-500/40 text-emerald-400',
        `Closes ${escapeHTML(fmtDate(trip.signupClosesAt))}`
    );
}

function spotsLine(trip: Trip): string {
    if (trip.spotsTaken === undefined) return '';
    const left = Math.max(0, trip.capacity - trip.spotsTaken);
    return `<p class="text-sm ${left === 0 ? 'text-red-400' : 'text-slate-400'}">${left} of ${trip.capacity} places left</p>`;
}

function tripCard(trip: Trip): string {
    const signedUp = !!trip.mySignup && !trip.mySignup.cancelledAt;
    const cancelled = trip.status === 'cancelled';
    const canAct = !cancelled && new Date(trip.signupClosesAt) > new Date();

    let action = '';
    if (canAct) {
        action = signedUp
            ? `<button data-cancel="${trip.id}" class="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:border-red-500 hover:text-red-400 transition-colors text-sm font-bold uppercase tracking-wide">
                    Cancel my place
                </button>`
            : `<button data-signup="${trip.id}" class="px-5 py-2 rounded-lg bg-brand-gold text-slate-950 hover:bg-amber-300 transition-colors text-sm font-black uppercase tracking-wide">
                    Sign up
                </button>`;
    }

    const mine = signedUp
        ? `<div class="mt-3 p-3 rounded-lg bg-brand-gold/10 border border-brand-gold/30 text-sm text-brand-gold">
                You're signed up · <strong>${paymentLabel(trip.mySignup?.paymentStatus)}</strong>
            </div>`
        : '';

    return `
    <article class="glass-card p-6 space-y-3">
        <div class="flex flex-wrap justify-between items-start gap-3">
            <div>
                <h2 class="text-xl font-bold text-white">${escapeHTML(trip.title)}</h2>
                <p class="text-slate-400">${escapeHTML(trip.destination)}</p>
            </div>
            <div class="flex flex-col items-end gap-1">${statusBadge(trip)}</div>
        </div>

        <dl class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm mt-2">
            <div><dt class="text-slate-500">Dates</dt><dd class="text-slate-200">${escapeHTML(fmtDate(trip.startDate))} →</dd>
                 <dd class="text-slate-200">${escapeHTML(fmtDate(trip.endDate))}</dd></div>
            <div><dt class="text-slate-500">Meet at</dt><dd class="text-slate-200">${escapeHTML(trip.meetupPoint || 'TBC')}</dd></div>
            <div><dt class="text-slate-500">Cost</dt><dd class="text-slate-200">£${trip.totalCostPerPerson.toFixed(2)} pp${
                trip.depositAmount > 0
                    ? ` <span class="text-slate-500">(£${trip.depositAmount.toFixed(2)} deposit)</span>`
                    : ''
            }</dd></div>
            <div>${spotsLine(trip)}</div>
        </dl>

        ${trip.description ? `<p class="text-slate-400 text-sm">${escapeHTML(trip.description)}</p>` : ''}
        ${mine}
        <div class="pt-2 flex gap-3">${action}</div>
    </article>`;
}

async function refresh() {
    const listEl = document.getElementById('trips-list');
    const emptyEl = document.getElementById('trips-empty');
    if (!listEl || !emptyEl) return;

    try {
        const trips = await tripsApi.list();
        emptyEl.classList.toggle('hidden', trips.length > 0);
        listEl.innerHTML = trips.map(tripCard).join('');
    } catch (err) {
        console.error('Failed to load trips', err);
        listEl.innerHTML =
            '<div class="glass-card text-center py-12 text-slate-400">Could not load trips. Try refreshing.</div>';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await authState.init();
    const user = authState.getUser();
    if (!user) {
        window.location.href = '/login';
        return;
    }
    await refresh();
});

document.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const signupBtn = target.closest<HTMLElement>('[data-signup]');
    const cancelBtn = target.closest<HTMLElement>('[data-cancel]');
    if (!signupBtn && !cancelBtn) return;

    const tripId = signupBtn?.dataset.signup || cancelBtn?.dataset.cancel;
    if (!tripId) return;

    try {
        if (signupBtn) {
            await tripsApi.signUp(tripId);
            showToast('Signed up! Check your email for details.', 'success');
        } else if (cancelBtn) {
            const ok = await showConfirmModal('Cancel your place on this trip?');
            if (!ok) return;
            const res = await tripsApi.cancelSignUp(tripId);
            showToast(
                res.lateCancel ? 'Place cancelled (after deadline — see refund policy).' : 'Place cancelled.',
                'info'
            );
        }
        await refresh();
    } catch (err: any) {
        showToast(err?.message || 'Something went wrong', 'error');
    }
});
