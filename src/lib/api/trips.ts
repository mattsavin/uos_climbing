import { apiFetch } from './http';

export interface TripSignup {
    id: string;
    paymentStatus: 'unpaid' | 'deposit-paid' | 'paid';
    paidAmount: number;
    signedUpAt: number;
    cancelledAt: number | null;
}

export interface Trip {
    id: string;
    title: string;
    destination: string;
    description?: string | null;
    startDate: string;
    endDate: string;
    meetupPoint?: string | null;
    costBreakdown?: string | null; // JSON blob: { transport: 25, bunkhouse: 30 }
    totalCostPerPerson: number;
    depositAmount: number;
    capacity: number;
    signupClosesAt: string;
    requiredMembership: string;
    visibility: 'all' | 'committee_only';
    status: 'open' | 'closed' | 'cancelled' | 'completed';
    // Detail-only fields
    mySignup?: TripSignup | null;
    spotsTaken?: number;
}

export const tripsApi = {
    async list(): Promise<Trip[]> {
        return apiFetch('/api/trips');
    },

    async get(id: string): Promise<Trip> {
        return apiFetch(`/api/trips/${id}`);
    },

    async signUp(tripId: string) {
        return apiFetch(`/api/trips/${tripId}/signup`, { method: 'POST' });
    },

    async cancelSignUp(tripId: string): Promise<{ success: true; lateCancel: boolean }> {
        return apiFetch(`/api/trips/${tripId}/cancel-signup`, { method: 'POST' });
    }
};
