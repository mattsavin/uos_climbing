export const csvExportModalHtml = `
    <div id="csv-export-modal" class="hidden fixed inset-0 z-[160] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="csv-export-backdrop"></div>
        <div class="relative glass-card !p-0 w-full max-w-md shadow-2xl border border-emerald-500/20 animate-[fade-in-up_0.2s_ease-out] flex flex-col overflow-hidden">
            <!-- Header -->
            <div class="p-6 border-b border-emerald-500/20 bg-slate-800/80">
                <h3 class="text-xl font-bold text-white uppercase tracking-wide">Export Members CSV</h3>
            </div>

            <!-- Content -->
            <div class="p-6">
                <label class="block text-sm font-bold text-slate-300 mb-3">Select Membership Type:</label>
                <select id="csv-export-membership-type" class="w-full bg-slate-900 text-white border border-slate-700 rounded-lg px-4 py-2.5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none">
                    <option value="">-- Select a type --</option>
                </select>
                <p class="text-xs text-slate-400 mt-3">Download a CSV file containing all members with active membership of the selected type.</p>
            </div>

            <!-- Footer Buttons -->
            <div class="flex border-t border-emerald-500/20 gap-3 p-6">
                <button id="csv-export-cancel-btn" class="flex-1 py-2.5 text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors rounded-lg border border-slate-600 hover:border-slate-500">
                    Cancel
                </button>
                <button id="csv-export-confirm-btn" class="flex-1 py-2.5 text-sm font-bold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors rounded-lg border border-emerald-500/40 hover:border-emerald-400/60">
                    Export
                </button>
            </div>
        </div>
    </div>
`;
