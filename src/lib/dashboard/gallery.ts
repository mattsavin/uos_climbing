import { renderGalleryThumbGrid } from './gallery.list';
import type { CropEditorState } from './gallery.helpers';
import { initGalleryUploadHandlers } from './gallery.upload';
import { createGalleryViewerController } from './gallery.viewer';
import { apiFetch } from '../api/http';

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

/**
 * Fetch the base array of gallery images from the backend.
 *
 * @returns {Promise<any[]>} The array of image objects, or an empty array on failure.
 */
export async function fetchGalleryImages() {
    try {
        return await apiFetch('/api/gallery');
    } catch (e) {
        console.error(e);
        return [];
    }
}

/**
 * Render the gallery list inside the dashboard management view.
 * Fetches fresh images, clears the container, and injects the photo thumbnail grid.
 *
 * @returns {Promise<void>}
 */
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

/**
 * Top-level initialization for the Dashboard's Gallery Management tab.
 * Hooks up upload handlers, viewers, and triggers the initial fetch & render cycle.
 *
 * @returns {Promise<void>}
 */
export async function initGalleryTab() {
    initGalleryHandlers();
    await renderGalleryList();
}
