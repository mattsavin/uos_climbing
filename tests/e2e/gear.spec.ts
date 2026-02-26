import { test, expect } from '@playwright/test';

test.describe('Gear Hire Workflow', () => {
    test.beforeEach(async ({ page }) => {
        // Log in as admin — admin account is pre-verified so it bypasses email verification
        await page.goto('/login.html');
        await page.fill('#login-email', 'sheffieldclimbing@gmail.com');
        await page.fill('#login-password', 'SuperSecret123!');
        await page.click('#login-btn');
        await expect(page).toHaveURL(/.*dashboard.html/, { timeout: 10000 });
    });

    test('should allow user to request gear checkout', async ({ page }) => {
        await page.goto('/gear.html');

        const requestButton = page.locator('button:has-text("Request")').first();

        if (await requestButton.isVisible()) {
            await requestButton.click();
            const pendingText = page.locator('body').filter({ hasText: /Pending|Requested|Success/i }).first();
            await expect(pendingText).toBeVisible({ timeout: 5000 });
        } else {
            console.log('No gear available to request.');
        }
    });
});
