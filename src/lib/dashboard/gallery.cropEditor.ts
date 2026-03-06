import { bindCropEditorActionButtons } from './gallery.cropEditorActions';
import { getEditorGeometry } from './gallery.cropGeometry';
import {
    CROP_CONTEXT_CONFIG,
    IMAGE_DRAG_SENSITIVITY,
    clamp,
    getCropStateKey,
    normalizeCrop,
    normalizeZoom
} from './gallery.helpers';
import type { CropContextKey, CropEditorState } from './gallery.helpers';

type InitCropEditorOptions = {
    cropEditorStateByImageContext: Map<string, CropEditorState>;
    getCurrentImage: () => any | null;
    getCurrentImageIndex: () => number;
    setSummaryText: (context: CropContextKey, x: number, y: number, zoom: number) => void;
};

export function initCropEditor(options: InitCropEditorOptions) {
    const { cropEditorStateByImageContext, getCurrentImage, getCurrentImageIndex, setSummaryText } = options;

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
    let draftBoxCenterX = 50;
    let draftBoxCenterY = 50;

    const persistDraftCropState = () => {
        if (!activeCropContext) return;
        const image = getCurrentImage();
        if (!image || image.id === undefined || image.id === null) return;

        cropEditorStateByImageContext.set(getCropStateKey(image.id, activeCropContext), {
            cropX: draftCropX,
            cropY: draftCropY,
            zoom: draftZoom,
            boxScale: draftBoxScale,
            boxCenterX: draftBoxCenterX,
            boxCenterY: draftBoxCenterY
        });
    };

    const applyCropEditorVisuals = () => {
        if (!activeCropContext || !cropStage || !cropImage || !cropBox || !cropZoomInput) return;

        const geometry = getEditorGeometry({
            activeCropContext,
            cropStage,
            cropImage,
            draftZoom,
            draftBoxScale,
            draftBoxCenterX,
            draftBoxCenterY
        });
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

        persistDraftCropState();
    };

    const closeCropEditor = () => {
        persistDraftCropState();
        if (cropModal) cropModal.classList.add('hidden');
        activeCropContext = null;
    };

    const openCropEditor = (context: CropContextKey) => {
        const image = getCurrentImage();
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
            draftBoxCenterX = 50;
            draftBoxCenterY = 50;
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
        let dragStartX = 0;
        let dragStartY = 0;
        let dragStartCropX = 50;
        let dragStartCropY = 50;
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

        const tryStartPinch = () => {
            if (activePointers.size < 2) return;
            const points = Array.from(activePointers.values());
            pinchStartDistance = Math.max(20, getDistance(points[0], points[1]));
            pinchStartZoom = draftZoom;
            isPinching = true;
            stopImageDrag();
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

            if (!isDraggingImage) return;
            const geometry = getEditorGeometry({
                activeCropContext,
                cropStage,
                cropImage,
                draftZoom,
                draftBoxScale,
                draftBoxCenterX,
                draftBoxCenterY
            });
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

    bindCropEditorActionButtons({
        cropResetBtn,
        cropSaveBtn,
        cropCloseBtn,
        cropCancelBtn,
        cropBackdrop,
        getDraftState: () => ({
            activeCropContext,
            draftCropX,
            draftCropY,
            draftZoom,
            draftBoxScale,
            draftBoxCenterX,
            draftBoxCenterY
        }),
        setDraftState: (updates) => {
            if (updates.activeCropContext !== undefined) activeCropContext = updates.activeCropContext;
            if (updates.draftCropX !== undefined) draftCropX = updates.draftCropX;
            if (updates.draftCropY !== undefined) draftCropY = updates.draftCropY;
            if (updates.draftZoom !== undefined) draftZoom = updates.draftZoom;
            if (updates.draftBoxScale !== undefined) draftBoxScale = updates.draftBoxScale;
            if (updates.draftBoxCenterX !== undefined) draftBoxCenterX = updates.draftBoxCenterX;
            if (updates.draftBoxCenterY !== undefined) draftBoxCenterY = updates.draftBoxCenterY;
        },
        getCurrentImage,
        getCurrentImageIndex,
        getEditorGeometry: () => getEditorGeometry({
            activeCropContext,
            cropStage,
            cropImage,
            draftZoom,
            draftBoxScale,
            draftBoxCenterX,
            draftBoxCenterY
        }),
        cropEditorStateByImageContext,
        setSummaryText,
        applyCropEditorVisuals,
        closeCropEditor
    });

    return {
        openCropEditor,
        closeCropEditor,
        isOpen: () => !!cropModal && !cropModal.classList.contains('hidden')
    };
}