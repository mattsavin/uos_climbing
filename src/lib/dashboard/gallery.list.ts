function escapeHTML(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function renderGalleryThumbGrid(
    listContainer: HTMLElement,
    images: any[],
    onOpen: (index: number) => void
) {
    listContainer.innerHTML = `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-4">${images.map((img: any, index: number) => `
        <button class="gallery-thumb-btn group relative aspect-square overflow-hidden rounded-lg border bg-black/50 transition-all duration-200 cursor-pointer ${img.featured ? 'border-brand-gold/50 shadow-[0_0_15px_rgba(251,191,36,0.1)]' : 'border-slate-700/80 hover:border-slate-500'}"
            data-index="${index}"
            data-id="${img.id}"
            data-filepath="${escapeHTML(img.filepath)}"
            data-caption="${escapeHTML(img.caption || '')}"
            data-filename="${escapeHTML(img.filename)}"
            data-date="${new Date(img.uploadedAt).toLocaleDateString()}"
            data-featured="${img.featured ? '1' : '0'}">
            <img src="${escapeHTML(img.filepath)}" alt="${escapeHTML(img.caption || '')}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none">
            ${img.featured ? `<div class="absolute top-2 right-2 text-brand-gold drop-shadow-md"><svg class="w-4 h-4 lg:w-5 lg:h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg></div>` : ''}
            <div class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/90 to-transparent px-3 py-2 translate-y-[calc(100%+1px)] group-hover:translate-y-0 transition-transform duration-300 pointer-events-none">
                <p class="text-white text-xs lg:text-sm truncate font-medium drop-shadow-md">${escapeHTML(img.caption || 'No caption')}</p>
            </div>
        </button>
    `).join('')}</div>`;

    listContainer.querySelectorAll<HTMLElement>('.gallery-thumb-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index || '0', 10);
            onOpen(idx);
        });
    });
}