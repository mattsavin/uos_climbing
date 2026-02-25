import type { Session } from './auth';

export function renderCalendarEvents(
    container: HTMLElement,
    monthDisplay: HTMLElement | null,
    currentDate: Date,
    sessions: Session[],
    myBookings: string[],
    _isAdmin: boolean = false,
    onSessionClick?: (session: Session, isBooked: boolean) => void
) {
    if (!container) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (monthDisplay) {
        monthDisplay.textContent = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(currentDate);
    }

    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon...
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // JS getDay() starts on Sunday (0). We want Monday (1) to be index 0.
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    let gridHtml = '';

    // Blank days before start
    for (let i = 0; i < startOffset; i++) {
        gridHtml += `<div class="bg-slate-800/20 p-2 min-h-[90px] border border-transparent"></div>`;
    }

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = isCurrentMonth && today.getDate() === day;
        const dayClass = isToday ? 'text-brand-gold font-bold bg-brand-gold/10 rounded w-6 h-6 flex items-center justify-center' : 'text-slate-500 text-xs font-bold';

        // Find sessions for this day
        const dayStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const daySessions = sessions.filter(s => s.date.startsWith(dayStr));

        let chipsHtml = daySessions.map(session => {
            const isBooked = myBookings.includes(session.id);

            let bg = 'bg-slate-600/50 text-slate-300 border-slate-600/30';
            if (session.type === 'Competition') bg = 'bg-red-500/20 text-red-500 border-red-500/30';
            if (session.type === 'Social') bg = 'bg-brand-gold-muted/20 text-brand-gold-muted border-brand-gold-muted/30';
            if (session.type === 'Training Session (Bouldering)') bg = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            if (session.type === 'Training Session (Roped)') bg = 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            if (session.type === 'Meeting') bg = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

            if (isBooked) {
                bg = 'bg-brand-gold text-brand-darker border-brand-gold font-bold shadow-[0_0_15px_rgba(253,185,19,0.3)]';
            }

            const timeStr = new Date(session.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

            return `
                <div class="session-chip mt-1 border rounded p-2 text-xs font-medium leading-snug w-full ${onSessionClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'} flex flex-col gap-1.5 ${bg}" data-id="${session.id}">
                    <div class="w-full">
                        <span class="font-bold mr-1 opacity-75">${timeStr}</span>
                        <span class="font-bold break-words">${session.title}</span>
                    </div>
                    <div class="flex items-center justify-between gap-1.5 mt-auto pt-1 border-t border-current border-opacity-20">
                        <span class="font-bold text-[10px] uppercase tracking-wider opacity-90 whitespace-nowrap">${session.bookedSlots}/${session.capacity} Slots</span>
                        ${isBooked ? '<span class="text-current font-black text-sm" title="Booked">✓</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');

        gridHtml += `
            <div class="bg-slate-800/60 p-2 min-h-[110px] border border-white/5 hover:border-brand-gold/30 transition-colors group relative flex flex-col">
                <div class="flex justify-end mb-1">
                    <span class="${dayClass}">${day}</span>
                </div>
                <div class="flex-1 flex flex-col gap-1 w-full overflow-hidden">
                    ${chipsHtml}
                </div>
            </div>
        `;
    }

    // Fill remaining grid to keep structure nice
    const totalCells = startOffset + daysInMonth;
    const remainder = totalCells % 7;
    if (remainder !== 0) {
        for (let i = 0; i < 7 - remainder; i++) {
            gridHtml += `<div class="bg-slate-800/20 p-2 min-h-[90px] border border-transparent"></div>`;
        }
    }

    container.innerHTML = gridHtml;

    if (onSessionClick) {
        // Attach Click Listeners for Chips
        container.querySelectorAll('.session-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const id = (e.currentTarget as HTMLElement).dataset.id;
                const session = sessions.find(s => s.id === id);
                if (session) {
                    onSessionClick(session, myBookings.includes(session.id));
                }
            });
        });
    }
}
