import { test, expect } from '@playwright/test';

const pagesToCheck = [
  '/',
  '/about.html',
  '/competitions.html',
  '/gallery.html',
  '/join.html',
  '/beginners.html',
  '/walls.html',
  '/faq.html',
  '/gear.html',
  '/login.html'
];

test.describe('Mobile Nav Across Pages', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const path of pagesToCheck) {
    test(`shows full primary nav on ${path}`, async ({ page }) => {
      await page.goto(path);

      const mobileMenuBtn = page.locator('#mobile-menu-btn-fallback');
      await expect(mobileMenuBtn).toBeVisible();
      await mobileMenuBtn.click();

      const mobileMenu = page.locator('#mobile-menu');
      await expect(mobileMenu).toBeVisible();

      await expect(mobileMenu.locator('a', { hasText: 'Home' }).first()).toBeVisible();
      await expect(mobileMenu.locator('a', { hasText: 'About' }).first()).toBeVisible();
      await expect(mobileMenu.locator('a', { hasText: 'Competitions' }).first()).toBeVisible();
      await expect(mobileMenu.locator('a', { hasText: 'Gallery' }).first()).toBeVisible();
      await expect(mobileMenu.locator('a', { hasText: 'Join Us' }).first()).toBeVisible();
    });
  }
});
