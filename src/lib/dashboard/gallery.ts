import { showToast } from '../../utils';
import { requestAdminConfirmation } from './admin';

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
                <span class="text-xs font-bold text-white truncate gallery-editable-caption" data-id="${img.id}">${img.caption || 'No Caption'}</span>
                <span class="text-[9px] opacity-70 truncate">${new Date(img.uploadedAt).toLocaleDateString()}</span>
            </div>
            <div class="flex shrink-0">
                <button class="edit-gallery-caption p-1.5 text-slate-500 hover:text-brand-gold hover:bg-brand-gold/10 rounded transition-colors" data-id="${img.id}" data-caption="${img.caption || ''}" title="Edit Caption">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                </button>
                <button class="delete-gallery-img p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors" data-id="${img.id}" title="Delete Image">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        </div>
    `).join('');

    const editCaptionModal = document.getElementById('edit-caption-modal');
    const editCaptionBackdrop = document.getElementById('edit-caption-backdrop');
    const editCaptionCancelBtn = document.getElementById('edit-caption-cancel-btn');
    const editCaptionForm = document.getElementById('edit-caption-form') as HTMLFormElement;
    const editCaptionInput = document.getElementById('edit-caption-input') as HTMLInputElement;
    const editCaptionId = document.getElementById('edit-caption-id') as HTMLInputElement;

    function closeEditModal() {
        if (editCaptionModal) editCaptionModal.classList.add('hidden');
        if (editCaptionForm) editCaptionForm.reset();
    }

    if (editCaptionCancelBtn) editCaptionCancelBtn.addEventListener('click', closeEditModal);
    if (editCaptionBackdrop) editCaptionBackdrop.addEventListener('click', closeEditModal);

    if (editCaptionForm) {
        editCaptionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = editCaptionId.value;
            const newCaption = editCaptionInput.value.trim();
            if (!id) return;

            const saveBtn = document.getElementById('edit-caption-save-btn') as HTMLButtonElement | null;
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
            }

            try {
                const res = await fetch(`/api/gallery/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ caption: newCaption }),
                    credentials: 'include'
                });
                if (!res.ok) throw new Error('Update failed');
                showToast('Caption updated', 'success');
                closeEditModal();
                await renderGalleryList();
            } catch (err: any) {
                showToast(err.message, 'error');
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save';
                }
            }
        });
    }

    listContainer.querySelectorAll('.edit-gallery-caption').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const el = e.currentTarget as HTMLElement;
            const id = el.dataset.id;
            const oldCaption = el.dataset.caption || '';
            if (!id) return;

            if (editCaptionModal && editCaptionInput && editCaptionId) {
                editCaptionId.value = id;
                editCaptionInput.value = oldCaption;
                editCaptionModal.classList.remove('hidden');
                setTimeout(() => editCaptionInput.focus(), 50);
            }
        });
    });

    listContainer.querySelectorAll('.delete-gallery-img').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = (e.currentTarget as HTMLElement).dataset.id;
            if (id) {
                requestAdminConfirmation(
                    'Delete Image',
                    'Are you sure you want to permanently delete this image from the public gallery?',
                    async () => {
                        const res = await fetch(`/api/gallery/${id}`, {
                            method: 'DELETE',
                            credentials: 'include'
                        });
                        if (!res.ok) throw new Error('Deletion failed');
                        showToast('Image deleted successfully', 'success');
                        await renderGalleryList(); // refresh list
                    }
                );
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
    const stagingArea = document.getElementById('gallery-staging-area');

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
            if (stagingArea) {
                stagingArea.innerHTML = '';
                stagingArea.classList.add('hidden');
            }
            if (statusDiv) statusDiv.classList.add('hidden');
        });
    }

    if (photoInput && stagingArea) {
        photoInput.addEventListener('change', () => {
            const files = photoInput.files;
            if (!files || files.length === 0) {
                stagingArea.innerHTML = '';
                stagingArea.classList.add('hidden');
                return;
            }

            stagingArea.innerHTML = '';
            stagingArea.classList.remove('hidden');

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const itemDiv = document.createElement('div');
                itemDiv.className = 'flex flex-col gap-1';

                const label = document.createElement('span');
                label.className = 'text-[10px] text-slate-400 truncate';
                label.textContent = file.name;

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'gallery-staging-caption w-full bg-slate-900 border border-slate-700/50 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-pink-500';
                input.placeholder = `Caption for ${file.name} (Optional)`;

                itemDiv.appendChild(label);
                itemDiv.appendChild(input);
                stagingArea.appendChild(itemDiv);
            }
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const files = photoInput?.files;
            if (!files || files.length === 0) {
                showToast('Please select at least one image', 'error');
                return;
            }

            let totalSize = 0;
            for (let i = 0; i < files.length; i++) {
                totalSize += files[i].size;
                if (files[i].size > 50 * 1024 * 1024) {
                    showToast(`The image ${files[i].name} is too large (max 50MB). Please select smaller files.`, 'error');
                    return;
                }
            }

            // Cloudflare has a hard limit of 100MB for the free/pro tiers. 
            // We set a safe limit of 90MB to account for multipart form overhead.
            const MAX_BATCH_SIZE = 90 * 1024 * 1024;
            if (totalSize > MAX_BATCH_SIZE) {
                const totalMB = (totalSize / (1024 * 1024)).toFixed(1);
                showToast(`Total upload size is ${totalMB}MB. Cloudflare limits uploads to 100MB at once. Please upload fewer photos at a time.`, 'error');
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
                const captionInputs = form.querySelectorAll('.gallery-staging-caption') as NodeListOf<HTMLInputElement>;

                for (let i = 0; i < files.length; i++) {
                    formData.append('photos', files[i]);
                    const caption = captionInputs[i] ? captionInputs[i].value : '';
                    formData.append('caption', caption);
                }

                const res = await fetch('/api/gallery', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });

                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Upload failed');

                showToast(files.length > 1 ? `${files.length} images uploaded!` : 'Gallery image uploaded!', 'success');
                (form as HTMLFormElement).reset();
                if (stagingArea) {
                    stagingArea.innerHTML = '';
                    stagingArea.classList.add('hidden');
                }
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
