import { CROP_CONTEXT_CONFIG, clamp, getCropBounds } from './gallery.helpers';
import type { CropContextKey } from './gallery.helpers';

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