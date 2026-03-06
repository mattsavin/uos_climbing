import { showToast } from '../../utils';
import { authState } from '../../auth';

export function initProfilePhotoCropEditor() {
    const modal = document.getElementById('profile-crop-modal');
    const backdrop = document.getElementById('profile-crop-backdrop');
    const stage = document.getElementById('profile-crop-stage') as HTMLElement | null;
    const cropImage = document.getElementById('profile-crop-image') as HTMLImageElement | null;
    const zoomInput = document.getElementById('profile-crop-zoom') as HTMLInputElement | null;
    const saveBtn = document.getElementById('profile-crop-save') as HTMLButtonElement | null;
    const cancelBtn = document.getElementById('profile-crop-cancel');
    const cancelXBtn = document.getElementById('profile-crop-cancel-x');

    if (!modal || !stage || !cropImage || !zoomInput || !saveBtn) return null;

    let userZoom = 1;
    let tx = 0;
    let ty = 0;
    let stageSize = 0;
    let baseScale = 1;
    let onSuccess: ((photoPath: string) => void) | null = null;
    let currentUploadFn: ((blob: Blob) => Promise<string>) | null = null;

    const accountUploadFn = async (blob: Blob): Promise<string> => {
        const formData = new FormData();
        formData.append('photo', blob, 'profile.jpg');
        const res = await fetch('/api/users/me/photo', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Upload failed');
        if (authState.user) authState.user.profilePhoto = result.photoPath;
        return result.photoPath;
    };

    // The circle has 16px inset on each side (Tailwind inset-4)
    const getCircleRadius = () => (stageSize - 32) / 2;
    const getScale = () => baseScale * userZoom;

    const clampPan = () => {
        const radius = getCircleRadius();
        const halfImgW = cropImage.naturalWidth * getScale() / 2;
        const halfImgH = cropImage.naturalHeight * getScale() / 2;
        const maxTx = Math.max(0, halfImgW - radius);
        const maxTy = Math.max(0, halfImgH - radius);
        tx = Math.min(maxTx, Math.max(-maxTx, tx));
        ty = Math.min(maxTy, Math.max(-maxTy, ty));
    };

    const applyTransform = () => {
        const scale = getScale();
        cropImage.style.left = `${stageSize / 2 - cropImage.naturalWidth * scale / 2 + tx}px`;
        cropImage.style.top = `${stageSize / 2 - cropImage.naturalHeight * scale / 2 + ty}px`;
        cropImage.style.width = `${cropImage.naturalWidth * scale}px`;
        cropImage.style.height = `${cropImage.naturalHeight * scale}px`;
    };

    const initImagePosition = () => {
        stageSize = stage.getBoundingClientRect().width;
        if (!stageSize || !cropImage.naturalWidth) return;
        baseScale = Math.max(stageSize / cropImage.naturalWidth, stageSize / cropImage.naturalHeight);
        userZoom = 1;
        tx = 0;
        ty = 0;
        zoomInput.value = '1';
        applyTransform();
    };

    cropImage.addEventListener('load', () => requestAnimationFrame(() => {
        initImagePosition();
        saveBtn.disabled = false;
    }));

    zoomInput.addEventListener('input', () => {
        userZoom = parseFloat(zoomInput.value);
        clampPan();
        applyTransform();
    });

    // Pointer events for drag and pinch-to-zoom
    stage.style.touchAction = 'none';
    const activePointers = new Map<number, { x: number; y: number }>();
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0, dragStartTx = 0, dragStartTy = 0;
    let isPinching = false;
    let pinchStartDist = 0, pinchStartZoom = 1;

    stage.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.button !== 0) return;
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        stage.setPointerCapture(e.pointerId);

        if (activePointers.size >= 2) {
            const pts = Array.from(activePointers.values());
            pinchStartDist = Math.max(20, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
            pinchStartZoom = userZoom;
            isPinching = true;
            isDragging = false;
            e.preventDefault();
            return;
        }

        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragStartTx = tx;
        dragStartTy = ty;
        stage.style.cursor = 'grabbing';
        e.preventDefault();
    });

    stage.addEventListener('pointermove', (e: PointerEvent) => {
        if (activePointers.has(e.pointerId)) {
            activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        if (isPinching && activePointers.size >= 2) {
            const pts = Array.from(activePointers.values());
            const dist = Math.max(20, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
            userZoom = Math.min(5, Math.max(1, pinchStartZoom * (dist / pinchStartDist)));
            zoomInput.value = String(userZoom);
            clampPan();
            applyTransform();
            return;
        }

        if (!isDragging) return;
        tx = dragStartTx + (e.clientX - dragStartX);
        ty = dragStartTy + (e.clientY - dragStartY);
        clampPan();
        applyTransform();
    });

    const finishPointer = (e: PointerEvent) => {
        activePointers.delete(e.pointerId);
        if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
        if (activePointers.size < 2) isPinching = false;
        if (activePointers.size === 0) {
            isDragging = false;
            stage.style.cursor = 'grab';
        }
    };

    stage.addEventListener('pointerup', finishPointer);
    stage.addEventListener('pointercancel', finishPointer);
    stage.addEventListener('pointerleave', (e: PointerEvent) => {
        if (e.pointerType === 'mouse') return;
        finishPointer(e);
    });

    stage.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        userZoom = Math.min(5, Math.max(1, userZoom - e.deltaY * 0.003));
        zoomInput.value = String(userZoom);
        clampPan();
        applyTransform();
    }, { passive: false });

    const close = () => {
        modal.classList.add('hidden');
        if (cropImage.src.startsWith('blob:')) URL.revokeObjectURL(cropImage.src);
        cropImage.src = '';
        for (const pointerId of activePointers.keys()) {
            if (stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId);
        }
        activePointers.clear();
        isDragging = false;
        isPinching = false;
        stage.style.cursor = 'grab';
    };

    [cancelBtn, cancelXBtn, backdrop].forEach(el => {
        if (el) el.addEventListener('click', close);
    });

    const exportCrop = (): Promise<Blob> => new Promise((resolve, reject) => {
        if (!cropImage.complete || cropImage.naturalWidth === 0 || stageSize === 0) {
            return reject(new Error('Image not ready'));
        }
        const outputSize = 500;
        const canvas = document.createElement('canvas');
        canvas.width = outputSize;
        canvas.height = outputSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not available'));

        const scale = getScale();
        const radius = getCircleRadius();
        const imgLeft = stageSize / 2 - cropImage.naturalWidth * scale / 2 + tx;
        const imgTop = stageSize / 2 - cropImage.naturalHeight * scale / 2 + ty;

        // Crop box in stage coords: centered, diameter = radius * 2
        const natLeft = (stageSize / 2 - radius - imgLeft) / scale;
        const natTop = (stageSize / 2 - radius - imgTop) / scale;
        const natSize = (radius * 2) / scale;

        ctx.drawImage(cropImage, natLeft, natTop, natSize, natSize, 0, 0, outputSize, outputSize);
        canvas.toBlob(blob => {
            blob ? resolve(blob) : reject(new Error('Failed to export crop'));
        }, 'image/jpeg', 0.92);
    });

    saveBtn.addEventListener('click', async () => {
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Uploading...';

        try {
            const blob = await exportCrop();
            const photoPath = await (currentUploadFn ?? accountUploadFn)(blob);
            showToast('Profile photo updated!', 'success');
            close();
            onSuccess?.(photoPath);
            window.dispatchEvent(new CustomEvent('dashboardUpdate'));
        } catch (err: any) {
            showToast(err.message || 'Failed to upload photo', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    });

    // Hook into the account modal's file input (default upload target)
    const photoInput = document.getElementById('member-photo-input') as HTMLInputElement | null;
    if (photoInput) {
        photoInput.addEventListener('change', () => {
            const file = photoInput.files?.[0];
            if (!file) return;
            photoInput.value = '';

            currentUploadFn = accountUploadFn;
            onSuccess = (photoPath: string) => {
                const preview = document.getElementById('profile-photo-preview') as HTMLImageElement | null;
                const placeholder = document.getElementById('profile-photo-placeholder');
                if (preview) {
                    preview.src = photoPath;
                    preview.classList.remove('hidden');
                }
                if (placeholder) placeholder.classList.add('hidden');
            };

            if (cropImage.src.startsWith('blob:')) URL.revokeObjectURL(cropImage.src);
            saveBtn.disabled = true;
            cropImage.src = URL.createObjectURL(file);
            modal.classList.remove('hidden');
        });
    }

    const open = (file: File, uploadFn: (blob: Blob) => Promise<string>, successCallback?: (photoPath: string) => void) => {
        currentUploadFn = uploadFn;
        onSuccess = successCallback ?? null;
        if (cropImage.src.startsWith('blob:')) URL.revokeObjectURL(cropImage.src);
        saveBtn.disabled = true;
        cropImage.src = URL.createObjectURL(file);
        modal.classList.remove('hidden');
    };

    return { open, close };
}
