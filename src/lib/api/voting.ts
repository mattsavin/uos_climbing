import { apiFetch } from './http';

export interface Candidate {
    id: string;
    name: string;
    manifesto: string;
    role: string;
    presentationLink?: string;
    voteCount: number;
}

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