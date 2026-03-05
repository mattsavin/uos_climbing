import { showToast } from '../../utils';
import { requestAdminConfirmation } from './admin';

let currentGalleryImages: any[] = [];
let currentViewerIndex: number = -1;

type CropContextKey = 'heroDesktop' | 'heroMobile' | 'galleryLandscape';

type CropEditorState = {
    cropX: number;
    cropY: number;
    zoom: number;
    boxScale: number;
    boxCenterX: number;
    boxCenterY: number;
};

const cropEditorStateByImageContext = new Map<string, CropEditorState>();

const CROP_CONTEXT_CONFIG: Record<CropContextKey, {
    title: string;
    aspect: number;
    xKey: string;
    yKey: string;
    zoomKey: string;
}> = {
    heroDesktop: {
        title: 'Homepage Desktop',
        aspect: 16 / 9,
        xKey: 'heroDesktopX',
        yKey: 'heroDesktopY',
        zoomKey: 'heroDesktopZoom'
    },
    heroMobile: {
        title: 'Homepage Mobile',
        aspect: 9 / 16,
        xKey: 'heroMobileX',
        yKey: 'heroMobileY',
        zoomKey: 'heroMobileZoom'
    },
    galleryLandscape: {
        title: 'Gallery Landscape',
        aspect: 16 / 9,
        xKey: 'galleryLandscapeX',
        yKey: 'galleryLandscapeY',
        zoomKey: 'galleryLandscapeZoom'
    }
};

function formatCropSummary(x: number, y: number, zoom: number): string {
    const centered = Math.abs(x - 50) < 0.5 && Math.abs(y - 50) < 0.5;
    if (centered) return `Center • ${zoom.toFixed(2)}x`;
    return `${Math.round(x)}% / ${Math.round(y)}% • ${zoom.toFixed(2)}x`;
}

function getCropStateKey(imageId: string | number, context: CropContextKey): string {
    return `${imageId}:${context}`;
}

function isFeaturedImage(image: any): boolean {
    return image?.featured === true || image?.featured === 1 || image?.featured === '1';
}

function getFeaturedReel(images: any[]): any[] {
    return images
        .filter(isFeaturedImage)
        .sort((a, b) => {
            const aOrder = Number.isFinite(Number(a.featuredOrder)) ? Number(a.featuredOrder) : Number.MAX_SAFE_INTEGER;
            const bOrder = Number.isFinite(Number(b.featuredOrder)) ? Number(b.featuredOrder) : Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) return aOrder - bOrder;
            const aTime = new Date(a.uploadedAt || 0).getTime();
            const bTime = new Date(b.uploadedAt || 0).getTime();
            return bTime - aTime;
        });
}

function normalizeCrop(value: any, fallback = 50): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(100, Math.max(0, parsed));
}

function normalizeZoom(value: any, fallback = 1): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(3, Math.max(1, parsed));
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

const IMAGE_DRAG_SENSITIVITY = 1.2;
const BOX_DRAG_SENSITIVITY = 1.0;

