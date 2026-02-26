export function escapeHTML(str: string | undefined | null): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    // Remove existing toast if present
    const existing = document.getElementById('global-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = `fixed top-6 left-1/2 -translate-x-1/2 z-[9999] glass-card px-6 py-4 flex items-center gap-3 shadow-2xl transition-all duration-300 transform translate-y-[-100%] opacity-0`;

    let icon = '';
    let textColor = '';

    if (type === 'error') {
        icon = `<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        textColor = 'text-red-400';
    } else if (type === 'success') {
        icon = `<svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
        textColor = 'text-emerald-400';
    } else {
        icon = `<svg class="w-5 h-5 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        textColor = 'text-brand-gold-muted';
    }

    toast.innerHTML = `
        ${icon}
        <p class="text-sm font-bold tracking-widest uppercase ${textColor}">${escapeHTML(message)}</p>
    `;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.classList.remove('translate-y-[-100%]', 'opacity-0');
    }, 10);

    // Animate out
    setTimeout(() => {
        toast.classList.add('translate-y-[-100%]', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

export function showConfirmModal(message: string): Promise<boolean> {
    return new Promise((resolve) => {
        // Remove existing confirm if present
        const existing = document.getElementById('global-confirm-wrap');
        if (existing) existing.remove();

        const wrap = document.createElement('div');
        wrap.id = 'global-confirm-wrap';
        wrap.className = 'fixed inset-0 z-[10000] flex items-center justify-center';

        const backdrop = document.createElement('div');
        backdrop.className = 'absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity opacity-0';

        const modal = document.createElement('div');
        modal.className = 'glass-card border border-white/10 p-6 md:p-8 max-w-sm w-full mx-4 shadow-2xl transform scale-95 opacity-0 transition-all duration-300 relative z-10';

        modal.innerHTML = `
            <div class="flex items-start gap-4 mb-6">
                <div class="p-3 bg-brand-gold-muted/10 rounded-full shrink-0">
                    <svg class="w-6 h-6 text-brand-gold-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <div>
                    <h3 class="text-xl font-black text-white uppercase tracking-wider mb-2">Confirm Action</h3>
                    <p class="text-sm text-slate-300 leading-relaxed">${escapeHTML(message)}</p>
                </div>
            </div>
            <div class="flex gap-3 justify-end">
                <button id="global-confirm-cancel" class="btn-outline !py-2 !px-4 !text-sm flex-1">Cancel</button>
                <button id="global-confirm-ok" class="btn-primary !py-2 !px-4 !text-sm flex-1">Proceed</button>
            </div>
        `;

        wrap.appendChild(backdrop);
        wrap.appendChild(modal);
        document.body.appendChild(wrap);

        // Animate In
        requestAnimationFrame(() => {
            backdrop.classList.remove('opacity-0');
            modal.classList.remove('scale-95', 'opacity-0');
        });

        const close = (result: boolean) => {
            backdrop.classList.add('opacity-0');
            modal.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                wrap.remove();
                resolve(result);
            }, 300);
        };

        wrap.querySelector('#global-confirm-cancel')?.addEventListener('click', () => close(false));
        wrap.querySelector('#global-confirm-ok')?.addEventListener('click', () => close(true));
        backdrop.addEventListener('click', () => close(false));
    });
}

export function showPromptModal(message: string, placeholder = ''): Promise<string | null> {
    return new Promise((resolve) => {
        const existing = document.getElementById('global-prompt-wrap');
        if (existing) existing.remove();

        const wrap = document.createElement('div');
        wrap.id = 'global-prompt-wrap';
        wrap.className = 'fixed inset-0 z-[10000] flex items-center justify-center';

        const backdrop = document.createElement('div');
        backdrop.className = 'absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity opacity-0';

        const modal = document.createElement('div');
        modal.className = 'glass-card border border-white/10 p-6 md:p-8 max-w-sm w-full mx-4 shadow-2xl transform scale-95 opacity-0 transition-all duration-300 relative z-10';

        modal.innerHTML = `
            <div class="mb-6">
                <h3 class="text-xl font-black text-white uppercase tracking-wider mb-2">Input Required</h3>
                <label for="global-prompt-input" class="text-sm text-slate-300 leading-relaxed block mb-4">${escapeHTML(message)}</label>
                <input type="text" id="global-prompt-input" class="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition-all shadow-inner" placeholder="${escapeHTML(placeholder)}">
            </div>
            <div class="flex gap-3 justify-end">
                <button id="global-prompt-cancel" class="btn-outline !py-2 !px-4 !text-sm flex-1">Cancel</button>
                <button id="global-prompt-ok" class="btn-primary !py-2 !px-4 !text-sm flex-1">Submit</button>
            </div>
        `;

        wrap.appendChild(backdrop);
        wrap.appendChild(modal);
        document.body.appendChild(wrap);

        const input = wrap.querySelector('#global-prompt-input') as HTMLInputElement;

        requestAnimationFrame(() => {
            backdrop.classList.remove('opacity-0');
            modal.classList.remove('scale-95', 'opacity-0');
            input.focus();
        });

        const close = (value: string | null) => {
            backdrop.classList.add('opacity-0');
            modal.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                wrap.remove();
                resolve(value);
            }, 300);
        };

        wrap.querySelector('#global-prompt-cancel')?.addEventListener('click', () => close(null));
        wrap.querySelector('#global-prompt-ok')?.addEventListener('click', () => close(input.value));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') close(input.value);
            if (e.key === 'Escape') close(null);
        });
        backdrop.addEventListener('click', () => close(null));
    });
}
