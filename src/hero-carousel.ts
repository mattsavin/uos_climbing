const FALLBACK_IMAGE = '/src/assets/NUBS_Finals_015.jpg';
const FALLBACK_ALT = 'Climbing';
const INTERVAL_MS = 5000;
import { apiFetch } from './lib/api/http';

import { normalizeCrop, normalizeZoom } from './lib/utils/imageMath';

function getHeroCropStyles(image: any): { objectPosition: string, transformOrigin: string, zoom: number } {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    const x = isMobile ? normalizeCrop(image.heroMobileX, 50) : normalizeCrop(image.heroDesktopX, 50);
    const y = isMobile ? normalizeCrop(image.heroMobileY, 50) : normalizeCrop(image.heroDesktopY, 50);
    const zoom = isMobile ? normalizeZoom(image.heroMobileZoom, 1) : normalizeZoom(image.heroDesktopZoom, 1);
    const anchor = `${x}% ${y}%`;
    return { objectPosition: anchor, transformOrigin: anchor, zoom };
}

export async function initHeroCarousel() {
    const container = document.getElementById('hero-carousel');
    if (!container) return;

    let images: any[] = [];

    try {
        images = await apiFetch('/api/gallery?featured=1');
    } catch {
        // fall through to fallback
    }

    if (images.length === 0) {
        images = [{ filepath: FALLBACK_IMAGE, caption: '' }];
    }

    let current = 0;
    let autoTimer: ReturnType<typeof setInterval> | null = null;

    // Build slides
    container.innerHTML = images.map((img, i) => {
        const crop = getHeroCropStyles(img);
        const altText = (img.caption || FALLBACK_ALT)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        return `
        <div class="hero-slide absolute inset-0 transition-opacity duration-1000 ${i === 0 ? 'opacity-100' : 'opacity-0'}" aria-hidden="${i !== 0}">
            <img src="${img.filepath}" alt="${altText}" class="w-full h-full object-cover" style="object-position: ${crop.objectPosition}; transform-origin: ${crop.transformOrigin}; transform: scale(${crop.zoom});">
        </div>
    `;
    }).join('');

    const slides = container.querySelectorAll<HTMLElement>('.hero-slide');

    // Dots (only if more than 1 image)
    const dotsContainer = document.getElementById('hero-carousel-dots');
    if (dotsContainer && images.length > 1) {
        dotsContainer.innerHTML = images.map((_, i) => `
            <button class="carousel-dot w-2 h-2 rounded-full transition-all duration-300 ${i === 0 ? 'bg-brand-gold w-5' : 'bg-white/40'}" data-index="${i}" aria-label="Go to slide ${i + 1}"></button>
        `).join('');
        dotsContainer.classList.remove('hidden');
        dotsContainer.classList.add('flex');
    }

    function goTo(index: number) {
        slides[current].classList.replace('opacity-100', 'opacity-0');
        slides[current].setAttribute('aria-hidden', 'true');

        current = (index + images.length) % images.length;

        slides[current].classList.replace('opacity-0', 'opacity-100');
        slides[current].setAttribute('aria-hidden', 'false');

        // Update dots
        if (dotsContainer) {
            dotsContainer.querySelectorAll<HTMLElement>('.carousel-dot').forEach((dot, i) => {
                if (i === current) {
                    dot.classList.add('bg-brand-gold', 'w-5');
                    dot.classList.remove('bg-white/40', 'w-2');
                } else {
                    dot.classList.remove('bg-brand-gold', 'w-5');
                    dot.classList.add('bg-white/40', 'w-2');
                }
            });
        }
    }

    function startAuto() {
        if (images.length <= 1) return;
        autoTimer = setInterval(() => goTo(current + 1), INTERVAL_MS);
    }

    function stopAuto() {
        if (autoTimer) {
            clearInterval(autoTimer);
            autoTimer = null;
        }
    }

    // Prev/next buttons
    const prevBtn = document.getElementById('hero-carousel-prev');
    const nextBtn = document.getElementById('hero-carousel-next');

    if (prevBtn && images.length > 1) {
        prevBtn.classList.remove('hidden');
        prevBtn.addEventListener('click', () => { stopAuto(); goTo(current - 1); startAuto(); });
    }
    if (nextBtn && images.length > 1) {
        nextBtn.classList.remove('hidden');
        nextBtn.addEventListener('click', () => { stopAuto(); goTo(current + 1); startAuto(); });
    }

    // Dot clicks
    if (dotsContainer) {
        dotsContainer.addEventListener('click', (e) => {
            const dot = (e.target as HTMLElement).closest<HTMLElement>('.carousel-dot');
            if (!dot) return;
            const index = parseInt(dot.dataset.index || '0', 10);
            stopAuto();
            goTo(index);
            startAuto();
        });
    }

    const applyCurrentCropMode = () => {
        slides.forEach((slide, idx) => {
            const img = slide.querySelector('img') as HTMLImageElement | null;
            if (!img) return;
            const crop = getHeroCropStyles(images[idx]);
            img.style.objectPosition = crop.objectPosition;
            img.style.transformOrigin = crop.transformOrigin;
            img.style.transform = `scale(${crop.zoom})`;
        });
    };

    window.addEventListener('resize', applyCurrentCropMode);

    // Pause on hover
    container.addEventListener('mouseenter', stopAuto);
    container.addEventListener('mouseleave', startAuto);

    startAuto();
}
