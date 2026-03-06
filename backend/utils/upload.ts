import multer from 'multer';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

/**
 * Multer file filter to permit only specific image formats.
 * Allows: jpeg, jpg, png, webp, heic, heif.
 *
 * @param {any} req - The Express request object.
 * @param {Express.Multer.File} file - The file being uploaded.
 * @param {multer.FileFilterCallback} cb - Multer callback to accept or deny the file.
 */
export const imageFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const filetypes = /jpeg|jpg|png|webp|heic|heif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
        return cb(null, true);
    }
    cb(new Error('Only images (jpeg, jpg, png, webp, heic, heif) are allowed!'));
};

/**
 * Multer configuration for memory uploads.
 * Restricts files to 5MB and enforces image file types.
 * Ideal for short-lived, transient files like immediate profile photo transcoding.
 */
export const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: imageFileFilter
});

const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
        cb(null, 'tmp-upload-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(file.originalname));
    }
});

/**
 * Multer configuration for disk-based temporary uploads.
 * Restricts files to 50MB and streams to OS temp directory.
 * Ideal for large or batch uploads (e.g., Gallery images) to avoid RAM exhaustion.
 */
export const diskUpload = multer({
    storage: diskStorage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for high-res photos
    fileFilter: imageFileFilter
});
