import { showToast } from '../../utils';
import { requestAdminConfirmation } from './admin';
import { initCropEditor } from './gallery.cropEditor';
import {
    formatCropSummary,
    getFeaturedReel,
    isFeaturedImage,
    normalizeCrop,
    normalizeZoom
} from './gallery.helpers';
import type { CropEditorState, CropContextKey } from './gallery.helpers';

type GalleryViewerOptions = {
    getCurrentGalleryImages: () => any[];
    getCurrentViewerIndex: () => number;
    setCurrentViewerIndex: (index: number) => void;
    renderGalleryList: () => Promise<void>;
    cropEditorStateByImageContext: Map<string, CropEditorState>;
};

export function createGalleryViewerController(options: GalleryViewerOptions) {
    const {
        getCurrentGalleryImages,
        getCurrentViewerIndex,
        setCurrentViewerIndex,
        renderGalleryList,
        cropEditorStateByImageContext
    } = options;

    const closeGalleryViewer = () => {
        const modal = document.getElementById('gallery-viewer-modal');
        if (modal) modal.classList.add('hidden');
        const cropModal = document.getElementById('crop-editor-modal');
        if (cropModal) cropModal.classList.add('hidden');
    };

    const openGalleryViewer = (index: number) => {
        const currentGalleryImages = getCurrentGalleryImages();
        if (index < 0 || index >= currentGalleryImages.length) return;
        setCurrentViewerIndex(index);
        const data = currentGalleryImages[index];

        const modal = document.getElementById('gallery-viewer-modal');
        const img = document.getElementById('gallery-viewer-img') as HTMLImageElement;
        const captionEl = document.getElementById('gallery-viewer-caption');
        const filenameEl = document.getElementById('gallery-viewer-filename');
        const dateEl = document.getElementById('gallery-viewer-date');
        const featuredBadge = document.getElementById('gallery-viewer-featured-badge');
        const toggleBtn = document.getElementById('gallery-viewer-toggle-featured') as HTMLElement;
        const featuredLabel = document.getElementById('gallery-viewer-featured-label');
        const featuredUpBtn = document.getElementById('gallery-viewer-featured-up') as HTMLButtonElement | null;
        const featuredDownBtn = document.getElementById('gallery-viewer-featured-down') as HTMLButtonElement | null;
        const featuredOrderLabel = document.getElementById('gallery-viewer-featured-order');
        const editBtn = document.getElementById('gallery-viewer-edit-caption') as HTMLElement;
        const deleteBtn = document.getElementById('gallery-viewer-delete') as HTMLElement;
        const prevBtn = document.getElementById('gallery-viewer-prev') as HTMLButtonElement;
        const nextBtn = document.getElementById('gallery-viewer-next') as HTMLButtonElement;
        const counterEl = document.getElementById('gallery-viewer-counter');
        const desktopSummary = document.getElementById('crop-summary-hero-desktop');
        const mobileSummary = document.getElementById('crop-summary-hero-mobile');
        const gallerySummary = document.getElementById('crop-summary-gallery');
        const openDesktopBtn = document.getElementById('open-crop-hero-desktop') as HTMLButtonElement | null;
        const openMobileBtn = document.getElementById('open-crop-hero-mobile') as HTMLButtonElement | null;
        const openGalleryBtn = document.getElementById('open-crop-gallery') as HTMLButtonElement | null;

        if (!modal || !img) return;

        const isFeatured = data.featured === true || data.featured === 1 || data.featured === '1';

        img.src = data.filepath || '';
        img.alt = data.caption || '';
        if (captionEl) captionEl.textContent = data.caption || 'No caption';
        if (filenameEl) filenameEl.textContent = data.filename || '';
        if (dateEl) dateEl.textContent = `Uploaded ${new Date(data.uploadedAt).toLocaleDateString()}`;

        if (featuredBadge) featuredBadge.classList.toggle('hidden', !isFeatured);

        if (toggleBtn) {
            toggleBtn.dataset.id = data.id;
            toggleBtn.dataset.featured = isFeatured ? '1' : '0';
            if (isFeatured) {
                toggleBtn.className = 'flex-1 min-w-30 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20 transition-colors';
            } else {
                toggleBtn.className = 'flex-1 min-w-30 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors';
            }
        }
        if (featuredLabel) featuredLabel.textContent = isFeatured ? 'Remove from carousel' : 'Add to carousel';

        const featuredReel = getFeaturedReel(currentGalleryImages);
        const featuredIdx = featuredReel.findIndex((img) => String(img.id) === String(data.id));
        if (featuredUpBtn) {
            featuredUpBtn.classList.toggle('hidden', !isFeatured);
            featuredUpBtn.disabled = !isFeatured || featuredIdx <= 0;
            featuredUpBtn.style.opacity = (!isFeatured || featuredIdx <= 0) ? '0.4' : '1';
            featuredUpBtn.dataset.id = String(data.id);
        }
        if (featuredDownBtn) {
            featuredDownBtn.classList.toggle('hidden', !isFeatured);
            featuredDownBtn.disabled = !isFeatured || featuredIdx === -1 || featuredIdx >= featuredReel.length - 1;
            featuredDownBtn.style.opacity = (!isFeatured || featuredIdx === -1 || featuredIdx >= featuredReel.length - 1) ? '0.4' : '1';
            featuredDownBtn.dataset.id = String(data.id);
        }
        if (featuredOrderLabel) {
            if (isFeatured && featuredIdx >= 0) {
                featuredOrderLabel.classList.remove('hidden');
                featuredOrderLabel.textContent = `Highlight reel position: ${featuredIdx + 1} of ${featuredReel.length}`;
            } else {
                featuredOrderLabel.classList.add('hidden');
                featuredOrderLabel.textContent = '';
            }
        }

        if (editBtn) {
            editBtn.dataset.id = data.id;
            editBtn.dataset.caption = data.caption || '';
        }
        if (deleteBtn) deleteBtn.dataset.id = data.id;

        if (counterEl) {
            counterEl.textContent = `${index + 1} / ${currentGalleryImages.length}`;
        }

        const heroDesktopX = normalizeCrop(data.heroDesktopX, 50);
        const heroDesktopY = normalizeCrop(data.heroDesktopY, 50);
        const heroMobileX = normalizeCrop(data.heroMobileX, 50);
        const heroMobileY = normalizeCrop(data.heroMobileY, 50);
        const heroDesktopZoom = normalizeZoom(data.heroDesktopZoom, 1);
        const heroMobileZoom = normalizeZoom(data.heroMobileZoom, 1);
        const galleryX = normalizeCrop(data.galleryLandscapeX, 50);
        const galleryY = normalizeCrop(data.galleryLandscapeY, 50);
        const galleryZoom = normalizeZoom(data.galleryLandscapeZoom, 1);

        if (desktopSummary) desktopSummary.textContent = formatCropSummary(heroDesktopX, heroDesktopY, heroDesktopZoom);
        if (mobileSummary) mobileSummary.textContent = formatCropSummary(heroMobileX, heroMobileY, heroMobileZoom);
        if (gallerySummary) gallerySummary.textContent = formatCropSummary(galleryX, galleryY, galleryZoom);

        if (openDesktopBtn) openDesktopBtn.dataset.id = String(data.id);
        if (openMobileBtn) openMobileBtn.dataset.id = String(data.id);
        if (openGalleryBtn) openGalleryBtn.dataset.id = String(data.id);

        if (prevBtn) {
            prevBtn.style.opacity = index > 0 ? '1' : '0.3';
            prevBtn.style.pointerEvents = index > 0 ? 'auto' : 'none';
        }
        if (nextBtn) {
            nextBtn.style.opacity = index < currentGalleryImages.length - 1 ? '1' : '0.3';
            nextBtn.style.pointerEvents = index < currentGalleryImages.length - 1 ? 'auto' : 'none';
        }

        modal.classList.remove('hidden');
    };

    let galleryViewerInitialised = false;

    const initGalleryViewerModal = () => {
        if (galleryViewerInitialised) return;
        galleryViewerInitialised = true;

        const modal = document.getElementById('gallery-viewer-modal');
        const backdrop = document.getElementById('gallery-viewer-backdrop');
        const closeBtn = document.getElementById('gallery-viewer-close');
        const toggleBtn = document.getElementById('gallery-viewer-toggle-featured') as HTMLElement;
        const featuredUpBtn = document.getElementById('gallery-viewer-featured-up') as HTMLButtonElement | null;
        const featuredDownBtn = document.getElementById('gallery-viewer-featured-down') as HTMLButtonElement | null;
        const editBtn = document.getElementById('gallery-viewer-edit-caption') as HTMLElement;
        const deleteBtn = document.getElementById('gallery-viewer-delete') as HTMLElement;
        const prevBtn = document.getElementById('gallery-viewer-prev') as HTMLButtonElement;
        const nextBtn = document.getElementById('gallery-viewer-next') as HTMLButtonElement;
        const openDesktopBtn = document.getElementById('open-crop-hero-desktop') as HTMLButtonElement | null;
        const openMobileBtn = document.getElementById('open-crop-hero-mobile') as HTMLButtonElement | null;
        const openGalleryBtn = document.getElementById('open-crop-gallery') as HTMLButtonElement | null;
        const desktopSummary = document.getElementById('crop-summary-hero-desktop');
        const mobileSummary = document.getElementById('crop-summary-hero-mobile');
        const gallerySummary = document.getElementById('crop-summary-gallery');

        const setSummaryText = (context: CropContextKey, x: number, y: number, zoom: number) => {
            const text = formatCropSummary(x, y, zoom);
            if (context === 'heroDesktop' && desktopSummary) desktopSummary.textContent = text;
            if (context === 'heroMobile' && mobileSummary) mobileSummary.textContent = text;
            if (context === 'galleryLandscape' && gallerySummary) gallerySummary.textContent = text;
        };

        const cropController = initCropEditor({
            cropEditorStateByImageContext,
            getCurrentImage: () => {
                const images = getCurrentGalleryImages();
                const idx = getCurrentViewerIndex();
                return idx >= 0 ? images[idx] : null;
            },
            getCurrentImageIndex: getCurrentViewerIndex,
            setSummaryText
        });

        if (openDesktopBtn) openDesktopBtn.addEventListener('click', () => cropController.openCropEditor('heroDesktop'));
        if (openMobileBtn) openMobileBtn.addEventListener('click', () => cropController.openCropEditor('heroMobile'));
        if (openGalleryBtn) openGalleryBtn.addEventListener('click', () => cropController.openCropEditor('galleryLandscape'));

        if (backdrop) backdrop.addEventListener('click', closeGalleryViewer);
        if (closeBtn) closeBtn.addEventListener('click', closeGalleryViewer);

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                const idx = getCurrentViewerIndex();
                if (idx > 0) openGalleryViewer(idx - 1);
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const idx = getCurrentViewerIndex();
                const currentGalleryImages = getCurrentGalleryImages();
                if (idx < currentGalleryImages.length - 1) openGalleryViewer(idx + 1);
            });
        }

        document.addEventListener('keydown', (e) => {
            if (cropController.isOpen()) {
                if (e.key === 'Escape') {
                    cropController.closeCropEditor();
                    return;
                }
            }

            if (modal && !modal.classList.contains('hidden')) {
                const idx = getCurrentViewerIndex();
                const currentGalleryImages = getCurrentGalleryImages();
                if (e.key === 'Escape') closeGalleryViewer();
                if (e.key === 'ArrowLeft' && idx > 0) openGalleryViewer(idx - 1);
                if (e.key === 'ArrowRight' && idx < currentGalleryImages.length - 1) openGalleryViewer(idx + 1);
            }
        });

        if (toggleBtn) {
            toggleBtn.addEventListener('click', async () => {
                const id = toggleBtn.dataset.id;
                const isFeatured = toggleBtn.dataset.featured === '1';
                if (!id) return;
                try {
                    const res = await fetch(`/api/gallery/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ featured: !isFeatured }),
                        credentials: 'include'
                    });
                    if (!res.ok) throw new Error('Update failed');
                    showToast(isFeatured ? 'Removed from homepage carousel' : 'Added to homepage carousel', 'success');
                    closeGalleryViewer();
                    await renderGalleryList();
                } catch (err: any) {
                    showToast(err.message, 'error');
                }
            });
        }

        const moveFeaturedImage = async (direction: 'up' | 'down') => {
            const idx = getCurrentViewerIndex();
            if (idx < 0) return;
            const currentGalleryImages = getCurrentGalleryImages();
            const current = currentGalleryImages[idx];
            if (!current || !isFeaturedImage(current)) return;

            const reel = getFeaturedReel(currentGalleryImages);
            const reelIdx = reel.findIndex((img) => String(img.id) === String(current.id));
            if (reelIdx < 0) return;

            const targetIdx = direction === 'up' ? reelIdx - 1 : reelIdx + 1;
            if (targetIdx < 0 || targetIdx >= reel.length) return;

            const swapped = [...reel];
            [swapped[reelIdx], swapped[targetIdx]] = [swapped[targetIdx], swapped[reelIdx]];

            try {
                for (let i = 0; i < swapped.length; i++) {
                    const img = swapped[i];
                    const res = await fetch(`/api/gallery/${img.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ featured: true, featuredOrder: i + 1 })
                    });
                    if (!res.ok) throw new Error('Failed to update highlight reel order');
                }

                showToast('Highlight reel order updated', 'success');
                const currentId = String(current.id);
                await renderGalleryList();
                const refreshed = getCurrentGalleryImages();
                const newIndex = refreshed.findIndex((img) => String(img.id) === currentId);
                if (newIndex >= 0) openGalleryViewer(newIndex);
            } catch (err: any) {
                showToast(err.message || 'Failed to update highlight reel order', 'error');
            }
        };

        if (featuredUpBtn) {
            featuredUpBtn.addEventListener('click', () => {
                moveFeaturedImage('up');
            });
        }

        if (featuredDownBtn) {
            featuredDownBtn.addEventListener('click', () => {
                moveFeaturedImage('down');
            });
        }

        if (editBtn) {
            editBtn.addEventListener('click', () => {
                const id = editBtn.dataset.id;
                const caption = editBtn.dataset.caption || '';
                const editCaptionModal = document.getElementById('edit-caption-modal');
                const editCaptionInput = document.getElementById('edit-caption-input') as HTMLInputElement;
                const editCaptionId = document.getElementById('edit-caption-id') as HTMLInputElement;
                if (editCaptionModal && editCaptionInput && editCaptionId && id) {
                    editCaptionId.value = id;
                    editCaptionInput.value = caption;
                    editCaptionModal.classList.remove('hidden');
                    closeGalleryViewer();
                    setTimeout(() => editCaptionInput.focus(), 50);
                }
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const id = deleteBtn.dataset.id;
                if (!id) return;
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
                        closeGalleryViewer();
                        await renderGalleryList();
                    }
                );
            });
        }

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
                if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

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
                    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
                }
            });
        }
    };

    return {
        openGalleryViewer,
        initGalleryViewerModal,
        closeGalleryViewer
    };
}