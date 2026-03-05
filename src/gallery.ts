import './style.css';

function normalizeCrop(value: any, fallback = 50): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(100, Math.max(0, parsed));
}

function normalizeZoom(value: any, fallback = 1): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(3, Math.max(1, parsed));
}

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
        <div class="glass-card aspect-video flex items-center justify-center border border-white/10 group overflow-hidden relative cursor-pointer gallery-item" data-src="${img.filepath}" data-caption="${img.caption || ''}">
            <img src="${img.filepath}" alt="${img.caption || 'Gallery Image'}" class="w-full h-full object-cover transition-transform duration-700" style="object-position: ${normalizeCrop(img.galleryLandscapeX, 50)}% ${normalizeCrop(img.galleryLandscapeY, 50)}%; transform-origin: ${normalizeCrop(img.galleryLandscapeX, 50)}% ${normalizeCrop(img.galleryLandscapeY, 50)}%; transform: scale(${normalizeZoom(img.galleryLandscapeZoom, 1)});">
            ${img.caption ? `
            <div class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                <p class="text-white text-sm font-bold text-center">${img.caption}</p>
            </div>
            ` : ''}
        </div>
    `).join('');

    // Modal Logic
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-image') as HTMLImageElement;
    const modalCaption = document.getElementById('modal-caption');
    const closeBtn = document.getElementById('close-image-modal');

    // Open Modal
    document.querySelectorAll('.gallery-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const el = e.currentTarget as HTMLElement;
            const src = el.getAttribute('data-src');
            const caption = el.getAttribute('data-caption');

            if (src && modalImg && modal) {
                modalImg.src = src;

                if (modalCaption) {
                    if (caption) {
                        modalCaption.textContent = caption;
                        modalCaption.classList.remove('hidden');
                    } else {
                        modalCaption.classList.add('hidden');
                    }
                }

                modal.classList.remove('hidden');
                // Small delay to allow display block to take effect before transitioning opacity
                setTimeout(() => {
                    modal.classList.remove('opacity-0');
                    modal.classList.add('opacity-100');
                }, 10);

                document.body.style.overflow = 'hidden'; // Prevent scrolling
            }
        });
    });

    // Close Modal Function
    const closeModal = () => {
        if (!modal) return;
        modal.classList.remove('opacity-100');
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
            if (modalImg) modalImg.src = '';
            document.body.style.overflow = '';
        }, 300); // Wait for transition
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initGallery();
});
