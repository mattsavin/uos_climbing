export const gearRequestModalHtml = `
    <div id="request-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="request-modal-backdrop"></div>
        <div
            class="relative glass-card !p-0 w-full max-w-md shadow-2xl border border-emerald-500/20 animate-[fade-in-up_0.2s_ease-out] flex flex-col overflow-hidden">
            <div class="p-6 border-b border-emerald-500/20 bg-slate-800/80">
                <h3 class="text-xl font-bold text-white uppercase tracking-wide">Confirm Request</h3>
            </div>
            <div class="p-6">
                <p class="text-slate-300 mb-6 text-sm">You are about to request: <span id="request-gear-name"
                        class="font-bold text-emerald-400"></span>.</p>
                <div class="flex gap-3 justify-end">
                    <button id="cancel-request-btn"
                        class="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">Cancel</button>
                    <button id="confirm-request-btn"
                        class="btn-primary !bg-emerald-500 hover:!bg-emerald-400 !border-emerald-500 !py-2 !px-6 !text-sm shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]">Submit
                        Request</button>
                </div>
            </div>
        </div>
    </div>
`;
