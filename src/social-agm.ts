import './style.css';
import { authState } from './auth';
import { initApp } from './main';
import { apiFetch } from './lib/api/http';

type SocialSlide = {
  kicker: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  points: string[];
  cta: string;
  badge?: string;
};

const socialSlides: SocialSlide[] = [
  {
    kicker: 'USMC Announcement',
    title: 'AGM: New Indoor & Competitions Subcommittee',
    date: 'Wednesday 22 April',
    time: '18:00',
    venue: 'Venue TBC',
    points: [
      'All USMC members can vote, comp team or not.',
      'Anyone in USMC can run for a role.',
      'Help shape next year of training, events, and comps.'
    ],
    cta: 'Updates: usmc site elections page',
    badge: 'Indoor & Competitions'
  },
  {
    kicker: 'Why You Should Be There',
    title: 'Your Vote Shapes Training, Events, and Comps',
    date: '22 April',
    time: '18:00 AGM Start',
    venue: 'Venue TBC',
    points: [
      'Vote on who leads Indoor & Competitions.',
      'Back the ideas you want for next year.',
      'No comp-team requirement to vote.'
    ],
    cta: 'Bring a friend from USMC',
    badge: 'USMC AGM'
  },
  {
    kicker: 'Run for a Role',
    title: 'Step Up for the New Subcommittee',
    date: 'Nominations Open',
    time: 'Before AGM',
    venue: 'USMC Members Welcome',
    points: [
      'Anyone in USMC can run for a position.',
      'No previous committee experience required.',
      'Lead the direction of Indoor & Competitions.'
    ],
    cta: 'Get your manifesto ready',
    badge: 'Indoor & Competitions'
  }
];

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64Data] = dataUrl.split(',');
  if (!meta || !base64Data) {
    throw new Error('Invalid image data URL');
  }

  const mimeMatch = /data:(.*?);base64/.exec(meta);
  const mimeType = mimeMatch?.[1] ?? 'image/png';
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

