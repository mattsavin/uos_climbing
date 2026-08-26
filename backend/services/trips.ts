import { sendEmail } from './email';

/**
 * Trip emails — phase 2 of docs/TRIPS_PLAN.md.
 *
 * Fire-and-forget like booking emails: failures are logged, never break the
 * mutation that triggered them. Money copy always says amounts are *recorded*
 * by committee bookkeeping — the system never handles money.
 *
 * Late-cancel refund wording is deliberately a placeholder: the committee has
 * not decided refund policy yet (2026-08-26), so we never invent one.
 */

const REFUND_PLACEHOLDER = '[REFUND POLICY — TBC BY COMMITTEE]';

function formatTripDate(isoDate: string): string {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return d.toLocaleString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/London'
    });
}

function costLines(trip: { totalCostPerPerson: number; depositAmount: number }): { text: string; html: string } {
    const depositSentence =
        trip.depositAmount > 0 ? ` A deposit of £${trip.depositAmount.toFixed(2)} is due to secure your place.` : '';
    const bookkeepingNote =
        'Payment is collected by the club treasurer/president (bank transfer or cash in person) and marked as paid on your account.';
    return {
        text: `Cost: £${trip.totalCostPerPerson.toFixed(2)} per person.${depositSentence}\n${bookkeepingNote}`,
        html: `<p>Cost: <strong>£${trip.totalCostPerPerson.toFixed(2)}</strong> per person.${depositSentence}</p><p style="color:#999;font-size:12px;">Payment is collected by the treasurer/president and <em>recorded as paid</em> on your account.</p>`
    };
}

export interface TripEmailData {
    title: string;
    destination: string;
    description?: string | null;
    startDate: string;
    endDate: string;
    meetupPoint?: string | null;
    signupClosesAt: string;
    totalCostPerPerson: number;
    depositAmount: number;
}

export async function sendTripSignupConfirmation(email: string, firstName: string, trip: TripEmailData): Promise<void> {
    const costs = costLines(trip);
    await sendEmail(
        email,
        `Trip confirmed: ${trip.title}`,
        `Hi ${firstName ?? 'there'},\n\nYou're signed up for ${trip.title} (${trip.destination}).\n\nWhen: ${formatTripDate(trip.startDate)} → ${formatTripDate(trip.endDate)}\nMeet at: ${trip.meetupPoint || 'TBC'}\nSign-ups close: ${formatTripDate(trip.signupClosesAt)}\n\n${costs.text}\n\nManage your trips on the club trips page.`,
        `<p>Hi ${firstName ?? 'there'},</p><p>You're signed up for <strong>${trip.title}</strong> (${trip.destination}).</p><p><strong>When:</strong> ${formatTripDate(trip.startDate)} → ${formatTripDate(trip.endDate)}<br><strong>Meet at:</strong> ${trip.meetupPoint || 'TBC'}<br><strong>Sign-ups close:</strong> ${formatTripDate(trip.signupClosesAt)}</p>${costs.html}<p style="color:#999;font-size:12px;">If you can no longer make it, cancel on the trips page before sign-ups close.</p>`
    ).catch((e) => console.error('Failed to send trip signup confirmation:', e));
}

export async function sendTripCancellationConfirmation(
    email: string,
    firstName: string,
    trip: TripEmailData,
    lateCancel: boolean
): Promise<void> {
    const refundNote = lateCancel
        ? `\n\nAs this cancellation was after the sign-up deadline:\n${REFUND_PLACEHOLDER}`
        : '';
    const refundNoteHtml = lateCancel
        ? `<p style="color:#b45309;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:8px;">${REFUND_PLACEHOLDER}</p>`
        : '';

    await sendEmail(
        email,
        `Trip cancelled: ${trip.title}`,
        `Hi ${firstName ?? 'there'},\n\nYour place on ${trip.title} (${trip.destination}, ${formatTripDate(trip.startDate)}) has been cancelled and released.${refundNote}\n\nManage your trips on the club trips page.`,
        `<p>Hi ${firstName ?? 'there'},</p><p>Your place on <strong>${trip.title}</strong> (${trip.destination}, ${formatTripDate(trip.startDate)}) has been cancelled and released.</p>${refundNoteHtml}`
    ).catch((e) => console.error('Failed to send trip cancellation confirmation:', e));
}