function getCropBounds(naturalWidth: number, naturalHeight: number, frameAspect: number, zoom: number) {
    if (!naturalWidth || !naturalHeight || !frameAspect) {
        return { minX: 0, maxX: 100, minY: 0, maxY: 100, widthRatio: 1, heightRatio: 1 };
    }

    const imageAspect = naturalWidth / naturalHeight;
    const baseWidthRatio = Math.max(1, imageAspect / frameAspect);
    const baseHeightRatio = Math.max(1, frameAspect / imageAspect);

    const widthRatio = baseWidthRatio * zoom;
    const heightRatio = baseHeightRatio * zoom;

    const minX = 0;
    const maxX = 100;
    const minY = 0;
    const maxY = 100;

    return { minX, maxX, minY, maxY, widthRatio, heightRatio };
}

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
    currentGalleryImages = images;

    if (images.length === 0) {
        listContainer.innerHTML = '<p class="text-xs text-slate-500 text-center">No images uploaded yet.</p>';
        return;
    }

    // wider grid for full page
    listContainer.innerHTML = `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-4">${images.map((img: any, index: number) => `
        <button class="gallery-thumb-btn group relative aspect-square overflow-hidden rounded-lg border bg-black/50 transition-all duration-200 cursor-pointer ${img.featured ? 'border-brand-gold/50 shadow-[0_0_15px_rgba(251,191,36,0.1)]' : 'border-slate-700/80 hover:border-slate-500'}"
            data-index="${index}"
            data-id="${img.id}"
            data-filepath="${img.filepath}"
            data-caption="${(img.caption || '').replace(/"/g, '&quot;')}"
            data-filename="${img.filename}"
            data-date="${new Date(img.uploadedAt).toLocaleDateString()}"
            data-featured="${img.featured ? '1' : '0'}">
            <img src="${img.filepath}" alt="${img.caption || ''}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none">
            ${img.featured ? `<div class="absolute top-2 right-2 text-brand-gold drop-shadow-md"><svg class="w-4 h-4 lg:w-5 lg:h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg></div>` : ''}
            <div class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/90 to-transparent px-3 py-2 translate-y-[calc(100%+1px)] group-hover:translate-y-0 transition-transform duration-300 pointer-events-none">
                <p class="text-white text-xs lg:text-sm truncate font-medium drop-shadow-md">${img.caption || 'No caption'}</p>
            </div>
        </button>
    `).join('')}</div>`;

    // Open viewer on thumbnail click
    listContainer.querySelectorAll<HTMLElement>('.gallery-thumb-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index || '0', 10);
            openGalleryViewer(idx);
        });
    });
}

function openGalleryViewer(index: number) {
    if (index < 0 || index >= currentGalleryImages.length) return;
    currentViewerIndex = index;
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
}

function closeGalleryViewer() {
    const modal = document.getElementById('gallery-viewer-modal');
    if (modal) modal.classList.add('hidden');
    const cropModal = document.getElementById('crop-editor-modal');
    if (cropModal) cropModal.classList.add('hidden');
}

let galleryViewerInitialised = false;

