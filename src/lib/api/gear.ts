import { apiFetch } from './http';

export interface GearItem {
    id: string;
    name: string;
    description?: string;
    totalQuantity: number;
    availableQuantity: number;
}

export interface GearRequest {
    id: string;
    gearId: string;
    gearName: string;
    userId: string;
    userName: string;
    userEmail: string;
    requestDate: string;
    status: 'pending' | 'approved' | 'rejected' | 'returned';
}

export const gearApi = {
    async getGear(): Promise<GearItem[]> {
        return apiFetch('/api/gear');
    },

    async addGear(gear: Omit<GearItem, 'id'>) {
        return apiFetch('/api/gear', {
            method: 'POST',
            body: JSON.stringify(gear)
        });
    },

    async updateGear(id: string, gear: Partial<GearItem>) {
        return apiFetch(`/api/gear/${id}`, {
            method: 'PUT',
            body: JSON.stringify(gear)
        });
    },

    async deleteGear(id: string) {
        return apiFetch(`/api/gear/${id}`, { method: 'DELETE' });
    },

    async requestGear(gearId: string) {
        return apiFetch(`/api/gear/${gearId}/request`, { method: 'POST' });
    },

    async getAllRequests(): Promise<GearRequest[]> {
        return apiFetch('/api/gear/requests');
    },

    async getMyRequests(): Promise<GearRequest[]> {
        return apiFetch('/api/gear/me/requests');
    },

    async approveRequest(id: string) {
        return apiFetch(`/api/gear/requests/${id}/approve`, { method: 'POST' });
    },

    async rejectRequest(id: string) {
        return apiFetch(`/api/gear/requests/${id}/reject`, { method: 'POST' });
    },

    async returnRequest(id: string) {
        return apiFetch(`/api/gear/requests/${id}/return`, { method: 'POST' });
    }
};