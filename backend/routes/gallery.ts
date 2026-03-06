import express from 'express';
import { db } from '../db';
import { authenticateToken, requireCommittee } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import { UPLOAD_BASE_DIR } from '../config';
import { diskUpload as upload } from '../utils/upload';

const router = express.Router();

const uploadDir = path.join(UPLOAD_BASE_DIR, 'gallery');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}


/**
 * Fetch all gallery images.
 * Can optionally filter by the featured flag and fetch them ordered by featuredOrder.
 *
 * @name GET/
 * @function
 * @memberof module:routers/gallery
 * @param {express.Request} req - The request object. Can contain a query parameter `featured`.
 * @param {express.Response} res - The response object.
 * @returns {void} Array of gallery image items.
 */
router.get('/', (req, res) => {
    const featuredOnly = req.query.featured === '1';
    const sql = featuredOnly
        ? 'SELECT * FROM gallery WHERE featured = 1 ORDER BY CASE WHEN featuredOrder IS NULL THEN 1 ELSE 0 END, featuredOrder ASC, uploadedAt DESC'
        : 'SELECT * FROM gallery ORDER BY uploadedAt DESC';
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows || []);
    });
});

/**
 * Upload a new gallery image (Committee Only).
 * Accepts batch uploads, enforcing size limits and optimizing images using Sharp before saving.
 *
 * @name POST/
 * @function
 * @memberof module:routers/gallery
 * @param {express.Request} req - The incoming multipart/form-data request containing photos and optional captions.
 * @param {express.Response} res - The response object.
 * @returns {void} JSON object containing details of the uploaded images.
 */
router.post('/', authenticateToken, requireCommittee, (req: any, res) => {

    // Enforce a maximum total batch size for the request to avoid excessive disk/CPU usage.
    // This is in addition to the per-file 50MB limit enforced by Multer above.
    const contentLengthHeader = req.headers['content-length'];
    const MAX_BATCH_BYTES = 50 * 1024 * 1024 * 5; // 250MB total for all files in this request
    if (typeof contentLengthHeader === 'string') {
        const totalBytes = parseInt(contentLengthHeader, 10);
        if (!Number.isNaN(totalBytes) && totalBytes > MAX_BATCH_BYTES) {
            return res.status(413).json({ error: 'Total upload size exceeds the 250MB limit for gallery uploads.' });
        }
    }
    upload.array('photos', 50)(req, res, async (uploadErr: any) => {
        if (uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'One or more photos are too large. Max size is 50MB per file.' });
        }
        if (uploadErr) {
            return res.status(400).json({ error: uploadErr.message || 'Invalid image upload.' });
        }

        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        try {
            const uploadedImages = [];
            const captionsInput = req.body.caption;
            const captions = Array.isArray(captionsInput) ? captionsInput : (captionsInput ? [captionsInput] : []);
            const uploaderId = req.user.id;

            let fileIndex = 0;

            for (const file of files) {
                const caption = captions[fileIndex] || '';
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const filename = 'gallery-' + uniqueSuffix + '.webp';
                const filepath = `/uploads/gallery/${filename}`;
                const fullPath = path.join(UPLOAD_BASE_DIR, 'gallery', filename);

                // Process image with sharp from the temporary file
                await sharp(file.path)
                    .resize(1920, 1920, {
                        fit: sharp.fit.inside,
                        withoutEnlargement: true
                    })
                    .webp({ quality: 90 })
                    .toFile(fullPath);

                // Remove the temporary file
                try {
                    fs.unlinkSync(file.path);
                } catch (e) {
                    console.error('Failed to cleanup temp file:', e);
                }

                const id = 'gal_' + crypto.randomUUID();

                await new Promise<void>((resolve, reject) => {
                    db.run(
                        'INSERT INTO gallery (id, filename, filepath, caption, uploadedBy) VALUES (?, ?, ?, ?, ?)',
                        [id, filename, filepath, caption, uploaderId],
                        function (err) {
                            if (err) return reject(err);
                            resolve();
                        }
                    );
                });

                uploadedImages.push({ id, filename, filepath, caption });
                fileIndex++;
            }

            res.json({ success: true, uploaded: uploadedImages });
        } catch (error: any) {
            console.error('Sharp processing error:', error);
            if (files && Array.isArray(files)) {
                void Promise.allSettled(
                    files
                        .filter((file): file is Express.Multer.File => !!(file && file.path))
                        .map(file => fs.promises.unlink(file.path).catch(cleanupErr => {
                            if ((cleanupErr as NodeJS.ErrnoException).code !== 'ENOENT') {
                                console.error('Failed to clean up temp upload file:', cleanupErr);
                            }
                        }))
                );
            }
            res.status(500).json({ error: 'Failed to process images' });
        }
    });
});

/**
 * Delete an image (Committee Only).
 * Removes the image file from the disk and deletes the corresponding database record.
 *
 * @name DELETE/:id
 * @function
 * @memberof module:routers/gallery
 * @param {express.Request} req - The incoming request containing the image ID as a URL parameter.
 * @param {express.Response} res - The response object.
 * @returns {void} Success status or an error if the item is not found.
 */
router.delete('/:id', authenticateToken, requireCommittee, (req: any, res) => {

    const { id } = req.params;

    db.get('SELECT filepath FROM gallery WHERE id = ?', [id], (err, row: any) => {
        if (err || !row) return res.status(404).json({ error: 'Image not found' });

        const fullPath = path.join(UPLOAD_BASE_DIR, row.filepath.replace(/^\/uploads\//, ''));
        if (fs.existsSync(fullPath)) {
            try {
                fs.unlinkSync(fullPath);
            } catch (e) {
                console.error('Failed to delete file:', e);
            }
        }

        db.run('DELETE FROM gallery WHERE id = ?', [id], (deleteErr) => {
            if (deleteErr) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true });
        });
    });
});

