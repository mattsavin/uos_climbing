import { GALLERY_LANDSCAPE_ASPECT } from '../gallery.config';

export type CropContextKey = 'heroDesktop' | 'heroMobile' | 'galleryLandscape';

export type CropEditorState = {
    cropX: number;
    cropY: number;
    zoom: number;
    boxScale: number;
    boxCenterX: number;
    boxCenterY: number;
};

/**
 * Configuration mapping for the different contexts an image might be cropped for.
 * Defines the aspect ratios and the specific database keys used to store crop offsets.
 */
export const CROP_CONTEXT_CONFIG: Record<CropContextKey, {
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
        aspect: GALLERY_LANDSCAPE_ASPECT,
        xKey: 'galleryLandscapeX',
        yKey: 'galleryLandscapeY',
        zoomKey: 'galleryLandscapeZoom'
    }
};

/** Mouse drag sensitivity multiplier when panning the background image. */
export const IMAGE_DRAG_SENSITIVITY = 1.2;
/** Mouse drag sensitivity multiplier when panning the crop selection box. */
export const BOX_DRAG_SENSITIVITY = 1.0;
/** Maximum allowed size for a single photo upload (50MB). */
export const GALLERY_UPLOAD_MAX_FILE_SIZE = 50 * 1024 * 1024;
/** Maximum allowed size for a batch of photo uploads (90MB to stay strictly under Cloudflare's 100MB limit). */
export const GALLERY_UPLOAD_MAX_BATCH_SIZE = 90 * 1024 * 1024;

/**
 * Formats the current crop coordinates and zoom level into a human-readable string.
 *
 * @param {number} x - The X offset percentage (0-100).
 * @param {number} y - The Y offset percentage (0-100).
 * @param {number} zoom - The zoom level multiplier.
 * @returns {string} Formatted label, e.g., 'Center • 1.00x' or '45% / 60% • 1.50x'.
 */
export function formatCropSummary(x: number, y: number, zoom: number): string {
    const centered = Math.abs(x - 50) < 0.5 && Math.abs(y - 50) < 0.5;
    if (centered) return `Center • ${zoom.toFixed(2)}x`;
    return `${Math.round(x)}% / ${Math.round(y)}% • ${zoom.toFixed(2)}x`;
}

/**
 * Generates a unique state key combining the image ID and the current crop context.
 * Useful for caching crop states locally before saving.
 *
 * @param {string | number} imageId - The unique ID of the image in the database.
 * @param {CropContextKey} context - The active crop context ('heroDesktop', etc.).
 * @returns {string} A composite key like '123:heroDesktop'.
 */
export function getCropStateKey(imageId: string | number, context: CropContextKey): string {
    return `${imageId}:${context}`;
}

/**
 * Checks if a gallery image is marked as featured.
 * Handles boolean or numeric string representations.
 *
 * @param {any} image - The gallery image object.
 * @returns {boolean} True if the image is explicitly flagged as featured.
 */
export function isFeaturedImage(image: any): boolean {
    return image?.featured === true || image?.featured === 1 || image?.featured === '1';
}

export function getFeaturedReel(images: any[]): any[] {
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

export { normalizeCrop, normalizeZoom } from '../utils/imageMath';

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function getCropBounds(naturalWidth: number, naturalHeight: number, frameAspect: number, zoom: number) {
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

/**
 * Validates a batch of files against single-file and batch-total size limits.
 * Designed to prevent Cloudflare 413 Payload Too Large errors.
 *
 * @param {FileList} files - The native FileList object from the file input.
 * @returns {{ error?: string; totalBytes: number }} A validation failure message if limits are exceeded.
 */
export function validateGalleryUploadBatch(files: FileList): { error?: string; totalBytes: number } {
    let totalSize = 0;

    for (let i = 0; i < files.length; i++) {
        totalSize += files[i].size;
        if (files[i].size > GALLERY_UPLOAD_MAX_FILE_SIZE) {
            return {
                error: `The image ${files[i].name} is too large (max 50MB). Please select smaller files.`,
                totalBytes: totalSize
            };
        }
    }

    if (totalSize > GALLERY_UPLOAD_MAX_BATCH_SIZE) {
        const totalMB = (totalSize / (1024 * 1024)).toFixed(1);
        return {
            error: `Total upload size is ${totalMB}MB. Cloudflare limits uploads to 100MB at once. Please upload fewer photos at a time.`,
            totalBytes: totalSize
        };
    }

    return { totalBytes: totalSize };
}