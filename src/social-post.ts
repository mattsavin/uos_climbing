import './style.css';
import { authState } from './auth';
import { initApp } from './main';
import { apiFetch } from './lib/api/http';
import { toPng } from 'html-to-image';

type SocialSlide = {
  theme: 'summit' | 'pulse' | 'night';
  kicker: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  points: string[];
  cta: string;
  badge?: string;
};

type ExportedAsset = {
  filename: string;
  blob: Blob;
};

const socialSlides: SocialSlide[] = [
  {
    theme: 'summit',
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
    cta: 'Updates: @sheffieldmountaineering and @uos_climb',
    badge: 'Indoor & Competitions'
  },
  {
    theme: 'pulse',
    kicker: 'Why You Should Be There',
    title: 'Your Vote Shapes Training, Events, and Comps',
    date: 'Wednesday 22 April',
    time: '18:00',
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
    theme: 'night',
    kicker: 'Run for a Role',
    title: 'Roles Open for the New Subcommittee',
    date: 'Nominations Open',
    time: 'Before AGM',
    venue: 'USMC Members Welcome',
    points: [
      'Chair',
      'Treasurer',
      'Secretary',
      'Welfare & Inclusions',
      "Men's Team Captain",
      "Women's Team Captain",
      'Social Secretary',
      'Publicity',
      'Training Secretary'
    ],
    cta: 'DM to ask about any role',
    badge: 'Indoor & Competitions'
  }
];

const themeClassNames = ['social-agm-theme-summit', 'social-agm-theme-pulse', 'social-agm-theme-night'] as const;

