import './style.css';
import { initApp } from './main';
import { config } from './config';

// Initialize core app
initApp();

document.addEventListener('DOMContentLoaded', () => {
    renderFAQs();
});

function renderFAQs() {
    const container = document.getElementById('faq-container');
    if (!container) return;

    container.innerHTML = config.faqs.map(faq => `
        <div class="glass-card group hover:border-brand-gold/30 transition-all duration-300">
            <h3 class="text-xl font-bold text-white mb-4 flex items-start gap-3">
                <span class="text-brand-gold mt-1">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </span>
                ${faq.question}
            </h3>
            <p class="text-slate-400 leading-relaxed font-light pl-8">
                ${faq.answer}
            </p>
        </div>
    `).join('');
}
