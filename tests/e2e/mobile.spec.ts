import { test, expect } from '@playwright/test';

test.describe('Mobile Viewport Experiences', () => {
    test.use({ viewport: { width: 390, height: 844 } }); // iPhone 12 Pro dimensions

    test('should display mobile hamburger menu and toggle navigation', async ({ page }) => {
        // Go to home page
        await page.goto('/');

        // Desktop nav links should not be visible
        const desktopNavHome = page.locator('.hidden.md\\:flex .nav-link').first();
        await expect(desktopNavHome).not.toBeVisible();

        // Mobile menu button should be visible
        const mobileMenuBtn = page.locator('#mobile-menu-btn-fallback');
        await expect(mobileMenuBtn).toBeVisible();

        // The mobile menu dropdown should initially be hidden
        const mobileMenu = page.locator('#mobile-menu');
        await expect(mobileMenu).not.toBeVisible();

        // Click the hamburger menu
        await mobileMenuBtn.click();

        // The mobile menu dropdown should now be visible (not hidden)
        await expect(mobileMenu).toBeVisible();

        // Check if a link exists in the mobile menu and is visible
        const mobileHomeLink = mobileMenu.locator('a', { hasText: 'Home' }).first();
        await expect(mobileHomeLink).toBeVisible();

        // Click the hamburger menu again to close it
        await mobileMenuBtn.click();

        // The mobile menu dropdown should be hidden again
        await expect(mobileMenu).not.toBeVisible();
    });
});