function setExportMessage(container: HTMLElement, message: string, kind: 'info' | 'error' = 'info') {
  const colorClass = kind === 'error' ? 'text-red-300' : 'text-slate-300';
  container.innerHTML = `<p class="text-xs ${colorClass} font-semibold mt-3">${message}</p>`;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

// Fetch the Outfit font CSS and embed all font files as base64 data URIs.
// This bypasses html-to-image's stylesheet scanner (which crashes on Tailwind v4
// @layer/@keyframes rules) AND ensures fonts render correctly in the SVG foreignObject
// (external font URLs are blocked or unreliable in that context).
let cachedFontCSS: string | null = null;
async function getFontEmbedCSS(): Promise<string> {
  if (cachedFontCSS !== null) return cachedFontCSS;
  try {
    const cssRes = await fetch('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700;900&display=swap');
    const cssText = await cssRes.text();

    // Collect unique font file URLs
    const urlSet = new Set<string>();
    const urlRe = /url\((['"]?)([^)'"]+)\1\)\s+format\(['"]woff2['"]\)/g;
    let m;
    while ((m = urlRe.exec(cssText)) !== null) urlSet.add(m[2]);

    // Fetch each font file and convert to base64 data URI in parallel
    const dataUriMap = new Map<string, string>();
    await Promise.all([...urlSet].map(async (url) => {
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        dataUriMap.set(url, `data:font/woff2;base64,${btoa(bin)}`);
      } catch { /* keep URL if fetch fails */ }
    }));

    cachedFontCSS = cssText.replace(/url\((['"]?)([^)'"]+)\1\)/g, (match, _quote, url) => {
      const dataUri = dataUriMap.get(url);
      return dataUri ? `url('${dataUri}')` : match;
    });
  } catch {
    cachedFontCSS = '';
  }
  return cachedFontCSS;
}

// Capture the rendered artboard element as a PNG, scaled to 1080px wide.
async function captureArtboard(artboard: HTMLElement, filename: string): Promise<ExportedAsset> {
  const fontEmbedCSS = await getFontEmbedCSS();
  const pixelRatio = 1080 / artboard.offsetWidth;
  const dataUrl = await toPng(artboard, { pixelRatio, cacheBust: true, fontEmbedCSS, style: { margin: '0' } });
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return { filename, blob };
}

function triggerAssetDownload(asset: ExportedAsset): void {
  const objectUrl = URL.createObjectURL(asset.blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = asset.filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

function renderDownloadLinks(container: HTMLElement, assets: ExportedAsset[]) {
  container.innerHTML = '';

  if (assets.length === 0) {
    return;
  }

  const heading = document.createElement('p');
  heading.className = 'text-xs text-slate-400 font-bold uppercase tracking-[0.18em] mt-3 mb-2';
  heading.textContent = 'Downloads Ready';
  container.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'flex flex-wrap gap-2';

  assets.forEach((asset) => {
    const objectUrl = URL.createObjectURL(asset.blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = asset.filename;
    link.textContent = asset.filename;
    link.className = 'text-xs font-semibold text-brand-gold hover:text-brand-gold-muted underline underline-offset-4';
    link.addEventListener('click', () => {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    }, { once: true });
    list.appendChild(link);
  });

  container.appendChild(list);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function fetchBackgroundImages(maxCount: number): Promise<string[]> {
  const collect = (rows: any[]) => rows
    .map((row: any) => row?.filepath)
    .filter((path: unknown): path is string => typeof path === 'string' && path.length > 0);

  try {
    const featured = await apiFetch('/api/gallery?featured=1');
    const featuredPaths = shuffle(collect(Array.isArray(featured) ? featured : []));
    if (featuredPaths.length >= maxCount) {
      return featuredPaths.slice(0, maxCount);
    }

    const all = await apiFetch('/api/gallery');
    const allPaths = shuffle(collect(Array.isArray(all) ? all : []));
    const combined = [...featuredPaths, ...allPaths].filter((value, index, arr) => arr.indexOf(value) === index);
    return combined.slice(0, maxCount);
  } catch (error) {
    console.warn('Could not load gallery backgrounds for social slides:', error);
    return [];
  }
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
  const downloadsOutput = document.getElementById('downloads-output') as HTMLDivElement | null;

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
  if (!downloadBtn || !downloadAllBtn || !prevBtn || !nextBtn || !slideCounter || !slideDots || !downloadsOutput || !badgeEl || !kickerEl || !titleEl || !dateEl || !timeEl || !venueEl || !pointsEl || !ctaEl || !photoEl || !artboard) {
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
    artboard.classList.remove(...themeClassNames);
    artboard.classList.add(`social-agm-theme-${slide.theme}`);

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
      downloadsOutput.innerHTML = '';
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
    setExportMessage(downloadsOutput, 'Preparing your slide export...');

    try {
      const asset = await captureArtboard(artboard, buildFilename(currentSlideIndex));
      triggerAssetDownload(asset);
      renderDownloadLinks(downloadsOutput, [asset]);
    } catch (error) {
      console.error('Failed to export AGM artboard:', error);
      const reason = normalizeErrorMessage(error);
      setExportMessage(downloadsOutput, `Export failed: ${reason}`, 'error');
    } finally {
      setExportState(false, 'single');
    }
  });

  downloadAllBtn.addEventListener('click', async () => {
    setExportState(true, 'all');
    setExportMessage(downloadsOutput, 'Preparing all slides for export...');

    const savedIndex = currentSlideIndex;
    try {
      const exportedAssets: ExportedAsset[] = [];
      for (let i = 0; i < socialSlides.length; i++) {
        currentSlideIndex = i;
        renderSlide();
        // Allow layout to settle before capture
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const asset = await captureArtboard(artboard, buildFilename(i));
        exportedAssets.push(asset);
      }

      exportedAssets.forEach((asset) => triggerAssetDownload(asset));
      renderDownloadLinks(downloadsOutput, exportedAssets);
    } catch (error) {
      console.error('Failed to export all AGM slides:', error);
      const reason = normalizeErrorMessage(error);
      setExportMessage(downloadsOutput, `Bulk export failed: ${reason}`, 'error');
    } finally {
      currentSlideIndex = savedIndex;
      renderSlide();
      setExportState(false, 'all');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  void initSocialAgmPage();
});
