import { adminApi, type Session, type User } from '../auth';

export interface SessionModalOptions {
    session: Session;
    isBooked: boolean;
    user: User | null;
    onBook?: (sessionId: string) => Promise<void>;
    onCancel?: (sessionId: string) => Promise<void>;
    onEditSuccess?: () => void;
    onDeleteSuccess?: () => void;
}

export function openSessionModal(options: SessionModalOptions) {
    const { session, isBooked, user, onBook, onCancel, onEditSuccess, onDeleteSuccess } = options;

    let modal = document.getElementById('unified-session-modal');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="unified-session-modal" class="fixed inset-0 z-[100] hidden flex items-center justify-center p-4">
                <div id="unified-session-backdrop" class="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer transition-opacity"></div>
                <div class="relative w-full max-w-md bg-brand-dark border border-white/10 rounded-2xl shadow-2xl p-6 transform transition-all flex flex-col max-h-[90vh] overflow-y-auto">
                    
                    <button id="usm-close-btn" class="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>

                    <div class="text-center mb-6">
                        <span id="usm-icon" class="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3">
                        </span>
                        <h3 id="usm-title" class="text-2xl font-black text-white uppercase tracking-widest break-words leading-tight"></h3>
                        <p id="usm-type" class="text-xs font-bold mt-2 text-slate-400 uppercase tracking-widest"></p>
                    </div>

                    <div class="space-y-4 text-sm text-slate-300 mb-6 bg-slate-800/50 p-4 rounded-xl border border-white/5">
                        <div class="flex justify-between items-center pb-3 border-b border-white/10">
                            <span class="text-slate-500 font-bold uppercase tracking-wider text-xs">Date & Time</span>
                            <span id="usm-datetime" class="font-bold text-white text-right"></span>
                        </div>
                        <div class="flex justify-between items-center pt-1">
                            <span class="text-slate-500 font-bold uppercase tracking-wider text-xs">Availability</span>
                            <span id="usm-capacity" class="font-mono text-white bg-slate-900 px-2 py-1 rounded inline-block"></span>
                        </div>
                    </div>
                    
                    <p id="usm-error" class="hidden text-red-400 text-xs mb-4 p-3 bg-red-400/10 rounded border border-red-400/20 text-center font-bold"></p>
                    
                    <div id="usm-actions" class="flex flex-col gap-3"></div>

                    <!-- Committee Edit Pane -->
                    <div id="usm-edit-pane" class="hidden mt-6 pt-6 border-t border-white/10">
                        <h4 class="text-sm font-bold text-amber-500 uppercase flex items-center gap-2 mb-4 tracking-wider">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            Committee Override
                        </h4>
                        <form id="usm-edit-form" class="space-y-3">
                            <input type="hidden" id="usm-edit-id">
                            <div class="space-y-1 text-left">
                                <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Title</label>
                                <input type="text" id="usm-edit-title" required class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 block">
                            </div>
                            <div class="grid grid-cols-2 gap-3 text-left">
                                <div class="space-y-1">
                                    <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Date & Time</label>
                                    <input type="datetime-local" id="usm-edit-date" required class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-[11px] focus:outline-none focus:border-amber-500 block">
                                </div>
                                <div class="space-y-1 text-left">
                                    <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Type</label>
                                    <select id="usm-edit-type" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-[11px] focus:outline-none focus:border-amber-500 block">
                                        <option value="Competition">Competition</option>
                                        <option value="Social">Social</option>
                                        <option value="Training Session (Bouldering)">Training Session (Bouldering)</option>
                                        <option value="Training Session (Roped)">Training Session (Roped)</option>
                                        <option value="Meeting">Meeting</option>
                                    </select>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-3 pb-3 text-left">
                                <div class="space-y-1">
                                    <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Capacity</label>
                                    <input type="number" id="usm-edit-capacity" required min="1" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 block">
                                </div>
                                <div class="space-y-1 text-left">
                                    <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Booked Slots</label>
                                    <input type="number" id="usm-edit-booked" min="0" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 block">
                                </div>
                            </div>
                            <div class="space-y-1 text-left mt-2">
                                    <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Required Membership</label>
                                    <select id="usm-edit-required-membership" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-[11px] focus:outline-none focus:border-amber-500 block">
                                        <option value="basic">Basic (All Members)</option>
                                        <option value="bouldering">Bouldering Add-on</option>
                                        <option value="comp_team">Competition Team Only</option>
                                    </select>
                                </div>
                            <div class="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-800">
                                <button type="submit" class="btn-primary w-full !px-4 !py-3 !text-xs uppercase tracking-wider !bg-amber-500 hover:!bg-amber-400 !text-brand-darker !shadow-amber-500/20 font-black">Save Adjustments</button>
                                <button type="button" id="usm-delete-btn" class="w-full text-[10px] font-bold px-2 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded uppercase tracking-wider transition-colors hidden text-center">Delete Event</button>
                            </div>
                        </form>
                    </div>

                </div>
            </div>
        `);
        modal = document.getElementById('unified-session-modal');

        document.getElementById('unified-session-backdrop')?.addEventListener('click', close);
        document.getElementById('usm-close-btn')?.addEventListener('click', close);

        // Let's hook up the edit form submit
        document.getElementById('usm-edit-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = (document.getElementById('usm-edit-id') as HTMLInputElement).value;
            const title = (document.getElementById('usm-edit-title') as HTMLInputElement).value;
            const date = (document.getElementById('usm-edit-date') as HTMLInputElement).value;
            const type = (document.getElementById('usm-edit-type') as HTMLSelectElement).value as any;
            const capacity = parseInt((document.getElementById('usm-edit-capacity') as HTMLInputElement).value, 10);
            const bookedSlots = parseInt((document.getElementById('usm-edit-booked') as HTMLInputElement).value, 10) || 0;
            const requiredMembership = (document.getElementById('usm-edit-required-membership') as HTMLSelectElement).value as 'basic' | 'bouldering' | 'comp_team';

            if (id && title && date && type && !isNaN(capacity)) {
                try {
                    const submitBtn = document.querySelector('#usm-edit-form button[type="submit"]') as HTMLButtonElement;
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Saving...';
                    await adminApi.updateSession(id, { title, date, type, capacity, bookedSlots, requiredMembership });
                    close();
                    if ((window as any)._usmCurrentOnEditSuccess) (window as any)._usmCurrentOnEditSuccess();
                } catch (err: any) {
                    showError(err.message || "Failed to edit session");
                } finally {
                    const submitBtn = document.querySelector('#usm-edit-form button[type="submit"]') as HTMLButtonElement;
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Save Adjustments';
                    }
                }
            }
        });

        document.getElementById('usm-delete-btn')?.addEventListener('click', async () => {
            const id = (document.getElementById('usm-edit-id') as HTMLInputElement).value;
            if (id && confirm('Are you sure you want to delete this session?')) {
                try {
                    await adminApi.deleteSession(id);
                    close();
                    if ((window as any)._usmCurrentOnDeleteSuccess) (window as any)._usmCurrentOnDeleteSuccess();
                } catch (err: any) {
                    showError(err.message || "Failed to delete session");
                }
            }
        });

    }

    // Attach callbacks globally so the form event listeners can use them
    (window as any)._usmCurrentOnEditSuccess = onEditSuccess;
    (window as any)._usmCurrentOnDeleteSuccess = onDeleteSuccess;

    const titleEl = document.getElementById('usm-title')!;
    const typeEl = document.getElementById('usm-type')!;
    const datetimeEl = document.getElementById('usm-datetime')!;
    const capacityEl = document.getElementById('usm-capacity')!;
    const iconEl = document.getElementById('usm-icon')!;
    const actionsEl = document.getElementById('usm-actions')!;
    const errorEl = document.getElementById('usm-error')!;
    const editPaneEl = document.getElementById('usm-edit-pane')!;
    const deleteBtnEl = document.getElementById('usm-delete-btn')!;

    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    // Clear old actions
    actionsEl.innerHTML = '';
    editPaneEl.classList.add('hidden');
    deleteBtnEl.classList.add('hidden');

    titleEl.textContent = session.title;
    datetimeEl.innerHTML = new Date(session.date).toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
    capacityEl.textContent = `${session.bookedSlots} / ${session.capacity} Slots`;

    // Styling the icon depending on Type
    if (session.type === 'Competition') {
        iconEl.className = 'inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 bg-red-500/20 text-red-500';
        typeEl.className = 'text-[10px] font-bold text-red-500 uppercase tracking-widest';
        typeEl.textContent = "COMPETITION";
    } else if (session.type === 'Social') {
        iconEl.className = 'inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 bg-brand-gold-muted/20 text-brand-gold-muted';
        typeEl.className = 'text-[10px] font-bold text-brand-gold-muted uppercase tracking-widest';
        typeEl.textContent = "CLUB SOCIAL";
    } else if (session.type === 'Training Session (Bouldering)') {
        iconEl.className = 'inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 bg-blue-500/20 text-blue-400';
        typeEl.className = 'text-[10px] font-bold text-blue-400 uppercase tracking-widest';
        typeEl.textContent = "TRAINING (BOULDERING)";
    } else if (session.type === 'Training Session (Roped)') {
        iconEl.className = 'inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 bg-purple-500/20 text-purple-400';
        typeEl.className = 'text-[10px] font-bold text-purple-400 uppercase tracking-widest';
        typeEl.textContent = "TRAINING (ROPED)";
    } else if (session.type === 'Meeting') {
        iconEl.className = 'inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 bg-emerald-500/20 text-emerald-400';
        typeEl.className = 'text-[10px] font-bold text-emerald-400 uppercase tracking-widest';
        typeEl.textContent = "CLUB MEETING";
    }
    iconEl.innerHTML = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`;

    function showError(msg: string) {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
    }

    if (!user) {
        // Not logged in
        const btn = document.createElement('a');
        btn.href = '/login.html';
        btn.className = 'w-full px-4 py-3 bg-brand-gold text-brand-darker hover:bg-white rounded-lg transition-colors text-sm font-bold uppercase shadow-lg shadow-brand-gold/20 text-center flex items-center justify-center gap-2 block';
        btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg> Sign In to Book`;
        actionsEl.appendChild(btn);
    } else {
        // Logged in
        if (isBooked) {
            const btn = document.createElement('button');
            btn.className = 'w-full px-4 py-3 bg-red-400 hover:bg-red-500 text-brand-darker rounded-lg transition-colors text-sm font-black uppercase tracking-wider shadow-[0_0_15px_rgba(248,113,113,0.3)] block';
            btn.innerHTML = `<span class="flex items-center justify-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg> Cancel Booking</span>`;
            btn.onclick = async () => {
                if (onCancel) {
                    btn.disabled = true;
                    btn.textContent = 'Canceling...';
                    try {
                        await onCancel(session.id);
                        close();
                    } catch (err: any) {
                        showError(err.message || 'Action failed.');
                        btn.disabled = false;
                        btn.innerHTML = `<span class="flex items-center justify-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg> Cancel Booking</span>`;
                    }
                }
            };
            actionsEl.appendChild(btn);
        } else if (session.bookedSlots >= session.capacity) {
            const btn = document.createElement('button');
            btn.className = 'w-full px-4 py-3 bg-slate-800 text-slate-500 rounded-lg cursor-not-allowed text-sm font-bold uppercase tracking-wider block';
            btn.innerHTML = 'Fully Booked';
            btn.disabled = true;
            actionsEl.appendChild(btn);
        } else {
            const btn = document.createElement('button');
            btn.className = 'w-full px-4 py-3 bg-brand-gold hover:bg-white text-brand-darker rounded-lg transition-colors text-sm font-black uppercase shadow-[0_0_20px_rgba(253,185,19,0.4)] tracking-wider block';
            btn.textContent = 'Confirm Booking';
            btn.onclick = async () => {
                if (onBook) {
                    btn.disabled = true;
                    btn.textContent = 'Booking...';
                    try {
                        await onBook(session.id);
                        close();
                    } catch (err: any) {
                        showError(err.message || 'Action failed.');
                        btn.disabled = false;
                        btn.textContent = 'Confirm Booking';
                    }
                }
            };
            actionsEl.appendChild(btn);
        }

        // Committee Edit Toggle
        if (user.role === 'committee') {
            const toggleWrapper = document.createElement('div');
            toggleWrapper.className = 'text-center mt-3';

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'text-[10px] text-slate-400 hover:text-white underline decoration-dashed underline-offset-4 transition-colors font-bold tracking-wider uppercase inline-block';
            toggleBtn.innerHTML = '<span class="flex items-center justify-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg> Expand Admin Options</span>';
            toggleBtn.onclick = () => {
                editPaneEl.classList.toggle('hidden');
                toggleBtn.classList.toggle('text-white');
            };
            toggleWrapper.appendChild(toggleBtn);
            actionsEl.appendChild(toggleWrapper);

            deleteBtnEl.classList.remove('hidden');

            // Populate edit fields
            (document.getElementById('usm-edit-id') as HTMLInputElement).value = session.id;
            (document.getElementById('usm-edit-title') as HTMLInputElement).value = session.title;
            (document.getElementById('usm-edit-date') as HTMLInputElement).value = session.date;
            (document.getElementById('usm-edit-type') as HTMLSelectElement).value = session.type;
            (document.getElementById('usm-edit-capacity') as HTMLInputElement).value = session.capacity.toString();
            (document.getElementById('usm-edit-booked') as HTMLInputElement).value = session.bookedSlots.toString();
            (document.getElementById('usm-edit-required-membership') as HTMLSelectElement).value = (session as any).requiredMembership || 'basic';
        }
    }

    modal!.classList.remove('hidden');
}

function close() {
    document.getElementById('unified-session-modal')?.classList.add('hidden');
}
