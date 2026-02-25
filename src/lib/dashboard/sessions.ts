import { adminApi, authState, type Session } from '../../auth';
import { renderCalendarEvents } from '../../calendar';
import { openSessionModal } from '../../components/sessionModal';

let currentCalendarDate = new Date();

export async function renderSessions(isAdmin: boolean) {
    const calendarGrid = document.getElementById('calendar-grid');
    const calendarMonthDisplay = document.getElementById('calendar-month-display');
    if (!calendarGrid || !calendarMonthDisplay) return;

    const sessions = await adminApi.getSessions();
    let myBookings: string[] = [];
    if (authState.getUser()) {
        myBookings = await adminApi.getMyBookings();
    }

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

    if (prevMonthBtn) prevMonthBtn.addEventListener('click', async () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        await renderSessions(authState.getUser()?.role === 'committee');
    });
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', async () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        await renderSessions(authState.getUser()?.role === 'committee');
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

            if (title && type && dateStr && !isNaN(capacity)) {
                await adminApi.addSession({ title, type, date: dateStr, capacity });
                (addSessionForm as HTMLFormElement).reset();
                addSessionFormContainer?.classList.add('hidden');
                await renderSessions(authState.getUser()?.role === 'committee');
            }
        });
    }
}
