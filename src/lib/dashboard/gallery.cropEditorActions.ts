import { showToast } from '../../utils';
import {
    CROP_CONTEXT_CONFIG,
    clamp,
    getCropStateKey,
    normalizeZoom
} from './gallery.helpers';
import type { CropContextKey, CropEditorState } from './gallery.helpers';
import { apiFetch } from '../api/http';

type DraftState = {
    activeCropContext: CropContextKey | null;
    draftCropX: number;
    draftCropY: number;
    draftZoom: number;
    draftBoxScale: number;
    draftBoxCenterX: number;
    draftBoxCenterY: number;
};

type BindCropEditorActionButtonsOptions = {
    cropResetBtn: HTMLButtonElement | null;
    cropSaveBtn: HTMLButtonElement | null;
    cropCloseBtn: HTMLElement | null;
    cropCancelBtn: HTMLElement | null;
    cropBackdrop: HTMLElement | null;
    getDraftState: () => DraftState;
    setDraftState: (updates: Partial<DraftState>) => void;
    getCurrentImage: () => any | null;
    getCurrentImageIndex: () => number;
    getEditorGeometry: () => any;
    cropEditorStateByImageContext: Map<string, CropEditorState>;
    setSummaryText: (context: CropContextKey, x: number, y: number, zoom: number) => void;
    applyCropEditorVisuals: () => void;
    closeCropEditor: () => void;
};

export function bindCropEditorActionButtons(options: BindCropEditorActionButtonsOptions) {
    const {
        cropResetBtn,
        cropSaveBtn,
        cropCloseBtn,
        cropCancelBtn,
        cropBackdrop,
        getDraftState,
        setDraftState,
        getCurrentImage,
        getCurrentImageIndex,
        getEditorGeometry,
        cropEditorStateByImageContext,
        setSummaryText,
        applyCropEditorVisuals,
        closeCropEditor
    } = options;

    if (cropResetBtn) {
        cropResetBtn.addEventListener('click', () => {
            setDraftState({
                draftCropX: 50,
                draftCropY: 50,
                draftZoom: 1,
                draftBoxScale: 1,
                draftBoxCenterX: 50,
                draftBoxCenterY: 50
            });

            const image = getCurrentImage();
            const currentViewerIndex = getCurrentImageIndex();
            const state = getDraftState();
            if (state.activeCropContext && currentViewerIndex >= 0 && image?.id !== undefined) {
                cropEditorStateByImageContext.set(getCropStateKey(image.id, state.activeCropContext), {
                    cropX: state.draftCropX,
                    cropY: state.draftCropY,
                    zoom: state.draftZoom,
                    boxScale: state.draftBoxScale,
                    boxCenterX: state.draftBoxCenterX,
                    boxCenterY: state.draftBoxCenterY
                });
            }
            applyCropEditorVisuals();
        });
    }

    if (cropSaveBtn) {
        cropSaveBtn.addEventListener('click', async () => {
            const currentViewerIndex = getCurrentImageIndex();
            const state = getDraftState();
            if (!state.activeCropContext || currentViewerIndex < 0) return;

            const image = getCurrentImage();
            if (!image) return;

            const geometry = getEditorGeometry();
            if (!geometry) return;

            const boxOffsetXPx = ((state.draftBoxCenterX - 50) / 100) * geometry.viewport.width;
            const boxOffsetYPx = ((state.draftBoxCenterY - 50) / 100) * geometry.viewport.height;
            const offsetXNorm = (boxOffsetXPx / (geometry.metrics.boxWidth * geometry.bounds.widthRatio)) * 100;
            const offsetYNorm = (boxOffsetYPx / (geometry.metrics.boxHeight * geometry.bounds.heightRatio)) * 100;

            const finalCropX = clamp(state.draftCropX + offsetXNorm, 0, 100);
            const finalCropY = clamp(state.draftCropY + offsetYNorm, 0, 100);
            const finalZoom = normalizeZoom(state.draftZoom, 1);

            const config = CROP_CONTEXT_CONFIG[state.activeCropContext];
            const payload: Record<string, number> = {
                [config.xKey]: finalCropX,
                [config.yKey]: finalCropY,
                [config.zoomKey]: finalZoom
            };

            const originalText = cropSaveBtn.textContent || 'Save Crop';
            cropSaveBtn.disabled = true;
            cropSaveBtn.textContent = 'Saving...';

            try {
                await apiFetch(`/api/gallery/${image.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });

                image[config.xKey] = finalCropX;
                image[config.yKey] = finalCropY;
                image[config.zoomKey] = finalZoom;

                const nextState = getDraftState();
                cropEditorStateByImageContext.set(getCropStateKey(image.id, state.activeCropContext), {
                    cropX: nextState.draftCropX,
                    cropY: nextState.draftCropY,
                    zoom: nextState.draftZoom,
                    boxScale: nextState.draftBoxScale,
                    boxCenterX: nextState.draftBoxCenterX,
                    boxCenterY: nextState.draftBoxCenterY
                });

                setSummaryText(state.activeCropContext, finalCropX, finalCropY, finalZoom);
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
}
