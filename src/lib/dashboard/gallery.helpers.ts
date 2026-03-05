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

export const IMAGE_DRAG_SENSITIVITY = 1.2;
export const BOX_DRAG_SENSITIVITY = 1.0;
export const GALLERY_UPLOAD_MAX_FILE_SIZE = 50 * 1024 * 1024;
export const GALLERY_UPLOAD_MAX_BATCH_SIZE = 90 * 1024 * 1024;

export function formatCropSummary(x: number, y: number, zoom: number): string {
    const centered = Math.abs(x - 50) < 0.5 && Math.abs(y - 50) < 0.5;
    if (centered) return `Center • ${zoom.toFixed(2)}x`;
    return `${Math.round(x)}% / ${Math.round(y)}% • ${zoom.toFixed(2)}x`;
}

export function getCropStateKey(imageId: string | number, context: CropContextKey): string {
    return `${imageId}:${context}`;
}

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

export function normalizeCrop(value: any, fallback = 50): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(100, Math.max(0, parsed));
}

export function normalizeZoom(value: any, fallback = 1): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(3, Math.max(1, parsed));
}

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