async function exportArtboardAsPng(artboard: HTMLElement, filename: string): Promise<void> {
  const width = 1080;
  const height = 1350;
  const htmlToImage = await import('html-to-image');
  const dataUrl = await htmlToImage.toPng(artboard, {
    width,
    height,
    canvasWidth: width,
    canvasHeight: height,
    pixelRatio: 1,
    cacheBust: true,
    skipAutoScale: true,
    backgroundColor: '#000000'
  });

  const blob = dataUrlToBlob(dataUrl);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

async function fetchBackgroundImages(maxCount: number): Promise<string[]> {
  const collect = (rows: any[]) => rows
    .map((row: any) => row?.filepath)
    .filter((path: unknown): path is string => typeof path === 'string' && path.length > 0);

  try {
    const featured = await apiFetch('/api/gallery?featured=1');
    const featuredPaths = collect(Array.isArray(featured) ? featured : []);
    if (featuredPaths.length >= maxCount) {
      return featuredPaths.slice(0, maxCount);
    }

    const all = await apiFetch('/api/gallery');
    const allPaths = collect(Array.isArray(all) ? all : []);
    return [...featuredPaths, ...allPaths].filter((value, index, arr) => arr.indexOf(value) === index).slice(0, maxCount);
  } catch (error) {
    console.warn('Could not load gallery backgrounds for social slides:', error);
    return [];
  }
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function buildFilename(index: number): string {
  return `usmc-indoor-competitions-agm-2026-04-22-slide-${index + 1}.png`;
}

async function initSocialAgmPage() {
  initApp();
  await authState.init();

  const user = authState.getUser();
  const isCommittee = user?.role === 'committee';

  if (!isCommittee) {
    window.location.href = '/dashboard';
    return;
  }

  const downloadBtn = document.getElementById('download-agm-png') as HTMLButtonElement | null;
  const downloadAllBtn = document.getElementById('download-all-agm-png') as HTMLButtonElement | null;
  const prevBtn = document.getElementById('prev-slide') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('next-slide') as HTMLButtonElement | null;
  const slideCounter = document.getElementById('slide-counter') as HTMLParagraphElement | null;
  const slideDots = document.getElementById('slide-dots') as HTMLDivElement | null;

  const badgeEl = document.getElementById('social-agm-badge') as HTMLDivElement | null;
  const kickerEl = document.getElementById('social-agm-kicker') as HTMLParagraphElement | null;
  const titleEl = document.getElementById('social-agm-title') as HTMLHeadingElement | null;
  const dateEl = document.getElementById('social-agm-date') as HTMLSpanElement | null;
  const timeEl = document.getElementById('social-agm-time') as HTMLSpanElement | null;
  const venueEl = document.getElementById('social-agm-venue') as HTMLParagraphElement | null;
  const pointsEl = document.getElementById('social-agm-points') as HTMLUListElement | null;
  const ctaEl = document.getElementById('social-agm-cta') as HTMLParagraphElement | null;
  const photoEl = document.getElementById('social-agm-photo') as HTMLDivElement | null;
  const artboard = document.getElementById('social-agm-artboard') as HTMLElement | null;
  if (!downloadBtn || !downloadAllBtn || !prevBtn || !nextBtn || !slideCounter || !slideDots || !badgeEl || !kickerEl || !titleEl || !dateEl || !timeEl || !venueEl || !pointsEl || !ctaEl || !photoEl || !artboard) {
    return;
  }

  let currentSlideIndex = 0;
  const backgrounds = await fetchBackgroundImages(socialSlides.length);

  const dotButtons = socialSlides.map((_, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
    dot.addEventListener('click', () => {
      currentSlideIndex = index;
      renderSlide();
    });
    slideDots.appendChild(dot);
    return dot;
  });

  const renderSlide = () => {
    const slide = socialSlides[currentSlideIndex];
    slideCounter.textContent = `Slide ${currentSlideIndex + 1} / ${socialSlides.length}`;
    badgeEl.textContent = slide.badge ?? 'Indoor & Competitions';
    kickerEl.textContent = slide.kicker;
    titleEl.textContent = slide.title;
    dateEl.textContent = slide.date;
    timeEl.textContent = slide.time;
    venueEl.textContent = slide.venue;
    ctaEl.textContent = slide.cta;

    pointsEl.innerHTML = '';
    slide.points.forEach((point) => {
      const li = document.createElement('li');
      li.textContent = point;
      pointsEl.appendChild(li);
    });

    const imagePath = backgrounds[currentSlideIndex] ?? null;
    if (imagePath) {
      photoEl.style.backgroundImage = `url('${imagePath}')`;
      artboard.classList.add('has-photo');
    } else {
      photoEl.style.backgroundImage = '';
      artboard.classList.remove('has-photo');
    }

    dotButtons.forEach((dot, index) => {
      dot.classList.toggle('active', index === currentSlideIndex);
    });
  };

  const setExportState = (isBusy: boolean, mode: 'single' | 'all') => {
    if (isBusy) {
      downloadBtn.disabled = true;
      downloadAllBtn.disabled = true;
      downloadBtn.textContent = mode === 'single' ? 'Exporting...' : 'Please wait...';
      downloadAllBtn.textContent = mode === 'all' ? 'Exporting...' : 'Download All';
      return;
    }

    downloadBtn.disabled = false;
    downloadAllBtn.disabled = false;
    downloadBtn.textContent = 'Download Slide';
    downloadAllBtn.textContent = 'Download All';
  };

  renderSlide();

  prevBtn.addEventListener('click', () => {
    currentSlideIndex = (currentSlideIndex - 1 + socialSlides.length) % socialSlides.length;
    renderSlide();
  });

  nextBtn.addEventListener('click', () => {
    currentSlideIndex = (currentSlideIndex + 1) % socialSlides.length;
    renderSlide();
  });

  downloadBtn.addEventListener('click', async () => {
    setExportState(true, 'single');

    try {
      await exportArtboardAsPng(artboard, buildFilename(currentSlideIndex));
    } catch (error) {
      console.error('Failed to export AGM artboard:', error);
    } finally {
      setExportState(false, 'single');
    }
  });

  downloadAllBtn.addEventListener('click', async () => {
    setExportState(true, 'all');
    const startIndex = currentSlideIndex;

    try {
      for (let index = 0; index < socialSlides.length; index += 1) {
        currentSlideIndex = index;
        renderSlide();
        await nextAnimationFrame();
        await exportArtboardAsPng(artboard, buildFilename(index));
      }
    } catch (error) {
      console.error('Failed to export all AGM slides:', error);
    } finally {
      currentSlideIndex = startIndex;
      renderSlide();
      setExportState(false, 'all');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  void initSocialAgmPage();
});
