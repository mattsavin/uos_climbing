/**
 * Authentication & Database Module
 * Interfaces with the Express Backend API.
 */

export interface User {
    id: string;
    email: string;
    name: string;
    password?: string;
    registrationNumber?: string;
    emergencyContactName?: string;
    emergencyContactMobile?: string;
    pronouns?: string;
    dietaryRequirements?: string;
    role: 'member' | 'committee';
    committeeRole?: string | null;
    membershipStatus: 'active' | 'pending' | 'rejected';
    membershipYear?: string;
}

export function getCurrentAcademicYear() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed, 0 = Jan, 8 = Sep

    // If before September, academic year started last year
    if (month < 8) {
        return `${year - 1}/${year}`;
    }
    // If September or later, academic year started this year
    return `${year}/${year + 1}`;
}

export interface Session {
    id: string;
    type: 'Competition' | 'Social' | 'Training Session (Bouldering)' | 'Training Session (Roped)' | 'Meeting';
    title: string;
    date: string; // ISO 8601 Date String
    capacity: number;
    bookedSlots: number;
}

// Current Session State
export const authState = {
    user: null as User | null,
    token: null as string | null,

    async init() {
        this.token = localStorage.getItem('uscc_token');
        if (this.token) {
            try {
                const res = await fetch('/api/auth/me', {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    this.user = data.user;
                } else {
                    this.logout();
                }
            } catch (e) {
                this.logout();
            }
        }
    },

    async login(email: string, password?: string) {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Login failed");
        }

        this.user = data.user;
        this.token = data.token;
        if (this.token) localStorage.setItem('uscc_token', this.token);
        return this.user;
    },

    async register(name: string, email: string, passwordHash: string, registrationNumber: string) {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password: passwordHash, registrationNumber })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || "Registration failed");
        }

        this.user = data.user;
        this.token = data.token;
        if (this.token) localStorage.setItem('uscc_token', this.token);
        return this.user;
    },

    async updateProfile(name: string, emergencyContactName: string, emergencyContactMobile: string, pronouns: string, dietaryRequirements: string) {
        if (!this.user || !this.token) throw new Error("Not logged in");

        const res = await fetch(`/api/users/${this.user.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ name, emergencyContactName, emergencyContactMobile, pronouns, dietaryRequirements })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update profile");

        this.user.name = name;
        this.user.emergencyContactName = emergencyContactName;
        this.user.emergencyContactMobile = emergencyContactMobile;
        this.user.pronouns = pronouns;
        this.user.dietaryRequirements = dietaryRequirements;
        return this.user;
    },

    async confirmMembershipRenewal(membershipYear: string) {
        if (!this.user || !this.token) throw new Error("Not logged in");

        const res = await fetch('/api/users/me/membership-renewal', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ membershipYear })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to renew membership");

        this.user.membershipYear = data.membershipYear;
        this.user.membershipStatus = data.membershipStatus;
        return this.user;
    },

    async changePassword(currentPassword: string, newPassword: string) {
        if (!this.user || !this.token) throw new Error("Not logged in");

        const res = await fetch('/api/users/me/password', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update password");
        return data;
    },

    async deleteAccount(password: string) {
        if (!this.user || !this.token) throw new Error("Not logged in");

        // First verify password
        const verifyRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: this.user.email, password })
        });

        if (!verifyRes.ok) throw new Error("Incorrect password.");

        const res = await fetch(`/api/users/${this.user.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to delete account");
        this.logout();
        return data;
    },

    logout() {
        this.user = null;
        this.token = null;
        localStorage.removeItem('uscc_token');
    },

    getUser() {
        return this.user;
    }
};

// Helper for authenticated fetch
async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('uscc_token');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {})
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(endpoint, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API Request Failed');
    return data;
}

// Admin API
export const adminApi = {
    async getAllUsers(): Promise<User[]> {
        const users = await apiFetch('/api/admin/users');
        return users.filter((u: User) => u.membershipStatus === 'pending');
    },

    async getActiveMembers(): Promise<User[]> {
        const users = await apiFetch('/api/admin/users');
        return users.filter((u: User) => u.membershipStatus === 'active' && u.email !== 'sheffieldclimbing@gmail.com');
    },

    async approveMember(id: string) {
        return apiFetch(`/api/admin/users/${id}/approve`, { method: 'POST' });
    },

    async rejectMember(id: string) {
        return apiFetch(`/api/admin/users/${id}/reject`, { method: 'POST' });
    },

    async promoteToCommittee(id: string) {
        return apiFetch(`/api/admin/users/${id}/promote`, { method: 'POST' });
    },

    async demoteToMember(id: string) {
        return apiFetch(`/api/admin/users/${id}/demote`, { method: 'POST' });
    },

    async deleteUser(id: string) {
        return apiFetch(`/api/users/${id}`, { method: 'DELETE' });
    },

    async setCommitteeRole(id: string, committeeRole: string | null) {
        return apiFetch(`/api/admin/users/${id}/committee-role`, {
            method: 'POST',
            body: JSON.stringify({ committeeRole })
        });
    },

    async getElectionsConfig() {
        return apiFetch('/api/admin/config/elections');
    },

    async setElectionsConfig(open: boolean) {
        return apiFetch('/api/admin/config/elections', {
            method: 'POST',
            body: JSON.stringify({ open })
        });
    },

    // Session Management API
    async getSessions(): Promise<Session[]> {
        return apiFetch('/api/sessions');
    },

    async addSession(session: Omit<Session, 'id' | 'bookedSlots'>): Promise<Session> {
        return apiFetch('/api/sessions', {
            method: 'POST',
            body: JSON.stringify(session)
        });
    },

    async updateSession(id: string, updates: Partial<Session>): Promise<void> {
        return apiFetch(`/api/sessions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    },

    async deleteSession(id: string) {
        return apiFetch(`/api/sessions/${id}`, { method: 'DELETE' });
    },

    async getMyBookings(): Promise<string[]> {
        return apiFetch('/api/sessions/me/bookings');
    },

    async bookSession(id: string) {
        return apiFetch(`/api/sessions/${id}/book`, { method: 'POST' });
    },

    async cancelSession(id: string) {
        return apiFetch(`/api/sessions/${id}/cancel`, { method: 'POST' });
    }
};

export interface Candidate {
    id: string;
    name: string;
    manifesto: string;
    role: string;
    presentationLink?: string;
    voteCount: number;
}

export const votingApi = {
    async getCandidates(): Promise<Candidate[]> {
        return apiFetch('/api/voting/candidates');
    },

    async applyCandidate(manifesto: string, role: string, presentationLink?: string) {
        return apiFetch('/api/voting/apply', {
            method: 'POST',
            body: JSON.stringify({ manifesto, role, presentationLink })
        });
    },

    async getStatus() {
        return apiFetch('/api/voting/status');
    },

    async castVote(candidateId: string) {
        return apiFetch('/api/voting/vote', {
            method: 'POST',
            body: JSON.stringify({ candidateId })
        });
    }
};

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

// Initialize session asynchronously will be handled in dashboard.ts