export function initGalleryViewerModal() {
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

    const cropModal = document.getElementById('crop-editor-modal');
    const cropBackdrop = document.getElementById('crop-editor-backdrop');
    const cropCloseBtn = document.getElementById('crop-editor-close');
    const cropCancelBtn = document.getElementById('crop-editor-cancel');
    const cropSaveBtn = document.getElementById('crop-editor-save') as HTMLButtonElement | null;
    const cropResetBtn = document.getElementById('crop-editor-reset') as HTMLButtonElement | null;
    const cropTitle = document.getElementById('crop-editor-title');
    const cropSubtitle = document.getElementById('crop-editor-subtitle');
    const cropStage = document.getElementById('crop-editor-stage') as HTMLElement | null;
    const cropImage = document.getElementById('crop-editor-image') as HTMLImageElement | null;
    const cropBox = document.getElementById('crop-editor-box') as HTMLElement | null;
    const cropZoomInput = document.getElementById('crop-editor-zoom') as HTMLInputElement | null;
    const cropZoomValue = document.getElementById('crop-editor-zoom-value');
    const cropHandles = Array.from(document.querySelectorAll<HTMLElement>('[data-crop-handle]'));

    let activeCropContext: CropContextKey | null = null;
    let draftCropX = 50;
    let draftCropY = 50;
    let draftZoom = 1;
    let draftBoxScale = 1;

    const setSummaryText = (context: CropContextKey, x: number, y: number, zoom: number) => {
        const text = formatCropSummary(x, y, zoom);
        if (context === 'heroDesktop' && desktopSummary) desktopSummary.textContent = text;
        if (context === 'heroMobile' && mobileSummary) mobileSummary.textContent = text;
        if (context === 'galleryLandscape' && gallerySummary) gallerySummary.textContent = text;
    };

    const getBoxMetrics = (width: number, height: number, aspect: number, boxScale: number, centerX: number, centerY: number) => {
        if (width / height >= aspect) {
            const boxHeight = height * boxScale;
            const boxWidth = boxHeight * aspect;
            const rawLeft = (width * centerX) / 100 - boxWidth / 2;
            const rawTop = (height * centerY) / 100 - boxHeight / 2;
            const left = clamp(rawLeft, 0, Math.max(0, width - boxWidth));
            const top = clamp(rawTop, 0, Math.max(0, height - boxHeight));
            return {
                boxWidth,
                boxHeight,
                left,
                top,
                centerX: ((left + boxWidth / 2) / width) * 100,
                centerY: ((top + boxHeight / 2) / height) * 100
            };
        }
        const boxWidth = width * boxScale;
        const boxHeight = boxWidth / aspect;
        const rawLeft = (width * centerX) / 100 - boxWidth / 2;
        const rawTop = (height * centerY) / 100 - boxHeight / 2;
        const left = clamp(rawLeft, 0, Math.max(0, width - boxWidth));
        const top = clamp(rawTop, 0, Math.max(0, height - boxHeight));
        return {
            boxWidth,
            boxHeight,
            left,
            top,
            centerX: ((left + boxWidth / 2) / width) * 100,
            centerY: ((top + boxHeight / 2) / height) * 100
        };
    };

    let draftBoxCenterX = 50;
    let draftBoxCenterY = 50;

    const getImageViewport = (stageRect: DOMRect, naturalWidth: number, naturalHeight: number) => {
        if (!naturalWidth || !naturalHeight) {
            return { left: 0, top: 0, width: stageRect.width, height: stageRect.height };
        }

        const stageAspect = stageRect.width / stageRect.height;
        const imageAspect = naturalWidth / naturalHeight;

        if (imageAspect > stageAspect) {
            const width = stageRect.width;
            const height = width / imageAspect;
            return {
                left: 0,
                top: (stageRect.height - height) / 2,
                width,
                height
            };
        }

        const height = stageRect.height;
        const width = height * imageAspect;
        return {
            left: (stageRect.width - width) / 2,
            top: 0,
            width,
            height
        };
    };

    const getEditorGeometry = () => {
        if (!activeCropContext || !cropStage || !cropImage) return null;
        const config = CROP_CONTEXT_CONFIG[activeCropContext];
        const stageRect = cropStage.getBoundingClientRect();
        const viewport = getImageViewport(stageRect, cropImage.naturalWidth, cropImage.naturalHeight);
        const bounds = getCropBounds(cropImage.naturalWidth, cropImage.naturalHeight, config.aspect, draftZoom);
        const metrics = getBoxMetrics(viewport.width, viewport.height, config.aspect, clamp(draftBoxScale, 1 / 3, 1), draftBoxCenterX, draftBoxCenterY);
        return { stageRect, viewport, bounds, metrics };
    };

    const applyCropEditorVisuals = () => {
        if (!activeCropContext || !cropStage || !cropImage || !cropBox || !cropZoomInput) return;

        const geometry = getEditorGeometry();
        if (!geometry) return;
        const { viewport, bounds, metrics } = geometry;

        draftCropX = clamp(draftCropX, bounds.minX, bounds.maxX);
        draftCropY = clamp(draftCropY, bounds.minY, bounds.maxY);

        cropImage.style.objectPosition = `${draftCropX}% ${draftCropY}%`;
        cropImage.style.transformOrigin = `${draftCropX}% ${draftCropY}%`;
        cropImage.style.transform = `scale(${draftZoom})`;

        cropZoomInput.value = String(draftZoom);
        if (cropZoomValue) cropZoomValue.textContent = `${draftZoom.toFixed(2)}x`;

        draftBoxCenterX = metrics.centerX;
        draftBoxCenterY = metrics.centerY;
        const boxLeft = Math.round(viewport.left + metrics.left);
        const boxTop = Math.round(viewport.top + metrics.top);
        const boxWidth = Math.round(metrics.boxWidth);
        const boxHeight = Math.round(metrics.boxHeight);

        cropBox.style.left = `${boxLeft}px`;
        cropBox.style.top = `${boxTop}px`;
        cropBox.style.width = `${boxWidth}px`;
        cropBox.style.height = `${boxHeight}px`;
    };

    const closeCropEditor = () => {
        if (cropModal) cropModal.classList.add('hidden');
        activeCropContext = null;
    };

    const openCropEditor = (context: CropContextKey) => {
        const image = currentGalleryImages[currentViewerIndex];
        if (!image || !cropModal || !cropImage || !cropStage) return;

        activeCropContext = context;
        const config = CROP_CONTEXT_CONFIG[context];
        const stateKey = getCropStateKey(image.id, context);
        const savedState = cropEditorStateByImageContext.get(stateKey);

        if (savedState) {
            draftCropX = normalizeCrop(savedState.cropX, 50);
            draftCropY = normalizeCrop(savedState.cropY, 50);
            draftZoom = normalizeZoom(savedState.zoom, 1);
            draftBoxScale = clamp(savedState.boxScale, 1 / 3, 1);
            draftBoxCenterX = normalizeCrop(savedState.boxCenterX, 50);
            draftBoxCenterY = normalizeCrop(savedState.boxCenterY, 50);
        } else {
            draftCropX = normalizeCrop(image[config.xKey], 50);
            draftCropY = normalizeCrop(image[config.yKey], 50);
            draftZoom = normalizeZoom(image[config.zoomKey], 1);
            draftBoxScale = clamp(1 / draftZoom, 1 / 3, 1);
            draftBoxCenterX = 50;
            draftBoxCenterY = 50;
        }

        cropImage.src = image.filepath || '';
        cropImage.alt = image.caption || 'Crop image';
        cropStage.style.cursor = 'grab';

        if (cropTitle) cropTitle.textContent = `${config.title} Crop`;
        if (cropSubtitle) cropSubtitle.textContent = 'Drag image, resize crop corners, or zoom with slider / mouse wheel.';

        cropModal.classList.remove('hidden');
        requestAnimationFrame(() => applyCropEditorVisuals());
    };

    if (cropImage) {
        cropImage.addEventListener('load', () => {
            if (activeCropContext) applyCropEditorVisuals();
        });
    }

    if (cropZoomInput) {
        cropZoomInput.addEventListener('input', () => {
            draftZoom = normalizeZoom(cropZoomInput.value, draftZoom);
            draftBoxScale = clamp(1 / draftZoom, 1 / 3, 1);
            applyCropEditorVisuals();
        });
    }

    if (cropStage) {
        cropStage.style.touchAction = 'none';

        const activePointers = new Map<number, { x: number, y: number }>();
        let isDraggingImage = false;
        let isDraggingBox = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let dragStartCropX = 50;
        let dragStartCropY = 50;
        let dragStartBoxCenterX = 50;
        let dragStartBoxCenterY = 50;
        let isPinching = false;
        let pinchStartDistance = 0;
        let pinchStartZoom = 1;

        const getDistance = (a: { x: number, y: number }, b: { x: number, y: number }) => {
            return Math.hypot(a.x - b.x, a.y - b.y);
        };

        const stopImageDrag = (pointerId?: number) => {
            if (!isDraggingImage) return;
            isDraggingImage = false;
            cropStage.style.cursor = 'grab';
            if (pointerId !== undefined && cropStage.hasPointerCapture(pointerId)) {
                cropStage.releasePointerCapture(pointerId);
            }
        };

        const stopBoxDrag = () => {
            if (!isDraggingBox) return;
            isDraggingBox = false;
            cropStage.style.cursor = 'grab';
        };

        const tryStartPinch = () => {
            if (activePointers.size < 2) return;
            const points = Array.from(activePointers.values());
            pinchStartDistance = Math.max(20, getDistance(points[0], points[1]));
            pinchStartZoom = draftZoom;
            isPinching = true;
            stopImageDrag();
            stopBoxDrag();
            cropStage.style.cursor = 'default';
        };

        cropStage.addEventListener('pointerdown', (event: PointerEvent) => {
            if (!activeCropContext || event.button !== 0) return;
            if ((event.target as HTMLElement).closest('[data-crop-handle]')) return;

            activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            cropStage.setPointerCapture(event.pointerId);

            if (activePointers.size >= 2) {
                tryStartPinch();
                event.preventDefault();
                return;
            }

            const onBox = !!(cropBox && (event.target as HTMLElement).closest('#crop-editor-box'));
            if (onBox) {
                isDraggingBox = true;
                dragStartX = event.clientX;
                dragStartY = event.clientY;
                dragStartBoxCenterX = draftBoxCenterX;
                dragStartBoxCenterY = draftBoxCenterY;
                cropStage.style.cursor = 'grabbing';
                event.preventDefault();
                return;
            }

            isDraggingImage = true;
            dragStartX = event.clientX;
            dragStartY = event.clientY;
            dragStartCropX = draftCropX;
            dragStartCropY = draftCropY;
            cropStage.style.cursor = 'grabbing';
            event.preventDefault();
        });

        cropStage.addEventListener('pointermove', (event: PointerEvent) => {
            if (!activeCropContext || !cropImage) return;

            if (activePointers.has(event.pointerId)) {
                activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            }

            if (isPinching && activePointers.size >= 2) {
                const points = Array.from(activePointers.values());
                const currentDistance = Math.max(20, getDistance(points[0], points[1]));
                const nextZoom = normalizeZoom(pinchStartZoom * (currentDistance / pinchStartDistance), pinchStartZoom);
                draftZoom = nextZoom;
                draftBoxScale = clamp(1 / draftZoom, 1 / 3, 1);
                applyCropEditorVisuals();
                return;
            }

            if (isDraggingBox) {
                const geometry = getEditorGeometry();
                if (!geometry) return;
                const { viewport, metrics } = geometry;
                if (!viewport.width || !viewport.height) return;

                const deltaXPercent = ((event.clientX - dragStartX) / viewport.width) * 100 * BOX_DRAG_SENSITIVITY;
                const deltaYPercent = ((event.clientY - dragStartY) / viewport.height) * 100 * BOX_DRAG_SENSITIVITY;

                const minCenterX = (metrics.boxWidth / 2 / viewport.width) * 100;
                const maxCenterX = 100 - minCenterX;
                const minCenterY = (metrics.boxHeight / 2 / viewport.height) * 100;
                const maxCenterY = 100 - minCenterY;

                draftBoxCenterX = clamp(dragStartBoxCenterX + deltaXPercent, minCenterX, maxCenterX);
                draftBoxCenterY = clamp(dragStartBoxCenterY + deltaYPercent, minCenterY, maxCenterY);
                applyCropEditorVisuals();
                return;
            }

            if (!isDraggingImage) return;
            const geometry = getEditorGeometry();
            if (!geometry) return;
            const { viewport, bounds, metrics } = geometry;
            if (!viewport.width || !viewport.height) return;

            const dynamicXSensitivity = IMAGE_DRAG_SENSITIVITY * Math.max(1, bounds.widthRatio);
            const dynamicYSensitivity = IMAGE_DRAG_SENSITIVITY * Math.max(1, bounds.heightRatio);

            const deltaXNorm = ((event.clientX - dragStartX) / (metrics.boxWidth * bounds.widthRatio)) * 100 * dynamicXSensitivity;
            const deltaYNorm = ((event.clientY - dragStartY) / (metrics.boxHeight * bounds.heightRatio)) * 100 * dynamicYSensitivity;

            draftCropX = clamp(dragStartCropX - deltaXNorm, bounds.minX, bounds.maxX);
            draftCropY = clamp(dragStartCropY - deltaYNorm, bounds.minY, bounds.maxY);
            applyCropEditorVisuals();
        });

        const finishPointer = (event: PointerEvent) => {
            if (activePointers.has(event.pointerId)) {
                activePointers.delete(event.pointerId);
            }

            if (cropStage.hasPointerCapture(event.pointerId)) {
                cropStage.releasePointerCapture(event.pointerId);
            }

            if (activePointers.size >= 2) {
                tryStartPinch();
                return;
            }

            if (isPinching && activePointers.size < 2) {
                isPinching = false;
                const remaining = Array.from(activePointers.values())[0];
                if (remaining) {
                    isDraggingImage = true;
                    dragStartX = remaining.x;
                    dragStartY = remaining.y;
                    dragStartCropX = draftCropX;
                    dragStartCropY = draftCropY;
                    cropStage.style.cursor = 'grabbing';
                } else {
                    cropStage.style.cursor = 'grab';
                }
                return;
            }

            stopBoxDrag();
            stopImageDrag(event.pointerId);
        };

        cropStage.addEventListener('pointerup', finishPointer);
        cropStage.addEventListener('pointercancel', finishPointer);
        cropStage.addEventListener('pointerleave', (event: PointerEvent) => {
            if (event.pointerType === 'mouse') return;
            finishPointer(event);
        });

        cropStage.addEventListener('wheel', (event: WheelEvent) => {
            if (!activeCropContext) return;
            event.preventDefault();
            draftZoom = normalizeZoom(draftZoom - event.deltaY * 0.002, draftZoom);
            draftBoxScale = clamp(1 / draftZoom, 1 / 3, 1);
            applyCropEditorVisuals();
        }, { passive: false });
    }

    cropHandles.forEach((handle) => {
        handle.addEventListener('pointerdown', (event: PointerEvent) => {
            if (!activeCropContext || !cropStage || event.button !== 0) return;

            event.preventDefault();
            event.stopPropagation();
            handle.setPointerCapture(event.pointerId);

            const rect = cropStage.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const startDistance = Math.max(20, Math.hypot(event.clientX - centerX, event.clientY - centerY));
            const startScale = draftBoxScale;

            const onMove = (moveEvent: PointerEvent) => {
                const currentDistance = Math.max(20, Math.hypot(moveEvent.clientX - centerX, moveEvent.clientY - centerY));
                const nextScale = clamp(startScale * (currentDistance / startDistance), 1 / 3, 1);
                draftBoxScale = nextScale;
                draftZoom = normalizeZoom(1 / nextScale, draftZoom);
                applyCropEditorVisuals();
            };

            const onUp = () => {
                if (handle.hasPointerCapture(event.pointerId)) {
                    handle.releasePointerCapture(event.pointerId);
                }
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        });
    });

    if (cropResetBtn) {
        cropResetBtn.addEventListener('click', () => {
            draftCropX = 50;
            draftCropY = 50;
            draftZoom = 1;
            draftBoxScale = 1;
            draftBoxCenterX = 50;
            draftBoxCenterY = 50;

            if (activeCropContext && currentViewerIndex >= 0) {
                const image = currentGalleryImages[currentViewerIndex];
                if (image?.id !== undefined) {
                    cropEditorStateByImageContext.set(getCropStateKey(image.id, activeCropContext), {
                        cropX: draftCropX,
                        cropY: draftCropY,
                        zoom: draftZoom,
                        boxScale: draftBoxScale,
                        boxCenterX: draftBoxCenterX,
                        boxCenterY: draftBoxCenterY
                    });
                }
            }
            applyCropEditorVisuals();
        });
    }

    if (cropSaveBtn) {
        cropSaveBtn.addEventListener('click', async () => {
            if (!activeCropContext || currentViewerIndex < 0) return;
            const image = currentGalleryImages[currentViewerIndex];
            if (!image) return;

            const geometry = getEditorGeometry();
            if (!geometry) return;

            const boxOffsetXPx = ((draftBoxCenterX - 50) / 100) * geometry.viewport.width;
            const boxOffsetYPx = ((draftBoxCenterY - 50) / 100) * geometry.viewport.height;
            const offsetXNorm = (boxOffsetXPx / (geometry.metrics.boxWidth * geometry.bounds.widthRatio)) * 100;
            const offsetYNorm = (boxOffsetYPx / (geometry.metrics.boxHeight * geometry.bounds.heightRatio)) * 100;

            const finalCropX = clamp(draftCropX + offsetXNorm, 0, 100);
            const finalCropY = clamp(draftCropY + offsetYNorm, 0, 100);
            const finalZoom = normalizeZoom(draftZoom, 1);

            const config = CROP_CONTEXT_CONFIG[activeCropContext];
            const payload: Record<string, number> = {
                [config.xKey]: finalCropX,
                [config.yKey]: finalCropY,
                [config.zoomKey]: finalZoom
            };

            const originalText = cropSaveBtn.textContent || 'Save Crop';
            cropSaveBtn.disabled = true;
            cropSaveBtn.textContent = 'Saving...';

            try {
                const res = await fetch(`/api/gallery/${image.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const maybeJson = await res.json().catch(() => ({}));
                    throw new Error(maybeJson.error || 'Failed to save crop settings');
                }

                image[config.xKey] = finalCropX;
                image[config.yKey] = finalCropY;
                image[config.zoomKey] = finalZoom;

                cropEditorStateByImageContext.set(getCropStateKey(image.id, activeCropContext), {
                    cropX: draftCropX,
                    cropY: draftCropY,
                    zoom: draftZoom,
                    boxScale: draftBoxScale,
                    boxCenterX: draftBoxCenterX,
                    boxCenterY: draftBoxCenterY
                });

                setSummaryText(activeCropContext, finalCropX, finalCropY, finalZoom);
                showToast(`${config.title} crop updated`, 'success');
                closeCropEditor();
            } catch (err: any) {
                showToast(err.message || 'Failed to save crop settings', 'error');
            } finally {
                cropSaveBtn.disabled = false;
                cropSaveBtn.textContent = originalText;
            }
        });
    }

    if (cropCloseBtn) cropCloseBtn.addEventListener('click', closeCropEditor);
    if (cropCancelBtn) cropCancelBtn.addEventListener('click', closeCropEditor);
    if (cropBackdrop) cropBackdrop.addEventListener('click', closeCropEditor);

    if (openDesktopBtn) openDesktopBtn.addEventListener('click', () => openCropEditor('heroDesktop'));
    if (openMobileBtn) openMobileBtn.addEventListener('click', () => openCropEditor('heroMobile'));
    if (openGalleryBtn) openGalleryBtn.addEventListener('click', () => openCropEditor('galleryLandscape'));

    if (backdrop) backdrop.addEventListener('click', closeGalleryViewer);
    if (closeBtn) closeBtn.addEventListener('click', closeGalleryViewer);

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentViewerIndex > 0) openGalleryViewer(currentViewerIndex - 1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentViewerIndex < currentGalleryImages.length - 1) openGalleryViewer(currentViewerIndex + 1);
        });
    }

    document.addEventListener('keydown', (e) => {
        if (cropModal && !cropModal.classList.contains('hidden')) {
            if (e.key === 'Escape') {
                closeCropEditor();
                return;
            }
        }

        if (modal && !modal.classList.contains('hidden')) {
            if (e.key === 'Escape') closeGalleryViewer();
            if (e.key === 'ArrowLeft' && currentViewerIndex > 0) openGalleryViewer(currentViewerIndex - 1);
            if (e.key === 'ArrowRight' && currentViewerIndex < currentGalleryImages.length - 1) openGalleryViewer(currentViewerIndex + 1);
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
        if (currentViewerIndex < 0) return;
        const current = currentGalleryImages[currentViewerIndex];
        if (!current || !isFeaturedImage(current)) return;

        const reel = getFeaturedReel(currentGalleryImages);
        const idx = reel.findIndex((img) => String(img.id) === String(current.id));
        if (idx < 0) return;

        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= reel.length) return;

        const swapped = [...reel];
        [swapped[idx], swapped[targetIdx]] = [swapped[targetIdx], swapped[idx]];

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
            const newIndex = currentGalleryImages.findIndex((img) => String(img.id) === currentId);
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

    // Edit caption form submit (for saving after editing from viewer)
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
}

export function initGalleryHandlers() {
    initGalleryViewerModal();

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

                let result: any = {};
                const contentType = res.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    result = await res.json();
                } else {
                    const errorText = await res.text();
                    console.error('Server returned non-JSON response:', errorText);
                    throw new Error(`Server Error: ${res.status} ${res.statusText}`);
                }

                if (!res.ok) throw new Error(result.error || `Upload failed: ${res.status}`);

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
