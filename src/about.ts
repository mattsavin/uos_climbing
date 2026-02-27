import './style.css';
import { initApp } from './main';
import { config } from './config';

// Initialize core app
initApp();

document.addEventListener('DOMContentLoaded', () => {
    renderCommittee();
});

function renderCommittee() {
    const committeeGrid = document.getElementById('committee-grid');
    if (!committeeGrid) return;

    committeeGrid.innerHTML = config.committeeRoles.map(role => {
        const member = config.committeeMembers.find(m => m.roleId === role.id);
        const name = member ? member.name : "To Be Announced";
        const instagram = member ? member.instagram : null;
        const faveCrag = member ? member.faveCrag : null;

        return `
        <div class="glass-card group hover:border-brand-gold-muted/50 transition-all duration-500 overflow-hidden relative">
            <div class="absolute -right-10 -top-10 w-32 h-32 bg-brand-gold/5 rounded-full blur-3xl group-hover:bg-brand-gold/10 transition-colors"></div>
            
            <div class="w-24 h-24 mx-auto bg-slate-800 rounded-full mb-6 border border-white/10 flex items-center justify-center overflow-hidden relative z-10 shadow-xl group-hover:scale-110 transition-transform duration-500">
                <svg class="w-10 h-10 text-slate-600 group-hover:text-brand-gold-muted transition-colors" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            </div>
            
            <h3 class="text-xl font-bold text-white mb-1 relative z-10">${name}</h3>
            <p class="text-brand-gold-muted font-black text-[10px] mb-4 uppercase tracking-[0.2em] relative z-10">${role.title}</p>
            <p class="text-slate-400 text-sm font-light leading-relaxed mb-6 relative z-10">${role.description}</p>
            
            ${member ? `
            <div class="pt-4 border-t border-white/5 flex flex-col gap-2 relative z-10">
                <div class="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    <span>Fave Crag:</span>
                    <span class="text-slate-300">${faveCrag}</span>
                </div>
                <a href="https://instagram.com/${instagram}" target="_blank" class="text-xs text-brand-gold hover:text-white transition-colors font-bold inline-flex items-center justify-center gap-1">
                    @${instagram}
                </a>
            </div>
            ` : ''}
        </div>
    `}).join('');
}
