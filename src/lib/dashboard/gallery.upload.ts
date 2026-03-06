import { showToast } from '../../utils';
import { validateGalleryUploadBatch } from './gallery.helpers';
import { apiFetch } from '../api/http';

/**
 * Initialize event handlers for the gallery image upload modal.
 * Supports batch selection, client-side batch validation, dynamic caption inputs,
 * and form submission posting multiple multipart files simultaneously.
 *
 * @param {() => Promise<void>} renderGalleryList - Callback invoked after a successful upload to refresh the dashboard gallery view.
 */
export function initGalleryUploadHandlers(renderGalleryList: () => Promise<void>) {
    const openBtn = document.getElementById('open-gallery-upload-btn');
    const uploadModal = document.getElementById('upload-gallery-modal');
    const uploadBackdrop = document.getElementById('upload-gallery-backdrop');
    const form = document.getElementById('gallery-upload-form');
    const cancelBtn = document.getElementById('cancel-gallery-upload-btn');
    const statusDiv = document.getElementById('gallery-upload-status');
    const photoInput = document.getElementById('gallery-photo-input') as HTMLInputElement;
    const stagingArea = document.getElementById('gallery-staging-area');
    const submitBtn = document.getElementById('submit-gallery-upload-btn') as HTMLButtonElement | null;

    const closeUploadModal = () => {
        if (!uploadModal || !form) return;
        uploadModal.classList.add('hidden');
        (form as HTMLFormElement).reset();
        if (stagingArea) {
            stagingArea.innerHTML = '';
            stagingArea.classList.add('hidden');
        }
        if (statusDiv) {
            statusDiv.classList.add('hidden');
            statusDiv.textContent = 'Uploading...';
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload to Gallery';
        }
    };

    if (openBtn && uploadModal && cancelBtn) {
        openBtn.addEventListener('click', () => {
            uploadModal.classList.remove('hidden');
            setTimeout(() => photoInput?.focus(), 50);
        });

        cancelBtn.addEventListener('click', closeUploadModal);
        uploadBackdrop?.addEventListener('click', closeUploadModal);
    }

    if (photoInput && stagingArea) {
        photoInput.addEventListener('change', () => {
            const files = photoInput.files;
            if (!files || files.length === 0) {
                stagingArea.innerHTML = '';
                stagingArea.classList.add('hidden');
                return;
            }

            // Clear any lingering previews from previous aborted uploads
            stagingArea.innerHTML = '';
            stagingArea.classList.remove('hidden');

            // Iterate over all selected files to dynamically construct a staging list.
            // This exposes a dedicated text input per file for individual captions.
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

            const validation = validateGalleryUploadBatch(files);
            if (validation.error) {
                showToast(validation.error, 'error');
                return;
            }

            if (submitBtn) submitBtn.disabled = true;
            if (submitBtn) submitBtn.textContent = 'Uploading...';
            if (statusDiv) {
                statusDiv.classList.remove('hidden');
                statusDiv.textContent = 'Processing and uploading...';
            }

            try {
                // Construct a multipart/form-data payload capable of transmitting binary Blobs
                const formData = new FormData();
                const captionInputs = form.querySelectorAll('.gallery-staging-caption') as NodeListOf<HTMLInputElement>;

                for (let i = 0; i < files.length; i++) {
                    // Node.js Multer expects the field name 'photos' to be an array
                    formData.append('photos', files[i]);
                    // Associate captions by index sequence matching the uploaded Blobs
                    const caption = captionInputs[i] ? captionInputs[i].value : '';
                    formData.append('caption', caption);
                }

                await apiFetch('/api/gallery', {
                    method: 'POST',
                    body: formData
                });

                showToast(files.length > 1 ? `${files.length} images uploaded!` : 'Gallery image uploaded!', 'success');
                (form as HTMLFormElement).reset();
                if (stagingArea) {
                    stagingArea.innerHTML = '';
                    stagingArea.classList.add('hidden');
                }
                if (uploadModal) uploadModal.classList.add('hidden');

                await renderGalleryList();

            } catch (err: any) {
                showToast(err.message || 'Failed to upload image', 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Upload to Gallery';
                }
                if (statusDiv) statusDiv.classList.add('hidden');
            }
        });
    }
}