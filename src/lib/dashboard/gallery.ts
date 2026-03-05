import { renderGalleryThumbGrid } from './gallery.list';
import type { CropEditorState } from './gallery.helpers';
import { initGalleryUploadHandlers } from './gallery.upload';
import { createGalleryViewerController } from './gallery.viewer';

let currentGalleryImages: any[] = [];
let currentViewerIndex = -1;
const cropEditorStateByImageContext = new Map<string, CropEditorState>();

const galleryViewer = createGalleryViewerController({
    getCurrentGalleryImages: () => currentGalleryImages,
    getCurrentViewerIndex: () => currentViewerIndex,
    setCurrentViewerIndex: (index: number) => {
        currentViewerIndex = index;
    },
    renderGalleryList: () => renderGalleryList(),
    cropEditorStateByImageContext
});

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

    renderGalleryThumbGrid(listContainer, images, galleryViewer.openGalleryViewer);
}

export function initGalleryViewerModal() {
    galleryViewer.initGalleryViewerModal();
}

export function initGalleryHandlers() {
    initGalleryViewerModal();
    initGalleryUploadHandlers(renderGalleryList);
}

export async function initGalleryTab() {
    initGalleryHandlers();
    await renderGalleryList();
}
