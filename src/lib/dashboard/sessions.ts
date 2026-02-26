import { adminApi, authState, type Session } from '../../auth';
import { renderCalendarEvents } from '../../calendar';
import { openSessionModal } from '../../components/sessionModal';

let currentCalendarDate = new Date();
let activeFilter: 'all' | 'basic' | 'bouldering' | 'comp_team' = 'all';

export async function renderSessions(isAdmin: boolean) {
    const calendarGrid = document.getElementById('calendar-grid');
    const calendarMonthDisplay = document.getElementById('calendar-month-display');
    if (!calendarGrid || !calendarMonthDisplay) return;

    const allSessions = await adminApi.getSessions();
    let myBookings: string[] = [];
    if (authState.getUser()) {
        myBookings = await adminApi.getMyBookings();
    }

    // Apply membership type filter
    const sessions = activeFilter === 'all'
        ? allSessions
        : allSessions.filter((s: Session) => (s.requiredMembership || 'basic') === activeFilter);

    renderCalendarEvents(
        calendarGrid,
        calendarMonthDisplay,
        currentCalendarDate,
        sessions,
        myBookings,
        isAdmin,
        async (session: Session, isBooked: boolean) => {
            openSessionModal({
                session,
                isBooked,
                user: authState.user,
                onBook: async (id) => {
                    await adminApi.bookSession(id);
                    await renderSessions(isAdmin);
                },
                onCancel: async (id) => {
                    await adminApi.cancelSession(id);
                    await renderSessions(isAdmin);
                },
                onEditSuccess: async () => {
                    await renderSessions(isAdmin);
                },
                onDeleteSuccess: async () => {
                    await renderSessions(isAdmin);
                }
            });
        }
    );
}

export function initSessionHandlers() {
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const addSessionToggleBtn = document.getElementById('add-session-toggle-btn');
    const addSessionFormContainer = document.getElementById('add-session-form-container');
    const addSessionForm = document.getElementById('add-session-form');
    const cancelSessionBtn = document.getElementById('cancel-session-btn');

    const getIsCommittee = () => {
        const u = authState.getUser();
        if (!u) return false;
        return u.role === 'committee' || !!u.committeeRole || (Array.isArray(u.committeeRoles) && u.committeeRoles.length > 0);
    };

    if (prevMonthBtn) prevMonthBtn.addEventListener('click', async () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        await renderSessions(getIsCommittee());
    });
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', async () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        await renderSessions(getIsCommittee());
    });

    if (addSessionToggleBtn && addSessionFormContainer) {
        addSessionToggleBtn.addEventListener('click', () => {
            addSessionFormContainer.classList.toggle('hidden');
        });
    }

    if (cancelSessionBtn && addSessionFormContainer) {
        cancelSessionBtn.addEventListener('click', () => {
            addSessionFormContainer.classList.add('hidden');
        });
    }

    if (addSessionForm) {
        addSessionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = (document.getElementById('session-title') as HTMLInputElement).value;
            const type = (document.getElementById('session-type') as HTMLSelectElement).value as any;
            const dateStr = (document.getElementById('session-date') as HTMLInputElement).value;
            const capacity = parseInt((document.getElementById('session-capacity') as HTMLInputElement).value, 10);
            const requiredMembership = ((document.getElementById('session-required-membership') as HTMLSelectElement)?.value || 'basic') as 'basic' | 'bouldering' | 'comp_team';

            if (title && type && dateStr && !isNaN(capacity)) {
                await adminApi.addSession({ title, type, date: dateStr, capacity, requiredMembership });
                (addSessionForm as HTMLFormElement).reset();
                addSessionFormContainer?.classList.add('hidden');
                await renderSessions(getIsCommittee());
            }
        });
    }

    // Membership filter buttons
    document.querySelectorAll<HTMLButtonElement>('.session-filter-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const filter = btn.dataset.filter as typeof activeFilter;
            activeFilter = filter;

            // Update active state styling
            document.querySelectorAll<HTMLButtonElement>('.session-filter-btn').forEach(b => {
                b.classList.remove('bg-slate-700', 'text-white', 'border-slate-600', 'bg-brand-gold', 'text-brand-darker', 'border-brand-gold',
                    'bg-blue-500/20', 'text-blue-400', 'border-blue-400', 'bg-purple-500/20', 'text-purple-400', 'border-purple-400');
                b.classList.add('border-slate-700', 'text-slate-400');
                b.style.backgroundColor = '';
            });

            if (filter === 'all') {
                btn.classList.add('bg-slate-700', 'text-white', 'border-slate-600');
                btn.classList.remove('border-slate-700', 'text-slate-400');
            } else if (filter === 'basic') {
                btn.classList.add('bg-brand-gold/15', 'text-brand-gold', 'border-brand-gold');
                btn.classList.remove('border-slate-700', 'text-slate-400');
            } else if (filter === 'bouldering') {
                btn.classList.add('bg-blue-500/15', 'text-blue-400', 'border-blue-400');
                btn.classList.remove('border-slate-700', 'text-slate-400');
            } else if (filter === 'comp_team') {
                btn.classList.add('bg-purple-500/15', 'text-purple-400', 'border-purple-400');
                btn.classList.remove('border-slate-700', 'text-slate-400');
            }

            await renderSessions(getIsCommittee());
        });
    });
}
