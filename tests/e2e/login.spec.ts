import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test('should login as admin successfully', async ({ page }) => {
        await page.goto('/login.html');

        await page.fill('#login-email', 'sheffieldclimbing@gmail.com');
        await page.fill('#login-password', 'SuperSecret123!');
        await page.click('#login-btn');

        // Should be redirected to dashboard
        await expect(page).toHaveURL(/.*dashboard.html/, { timeout: 10000 });
        await expect(page.locator('h1')).toContainText(/Welcome back/i);
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

    test('should redirect to dashboard after registration in test environment', async ({ page }) => {
        await page.goto('/login.html');

        await page.click('#toggle-register');
        await page.fill('#reg-fname', 'Playwright');
        await page.fill('#reg-sname', 'Tester');
        await page.fill('#reg-email', `e2e_${Date.now()}@sheffield.ac.uk`);
        await page.fill('#reg-regnum', '123456789');
        await page.fill('#reg-password', 'Password123!');
        await page.fill('#reg-password-confirm', 'Password123!');

        // Select membership type
        await page.check('input[name="membershipType"][value="basic"]');

        await page.click('#register-btn');

        // In test environment, email verification is bypassed, so it goes straight to dashboard
        await expect(page).toHaveURL(/.*dashboard.html/, { timeout: 10000 });
        await expect(page.locator('h1')).toContainText(/Welcome/i);
    });
});
