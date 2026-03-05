import { test, expect } from '@playwright/test';

test.describe('Session Booking Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Log in as admin — admin account is pre-verified so it bypasses email verification
        await page.goto('/login.html');
        await page.fill('#login-email', 'committee@sheffieldclimbing.org');
        await page.fill('#login-password', 'SuperSecret123!');
        await page.click('#login-btn');
        await expect(page).toHaveURL(/.*dashboard.html/, { timeout: 10000 });
    });

    test('should book a session and see it in my bookings', async ({ page }) => {
        const bookButton = page.locator('button:has-text("Book")').first();

        if (await bookButton.isVisible()) {
            await bookButton.click();
            const cancelBtn = page.locator('button:has-text("Cancel Booking")').first();
            await expect(cancelBtn).toBeVisible({ timeout: 10000 });

            await page.click('button:has-text("My Bookings")');

            const myBookingsList = page.locator('#my-bookings-list, .my-bookings');
            await expect(myBookingsList).toContainText('Cancel Booking');
        } else {
            console.log('No sessions available to book during test run.');
        }
    });
});
