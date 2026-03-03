import './style.css';
import { initApp } from './main';
import { config } from './config';

// Initialize core app
initApp();

document.addEventListener('DOMContentLoaded', () => {
    renderWalls();
});

function renderWalls() {
    const grid = document.getElementById('walls-grid');
    if (!grid) return;

    grid.innerHTML = config.walls.map(wall => `
        <div class="glass-card flex flex-col h-full hover:border-cyan-500/30 transition-all duration-300">
            <div class="flex justify-between items-start mb-4">
                <h3 class="text-2xl font-bold text-white">${wall.name}</h3>
                <span class="px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-full text-[10px] uppercase font-bold tracking-widest border border-cyan-500/20">${wall.type}</span>
            </div>
            <p class="text-slate-400 mb-6 flex-grow font-light leading-relaxed">${wall.description}</p>
            <div class="space-y-3 pt-4 border-t border-white/5">
                <div class="flex items-center gap-3 text-sm">
                    <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    <span class="text-slate-300">${wall.distance}</span>
                </div>
                <div class="flex items-center gap-3 text-sm">
                    <svg class="w-4 h-4 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"></path>
                    </svg>
                    <span class="text-brand-gold-muted font-bold">${wall.discount}</span>
                </div>
            </div>
        </div>
    `).join('');
}
