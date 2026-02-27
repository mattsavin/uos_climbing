import type { Session } from './auth';

interface SessionColorStyle {
    chip: string;
    dot: string;
}

const SESSION_COLOR_PALETTE: SessionColorStyle[] = [
    { chip: 'bg-brand-gold/20 text-brand-gold border-brand-gold/35', dot: 'bg-brand-gold' },
    { chip: 'bg-blue-500/20 text-blue-300 border-blue-500/35', dot: 'bg-blue-400' },
    { chip: 'bg-purple-500/20 text-purple-300 border-purple-500/35', dot: 'bg-purple-400' },
    { chip: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35', dot: 'bg-emerald-400' },
    { chip: 'bg-rose-500/20 text-rose-300 border-rose-500/35', dot: 'bg-rose-400' },
    { chip: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/35', dot: 'bg-cyan-400' },
    { chip: 'bg-amber-500/20 text-amber-300 border-amber-500/35', dot: 'bg-amber-400' },
    { chip: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/35', dot: 'bg-indigo-400' }
];

function hashText(value: string): number {
    return Array.from(value).reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 0);
}

function getSessionTypeColorMap(typeIds: string[]): Record<string, SessionColorStyle> {
    const uniqueTypeIds = Array.from(new Set(typeIds.filter(Boolean)));

    return uniqueTypeIds.reduce<Record<string, SessionColorStyle>>((map, typeId) => {
        const index = hashText(typeId.toLowerCase()) % SESSION_COLOR_PALETTE.length;
        map[typeId] = SESSION_COLOR_PALETTE[index];
        return map;
    }, {});
}

function renderCalendarLegend(
    legendContainer: HTMLElement | null,
    legendTypes: string[],
    colorMap: Record<string, SessionColorStyle>
) {
    if (!legendContainer) return;
    const uniqueLegendTypes = Array.from(new Set(legendTypes.filter(Boolean))).sort((a, b) => a.localeCompare(b));

    if (!uniqueLegendTypes.length) {
        legendContainer.innerHTML = '';
        legendContainer.classList.add('hidden');
        return;
    }

    legendContainer.classList.remove('hidden');
    legendContainer.innerHTML = `
        <div class="mt-6 mb-3 flex flex-wrap gap-4 items-center text-xs text-slate-300 backdrop-blur-sm bg-brand-dark/30 p-4 rounded-xl border border-white/5 shadow-lg mx-auto w-fit max-w-full">
            ${uniqueLegendTypes.map(type => {
                const style = colorMap[type] || SESSION_COLOR_PALETTE[0];
                return `
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-2.5 h-2.5 rounded-full ${style.dot} shrink-0"></span>
                        <span class="truncate max-w-[170px]">${type}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

export function renderCalendarEvents(
    container: HTMLElement,
    monthDisplay: HTMLElement | null,
    currentDate: Date,
    sessions: Session[],
    myBookings: string[],
    _isAdmin: boolean = false,
    onSessionClick?: (session: Session, isBooked: boolean) => void,
    legendContainer?: HTMLElement | null,
    availableSessionTypes: string[] = []
) {
    if (!container) return;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (monthDisplay) {
        monthDisplay.textContent = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(currentDate);
    }

    const isMobile = window.innerWidth < 768;
    const colorMap = getSessionTypeColorMap([...availableSessionTypes, ...sessions.map(s => s.type)]);
    let html = '';

    if (isMobile) {
        // --- Agenda View (Mobile) ---
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        // Filter and sort sessions for this month
        const monthSessions = sessions.filter(s => {
            const d = new Date(s.date);
            return d >= firstDayOfMonth && d <= lastDayOfMonth;
        }).sort((a, b) => a.date.localeCompare(b.date));

        if (monthSessions.length === 0) {
            html = `
                <div class="py-12 text-center text-slate-500">
                    <p>No sessions scheduled for this month.</p>
                </div>
            `;
        } else {
            // Group by day
            const grouped: Record<string, Session[]> = {};
            monthSessions.forEach(s => {
                const dateKey = s.date.split('T')[0];
                if (!grouped[dateKey]) grouped[dateKey] = [];
                grouped[dateKey].push(s);
            });

            html = `<div class="flex flex-col gap-6 p-4">`;
            Object.entries(grouped).forEach(([dateStr, daySessions]) => {
                const date = new Date(dateStr);
                const dayName = date.toLocaleDateString('en-GB', { weekday: 'long' });
                const dayNum = date.getDate();
                const suffix = (dayNum: number) => {
                    if (dayNum > 3 && dayNum < 21) return 'th';
                    switch (dayNum % 10) {
                        case 1: return "st";
                        case 2: return "nd";
                        case 3: return "rd";
                        default: return "th";
                    }
                };

                html += `
                    <div>
                        <div class="flex items-center gap-3 mb-3 border-b border-white/5 pb-2">
                            <span class="text-brand-gold font-black text-2xl">${dayNum}${suffix(dayNum)}</span>
                            <span class="text-slate-400 font-bold uppercase tracking-widest text-sm">${dayName}</span>
                        </div>
                        <div class="flex flex-col gap-3">
                            ${daySessions.map(session => renderSessionChip(session, myBookings, !!onSessionClick, colorMap)).join('')}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
    } else {
        // --- Grid View (Desktop) ---
        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon...
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

        // Dynamic Headers
        html = `
            <div class="grid grid-cols-7 border-b border-white/10 bg-slate-900/50">
                ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => `
                    <div class="py-2 text-center text-[10px] font-bold text-slate-500 uppercase tracking-tighter">${day}</div>
                `).join('')}
            </div>
            <div class="grid grid-cols-7 auto-rows-[minmax(110px,_auto)] bg-white/5 gap-px">
        `;

        // Blank days
        for (let i = 0; i < startOffset; i++) {
            html += `<div class="bg-slate-800/20 p-2 min-h-[110px]"></div>`;
        }

        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

        for (let day = 1; day <= daysInMonth; day++) {
            const isToday = isCurrentMonth && today.getDate() === day;
            const dayClass = isToday ? 'text-brand-gold font-bold bg-brand-gold/10 rounded w-6 h-6 flex items-center justify-center' : 'text-slate-500 text-xs font-bold';
            const dayStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            const daySessions = sessions.filter(s => s.date.startsWith(dayStr));

            html += `
                <div class="bg-slate-800/60 p-2 min-h-[110px] border border-white/5 hover:border-brand-gold/30 transition-colors flex flex-col">
                    <div class="flex justify-end mb-1">
                        <span class="${dayClass}">${day}</span>
                    </div>
                    <div class="flex-1 flex flex-col gap-1 w-full overflow-hidden">
                        ${daySessions.map(session => renderSessionChip(session, myBookings, !!onSessionClick, colorMap)).join('')}
                    </div>
                </div>
            `;
        }

        // Fill remaining grid
        const totalCells = startOffset + daysInMonth;
        const remainder = totalCells % 7;
        if (remainder !== 0) {
            for (let i = 0; i < 7 - remainder; i++) {
                html += `<div class="bg-slate-800/20 p-2 min-h-[110px]"></div>`;
            }
        }
        html += `</div>`;
    }

    container.innerHTML = html;

    if (onSessionClick) {
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

    renderCalendarLegend(legendContainer || null, availableSessionTypes, colorMap);
}

function renderSessionChip(
    session: Session,
    myBookings: string[],
    isClickable: boolean,
    colorMap: Record<string, SessionColorStyle>
): string {
    const isBooked = myBookings.includes(session.id);
    const timeStr = new Date(session.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    let bg = colorMap[session.type]?.chip || 'bg-slate-600/50 text-slate-300 border-slate-600/30';

    if (isBooked) {
        bg = 'bg-brand-gold text-brand-darker border-brand-gold font-bold shadow-[0_0_15px_rgba(253,185,19,0.3)]';
    }

    const reqMemb = (session as any).requiredMembership || 'basic';
    const membBadge = reqMemb === 'comp_team'
        ? `<span class="text-[8px] font-black uppercase tracking-widest opacity-90 bg-purple-500/30 text-purple-300 px-1 rounded">Comp Team</span>`
        : reqMemb === 'bouldering'
            ? `<span class="text-[8px] font-black uppercase tracking-widest opacity-90 bg-blue-500/30 text-blue-300 px-1 rounded">Bouldering</span>`
            : '';

    return `
        <div class="session-chip mt-1 border rounded p-2 text-xs font-medium leading-tight w-full overflow-hidden ${isClickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'} flex flex-col gap-1 ${bg}" data-id="${session.id}">
            <div class="w-full flex items-center justify-between gap-2">
                <span class="font-bold text-[11px] tracking-wide">${timeStr}</span>
                ${isBooked ? '<span class="text-current font-black text-sm" title="Booked">✓</span>' : ''}
            </div>
            <div class="text-[11px] font-semibold leading-snug break-words">${session.title}</div>
            ${membBadge ? `<div>${membBadge}</div>` : ''}
            <div class="mt-auto pt-1 border-t border-current border-opacity-20">
                <div class="font-bold text-[10px] uppercase tracking-wider opacity-90">${session.bookedSlots}/${session.capacity} Slots</div>
                <div class="text-[8px] uppercase tracking-widest opacity-75 leading-tight pt-0.5 break-words">${session.type}</div>
            </div>
        </div>
    `;
}
