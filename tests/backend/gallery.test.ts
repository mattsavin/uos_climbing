import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../backend/server';
import { db } from '../../backend/db';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Mock sharp to avoid actual image processing in tests
vi.mock('sharp', () => {
    const sharpMock = vi.fn(() => ({
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toFile: vi.fn().mockResolvedValue({}),
    }));
    // We need to support sharp.fit.inside
    (sharpMock as any).fit = { inside: 'inside' };
    return { default: sharpMock };
});

describe('Gallery API', () => {
    let committeeToken: string;
    let userToken: string;

    beforeAll(async () => {
        // Wait for DB initialization
        await new Promise(resolve => setTimeout(resolve, 500));

        // Register and login as regular user
        const userRes = await request(app).post('/api/auth/register').send({
            firstName: 'Gallery', lastName: 'User', email: 'gallery_user@example.com',
            password: 'Password123!', passwordConfirm: 'Password123!', registrationNumber: 'G123'
        });
        const userCookie = (userRes.headers['set-cookie'] as any)?.find((c: string) => c.startsWith('uscc_token='));
        userToken = userCookie ? userCookie.split(';')[0].split('=')[1] : '';

        // Login as committee (root admin)
        const adminRes = await request(app).post('/api/auth/login').send({
            email: 'committee@sheffieldclimbing.org',
            password: 'SuperSecret123!'
        });
        const adminCookie = (adminRes.headers['set-cookie'] as any)?.find((c: string) => c.startsWith('uscc_token='));
        committeeToken = adminCookie ? adminCookie.split(';')[0].split('=')[1] : '';

        // Clear gallery table
        await new Promise<void>((resolve, reject) => {
            db.run('DELETE FROM gallery', (err) => err ? reject(err) : resolve());
        });
    });

    afterAll(async () => {
        await new Promise<void>((resolve, reject) => {
            db.run('DELETE FROM gallery', (err) => err ? reject(err) : resolve());
        });
        db.close();
        vi.restoreAllMocks();
    });

    const mockImageBuffer = Buffer.from('mock image payload');

    describe('GET /api/gallery', () => {
        it('should return empty gallery initially', async () => {
            const res = await request(app).get('/api/gallery');
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        it('should handle database errors on GET', async () => {
            const spy = vi.spyOn(db, 'all').mockImplementationOnce((query, params, cb) => cb(new Error('DB error'), null));
            const res = await request(app).get('/api/gallery');
            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Database error');
            spy.mockRestore();
        });
    });

    describe('POST /api/gallery', () => {
        it('should require authentication', async () => {
            const res = await request(app).post('/api/gallery');
            expect(res.status).toBe(401);
        });

        it('should require committee privileges', async () => {
            const res = await request(app).post('/api/gallery').set('Authorization', `Bearer ${userToken}`);
            expect(res.status).toBe(403);
        });

        it('should fail if no files are uploaded', async () => {
            const res = await request(app).post('/api/gallery').set('Authorization', `Bearer ${committeeToken}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('No files uploaded');
        });

        it('should handle invalid file types', async () => {
            const res = await request(app)
                .post('/api/gallery')
                .set('Authorization', `Bearer ${committeeToken}`)
                .attach('photos', mockImageBuffer, 'test.txt');

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Only images are allowed!');
        });

        it('should successfully upload a single image with a caption', async () => {
            const res = await request(app)
                .post('/api/gallery')
                .set('Authorization', `Bearer ${committeeToken}`)
                .field('caption', 'A beautiful climb')
                .attach('photos', mockImageBuffer, 'test.jpg');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.uploaded).toHaveLength(1);
            expect(res.body.uploaded[0].caption).toBe('A beautiful climb');
        });

        it('should successfully upload multiple images with multiple captions', async () => {
            const res = await request(app)
                .post('/api/gallery')
                .set('Authorization', `Bearer ${committeeToken}`)
                .field('caption', 'First caption')
                .field('caption', 'Second caption')
                .attach('photos', mockImageBuffer, 'test1.jpg')
                .attach('photos', mockImageBuffer, 'test2.png');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.uploaded).toHaveLength(2);
            expect(res.body.uploaded[0].caption).toBe('First caption');
            expect(res.body.uploaded[1].caption).toBe('Second caption');
        });

        it('should successfully upload multiple images without captions', async () => {
            const res = await request(app)
                .post('/api/gallery')
                .set('Authorization', `Bearer ${committeeToken}`)
                .attach('photos', mockImageBuffer, 'test1.jpg')
                .attach('photos', mockImageBuffer, 'test2.png');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.uploaded).toHaveLength(2);
            expect(res.body.uploaded[0].caption).toBe('');
        });

        it('should handle sharp processing errors', async () => {
            const sharpImport = (await import('sharp')).default as any;
            sharpImport.mockReturnValueOnce({
                resize: vi.fn().mockReturnThis(),
                webp: vi.fn().mockReturnThis(),
                toFile: vi.fn().mockRejectedValue(new Error('Fail')),
            });

            const res = await request(app)
                .post('/api/gallery')
                .set('Authorization', `Bearer ${committeeToken}`)
                .attach('photos', mockImageBuffer, 'test.jpg');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to process images');
        });

        it('should handle db insert error', async () => {
            const spy = vi.spyOn(db, 'run').mockImplementationOnce((query, params, cb) => cb.call({}, new Error('DB Error')));

            const res = await request(app)
                .post('/api/gallery')
                .set('Authorization', `Bearer ${committeeToken}`)
                .attach('photos', mockImageBuffer, 'test.jpg');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to process images'); // caught by catch block
            spy.mockRestore();
        });
    });

    describe('PUT /api/gallery/:id', () => {
        let imageId: string;

        beforeAll(async () => {
            const res = await request(app)
                .post('/api/gallery')
                .set('Authorization', `Bearer ${committeeToken}`)
                .field('caption', 'Old caption')
                .attach('photos', mockImageBuffer, 'update.jpg');
            imageId = res.body.uploaded[0].id;
        });

        it('should update the caption', async () => {
            const res = await request(app)
                .put(`/api/gallery/${imageId}`)
                .set('Authorization', `Bearer ${committeeToken}`)
                .send({ caption: 'Updated caption' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify in GET
            const getRes = await request(app).get('/api/gallery');
            const item = getRes.body.find((img: any) => img.id === imageId);
            expect(item.caption).toBe('Updated caption');
        });

        it('should clear the caption if not provided', async () => {
            const res = await request(app)
                .put(`/api/gallery/${imageId}`)
                .set('Authorization', `Bearer ${committeeToken}`)
                .send({});

            expect(res.status).toBe(200);
        });

        it('should handle db update error', async () => {
            const spy = vi.spyOn(db, 'run').mockImplementationOnce((query, params, cb) => cb.call({}, new Error('DB error')));
            const res = await request(app)
                .put(`/api/gallery/${imageId}`)
                .set('Authorization', `Bearer ${committeeToken}`)
                .send({ caption: 'New' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Database error');
            spy.mockRestore();
        });
    });

    describe('DELETE /api/gallery/:id', () => {
        let imageId: string;
        let filepath: string;

        beforeAll(async () => {
            const res = await request(app)
                .post('/api/gallery')
                .set('Authorization', `Bearer ${committeeToken}`)
                .attach('photos', mockImageBuffer, 'delete.jpg');
            imageId = res.body.uploaded[0].id;
            filepath = res.body.uploaded[0].filepath;
        });

        it('should return 404 for unknown image', async () => {
            const res = await request(app)
                .delete('/api/gallery/unknown_id')
                .set('Authorization', `Bearer ${committeeToken}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Image not found');
        });

        it('should return 404 on DB error getting image', async () => {
            const spy = vi.spyOn(db, 'get').mockImplementationOnce((query, params, cb) => cb(new Error('DB error'), null));
            const res = await request(app)
                .delete(`/api/gallery/${imageId}`)
                .set('Authorization', `Bearer ${committeeToken}`);
            expect(res.status).toBe(404);
            spy.mockRestore();
        });

        it('should handle fs deletion error gracefully and continue deleting from db', async () => {
            const testPath = path.join(process.cwd(), filepath);
            // mock existsSync to return true
            const spyExists = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
            const spyUnlink = vi.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => {
                throw new Error('FS unlink error');
            });

            const res = await request(app)
                .delete(`/api/gallery/${imageId}`)
                .set('Authorization', `Bearer ${committeeToken}`);

            expect(res.status).toBe(200); // Because it catches fs.unlinkSync
            spyExists.mockRestore();
            spyUnlink.mockRestore();
        });

        it('should successfully delete an image', async () => {
            // Re-upload to delete successfully
            const upRes = await request(app)
                .post('/api/gallery')
                .set('Authorization', `Bearer ${committeeToken}`)
                .attach('photos', mockImageBuffer, 'delete2.jpg');
            const newId = upRes.body.uploaded[0].id;
            const newPath = upRes.body.uploaded[0].filepath;

            // Mock FS to prevent actual deletion errors if file doesn't exist
            const spyExists = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
            const spyUnlink = vi.spyOn(fs, 'unlinkSync').mockImplementationOnce(() => { });

            const res = await request(app)
                .delete(`/api/gallery/${newId}`)
                .set('Authorization', `Bearer ${committeeToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            spyExists.mockRestore();
            spyUnlink.mockRestore();
        });

        it('should handle db delete error', async () => {
            const upRes = await request(app)
                .post('/api/gallery')
                .set('Authorization', `Bearer ${committeeToken}`)
                .attach('photos', mockImageBuffer, 'delete3.jpg');
            const newId = upRes.body.uploaded[0].id;

            const spyExists = vi.spyOn(fs, 'existsSync').mockReturnValue(false); // skip fs delete
            const spyRun = vi.spyOn(db, 'run').mockImplementationOnce((query, params, cb) => cb.call({}, new Error('DB err')));

            const res = await request(app)
                .delete(`/api/gallery/${newId}`)
                .set('Authorization', `Bearer ${committeeToken}`);

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Database error');
            spyExists.mockRestore();
            spyRun.mockRestore();
        });
    });
});
