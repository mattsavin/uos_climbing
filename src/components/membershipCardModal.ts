export const membershipCardModalHtml = `
    <div id="membership-card-overlay"
        class="hidden fixed inset-0 z-[250] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-xl">
        <div
            class="relative glass-card !p-3 sm:!p-6 w-full max-w-[340px] sm:max-w-sm shadow-2xl border border-emerald-500/30 animate-[fade-in-up_0.3s_ease-out] text-center flex flex-col max-h-[98vh]">
            
            <!-- Close Button -->
            <button id="close-membership-card-btn" class="absolute top-2 right-2 sm:top-4 sm:right-4 text-slate-400 hover:text-white transition-colors z-50">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>

            <div class="mb-2 sm:mb-4 flex flex-col items-center">
                <!-- Profile photo - Always visible, scales via CSS -->
                <div id="modal-card-user-photo-container" class="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl bg-slate-800 overflow-hidden border-2 border-emerald-500/30 mb-2 sm:mb-4 shadow-2xl transition-all duration-300 transform">
                    <img id="modal-card-user-photo" src="" alt="Profile" class="hidden w-full h-full object-cover">
                    <div id="modal-card-photo-placeholder" class="w-full h-full flex items-center justify-center text-slate-600 font-bold text-xl sm:text-2xl">?</div>
                </div>
                <div class="flex items-center justify-center gap-2 mb-1">
                    <img src="/climbing%20team%20logo.png" alt="Logo" class="h-4 sm:h-5 md:h-6 w-auto">
                    <span class="text-base sm:text-lg md:text-xl font-black text-white tracking-tighter">USMC</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                    <div class="flex items-center gap-2">
                        <p class="text-[7px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500">Digital Membership</p>
                        <span class="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                        <p id="modal-live-date" class="text-[6px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-widest">27 Feb 2026</p>
                    </div>
                    <div id="modal-word-of-the-day" class="word-of-the-day-badge !py-0.5 !px-3 sm:py-1 sm:px-4 text-[9px] sm:text-xs text-emerald-400">LOADING...</div>
                </div>
            </div>

            <div id="modal-qr-vibrant-container" class="qr-live-vibrant p-2 sm:p-4 md:p-6 rounded-3xl mb-3 sm:mb-4 shadow-2xl relative overflow-hidden group transition-all duration-300">
                <div id="enlarged-qr-container" class="qr-live-container w-full aspect-square flex items-center justify-center bg-white rounded-xl p-1 sm:p-2 md:p-4 shadow-inner">
                    <!-- QR Code injected here -->
                    <div class="animate-pulse bg-slate-100 w-full h-full rounded"></div>
                </div>
            </div>

            <div class="space-y-0.5 sm:space-y-1 mb-2 sm:mb-4">
                <h4 id="modal-card-user-name" class="text-lg sm:text-xl md:text-2xl font-black text-white uppercase tracking-tight">Name</h4>
                <p id="modal-card-user-reg" class="text-[10px] sm:text-xs md:text-sm font-bold text-slate-500 tracking-widest uppercase leading-none">ID: 12345678</p>
                <div class="pt-1.5 sm:pt-3 border-t border-white/10 mt-1.5 sm:mt-3">
                    <p class="text-[7px] sm:text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Membership Expiry</p>
                    <p id="modal-card-expiry" class="text-sm sm:text-base md:text-lg font-black text-emerald-400">31 August 2027</p>
                </div>
            </div>

            <p id="modal-bottom-text" class="text-[7px] sm:text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                Scan this code at the climbing wall<br>reception to verify your club membership.
            </p>
        </div>
    </div>
`;
