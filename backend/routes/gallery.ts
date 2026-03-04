import express from 'express';
import { db } from '../db';
import { authenticateToken, requireCommittee } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';

const router = express.Router();

const uploadDir = path.join(process.cwd(), 'uploads/gallery');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Memory storage for multer so we can process it with sharp before saving
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for high-res photos
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp|heic|heif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype || extname) {
            return cb(null, true);
        }
        cb(new Error('Only images are allowed!'));
    }
});

// GET /api/gallery - Fetch all gallery images
router.get('/', (req, res) => {
    db.all('SELECT * FROM gallery ORDER BY uploadedAt DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows || []);
    });
});

// POST /api/gallery - Upload a new gallery image (Committee Only)
router.post('/', authenticateToken, requireCommittee, (req: any, res) => {

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
                const fullPath = path.join(process.cwd(), filepath);

                // Process image with sharp
                await sharp(file.buffer)
                    .resize(1920, 1920, {
                        fit: sharp.fit.inside,
                        withoutEnlargement: true
                    })
                    .webp({ quality: 90 })
                    .toFile(fullPath);

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
            res.status(500).json({ error: 'Failed to process images' });
        }
    });
});

// DELETE /api/gallery/:id - Delete an image (Committee Only)
router.delete('/:id', authenticateToken, requireCommittee, (req: any, res) => {

    const { id } = req.params;

    db.get('SELECT filepath FROM gallery WHERE id = ?', [id], (err, row: any) => {
        if (err || !row) return res.status(404).json({ error: 'Image not found' });

        const fullPath = path.join(process.cwd(), row.filepath);
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

// PUT /api/gallery/:id - Update caption (Committee Only)
router.put('/:id', authenticateToken, requireCommittee, (req: any, res) => {

    const { id } = req.params;
    const { caption } = req.body;

    db.run('UPDATE gallery SET caption = ? WHERE id = ?', [caption || '', id], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

export default router;
