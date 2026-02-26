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

    committeeGrid.innerHTML = config.committeeRoles.map(role => `
        <div class="bg-brand-dark/50 border border-white/5 rounded-2xl p-6 text-center hover:border-brand-gold-muted/30 transition-colors">
            <div class="w-24 h-24 mx-auto bg-slate-800 rounded-full mb-4 border border-white/10 flex items-center justify-center overflow-hidden">
                <svg class="w-10 h-10 text-slate-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            </div>
            <h3 class="text-xl font-bold text-white mb-1">To Be Announced</h3>
            <p class="text-brand-gold-muted font-medium text-sm mb-3 uppercase tracking-wider">${role.title}</p>
            <p class="text-slate-400 text-sm">${role.description}</p>
        </div>
    `).join('');
}
