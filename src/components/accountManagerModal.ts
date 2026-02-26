export const accountManagerModalHtml = `
    <div id="account-manager-modal" class="hidden fixed inset-0 z-[150] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="account-manager-backdrop"></div>
        <div
            class="relative glass-card !p-0 w-full max-w-lg shadow-2xl border border-white/10 animate-[fade-in-up_0.2s_ease-out] flex flex-col overflow-hidden">
            <!-- Header -->
            <div class="flex justify-between items-center p-6 border-b border-white/10 bg-slate-800/50">
                <h3 class="text-xl font-bold text-white flex items-center gap-2">
                    <svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z">
                        </path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    Account Manager
                </h3>
                <button id="close-account-modal-btn" class="text-slate-400 hover:text-white transition-colors">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12">
                        </path>
                    </svg>
                </button>
            </div>

            <!-- Tabs -->
            <div class="flex border-b border-white/10 px-6 pt-4 bg-slate-800/30">
                <button id="tab-profile-settings"
                    class="pb-3 px-4 text-sm font-bold text-purple-400 border-b-2 border-purple-400 transition-colors">Profile
                    Details</button>
                <button id="tab-password-settings"
                    class="pb-3 px-4 text-sm font-bold text-slate-500 border-b-2 border-transparent hover:text-slate-300 transition-colors">Security</button>
            </div>

            <!-- Profile Form Tab -->
            <div id="account-profile-pane" class="p-6">
                <form id="profile-form" class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-xs text-slate-500 uppercase tracking-wider font-bold block mb-1">First Name</label>
                            <input type="text" id="profile-fname" required
                                class="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400">
                        </div>
                        <div>
                            <label class="text-xs text-slate-500 uppercase tracking-wider font-bold block mb-1">Last Name</label>
                            <input type="text" id="profile-sname" required
                                class="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400">
                        </div>
                    </div>
                    <div>
                        <label class="text-xs text-slate-500 uppercase tracking-wider font-bold block mb-1">Pronouns
                            (Optional)</label>
                        <input type="text" id="profile-pronouns" placeholder="e.g. she/her"
                            class="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500 uppercase tracking-wider font-bold block mb-1">Dietary &
                            Medical Requirements</label>
                        <input type="text" id="profile-dietary" placeholder="e.g. Vegan, nut allergy"
                            class="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500 uppercase tracking-wider font-bold block mb-1">Emergency
                            Contact Name</label>
                        <input type="text" id="profile-emergency-name" required placeholder="Jane Doe"
                            class="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500 uppercase tracking-wider font-bold block mb-1">Emergency
                            Contact Mobile</label>
                        <input type="text" id="profile-emergency-mobile" required placeholder="07700..."
                            class="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400">
                    </div>
                    <div id="profile-success"
                        class="hidden text-brand-gold-muted text-sm mt-2 p-2 bg-brand-gold-muted/10 rounded border border-brand-gold-muted/20">
                        Profile updated successfully!</div>
                    <div id="profile-error"
                        class="hidden text-red-400 text-sm mt-2 p-2 bg-red-400/10 rounded border border-red-400/20">
                    </div>
                    <div class="flex justify-end pt-2">
                        <button type="submit"
                            class="text-sm py-2 px-6 rounded-md bg-purple-500 text-white hover:bg-purple-400 transition-colors font-bold shadow-lg shadow-purple-500/20">Save
                            Profile</button>
                    </div>
                </form>
            </div>

            <!-- Password Form Tab -->
            <div id="account-password-pane" class="p-6 hidden">
                <form id="password-form" class="space-y-4">
                    <div>
                        <label class="text-xs text-slate-500 uppercase tracking-wider font-bold block mb-1">Current
                            Password</label>
                        <input type="password" id="password-current" required
                            class="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500 uppercase tracking-wider font-bold block mb-1">New
                            Password</label>
                        <input type="password" id="password-new" required
                            class="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500 uppercase tracking-wider font-bold block mb-1">Confirm New
                            Password</label>
                        <input type="password" id="password-confirm" required
                            class="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400">
                    </div>
                    <div id="password-success"
                        class="hidden text-brand-gold-muted text-sm mt-2 p-2 bg-brand-gold-muted/10 rounded border border-brand-gold-muted/20">
                        Password changed successfully!</div>
                    <div id="password-error"
                        class="hidden text-red-400 text-sm mt-2 p-2 bg-red-400/10 rounded border border-red-400/20">
                    </div>
                    <div class="flex justify-end pt-2">
                        <button type="submit"
                            class="text-sm py-2 px-6 rounded-md bg-purple-500 text-white hover:bg-purple-400 transition-colors font-bold shadow-lg shadow-purple-500/20">Update
                            Password</button>
                    </div>
                </form>

                <div class="mt-8 pt-6 border-t border-red-500/20">
                    <h4 class="text-sm font-bold text-red-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z">
                            </path>
                        </svg>
                        Danger Zone
                    </h4>
                    <p class="text-xs text-slate-400 mb-4">Permanently delete your account and remove all associated
                        data. This action cannot be undone.</p>
                    <button type="button" id="delete-self-account-btn"
                        class="text-xs font-bold text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white transition-colors py-2 px-4 rounded shadow-lg shadow-red-500/10">
                        Delete Account
                    </button>
                </div>
            </div>
        </div>
    </div>
`;
