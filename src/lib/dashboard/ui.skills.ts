/**
 * Initializes a minimalist skills progression tracker.
 * Serializes state to `localStorage` under a user-specific key to persist progress.
 * Renders a checklist of milestones and updates an SVG progress bar dynamically.
 *
 * @param {string} userId - Unique identifier of the user to namespace localStorage keys.
 */
export function initSkillsTracker(userId: string) {
    const list = document.getElementById('skills-tracker-list');
    if (!list) return;

    const storageKey = `uos_climb_skills_${userId}`;
    const skills = [
        { id: 'registered', label: 'Registered at a Wall' },
        { id: 'belay', label: 'Learned to Belay' },
        { id: 'first_blue', label: 'Sent first V2' },
        { id: 'first_lead', label: 'First Lead Climb' },
        { id: 'v5', label: 'Sent V5' },
        { id: 'comp', label: 'Entered First Competition' }
    ];

    let completed: string[] = JSON.parse(localStorage.getItem(storageKey) || '[]');

    const render = () => {
        list.innerHTML = skills.map(skill => {
            const isDone = completed.includes(skill.id);
            return `
                <div class="flex items-center gap-3 group cursor-pointer skill-item" data-id="${skill.id}">
                    <div class="w-5 h-5 rounded border border-white/10 flex items-center justify-center group-hover:bg-white/5 transition-colors ${isDone ? 'bg-cyan-500/20 border-cyan-500/50' : ''}">
                        ${isDone ? '<svg class="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>' : ''}
                    </div>
                    <span class="text-xs ${isDone ? 'text-white font-bold' : 'text-slate-400'} transition-colors">${skill.label}</span>
                </div>
            `;
        }).join('');

        const progressPercent = Math.round((completed.length / skills.length) * 100);
        const progressText = document.querySelector('#skills-tracker-list + div span:last-child');
        const progressBar = document.querySelector('#skills-tracker-list + div + div div');

        if (progressText) progressText.textContent = `${completed.length}/${skills.length}`;
        if (progressBar) (progressBar as HTMLElement).style.width = `${progressPercent}%`;

        list.querySelectorAll('.skill-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                if (!id) return;
                if (completed.includes(id)) {
                    completed = completed.filter(i => i !== id);
                } else {
                    completed.push(id);
                }
                localStorage.setItem(storageKey, JSON.stringify(completed));
                render();
            });
        });
    };

    render();
}