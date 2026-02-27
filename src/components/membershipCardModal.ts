export const membershipCardModalHtml = `
    <div id="membership-card-overlay"
        class="hidden fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
        <div
            class="relative glass-card !p-8 w-full max-w-sm shadow-2xl border border-emerald-500/30 animate-[fade-in-up_0.3s_ease-out] text-center">
            
            <!-- Close Button -->
            <button id="close-membership-card-btn" class="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>

            <div class="mb-4 flex flex-col items-center">
                <div class="w-24 h-24 rounded-2xl bg-slate-800 overflow-hidden border-2 border-emerald-500/30 mb-4 shadow-2xl">
                    <img id="modal-card-user-photo" src="" alt="Profile" class="hidden w-full h-full object-cover">
                    <div id="modal-card-photo-placeholder" class="w-full h-full flex items-center justify-center text-slate-600 font-bold text-2xl">?</div>
                </div>
                <div class="flex items-center justify-center gap-2 mb-1">
                    <img src="/climbing%20team%20logo.png" alt="Logo" class="h-6 w-auto">
                    <span class="text-xl font-black text-white tracking-tighter">USCC</span>
                </div>
                <div class="flex flex-col items-center gap-2">
                    <div class="flex items-center gap-2">
                        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Digital Membership</p>
                        <span class="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                        <p id="modal-live-date" class="text-[8px] font-bold text-slate-400 uppercase tracking-widest">27 Feb 2026</p>
                    </div>
                    <div id="modal-word-of-the-day" class="word-of-the-day-badge text-xs text-emerald-400 py-1.5 px-6">LOADING...</div>
                </div>
            </div>

            <div class="qr-live-vibrant p-8 rounded-3xl mb-6 shadow-2xl relative overflow-hidden group">
                <div id="enlarged-qr-container" class="qr-live-container w-full aspect-square flex items-center justify-center bg-white rounded-2xl p-4 shadow-inner">
                    <!-- QR Code injected here -->
                    <div class="animate-pulse bg-slate-100 w-full h-full rounded"></div>
                </div>
            </div>

            <div class="space-y-1 mb-6">
                <h4 id="modal-card-user-name" class="text-2xl font-black text-white uppercase tracking-tight">Name</h4>
                <p id="modal-card-user-reg" class="text-sm font-bold text-slate-500 tracking-widest uppercase">ID: 12345678</p>
                <div class="pt-4 border-t border-white/10 mt-4">
                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Membership Expiry</p>
                    <p id="modal-card-expiry" class="text-lg font-black text-emerald-400">31 August 2027</p>
                </div>
            </div>

            <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                Scan this code at the climbing wall<br>reception to verify your club membership.
            </p>
        </div>
    </div>
`;
