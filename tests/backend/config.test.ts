import { describe, it, expect, afterEach, vi } from 'vitest';

describe('backend/config environment validation', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = originalEnv;
        vi.resetModules();
    });

    it('refuses to boot when IS_BETA=true without BETA_ACCESS_SECRET', async () => {
        process.env.IS_BETA = 'true';
        delete process.env.BETA_ACCESS_SECRET;
        vi.resetModules();

        await expect(import('../../backend/config')).rejects.toThrow(/BETA_ACCESS_SECRET/);
    });

    it('boots cleanly when IS_BETA=true and BETA_ACCESS_SECRET is set', async () => {
        process.env.IS_BETA = 'true';
        process.env.BETA_ACCESS_SECRET = 'test-secret';
        vi.resetModules();

        const cfg = await import('../../backend/config');
        expect(cfg.SECRET_KEY).toBeDefined();
        expect(cfg.DEV_ROOT_PASSWORD).toBeDefined();
    });

    it('does not require BETA_ACCESS_SECRET when IS_BETA is off', async () => {
        process.env.IS_BETA = 'false';
        delete process.env.BETA_ACCESS_SECRET;
        vi.resetModules();

        await expect(import('../../backend/config')).resolves.toBeTruthy();
    });
});
