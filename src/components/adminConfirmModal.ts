export const adminConfirmModalHtml = `
    <div id="admin-confirm-modal" class="hidden fixed inset-0 z-[160] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="admin-confirm-backdrop"></div>
        <div
            class="relative glass-card !p-0 w-full max-w-sm shadow-2xl border border-white/10 animate-[fade-in-up_0.2s_ease-out] flex flex-col overflow-hidden text-center">
            <div id="admin-confirm-header" class="p-6 bg-slate-800/50 pb-2">
                <div id="admin-confirm-icon"
                    class="w-16 h-16 mx-auto rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center mb-4">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z">
                        </path>
                    </svg>
                </div>
                <h3 id="admin-confirm-title" class="text-xl font-bold text-white mb-2">Confirm Action</h3>
                <p id="admin-confirm-message" class="text-sm text-slate-400 mb-6">Are you sure you want to perform this
                    action?</p>
            </div>
            <div class="flex border-t border-white/10 mt-auto">
                <button id="admin-confirm-cancel-btn"
                    class="flex-1 py-3 text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors border-r border-white/10">Cancel</button>
                <button id="admin-confirm-proceed-btn"
                    class="flex-1 py-3 text-sm font-bold text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors">Proceed</button>
            </div>
        </div>
    </div>
`;
