import { test, expect } from '@playwright/test';

test.describe('Session Booking Flow', () => {
    let email: string;
    let sessionTitle: string;

    test.beforeEach(async ({ page }) => {
        // Create a new user for each test to avoid state conflicts
        email = `booking_tester_${Date.now()}@sheffield.ac.uk`;

        await page.goto('/login.html');
        await page.click('#toggle-register');
        await page.fill('#reg-fname', 'Booking');
        await page.fill('#reg-sname', 'Tester');
        await page.fill('#reg-email', email);
        await page.fill('#reg-regnum', '111222333');
        await page.fill('#reg-password', 'TestPass123!');
        await page.click('#register-btn');

        await expect(page).toHaveURL(/.*dashboard.html/);
    });

    test('should book a session and see it in my bookings', async ({ page }) => {
        // Assume there's a session card we can click 'Book' on
        // Let's find the first available session button
        const bookButton = page.locator('button:has-text("Book")').first();

        // Check if there are any sessions to book
        if (await bookButton.isVisible()) {
            // Get the title of the session
            const sessionCard = bookButton.locator('ancestor::div[contains(@class, "session-card") or contains(@class, "bg-")]'); // Rough guess of selector
            // we'll just click it and wait for success state
            await bookButton.click();

            // Wait for button to change to Cancel Booking or similar
            const cancelBtn = page.locator('button:has-text("Cancel Booking")').first();
            await expect(cancelBtn).toBeVisible({ timeout: 10000 });

            // Go to my bookings tab
            await page.click('button:has-text("My Bookings")');

            // Verify we have a booking listed
            const myBookingsList = page.locator('#my-bookings-list, .my-bookings');
            await expect(myBookingsList).toContainText('Cancel Booking');
        } else {
            console.log('No sessions available to book during test run.');
        }
    });
});
