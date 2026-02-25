export const membershipRenewalModalHtml = `
    <div id="membership-renewal-overlay"
        class="hidden fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div
            class="relative glass-card !p-8 w-full max-w-lg shadow-2xl border border-brand-gold/30 animate-[fade-in-up_0.3s_ease-out] text-center">
            <div
                class="w-20 h-20 mx-auto rounded-full bg-brand-gold/20 text-brand-gold flex items-center justify-center mb-6">
                <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10">
                    </path>
                </svg>
            </div>
            <h2 class="text-3xl font-black text-white mb-2 uppercase tracking-wide">New Academic Year</h2>
            <p class="text-slate-300 mb-6 text-sm">It looks like a new academic year (<span
                    id="renewal-year-text" class="font-bold text-brand-gold"></span>) has started! To continue
                booking sessions and maintaining your committee access, please confirm that you are renewing
                your membership.</p>
            <ul
                class="text-left text-xs space-y-2 mb-8 text-slate-400 bg-slate-900/50 p-4 rounded-xl border border-white/5">
                <li class="flex gap-2 items-start"><svg class="w-4 h-4 text-brand-gold shrink-0 mt-0.5"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M5 13l4 4L19 7"></path>
                    </svg> You must have purchased the new Union membership.</li>
                <li class="flex gap-2 items-start"><svg class="w-4 h-4 text-brand-gold shrink-0 mt-0.5"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M5 13l4 4L19 7"></path>
                    </svg> Your membership status will temporarily change to "Pending" until approved.</li>
            </ul>
            <button id="confirm-renewal-btn"
                class="w-full btn-primary !py-4 text-sm uppercase tracking-widest font-black shadow-[0_0_20px_rgba(253,185,19,0.3)] hover:shadow-[0_0_30px_rgba(253,185,19,0.5)]">
                Confirm Registration Renewal
            </button>
        </div>
    </div>
`;
