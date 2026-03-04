import './style.css';

async function fetchGalleryImages() {
    try {
        const res = await fetch('/api/gallery');
        if (!res.ok) throw new Error('Failed to fetch gallery');
        return await res.json();
    } catch (e) {
        console.error(e);
        return [];
    }
}

async function initGallery() {
    const grid = document.getElementById('public-gallery-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="col-span-full text-center text-slate-500 py-10">Loading gallery...</div>';

    const images = await fetchGalleryImages();

    if (images.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center text-slate-500 py-10">
                <p>No images in the gallery yet.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = images.map((img: any) => `
        <div class="glass-card aspect-video flex items-center justify-center border border-white/10 group overflow-hidden relative">
            <img src="${img.filepath}" alt="${img.caption || 'Gallery Image'}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700">
            ${img.caption ? `
            <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                <p class="text-white text-sm font-bold text-center">${img.caption}</p>
            </div>
            ` : ''}
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    initGallery();
});
