document.addEventListener('DOMContentLoaded', async () => {
    const verifyCard = document.getElementById('verify-card');
    const errorCard = document.getElementById('error-card');
    const nameEl = document.getElementById('verify-name');
    const regEl = document.getElementById('verify-reg');
    const statusBadge = document.getElementById('status-badge');
    const statusText = document.getElementById('status-text');
    const yearEl = document.getElementById('verify-year');
    const expiryEl = document.getElementById('verify-expiry');
    const photoImg = document.getElementById('verify-photo') as HTMLImageElement;
    const photoPlaceholder = document.getElementById('verify-photo-placeholder');
    const errorMessage = document.getElementById('error-message');

    // Extract ID from URL: /verify/:id
    const pathParts = window.location.pathname.split('/');
    const memberId = pathParts[pathParts.length - 1];

    if (!memberId || memberId === 'verify') {
        showError('Invalid verification link.');
        return;
    }

    try {
        const res = await fetch(`/api/verify/${memberId}`);
        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'Member not found.');
            return;
        }

        // Populate Data
        if (nameEl) nameEl.textContent = data.name;
        if (regEl) regEl.textContent = `ID: ${data.registrationNumber || 'N/A'}`;
        if (yearEl) yearEl.textContent = data.year || '2026/27'; // Fallback if not provided
        if (expiryEl) expiryEl.textContent = data.expiryDate;

        if (data.profilePhoto) {
            if (photoImg) {
                photoImg.src = data.profilePhoto;
                photoImg.classList.remove('hidden');
            }
            photoPlaceholder?.classList.add('hidden');
        }

        // Badge Status
        if (statusBadge && statusText) {
            if (data.isActive) {
                statusBadge.className = 'inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-lg mb-8 shadow-xl bg-emerald-500 text-white shadow-emerald-500/20';
                statusText.textContent = 'ACTIVE MEMBER';
            } else {
                statusBadge.className = 'inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-lg mb-8 shadow-xl bg-red-500 text-white shadow-red-500/20';
                statusText.textContent = data.status.toUpperCase() || 'INACTIVE';
            }
        }

        verifyCard?.classList.remove('hidden');
    } catch (err) {
        showError('Network error. Please try again.');
    }

    function showError(msg: string) {
        if (errorMessage) errorMessage.textContent = msg;
        errorCard?.classList.remove('hidden');
        verifyCard?.classList.add('hidden');
    }
});
