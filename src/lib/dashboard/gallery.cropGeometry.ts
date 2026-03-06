import { CROP_CONTEXT_CONFIG, clamp, getCropBounds } from './gallery.helpers';
import type { CropContextKey } from './gallery.helpers';

/**
 * Calculates the dimensions and absolute positioning of the cropping box relative to
 * the scaled image viewport. Ensures the crop box maintains the strict aspect ratio
 * required by the active `CropContextKey`, and prevents it from overflowing the viewport bounds.
 *
 * @param {number} width - The rendered width of the image viewport.
 * @param {number} height - The rendered height of the image viewport.
 * @param {number} aspect - The required aspect ratio constraint (width / height).
 * @param {number} boxScale - A scaling factor (0.33 to 1) applied to the crop box relative to the viewport.
 * @param {number} centerX - Percentage X coordinate (0-100) indicating the desired horizontal center of the box.
 * @param {number} centerY - Percentage Y coordinate (0-100) indicating the desired vertical center of the box.
 * @returns {Object} Computed dimensions (boxWidth, boxHeight, left, top) and adjusted center coordinates.
 */
export function getBoxMetrics(width: number, height: number, aspect: number, boxScale: number, centerX: number, centerY: number) {
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
}

/**
 * Determines the largest rectangular viewport that fits within the HTML stage
 * while preserving the natural aspect ratio of the underlying image.
 * Simulates a CSS `object-fit: contain` behavior mathematically.
 *
 * @param {DOMRect} stageRect - The bounding client rect of the HTML container (`#crop-editor-stage`).
 * @param {number} naturalWidth - The intrinsic width of the raw image.
 * @param {number} naturalHeight - The intrinsic height of the raw image.
 * @returns {Object} The calculated left, top, width, and height of the contained image viewport.
 */
export function getImageViewport(stageRect: DOMRect, naturalWidth: number, naturalHeight: number) {
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
}

/**
 * Master geometric orchestration function for the crop editor.
 * Aggregates hardware measurements (DOMRect), image intrinsic dimensions, and stateful
 * user transformations (zoom, box scaling) into a single cohesive layout object
 * used to render the visual DOM overlays.
 *
 * @param {Object} input - State dictionary including DOM targets and draft measurements.
 * @returns {Object|null} A payload containing `stageRect`, `viewport`, `bounds`, and `metrics`, or null if not ready.
 */
export function getEditorGeometry(input: {
    activeCropContext: CropContextKey | null;
    cropStage: HTMLElement | null;
    cropImage: HTMLImageElement | null;
    draftZoom: number;
    draftBoxScale: number;
    draftBoxCenterX: number;
    draftBoxCenterY: number;
}) {
    const {
        activeCropContext,
        cropStage,
        cropImage,
        draftZoom,
        draftBoxScale,
        draftBoxCenterX,
        draftBoxCenterY
    } = input;

    if (!activeCropContext || !cropStage || !cropImage) return null;
    const config = CROP_CONTEXT_CONFIG[activeCropContext];
    const stageRect = cropStage.getBoundingClientRect();
    const viewport = getImageViewport(stageRect, cropImage.naturalWidth, cropImage.naturalHeight);
    const bounds = getCropBounds(cropImage.naturalWidth, cropImage.naturalHeight, config.aspect, draftZoom);
    const metrics = getBoxMetrics(viewport.width, viewport.height, config.aspect, clamp(draftBoxScale, 1 / 3, 1), draftBoxCenterX, draftBoxCenterY);
    return { stageRect, viewport, bounds, metrics };
}