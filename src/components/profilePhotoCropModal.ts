export const profilePhotoCropModalHtml = `
    <div id="profile-crop-modal" class="hidden fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div id="profile-crop-backdrop" class="absolute inset-0 bg-black/90 backdrop-blur-sm"></div>
        <div class="relative w-full max-w-sm glass-card !p-0 border border-white/10 shadow-2xl overflow-hidden">
            <div class="p-4 border-b border-white/10 bg-slate-800/50 flex items-center justify-between">
                <h3 class="text-lg font-bold text-white">Crop Profile Photo</h3>
                <button id="profile-crop-cancel-x" class="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="aspect-square relative bg-black overflow-hidden select-none cursor-grab" id="profile-crop-stage">
                <img id="profile-crop-image" src="" alt="Profile crop preview" class="absolute" draggable="false" style="max-width: none; max-height: none">
                <div class="absolute inset-4 rounded-full pointer-events-none" style="box-shadow: 0 0 0 9999px rgba(0,0,0,0.6); border: 2px solid rgba(255,255,255,0.7)"></div>
            </div>
            <div class="p-4 space-y-3">
                <div class="flex items-center gap-3">
                    <svg class="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
                    </svg>
                    <input id="profile-crop-zoom" type="range" min="1" max="5" step="0.05" value="1" class="w-full accent-purple-500">
                    <svg class="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0ZM13 10H7m3-3v6"/>
                    </svg>
                </div>
                <p class="text-[10px] text-slate-500 text-center">Drag to reposition &middot; Scroll or pinch to zoom</p>
                <div class="flex gap-2 pt-1">
                    <button id="profile-crop-cancel" class="flex-1 py-2 px-4 rounded-lg border border-white/10 text-slate-300 hover:text-white text-sm font-bold transition-colors hover:bg-white/5">Cancel</button>
                    <button id="profile-crop-save" class="flex-1 py-2 px-4 rounded-lg bg-purple-500 hover:bg-purple-400 text-white text-sm font-bold transition-colors shadow-lg shadow-purple-500/20">Crop &amp; Upload</button>
                </div>
            </div>
        </div>
    </div>
`;