/**
 * Update caption and/or featured status (Committee Only).
 * Dynamically constructs a query to mutate only the fields provided in the request body, including image crop offsets.
 *
 * @name PUT/:id
 * @function
 * @memberof module:routers/gallery
 * @param {express.Request} req - The incoming request with the image ID and fields to update.
 * @param {express.Response} res - The response object.
 * @returns {void} Success response or a validation error.
 */
router.put('/:id', authenticateToken, requireCommittee, (req: any, res) => {

    const { id } = req.params;
    const {
        caption,
        featured,
        featuredOrder,
        heroDesktopX,
        heroDesktopY,
        heroDesktopZoom,
        heroMobileX,
        heroMobileY,
        heroMobileZoom,
        galleryLandscapeX,
        galleryLandscapeY,
        galleryLandscapeZoom
    } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    const toCropValue = (value: any) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
        return parsed;
    };
    const toZoomValue = (value: any) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 3) return null;
        return parsed;
    };

    if (caption !== undefined) {
        updates.push('caption = ?');
        params.push(caption || '');
    }
    if (featured !== undefined) {
        updates.push('featured = ?');
        params.push(featured ? 1 : 0);

        if (!featured) {
            updates.push('featuredOrder = NULL');
        }
    }

    if (featuredOrder !== undefined) {
        if (featuredOrder === null || featuredOrder === '') {
            updates.push('featuredOrder = NULL');
        } else {
            const parsed = Number(featuredOrder);
            if (!Number.isFinite(parsed) || parsed < 1) {
                return res.status(400).json({ error: 'Invalid featuredOrder (must be >= 1 or null)' });
            }
            updates.push('featuredOrder = ?');
            params.push(Math.floor(parsed));
        }
    }

    if (heroDesktopX !== undefined) {
        const value = toCropValue(heroDesktopX);
        if (value === null) return res.status(400).json({ error: 'Invalid heroDesktopX (must be 0-100)' });
        updates.push('heroDesktopX = ?');
        params.push(value);
    }
    if (heroDesktopY !== undefined) {
        const value = toCropValue(heroDesktopY);
        if (value === null) return res.status(400).json({ error: 'Invalid heroDesktopY (must be 0-100)' });
        updates.push('heroDesktopY = ?');
        params.push(value);
    }
    if (heroDesktopZoom !== undefined) {
        const value = toZoomValue(heroDesktopZoom);
        if (value === null) return res.status(400).json({ error: 'Invalid heroDesktopZoom (must be 1-3)' });
        updates.push('heroDesktopZoom = ?');
        params.push(value);
    }
    if (heroMobileX !== undefined) {
        const value = toCropValue(heroMobileX);
        if (value === null) return res.status(400).json({ error: 'Invalid heroMobileX (must be 0-100)' });
        updates.push('heroMobileX = ?');
        params.push(value);
    }
    if (heroMobileY !== undefined) {
        const value = toCropValue(heroMobileY);
        if (value === null) return res.status(400).json({ error: 'Invalid heroMobileY (must be 0-100)' });
        updates.push('heroMobileY = ?');
        params.push(value);
    }
    if (heroMobileZoom !== undefined) {
        const value = toZoomValue(heroMobileZoom);
        if (value === null) return res.status(400).json({ error: 'Invalid heroMobileZoom (must be 1-3)' });
        updates.push('heroMobileZoom = ?');
        params.push(value);
    }
    if (galleryLandscapeX !== undefined) {
        const value = toCropValue(galleryLandscapeX);
        if (value === null) return res.status(400).json({ error: 'Invalid galleryLandscapeX (must be 0-100)' });
        updates.push('galleryLandscapeX = ?');
        params.push(value);
    }
    if (galleryLandscapeY !== undefined) {
        const value = toCropValue(galleryLandscapeY);
        if (value === null) return res.status(400).json({ error: 'Invalid galleryLandscapeY (must be 0-100)' });
        updates.push('galleryLandscapeY = ?');
        params.push(value);
    }
    if (galleryLandscapeZoom !== undefined) {
        const value = toZoomValue(galleryLandscapeZoom);
        if (value === null) return res.status(400).json({ error: 'Invalid galleryLandscapeZoom (must be 1-3)' });
        updates.push('galleryLandscapeZoom = ?');
        params.push(value);
    }

    if (updates.length === 0) {
        const hasRequestBodyKeys = req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0;
        if (hasRequestBodyKeys) {
            return res.status(400).json({ error: 'Nothing to update' });
        }
        updates.push('caption = ?');
        params.push('');
    }

    const executeUpdate = () => {
        params.push(id);
        db.run(`UPDATE gallery SET ${updates.join(', ')} WHERE id = ?`, params, function (err) {
            if (err) {
                console.error('Gallery PUT db.run error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ success: true });
        });
    };

    const shouldAutoAssignFeaturedOrder = featured === true && featuredOrder === undefined;
    if (shouldAutoAssignFeaturedOrder) {
        db.get('SELECT COALESCE(MAX(featuredOrder), 0) + 1 AS nextOrder FROM gallery WHERE featured = 1 AND id != ?', [id], (orderErr, row: any) => {
            if (orderErr) {
                console.error('Gallery PUT featuredOrder query error:', orderErr);
                return res.status(500).json({ error: 'Database error' });
            }
            updates.push('featuredOrder = ?');
            params.push(row?.nextOrder || 1);
            executeUpdate();
        });
        return;
    }

    executeUpdate();
});

export default router;
