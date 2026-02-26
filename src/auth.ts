/**
 * Authentication & Database Module
 * Interfaces with the Express Backend API.
 */

export interface User {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    name: string;
    password?: string;
    registrationNumber?: string;
    emergencyContactName?: string;
    emergencyContactMobile?: string;
    pronouns?: string;
    dietaryRequirements?: string;
    role: 'member' | 'committee';
    committeeRole?: string | null;
    committeeRoles?: string[];
    membershipStatus: 'active' | 'pending' | 'rejected';
    membershipYear?: string;
    calendarToken?: string;
    memberships?: MembershipRow[];
}

export interface MembershipRow {
    id: string;
    userId: string;
    membershipType: 'basic' | 'bouldering' | 'comp_team';
    status: 'pending' | 'active' | 'rejected';
    membershipYear: string;
}

export const MEMBERSHIP_TYPE_LABELS: Record<string, string> = {
    basic: 'Basic',
    bouldering: 'Bouldering',
    comp_team: 'Competition Team'
};

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

export interface SessionType {
    id: string;
    label: string;
}

export interface Session {
    id: string;
    type: 'Competition' | 'Social' | 'Training Session (Bouldering)' | 'Training Session (Roped)' | 'Meeting';
    title: string;
    date: string; // ISO 8601 Date String
    capacity: number;
    bookedSlots: number;
    requiredMembership?: 'basic' | 'bouldering' | 'comp_team';
}

