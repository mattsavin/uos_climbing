import { describe, it, expect } from 'vitest';
import sharp from 'sharp';

// Real (unmocked) sharp pipeline checks.
// gallery.test.ts and users.test.ts mock sharp to keep tests fast; these
// exercises prove the actual installed sharp version can run the exact
// transformations the production upload routes perform — which matters
// after major-version upgrades of sharp/libvips.

describe('sharp image pipelines used by upload routes', () => {
    it('gallery path: resize fit.inside + webp encode works', async () => {
        const source = await sharp({
            create: { width: 1600, height: 900, channels: 3, background: '#1e293b' }
        }).png().toBuffer();

        // Mirrors backend/routes/gallery.ts processing
        const out = await sharp(source)
            .resize(1080, null, { fit: sharp.fit.inside })
            .webp()
            .toBuffer();

        const meta = await sharp(out).metadata();
        expect(meta.format).toBe('webp');
        expect(meta.width).toBe(1080);
    });

    it('profile photo path: square cover-crop + webp works', async () => {
        const source = await sharp({
            create: { width: 1200, height: 1200, channels: 3, background: '#fdb913' }
        }).png().toBuffer();

        // Mirrors backend/routes/users.ts profile-photo transcoding
        const out = await sharp(source)
            .resize(500, 500, { fit: sharp.fit.cover })
            .webp()
            .toBuffer();

        const meta = await sharp(out).metadata();
        expect(meta.format).toBe('webp');
        expect(meta.width).toBe(500);
        expect(meta.height).toBe(500);
    });
});
