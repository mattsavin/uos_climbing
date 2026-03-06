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