// Current Session State
export const authState = {
    user: null as User | null,

    async init() {
        try {
            const res = await fetch('/api/auth/me', {
                credentials: 'include'
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
    },

    async login(email: string, password?: string) {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        let data: any = {};
        try { data = await res.json(); } catch {
            throw new Error('Server returned an unexpected response. Please try again.');
        }

        if (!res.ok) {
            // Surface pendingVerification info so the UI can show the OTP panel
            const err: any = new Error(data.error || 'Login failed');
            err.pendingVerification = data.pendingVerification;
            err.userId = data.userId;
            throw err;
        }

        this.user = data.user;
        return this.user;
    },

    async verifyEmail(userId: string, code: string) {
        const res = await fetch('/api/auth/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ userId, code })
        });

        let data: any = {};
        try { data = await res.json(); } catch {
            throw new Error('Server returned an unexpected response. Please try again.');
        }
        if (!res.ok) throw new Error(data.error || 'Verification failed');

        this.user = data.user;
        return this.user;
    },

    async requestVerification(userId: string) {
        const res = await fetch('/api/auth/request-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        let data: any = {};
        try { data = await res.json(); } catch {
            throw new Error('Server returned an unexpected response. Please try again.');
        }
        if (!res.ok) throw new Error(data.error || 'Failed to resend code');
        return data;
    },

    async register(firstName: string, lastName: string, email: string, passwordHash: string, passwordConfirm: string, registrationNumber: string, membershipTypes: string[]) {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ firstName, lastName, email, password: passwordHash, passwordConfirm, registrationNumber, membershipTypes })
        });

        let data: any = {};
        try { data = await res.json(); } catch {
            throw new Error('Server returned an unexpected response. Please try again.');
        }
        if (!res.ok) {
            throw new Error(data.error || "Registration failed");
        }

        this.user = data.user;
        return data; // Return full response including pendingVerification flag
    },

    async getProfile() {
        const res = await fetch('/api/users/me/profile', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch profile");
        return data; // Returns { firstName, lastName, emergencyContactName, ... }
    },

    async updateProfile(fname: string, sname: string, emergencyContactName: string, emergencyContactMobile: string, pronouns: string, dietaryRequirements: string) {
        if (!this.user) throw new Error("Not logged in");

        const name = `${fname} ${sname}`.trim();

        const res = await fetch(`/api/users/${this.user.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ firstName: fname, lastName: sname, emergencyContactName, emergencyContactMobile, pronouns, dietaryRequirements })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update profile");

        this.user.firstName = fname;
        this.user.lastName = sname;
        this.user.name = name;
        this.user.emergencyContactName = emergencyContactName;
        this.user.emergencyContactMobile = emergencyContactMobile;
        this.user.pronouns = pronouns;
        this.user.dietaryRequirements = dietaryRequirements;
        return this.user;
    },

    async confirmMembershipRenewal(membershipYear: string, membershipTypes: string[]) {
        if (!this.user) throw new Error("Not logged in");

        const res = await fetch('/api/users/me/membership-renewal', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ membershipYear, membershipTypes })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to renew membership");

        this.user.membershipYear = data.membershipYear;
        this.user.membershipStatus = data.membershipStatus;
        return this.user;
    },

    async changePassword(currentPassword: string, newPassword: string) {
        if (!this.user) throw new Error("Not logged in");

        const res = await fetch('/api/users/me/password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update password");
        return data;
    },

    async forgotPassword(email: string) {
        const res = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        let data: any = {};
        try { data = await res.json(); } catch { /* ignore */ }
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    },

    async resetPassword(token: string, newPassword: string) {
        const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });
        let data: any = {};
        try { data = await res.json(); } catch { /* ignore */ }
        if (!res.ok) throw new Error(data.error || 'Reset failed');
        return data;
    },

    async getMyMemberships(): Promise<MembershipRow[]> {
        const res = await fetch('/api/users/me/memberships', { credentials: 'include' });
        let data: any = [];
        try { data = await res.json(); } catch { /* ignore */ }
        if (!res.ok) throw new Error(data.error || 'Failed to fetch memberships');
        return data;
    },

    async requestMembershipType(membershipType: string, membershipYear?: string) {
        const res = await fetch('/api/users/me/memberships', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ membershipType, membershipYear })
        });
        let data: any = {};
        try { data = await res.json(); } catch { /* ignore */ }
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    },

    async requestMembership() {
        if (!this.user) throw new Error('Not logged in');
        const res = await fetch('/api/users/me/request-membership', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        let data: any = {};
        try { data = await res.json(); } catch { /* ignore */ }
        if (!res.ok) throw new Error(data.error || 'Request failed');
        this.user.membershipStatus = data.membershipStatus;
        this.user.membershipYear = data.membershipYear;
        return data;
    },

    async deleteAccount(password: string) {
        if (!this.user) throw new Error("Not logged in");

        // First verify password
        const verifyRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: this.user.email, password })
        });

        if (!verifyRes.ok) throw new Error("Incorrect password.");

        const res = await fetch(`/api/users/${this.user.id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to delete account");
        this.logout();
        return data;
    },

    async logout() {
        this.user = null;
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } catch {
            // Ignore network errors — user is still logged out client-side
        }
    },

    getUser() {
        return this.user;
    }
};

// Helper for authenticated fetch
async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {})
    };

    const res = await fetch(endpoint, { ...options, headers, credentials: 'include' });
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

    /** Returns all users without filtering — used for pending membership scans */
    async getAllUsersRaw(): Promise<User[]> {
        return apiFetch('/api/admin/users');
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

    async approveMembershipRow(id: string) {
        return apiFetch(`/api/admin/memberships/${id}/approve`, { method: 'POST' });
    },

    async rejectMembershipRow(id: string) {
        return apiFetch(`/api/admin/memberships/${id}/reject`, { method: 'POST' });
    },

    async deleteMembershipRow(id: string) {
        return apiFetch(`/api/admin/memberships/${id}`, { method: 'DELETE' });
    },

    async setCommitteeRole(id: string, committeeRoles: string[]) {
        return apiFetch(`/api/admin/users/${id}/committee-role`, {
            method: 'POST',
            body: JSON.stringify({ committeeRoles })
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
    },

    // Session Type Management API
    async getSessionTypes(): Promise<SessionType[]> {
        return apiFetch('/api/session-types');
    },

    async addSessionType(label: string): Promise<SessionType> {
        return apiFetch('/api/session-types', {
            method: 'POST',
            body: JSON.stringify({ label })
        });
    },

    async updateSessionType(id: string, label: string): Promise<SessionType> {
        return apiFetch(`/api/session-types/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ label })
        });
    },

    async deleteSessionType(id: string): Promise<void> {
        return apiFetch(`/api/session-types/${id}`, { method: 'DELETE' });
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
    },

    async withdrawCandidate() {
        return apiFetch('/api/voting/withdraw', { method: 'POST' });
    },

    async resetElections() {
        return apiFetch('/api/voting/reset', { method: 'POST' });
    },

    async getReferendums(): Promise<Referendum[]> {
        return apiFetch('/api/voting/referendums');
    },

    async createReferendum(title: string, description: string) {
        return apiFetch('/api/voting/referendums', {
            method: 'POST',
            body: JSON.stringify({ title, description })
        });
    },

    async deleteReferendum(id: string) {
        return apiFetch(`/api/voting/referendums/${id}`, { method: 'DELETE' });
    },

    async voteReferendum(id: string, choice: 'yes' | 'no' | 'abstain') {
        return apiFetch(`/api/voting/referendums/${id}/vote`, {
            method: 'POST',
            body: JSON.stringify({ choice })
        });
    }
};

export interface Referendum {
    id: string;
    title: string;
    description: string;
    createdAt: number;
    yesCount: number;
    noCount: number;
    abstainCount: number;
    myVote?: 'yes' | 'no' | 'abstain';
}

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

