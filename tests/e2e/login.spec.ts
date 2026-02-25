import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test('should register and then login successfully', async ({ page }) => {
        // Go to login page
        await page.goto('/login.html');

        // Switch to register form
        await page.click('#toggle-register');

        // Fill registration details
        await page.fill('#reg-fname', 'Playwright');
        await page.fill('#reg-sname', 'Tester');
        await page.fill('#reg-email', `test_${Date.now()}@sheffield.ac.uk`);
        await page.fill('#reg-regnum', '123456789');
        await page.fill('#reg-password', 'Password123!');

        // Submit registration
        await page.click('#register-btn');

        // Should be redirected to dashboard
        await expect(page).toHaveURL(/.*dashboard.html/);
        await expect(page.locator('h1')).toContainText(/Welcome back/i);

        // Logout (common pattern, let's assume there's a logout button or we just clear storage)
        await page.evaluate(() => localStorage.clear());
        await page.goto('/login.html');

        // Now try logging in with the same email (we need to remember it, so let's use a fixed one for simplicity or capture it)
        const email = `login_test_${Date.now()}@sheffield.ac.uk`;

        await page.click('#toggle-register');
        await page.fill('#reg-fname', 'Login');
        await page.fill('#reg-sname', 'User');
        await page.fill('#reg-email', email);
        await page.fill('#reg-regnum', '987654321');
        await page.fill('#reg-password', 'LoginPass123!');
        await page.click('#register-btn');
        await expect(page).toHaveURL(/.*dashboard.html/);

        // Logout
        await page.evaluate(() => localStorage.clear());
        await page.goto('/login.html');

        // Login
        await page.fill('#login-email', email);
        await page.fill('#login-password', 'LoginPass123!');
        await page.click('#login-btn');

        // Should be back on dashboard
        await expect(page).toHaveURL(/.*dashboard.html/);
    });

    test('should show error on invalid login', async ({ page }) => {
        await page.goto('/login.html');
        await page.fill('#login-email', 'nonexistent@sheffield.ac.uk');
        await page.fill('#login-password', 'WrongPassword');
        await page.click('#login-btn');

        const error = page.locator('#login-error');
        await expect(error).toBeVisible();
        await expect(error).toContainText('Invalid email or password');
    });
});
