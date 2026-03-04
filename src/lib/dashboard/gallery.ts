import { showToast } from '../../utils';

export async function fetchGalleryImages() {
    try {
        const response = await fetch('/api/gallery');
        if (!response.ok) throw new Error('Failed to fetch gallery');
        return await response.json();
    } catch (e) {
        console.error(e);
        return [];
    }
}

export async function renderGalleryList() {
    const listContainer = document.getElementById('gallery-management-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<p class="text-xs text-slate-500 text-center">Loading gallery...</p>';

    const images = await fetchGalleryImages();

    if (images.length === 0) {
        listContainer.innerHTML = '<p class="text-xs text-slate-500 text-center">No images uploaded yet.</p>';
        return;
    }

    listContainer.innerHTML = images.map((img: any) => `
        <div class="flex items-center justify-between p-2 rounded border bg-slate-800 text-slate-400 border-slate-700 mb-2 gap-3 group">
            <img src="${img.filepath}" alt="${img.caption}" class="w-12 h-12 object-cover rounded bg-black/50 overflow-hidden shrink-0">
            <div class="flex flex-col flex-grow min-w-0">
                <span class="text-xs font-bold text-white truncate">${img.caption || 'No Caption'}</span>
                <span class="text-[9px] opacity-70 truncate">${new Date(img.uploadedAt).toLocaleDateString()}</span>
            </div>
            <button class="delete-gallery-img p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors" data-id="${img.id}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </div>
    `).join('');

    listContainer.querySelectorAll('.delete-gallery-img').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = (e.currentTarget as HTMLElement).dataset.id;
            if (!id) return;
            if (confirm('Are you sure you want to delete this image?')) {
                try {
                    const res = await fetch(`/api/gallery/${id}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });
                    if (!res.ok) throw new Error('Deletion failed');
                    showToast('Image deleted successfully', 'success');
                    renderGalleryList(); // refresh list
                } catch (err: any) {
                    showToast(err.message, 'error');
                }
            }
        });
    });
}

export function initGalleryHandlers() {
    const openBtn = document.getElementById('open-gallery-upload-btn');
    const form = document.getElementById('gallery-upload-form');
    const cancelBtn = document.getElementById('cancel-gallery-upload-btn');
    const statusDiv = document.getElementById('gallery-upload-status');
    const photoInput = document.getElementById('gallery-photo-input') as HTMLInputElement;
    const captionInput = document.getElementById('gallery-caption-input') as HTMLInputElement;

    if (openBtn && form && cancelBtn) {
        openBtn.addEventListener('click', () => {
            openBtn.classList.add('hidden');
            form.classList.remove('hidden');
            form.style.display = 'flex';
        });

        cancelBtn.addEventListener('click', () => {
            form.classList.add('hidden');
            form.style.display = 'none';
            openBtn.classList.remove('hidden');
            (form as HTMLFormElement).reset();
            if (statusDiv) statusDiv.classList.add('hidden');
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = photoInput?.files?.[0];
            if (!file) {
                showToast('Please select an image', 'error');
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
            if (submitBtn) submitBtn.disabled = true;
            if (submitBtn) submitBtn.textContent = 'Uploading...';
            if (statusDiv) {
                statusDiv.classList.remove('hidden');
                statusDiv.textContent = 'Processing and uploading...';
            }

            try {
                const formData = new FormData();
                formData.append('photo', file);
                if (captionInput.value) {
                    formData.append('caption', captionInput.value);
                }

                const res = await fetch('/api/gallery', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });

                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Upload failed');

                showToast('Gallery image uploaded!', 'success');
                (form as HTMLFormElement).reset();
                form.classList.add('hidden');
                form.style.display = 'none';
                if (openBtn) openBtn.classList.remove('hidden');

                await renderGalleryList();

            } catch (err: any) {
                showToast(err.message || 'Failed to upload image', 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Upload';
                }
                if (statusDiv) statusDiv.classList.add('hidden');
            }
        });
    }
}
