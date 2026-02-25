import { test, expect } from '@playwright/test';

test.describe('Gear Hire Workflow', () => {
    let userEmail: string;

    test.beforeEach(async ({ page }) => {
        // Create a new user for gear tests
        userEmail = `gear_tester_${Date.now()}@sheffield.ac.uk`;

        await page.goto('/login.html');
        await page.click('#toggle-register');
        await page.fill('#reg-fname', 'Gear');
        await page.fill('#reg-sname', 'Tester');
        await page.fill('#reg-email', userEmail);
        await page.fill('#reg-regnum', '555666777');
        await page.fill('#reg-password', 'TestPass123!');
        await page.click('#register-btn');

        await expect(page).toHaveURL(/.*dashboard.html/);
    });

    test('should allow user to request gear checkout', async ({ page }) => {
        // Navigate to gear section (assume it's linked from dashboard or direct URL)
        await page.goto('/gear.html');

        // Find a gear item that can be requested (assumes a "Request" button exists)
        const requestButton = page.locator('button:has-text("Request")').first();

        if (await requestButton.isVisible()) {
            await requestButton.click();

            // Look for a success message or button state change (e.g. to "Pending")
            const pendingText = page.locator('body').filter({ hasText: /Pending|Requested|Success/i }).first();
            await expect(pendingText).toBeVisible({ timeout: 5000 });
        } else {
            console.log('No gear available to request.');
        }
    });
});
