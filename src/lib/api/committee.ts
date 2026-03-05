import { apiFetch } from './http';

export const committeeApi = {
    async getCommitteeMembers() {
        return apiFetch('/api/committee');
    },

    async updateMyProfile(profile: { instagram?: string; faveCrag?: string; bio?: string }) {
        return apiFetch('/api/committee/me', {
            method: 'PUT',
            body: JSON.stringify(profile)
        });
    },

    async uploadPhoto(file: File) {
        const formData = new FormData();
        formData.append('photo', file);

        const res = await fetch('/api/committee/me/photo', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Photo upload failed');
        return data;
    },

    async exportMembersCSV(membershipType: string): Promise<void> {
        const url = `/api/committee/export/members?membershipType=${encodeURIComponent(membershipType)}`;
        const res = await fetch(url, {
            credentials: 'include'
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Export failed');
        }

        const contentDisposition = res.headers.get('content-disposition');
        let filename = `members-${membershipType}.csv`;
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+?)"/);
            if (match) filename = match[1];
        }

        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
    }
};